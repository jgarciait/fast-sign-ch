"use server"

import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { PDFDocument } from 'pdf-lib'
import { normalizeFileName, generateFilePath } from '@/utils/file-utils'

interface MergeFromStorageRequest {
  filePaths: string[]
  fileName: string
  sessionId: string
}

interface MergeResult {
  success: boolean
  documentId?: string
  documentUrl?: string
  fileSize?: number
  totalPages?: number
  error?: string
}

export async function mergePdfFromStorage(request: MergeFromStorageRequest): Promise<MergeResult> {
  try {
    console.log('Starting PDF merge from storage paths:', request.filePaths)
    console.log('Request details:', { 
      pathsCount: request.filePaths.length, 
      fileName: request.fileName, 
      sessionId: request.sessionId 
    })
    
    // Get current user
    console.log('Creating Supabase client...')
    const supabase = await createClient()
    console.log('Supabase client created, getting user...')
    
    let user, userError
    try {
      const authResult = await supabase.auth.getUser()
      user = authResult.data?.user
      userError = authResult.error
      console.log('User result:', { userId: user?.id, email: user?.email, hasError: !!userError, errorMsg: userError?.message })
    } catch (authException) {
      console.error('Auth exception:', authException)
      return { success: false, error: 'Error de autenticación: ' + (authException instanceof Error ? authException.message : 'Unknown error') }
    }
    
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado: ' + (userError?.message || 'No user found') }
    }
    
    // Use admin client to read from storage
    const adminSupabase = createAdminClient()
    
    // Download all files from storage
    const pdfDocuments: PDFDocument[] = []
    let totalPages = 0
    
    for (const filePath of request.filePaths) {
      console.log(`Downloading file from storage: ${filePath}`)
      
      const { data: fileData, error: downloadError } = await adminSupabase.storage
        .from('documents')
        .download(filePath)
      
      if (downloadError) {
        console.error(`Error downloading file ${filePath}:`, downloadError)
        // Clean up any temp files before returning error
        await cleanupTempFiles(adminSupabase, request.sessionId)
        return { success: false, error: `Error downloading file: ${downloadError.message}` }
      }
      
      // Convert blob to array buffer
      const arrayBuffer = await fileData.arrayBuffer()
      
      // Load PDF document
      const pdfDoc = await PDFDocument.load(arrayBuffer)
      pdfDocuments.push(pdfDoc)
      totalPages += pdfDoc.getPageCount()
      
      console.log(`Loaded PDF: ${pdfDoc.getPageCount()} pages`)
    }
    
    console.log(`Total pages to merge: ${totalPages}`)
    
    // Create merged PDF
    const mergedPdf = await PDFDocument.create()
    
    // Copy pages from all documents
    for (const pdfDoc of pdfDocuments) {
      const pageIndices = Array.from({ length: pdfDoc.getPageCount() }, (_, i) => i)
      const copiedPages = await mergedPdf.copyPages(pdfDoc, pageIndices)
      copiedPages.forEach(page => mergedPdf.addPage(page))
    }
    
    // Generate final PDF bytes
    const pdfBytes = await mergedPdf.save()
    const fileSize = pdfBytes.length
    
    console.log(`Merged PDF created: ${(fileSize / 1024 / 1024).toFixed(2)} MB, ${totalPages} pages`)
    
    // Normalize file name and generate path
    const normalizedFileName = normalizeFileName(request.fileName)
    const filePath = generateFilePath(normalizedFileName, user.id)
    
    // Upload merged PDF to storage
    const { data: uploadData, error: uploadError } = await adminSupabase.storage
      .from('public-documents')
      .upload(filePath, pdfBytes, {
        contentType: 'application/pdf',
        cacheControl: '3600'
      })
    
    if (uploadError) {
      console.error('Error uploading merged PDF:', uploadError)
      await cleanupTempFiles(adminSupabase, request.sessionId)
      return { success: false, error: `Error uploading merged document: ${uploadError.message}` }
    }
    
    console.log('Merged PDF uploaded successfully:', uploadData.path)
    
    // Insert document record into database using correct schema
    const { data: documentData, error: dbError } = await supabase
      .from('documents')
      .insert({
        file_name: normalizedFileName,
        file_path: uploadData.path,
        file_size: fileSize,
        file_type: 'application/pdf',
        created_by: user.id,
        archived: false,
        document_type: 'merged_pdf',
        status: 'ready',
        files_metadata: {
          pages: totalPages,
          original_files_count: request.filePaths.length,
          merge_session_id: request.sessionId,
          created_via: 'pdf_merge_v2',
          size_mb: (fileSize / 1024 / 1024).toFixed(2),
          merged_from_files: request.filePaths.length,
          processing_method: 'tus_upload_server_merge'
        }
      })
      .select()
      .single()
    
    if (dbError) {
      console.error('Error inserting document record:', dbError)
      // Clean up uploaded file
      await adminSupabase.storage.from('public-documents').remove([uploadData.path])
      await cleanupTempFiles(adminSupabase, request.sessionId)
      return { success: false, error: `Error saving document record: ${dbError.message}` }
    }
    
    // Clean up temporary files
    await cleanupTempFiles(adminSupabase, request.sessionId)
    
    // Generate public URL for the merged document
    const { data: urlData } = adminSupabase.storage
      .from('public-documents')
      .getPublicUrl(uploadData.path)
    
    console.log('PDF merge completed successfully')
    
    return {
      success: true,
      documentId: documentData.id,
      documentUrl: urlData.publicUrl,
      fileSize,
      totalPages
    }
    
  } catch (error) {
    console.error('Error in mergePdfFromStorage:', error)
    
    // Try to clean up temp files even on error
    try {
      const adminSupabase = createAdminClient()
      await cleanupTempFiles(adminSupabase, request.sessionId)
    } catch (cleanupError) {
      console.error('Error during cleanup:', cleanupError)
    }
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error merging documents' 
    }
  }
}

async function cleanupTempFiles(adminSupabase: any, sessionId: string): Promise<void> {
  try {
    console.log(`Cleaning up temp files for session: ${sessionId}`)
    
    const { data: files, error: listError } = await adminSupabase.storage
      .from('documents')
      .list(`temp-merge/${sessionId}`)
    
    if (listError) {
      console.error('Error listing temp files:', listError)
      return
    }
    
    if (!files || files.length === 0) {
      console.log('No temp files to clean up')
      return
    }
    
    const filePaths = files.map((file: any) => `temp-merge/${sessionId}/${file.name}`)
    
    const { error: deleteError } = await adminSupabase.storage
      .from('documents')
      .remove(filePaths)
    
    if (deleteError) {
      console.error('Error deleting temp files:', deleteError)
    } else {
      console.log(`Successfully cleaned up ${filePaths.length} temp files`)
    }
    
  } catch (error) {
    console.error('Cleanup error:', error)
  }
}
