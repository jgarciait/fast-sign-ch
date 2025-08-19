'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { BUCKET_PUBLIC } from '@/utils/supabase/storage'
import { PDFDocument, degrees } from 'pdf-lib'
import { randomUUID } from 'crypto'

export interface PageRotationData {
  pageNumber: number
  rotation: number // 0, 90, 180, 270
}

export async function uploadAndPreviewDocument(formData: FormData) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const file = formData.get('file') as File

    if (!file || !file.type.includes('pdf')) {
      return { success: false, error: 'Archivo PDF requerido' }
    }

    // Check file size limit (50MB)
    const maxSizeInBytes = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSizeInBytes) {
      const sizeInMB = (file.size / (1024 * 1024)).toFixed(1)
      return { 
        success: false, 
        error: `Archivo demasiado grande (${sizeInMB} MB). Máximo permitido: 50 MB` 
      }
    }

    // Read the PDF to get page count
    const arrayBuffer = await file.arrayBuffer()
    const pdfDoc = await PDFDocument.load(arrayBuffer)
    const pageCount = pdfDoc.getPageCount()
    
    // Create a temporary file identifier
    const tempId = randomUUID()
    
    // Convert file to base64 for temporary storage in session/memory
    const base64Data = Buffer.from(arrayBuffer).toString('base64')
    const dataUrl = `data:application/pdf;base64,${base64Data}`

    return {
      success: true,
      documentUrl: dataUrl, // Return data URL instead of storage URL
      pageCount,
      tempId,
      fileData: base64Data // Store base64 data for later processing
    }
  } catch (error) {
    console.error('Error in uploadAndPreviewDocument:', error)
    return { success: false, error: 'Error al procesar el documento' }
  }
}

export async function rotateDocumentPages(
  tempId: string,
  fileData: string, // Base64 data instead of fileName
  pageRotations: PageRotationData[]
) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    console.log('Starting rotation process for tempId:', tempId)
    console.log('Page rotations:', pageRotations)

    // Check base64 data size to avoid memory issues
    const estimatedSizeInMB = (fileData.length * 0.75) / (1024 * 1024) // base64 is ~33% larger
    console.log(`Estimated PDF size: ${estimatedSizeInMB.toFixed(2)} MB`)
    
    if (estimatedSizeInMB > 50) {
      return { 
        success: false, 
        error: `Documento demasiado grande (${estimatedSizeInMB.toFixed(1)} MB). Máximo: 50 MB` 
      }
    }

    // Convert base64 back to array buffer
    let arrayBuffer: Buffer
    try {
      arrayBuffer = Buffer.from(fileData, 'base64')
      console.log('Converted base64 to buffer, size:', arrayBuffer.byteLength)
    } catch (conversionError) {
      console.error('Error converting base64 to buffer:', conversionError)
      return { success: false, error: 'Error al procesar el documento. Archivo demasiado grande.' }
    }
    
    // Load PDF document
    const pdfDoc = await PDFDocument.load(arrayBuffer)
    console.log('PDF loaded successfully, pages:', pdfDoc.getPageCount())
    
    // Apply rotations to specific pages
    for (const pageRotation of pageRotations) {
      if (pageRotation.rotation !== 0) {
        console.log(`Applying rotation ${pageRotation.rotation}° to page ${pageRotation.pageNumber} (total pages: ${pdfDoc.getPageCount()})`)
        
        if (pageRotation.pageNumber < 1 || pageRotation.pageNumber > pdfDoc.getPageCount()) {
          console.error(`Invalid page number ${pageRotation.pageNumber} for document with ${pdfDoc.getPageCount()} pages`)
          continue
        }
        
        const page = pdfDoc.getPage(pageRotation.pageNumber - 1) // 0-indexed
        
        // Get current rotation of the page
        const currentRotation = page.getRotation().angle
        console.log(`Page ${pageRotation.pageNumber} current rotation: ${currentRotation}°`)
        
        // Get the page's MediaBox and current rotation to understand its state
        const mediaBox = page.getMediaBox()
        const pageWidth = mediaBox.width
        const pageHeight = mediaBox.height
        console.log(`Page ${pageRotation.pageNumber} dimensions: ${pageWidth}x${pageHeight}, current rotation: ${currentRotation}°`)
        
        // Simple approach: set the absolute rotation directly
        // The pageRotation.rotation represents the total rotation we want, not an increment
        const targetRotation = pageRotation.rotation % 360
        
        // Apply the rotation directly
        page.setRotation(degrees(targetRotation))
        
        // Verify the rotation was applied
        const finalRotation = page.getRotation().angle
        console.log(`Page ${pageRotation.pageNumber} rotation set to: ${targetRotation}° (actual: ${finalRotation}°)`)
      }
    }

    // Save the modified PDF
    const modifiedPdfBytes = await pdfDoc.save()
    console.log('PDF modified and saved, new size:', modifiedPdfBytes.length)
    
    // Create final filename with structured path
    const timestamp = Date.now()
    const finalFileName = `rotated-${tempId}-${timestamp}.pdf`
    const filePath = `uploads/${user.id}/${finalFileName}`
    
    console.log('Uploading to bucket:', BUCKET_PUBLIC)
    console.log('File path:', filePath)
    
    // Upload to public-documents bucket using admin client (bypasses RLS)
    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from(BUCKET_PUBLIC)
      .upload(filePath, modifiedPdfBytes, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: true
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      
      // Return the rotated PDF as data URL if upload fails
      const base64Data = Buffer.from(modifiedPdfBytes).toString('base64')
      const dataUrl = `data:application/pdf;base64,${base64Data}`
      
      return {
        success: true,
        documentUrl: dataUrl,
        documentName: finalFileName,
        fileData: base64Data,
        isDataUrl: true,
        error: 'No se pudo subir al storage, se devuelve como data URL'
      }
    }

    // Get the public URL for the rotated document
    const { data: { publicUrl } } = adminClient.storage
      .from(BUCKET_PUBLIC)
      .getPublicUrl(filePath)

    console.log('Upload successful, public URL:', publicUrl)

    // Create document record in database
    const { data: documentRecord, error: dbError } = await supabase
      .from('documents')
      .insert({
        user_id: user.id,
        file_name: finalFileName,
        file_path: filePath,
        file_url: publicUrl,
        subject: `Documento Rotado - ${finalFileName}`,
        message: 'Documento PDF con rotaciones aplicadas',
        recipient_email: user.email || 'no-reply@example.com',
        status: 'completed'
      })
      .select()
      .single()

    if (dbError) {
      console.warn('Could not create document record:', dbError)
      // Continue anyway, file is uploaded
    }

    return {
      success: true,
      documentUrl: publicUrl,
      documentName: finalFileName,
      documentPath: filePath,
      documentId: documentRecord?.id,
      fileData: Buffer.from(modifiedPdfBytes).toString('base64'),
      isDataUrl: false
    }
  } catch (error) {
    console.error('Error in rotateDocumentPages:', error)
    
    // If there's an error, try to return the original document
    try {
      const arrayBuffer = Buffer.from(fileData, 'base64')
      const base64Data = Buffer.from(arrayBuffer).toString('base64')
      const dataUrl = `data:application/pdf;base64,${base64Data}`
      
      return {
        success: false,
        error: 'Error al rotar el documento, se mantiene el original',
        documentUrl: dataUrl,
        documentName: `original-${tempId}.pdf`,
        fileData: base64Data,
        isDataUrl: true
      }
    } catch (fallbackError) {
      return { success: false, error: 'Error al rotar las páginas del documento' }
    }
  }
}

export async function cleanupTempDocument(fileName: string) {
  // No longer needed since we're using data URLs for preview
  // But keeping the function for compatibility
  return { success: true }
}

// Test function to verify rotation process
export async function testRotationProcess(tempId: string, fileData: string) {
  try {
    console.log('Testing rotation process...')
    console.log('TempId:', tempId)
    console.log('FileData length:', fileData?.length)
    
    // Test PDF loading
    const arrayBuffer = Buffer.from(fileData, 'base64')
    const pdfDoc = await PDFDocument.load(arrayBuffer)
    console.log('PDF loaded successfully, pages:', pdfDoc.getPageCount())
    
    // Test PDF saving
    const modifiedPdfBytes = await pdfDoc.save()
    console.log('PDF saved successfully, size:', modifiedPdfBytes.length)
    
    return {
      success: true,
      message: 'Rotation process test completed successfully',
      details: {
        originalSize: arrayBuffer.byteLength,
        modifiedSize: modifiedPdfBytes.length,
        pageCount: pdfDoc.getPageCount()
      }
    }
  } catch (error) {
    console.error('Test rotation process error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: {
        tempId,
        fileDataLength: fileData?.length
      }
    }
  }
}

// Simple test function to verify rotation is working
export async function testSimpleRotation(fileData: string) {
  try {
    console.log('=== Testing Simple Rotation ===')
    
    // Load PDF
    const arrayBuffer = Buffer.from(fileData, 'base64')
    const pdfDoc = await PDFDocument.load(arrayBuffer)
    const totalPages = pdfDoc.getPageCount()
    
    console.log(`PDF loaded: ${totalPages} pages`)
    
    // Test rotating first page by 90 degrees
    if (totalPages > 0) {
      const page = pdfDoc.getPage(0)
      const originalRotation = page.getRotation().angle
      console.log(`Page 1 original rotation: ${originalRotation}°`)
      
      // Apply 90-degree rotation
      page.setRotation(degrees(90))
      const newRotation = page.getRotation().angle
      console.log(`Page 1 after rotation: ${newRotation}°`)
      
      // Save and return the test document
      const modifiedPdfBytes = await pdfDoc.save()
      const base64Data = Buffer.from(modifiedPdfBytes).toString('base64')
      const dataUrl = `data:application/pdf;base64,${base64Data}`
      
      return {
        success: true,
        testDocumentUrl: dataUrl,
        fileData: base64Data,
        message: `Test rotation applied: ${originalRotation}° -> ${newRotation}°`
      }
    }
    
    return { success: false, error: 'No pages to test' }
  } catch (error) {
    console.error('Test rotation error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Save rotated document as regular document for general use
export async function saveRotatedDocumentAsRegular(
  documentUrl: string,
  documentName: string,
  documentPath: string,
  originalFileName: string
) {
  try {
    console.log('saveRotatedDocumentAsRegular called with:', {
      documentUrl: documentUrl ? `${documentUrl.substring(0, 50)}...` : 'null',
      documentName,
      documentPath,
      originalFileName
    })
    
    const supabase = await createClient()
    const adminClient = createAdminClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('User authentication error:', userError)
      return { success: false, error: 'Usuario no autenticado' }
    }

    console.log('Saving rotated document as regular document...')
    console.log('Document URL type:', documentUrl.startsWith('data:') ? 'data URL' : 'regular URL')
    console.log('Document Path:', documentPath)

    let finalDocumentPath = documentPath
    let finalDocumentUrl = documentUrl

    // If documentPath is empty or documentUrl is a data URL, we need to upload the file
    if (!documentPath || documentUrl.startsWith('data:')) {
      console.log('Uploading data URL to storage...')
      console.log('Document URL format check:', {
        urlLength: documentUrl.length,
        startsWithData: documentUrl.startsWith('data:'),
        hasComma: documentUrl.includes(','),
        firstPart: documentUrl.substring(0, 50)
      })
      
      try {
        // Extract base64 data from data URL
        if (!documentUrl.includes(',')) {
          throw new Error(`Invalid data URL format: no comma found. URL starts with: ${documentUrl.substring(0, 50)}`)
        }
        
        const base64Data = documentUrl.split(',')[1]
        if (!base64Data) {
          throw new Error(`Invalid data URL format: no base64 data after comma. URL: ${documentUrl.substring(0, 100)}`)
        }
        
        console.log('Base64 data extracted, length:', base64Data.length)
        
        const pdfBytes = Buffer.from(base64Data, 'base64')
        console.log('PDF bytes length:', pdfBytes.length)
        
        // Create filename and path
        const timestamp = Date.now()
        const fileName = `regular-${timestamp}-${originalFileName}`
        const filePath = `uploads/${user.id}/${fileName}`
        
        console.log('Uploading to path:', filePath)
        
        // Upload to storage
        const { data: uploadData, error: uploadError } = await adminClient.storage
          .from(BUCKET_PUBLIC)
          .upload(filePath, pdfBytes, {
            contentType: 'application/pdf',
            cacheControl: '3600',
            upsert: true
          })

        if (uploadError) {
          console.error('Upload error:', uploadError)
          return { success: false, error: `Error al subir el documento: ${uploadError.message}` }
        }

        console.log('Upload successful:', uploadData)
        
        // Get public URL
        const { data: { publicUrl } } = adminClient.storage
          .from(BUCKET_PUBLIC)
          .getPublicUrl(filePath)

        finalDocumentPath = filePath
        finalDocumentUrl = publicUrl
        
        console.log('Final document URL:', publicUrl)
      } catch (dataUrlError) {
        console.error('Error processing data URL:', dataUrlError)
        return { success: false, error: `Error al procesar el documento: ${dataUrlError instanceof Error ? dataUrlError.message : 'Error desconocido'}` }
      }
    }

    // Create document record with document_type = 'email' (regular document)
    console.log('Creating document record with:', {
      created_by: user.id,
      file_name: originalFileName,
      file_path: finalDocumentPath,
      file_type: 'application/pdf',
      document_type: 'email'
    })
    
    const { data: documentRecord, error: dbError } = await supabase
      .from('documents')
      .insert({
        created_by: user.id, // Use created_by as per schema
        file_name: originalFileName,
        file_path: finalDocumentPath,
        file_size: 0, // We don't have the exact size, but it's not critical
        file_type: 'application/pdf',
        document_type: 'email', // Regular document type
        archived: false,
        status: 'uploaded'
      })
      .select()
      .single()

    if (dbError) {
      console.error('Error creating regular document record:', dbError)
      return { success: false, error: `Error al guardar el documento en la base de datos: ${dbError.message}` }
    }

    console.log('Regular document created successfully:', documentRecord.id)

    return {
      success: true,
      documentId: documentRecord.id,
      documentUrl: finalDocumentUrl,
      message: 'Documento guardado exitosamente'
    }
  } catch (error) {
    console.error('Error in saveRotatedDocumentAsRegular:', error)
    return { 
      success: false, 
      error: `Error al guardar el documento como documento regular: ${error instanceof Error ? error.message : 'Error desconocido'}` 
    }
  }
}

// Save rotated document as fast-sign document and redirect to edit
export async function saveRotatedDocumentForSigning(
  documentUrl: string,
  documentName: string,
  documentPath: string,
  originalFileName: string
) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    console.log('Saving rotated document for signing...')
    console.log('Document URL:', documentUrl)
    console.log('Document Path:', documentPath)

    let finalDocumentPath = documentPath
    let finalDocumentUrl = documentUrl

    // If documentPath is empty or documentUrl is a data URL, we need to upload the file
    if (!documentPath || documentUrl.startsWith('data:')) {
      console.log('Uploading data URL to storage...')
      console.log('Document URL format check:', {
        urlLength: documentUrl.length,
        startsWithData: documentUrl.startsWith('data:'),
        hasComma: documentUrl.includes(','),
        firstPart: documentUrl.substring(0, 50)
      })
      
      // Extract base64 data from data URL
      if (!documentUrl.includes(',')) {
        return { success: false, error: `Invalid data URL format: no comma found. URL starts with: ${documentUrl.substring(0, 50)}` }
      }
      
      const base64Data = documentUrl.split(',')[1]
      if (!base64Data) {
        return { success: false, error: `Invalid data URL format: no base64 data after comma. URL: ${documentUrl.substring(0, 100)}` }
      }
      
      console.log('Base64 data extracted, length:', base64Data.length)
      const pdfBytes = Buffer.from(base64Data, 'base64')
      
      // Create filename and path
      const timestamp = Date.now()
      const fileName = `fast-sign-${timestamp}-${originalFileName}`
      const filePath = `uploads/${user.id}/${fileName}`
      
      // Upload to storage
      const { data: uploadData, error: uploadError } = await adminClient.storage
        .from(BUCKET_PUBLIC)
        .upload(filePath, pdfBytes, {
          contentType: 'application/pdf',
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        return { success: false, error: 'Error al subir el documento' }
      }

      // Get public URL
      const { data: { publicUrl } } = adminClient.storage
        .from(BUCKET_PUBLIC)
        .getPublicUrl(filePath)

      finalDocumentPath = filePath
      finalDocumentUrl = publicUrl
    }

    // Create document record with document_type = 'fast_sign'
    const { data: documentRecord, error: dbError } = await supabase
      .from('documents')
      .insert({
        created_by: user.id, // Use created_by as per schema
        file_name: originalFileName,
        file_path: finalDocumentPath,
        file_size: 0, // We don't have the exact size, but it's not critical
        file_type: 'application/pdf',
        document_type: 'fast_sign', // Fast sign document type
        archived: false,
        status: 'sin_firma' // Consistent status for fast_sign documents
      })
      .select()
      .single()

    if (dbError) {
      console.error('Error creating fast-sign document record:', dbError)
      return { success: false, error: 'Error al guardar el documento para firmar' }
    }

    console.log('Fast-sign document created successfully:', documentRecord.id)

    return {
      success: true,
      documentId: documentRecord.id,
      documentUrl: finalDocumentUrl,
      redirectUrl: `/fast-sign/edit/${documentRecord.id}`,
      message: 'Documento preparado para firmar'
    }
  } catch (error) {
    console.error('Error in saveRotatedDocumentForSigning:', error)
    return { success: false, error: 'Error al preparar el documento para firmar' }
  }
}

// Interface for page information
export interface PageInfo {
  id: string
  pageNumber: number // Original page number in the merged PDF (for thumbnail display)
  displayPosition: number // Current display position (1-based)
  documentIndex: number // Which document this page belongs to
  rotation: number
  thumbnail?: string
}

// Add additional PDF files to existing document
export async function addFilesToDocument(
  mainFileData: string,
  additionalFiles: File[],
  insertPosition: 'start' | 'end' = 'end'
) {
  try {
    console.log('Adding files to document...')
    console.log('Main file data length:', mainFileData.length)
    console.log('Additional files:', additionalFiles.length)
    console.log('Insert position:', insertPosition)

    // Load main PDF
    const mainArrayBuffer = Buffer.from(mainFileData, 'base64')
    const mainPdfDoc = await PDFDocument.load(mainArrayBuffer)
    
    // Create merged PDF document
    const mergedPdfDoc = await PDFDocument.create()
    
    // Prepare pages array with document info
    const allPages: PageInfo[] = []
    let currentPageNumber = 1
    
    // Process main document pages
    const mainPageCount = mainPdfDoc.getPageCount()
    for (let i = 0; i < mainPageCount; i++) {
      allPages.push({
        id: `main-${i}`,
        pageNumber: currentPageNumber,
        displayPosition: currentPageNumber++,
        documentIndex: 0,
        rotation: 0
      })
    }
    
    // Process additional files
    const additionalPdfDocs: PDFDocument[] = []
    for (let docIndex = 0; docIndex < additionalFiles.length; docIndex++) {
      const file = additionalFiles[docIndex]
      
      if (!file.type.includes('pdf')) {
        console.warn(`Skipping non-PDF file: ${file.name}`)
        continue
      }
      
      const arrayBuffer = await file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(arrayBuffer)
      additionalPdfDocs.push(pdfDoc)
      
      const pageCount = pdfDoc.getPageCount()
      for (let i = 0; i < pageCount; i++) {
        const pageInfo: PageInfo = {
          id: `doc${docIndex + 1}-${i}`,
          pageNumber: currentPageNumber,
          displayPosition: currentPageNumber++,
          documentIndex: docIndex + 1,
          rotation: 0
        }
        
        if (insertPosition === 'start') {
          allPages.unshift(pageInfo) // Add to beginning
        } else {
          allPages.push(pageInfo) // Add to end
        }
      }
    }
    
    // Renumber pages after insertion
    allPages.forEach((page, index) => {
      page.pageNumber = index + 1
      page.displayPosition = index + 1
    })
    
    // Create merged PDF with all pages in order
    const allPdfDocs = [mainPdfDoc, ...additionalPdfDocs]
    
    for (const pageInfo of allPages) {
      const sourcePdf = allPdfDocs[pageInfo.documentIndex]
      const originalPageIndex = parseInt(pageInfo.id.split('-')[1])
      const [copiedPage] = await mergedPdfDoc.copyPages(sourcePdf, [originalPageIndex])
      mergedPdfDoc.addPage(copiedPage)
    }
    
    // Save merged PDF
    const mergedPdfBytes = await mergedPdfDoc.save()
    const base64Data = Buffer.from(mergedPdfBytes).toString('base64')
    const dataUrl = `data:application/pdf;base64,${base64Data}`
    
    console.log('Merged PDF created successfully')
    console.log('Total pages:', allPages.length)
    
    return {
      success: true,
      documentUrl: dataUrl,
      fileData: base64Data,
      pageCount: allPages.length,
      pages: allPages,
      tempId: randomUUID()
    }
  } catch (error) {
    console.error('Error in addFilesToDocument:', error)
    return { success: false, error: 'Error al fusionar los documentos' }
  }
}

// Reorder pages in the document using pdf-lib 1.17.1 methods
export async function reorderDocumentPages(
  fileData: string,
  newPageOrder: PageInfo[]
) {
  try {
    console.log('Reordering document pages...')
    console.log('New page order:', newPageOrder.map(p => ({ id: p.id, displayPage: p.pageNumber })))
    
    // Load the current PDF
    const arrayBuffer = Buffer.from(fileData, 'base64')
    const sourcePdf = await PDFDocument.load(arrayBuffer)
    const totalPages = sourcePdf.getPageCount()
    
    console.log(`Source PDF has ${totalPages} pages`)
    
    // Create a new PDF document for the reordered pages
    const reorderedPdf = await PDFDocument.create()
    
    // Create a mapping from page IDs to their original positions in the merged PDF
    // For merged documents, we need to reconstruct the original order
    const originalPageIndices = newPageOrder.map((pageInfo) => {
      if (pageInfo.id.startsWith('page-')) {
        // Original format: page-1, page-2, etc.
        const pageNum = parseInt(pageInfo.id.split('-')[1])
        return pageNum - 1  // Convert to 0-based index
      } else {
        // Merged format: main-0, doc1-3, etc.
        // We need to find the original position of this page in the merged PDF
        // Since pages can be reordered, we can't rely on pageNumber
        // Instead, we need to find where this page originally appeared
        
        // Create a sorted list of all page IDs to determine original order
        const allPageIds = newPageOrder.map(p => p.id).sort((a, b) => {
          // Parse document prefix and page index
          const parsePageId = (id: string) => {
            const [prefix, index] = id.split('-')
            const pageIndex = parseInt(index)
            
            if (prefix === 'main') {
              return { docIndex: 0, pageIndex }
            } else {
              const docNum = parseInt(prefix.replace('doc', ''))
              return { docIndex: docNum, pageIndex }
            }
          }
          
          const aInfo = parsePageId(a)
          const bInfo = parsePageId(b)
          
          // Sort by document index first, then by page index within document
          if (aInfo.docIndex !== bInfo.docIndex) {
            return aInfo.docIndex - bInfo.docIndex
          }
          
          return aInfo.pageIndex - bInfo.pageIndex
        })
        
        console.log('All page IDs in original order:', allPageIds)
        console.log('Current page order:', newPageOrder.map(p => p.id))
        
        // Find the original position of this page ID in the sorted list
        const originalIndex = allPageIds.indexOf(pageInfo.id)
        console.log(`Page ${pageInfo.id} was originally at position ${originalIndex}`)
        return originalIndex
      }
    })
    
    console.log('Original page indices (0-based):', originalPageIndices)
    console.log('Page count check:', { expected: totalPages, received: originalPageIndices.length })
    
    // Validate indices
    const invalidIndices = originalPageIndices.filter(index => index < 0 || index >= totalPages)
    if (invalidIndices.length > 0) {
      throw new Error(`Invalid page indices: ${invalidIndices.join(', ')}`)
    }
    
    // Copy pages from source PDF to new PDF in the desired order
    const copiedPages = await reorderedPdf.copyPages(sourcePdf, originalPageIndices)
    
    // Add the copied pages to the new document
    copiedPages.forEach((page, index) => {
      const pageInfo = newPageOrder[index]
      
      // Apply rotation if specified
      if (pageInfo.rotation !== 0) {
        page.setRotation(degrees(pageInfo.rotation))
      }
      
      reorderedPdf.addPage(page)
    })
    
    // Save the reordered PDF
    const reorderedPdfBytes = await reorderedPdf.save()
    const base64Data = Buffer.from(reorderedPdfBytes).toString('base64')
    const dataUrl = `data:application/pdf;base64,${base64Data}`
    
    console.log('Document reordered successfully')
    
    return {
      success: true,
      documentUrl: dataUrl,
      fileData: base64Data,
      pageCount: newPageOrder.length
    }
  } catch (error) {
    console.error('Error in reorderDocumentPages:', error)
    return { success: false, error: 'Error al reordenar las páginas' }
  }
} 