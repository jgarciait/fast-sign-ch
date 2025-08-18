"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { BUCKET_PUBLIC } from "@/utils/supabase/storage"
import { normalizeFileName, generateFilePath } from "@/utils/file-utils"
import { PDFDocument, StandardFonts, PageSizes } from "pdf-lib"

export async function processPdfDocuments(formData: FormData) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Get files from FormData
    const files = formData.getAll('files') as File[]
    
    // Get compression settings
    let compressionSettings = {
      enabled: true,
      quality: 'auto',
      dpi: 150,
      maxImageSize: 1024
    }
    
    try {
      const settingsString = formData.get('compressionSettings') as string
      if (settingsString) {
        compressionSettings = { ...compressionSettings, ...JSON.parse(settingsString) }
      }
    } catch (error) {
      console.log('Using default compression settings')
    }
    
    console.log('Compression settings:', compressionSettings)
    
    if (files.length < 2) {
      return { success: false, error: 'Se requieren al menos 2 archivos para fusionar' }
    }

    if (files.length > 20) {
      return { success: false, error: 'Máximo 20 archivos permitidos' }
    }

    console.log(`Starting PDF merge for ${files.length} files`)

    // Validate files
    for (const file of files) {
      if (!file || file.size === 0) {
        return { success: false, error: 'Archivo vacío o inválido encontrado' }
      }
      
      if (file.type !== 'application/pdf') {
        return { success: false, error: `Archivo ${file.name} no es un PDF válido` }
      }
      
      if (file.size > 50 * 1024 * 1024) { // 50MB
        return { success: false, error: `Archivo ${file.name} excede el tamaño máximo de 50MB` }
      }
    }

    // Create merged PDF document
    const mergedPdf = await PDFDocument.create()
    
    // Process each file and add pages to merged document
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      try {
        console.log(`Processing file ${i + 1}/${files.length}: ${file.name}`)
        
        // Convert File to ArrayBuffer
        const arrayBuffer = await file.arrayBuffer()
        const pdfBytes = new Uint8Array(arrayBuffer)
        
        // Validate PDF file before processing
        console.log(`Validating PDF file ${file.name}...`)
        
        // Check if file looks like a valid PDF
        const fileHeader = new TextDecoder().decode(pdfBytes.slice(0, 8))
        if (!fileHeader.startsWith('%PDF-')) {
          throw new Error(`El archivo ${file.name} no es un PDF válido (header incorrecto)`)
        }
        
        // Check file size is reasonable
        if (pdfBytes.length < 100) {
          throw new Error(`El archivo ${file.name} es demasiado pequeño para ser un PDF válido`)
        }
        
        // Try to load the PDF document with better error handling
        let pdfDoc: PDFDocument
        try {
          pdfDoc = await PDFDocument.load(arrayBuffer, {
            ignoreEncryption: true,      // Try to ignore encryption issues
            capNumbers: true,            // Cap large numbers to prevent overflow
            throwOnInvalidObject: false  // Don't throw on invalid objects, skip them
          })
        } catch (loadError) {
          console.error(`PDF load error for ${file.name}:`, loadError)
          
          // Try alternative loading approach
          try {
            console.log(`Attempting alternative PDF load for ${file.name}...`)
                       pdfDoc = await PDFDocument.load(arrayBuffer, {
             ignoreEncryption: true,
             capNumbers: true,
             throwOnInvalidObject: false,
             updateMetadata: false    // Don't try to update metadata
           })
          } catch (secondLoadError) {
            throw new Error(`El archivo ${file.name} está corrupto o dañado y no se puede procesar. Por favor, verifica el archivo o usa una versión diferente.`)
          }
        }
        
        // Get all pages from the source document
        const pageCount = pdfDoc.getPageCount()
        console.log(`File ${file.name} has ${pageCount} pages`)
        
        if (pageCount === 0) {
          throw new Error(`El archivo ${file.name} no tiene páginas válidas`)
        }
        
        // Copy all pages to merged document
        const pageIndices = Array.from({ length: pageCount }, (_, index) => index)
        let copiedPages
        
        try {
          copiedPages = await mergedPdf.copyPages(pdfDoc, pageIndices)
        } catch (copyError) {
          console.error(`Error copying pages from ${file.name}:`, copyError)
          throw new Error(`No se pudieron copiar las páginas del archivo ${file.name}. El archivo puede estar protegido o corrupto.`)
        }
        
        // Add copied pages to merged document
        copiedPages.forEach(page => {
          mergedPdf.addPage(page)
        })
        
        console.log(`Successfully added ${pageCount} pages from ${file.name}`)
        
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error)
        
        // For corrupted files, offer to skip and continue with other files
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
        if (errorMessage.includes('corrupto') || errorMessage.includes('dañado')) {
          return { 
            success: false, 
            error: `El archivo ${file.name} está corrupto y será omitido. ${errorMessage}`,
            skippableError: true,
            corruptedFile: file.name
          }
        }
        
        return { 
          success: false, 
          error: `Error procesando archivo ${file.name}: ${errorMessage}` 
        }
      }
    }

    // Save merged PDF with compression
    console.log('Saving merged PDF with compression...')
    const originalPdfBytes = await mergedPdf.save()
    console.log(`Original merged PDF size: ${(originalPdfBytes.length / 1024 / 1024).toFixed(2)} MB`)
    
    // Apply compression to reduce file size based on settings
    let compressedPdfBytes = originalPdfBytes
    let compressionRatio = '0.0'
    
    if (compressionSettings.enabled) {
      compressedPdfBytes = await compressPdf(originalPdfBytes, compressionSettings)
      compressionRatio = ((originalPdfBytes.length - compressedPdfBytes.length) / originalPdfBytes.length * 100).toFixed(1)
      console.log(`Compressed PDF size: ${(compressedPdfBytes.length / 1024 / 1024).toFixed(2)} MB (${compressionRatio}% reduction)`)
    } else {
      console.log('Compression disabled by user settings')
    }
    
    const mergedPdfBytes = compressedPdfBytes
    
    // Return processed data WITHOUT uploading
    return {
      success: true,
      message: `${files.length} archivos procesados exitosamente`,
      totalPages: mergedPdf.getPageCount(),
      fileSize: mergedPdfBytes.length,
      pdfData: mergedPdfBytes, // Return the PDF bytes for later upload
      compressionInfo: {
        originalSize: originalPdfBytes.length,
        compressedSize: compressedPdfBytes.length,
        reductionPercentage: parseFloat(compressionRatio),
        compressionEnabled: true
      },
      tempFileName: `merged-document-${Date.now()}.pdf`
    }

  } catch (error) {
    console.error('PDF merge error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al fusionar archivos'
    }
  }
}

/**
 * Save processed PDF document to storage and database
 * @param pdfData PDF bytes to upload
 * @param fileName Name for the file
 * @param compressionInfo Compression details
 * @param totalPages Total number of pages
 */
export async function saveMergedDocument(
  pdfData: Uint8Array,
  fileName: string,
  compressionInfo: any,
  totalPages: number
) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Normalize and create file path
    const normalizedFileName = normalizeFileName(fileName)
    const filePath = generateFilePath(normalizedFileName, user.id)
    
    console.log(`Saving merged PDF to: ${filePath}`)
    
    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from(BUCKET_PUBLIC)
      .upload(filePath, pdfData, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: true
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return { success: false, error: `Error al subir el archivo fusionado: ${uploadError.message}` }
    }

    // Get public URL
    const { data: { publicUrl } } = adminClient.storage
      .from(BUCKET_PUBLIC)
      .getPublicUrl(filePath)

    console.log('Upload successful, public URL:', publicUrl)

    // Create document record in database
    const { data: documentRecord, error: dbError } = await supabase
      .from('documents')
      .insert({
        created_by: user.id,
        file_name: normalizedFileName,
        file_path: filePath,
        file_size: pdfData.length,
        file_type: 'application/pdf',
        document_type: 'fast_sign',
        archived: false,
        status: 'completed'
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      return { success: false, error: `Error al crear registro en base de datos: ${dbError.message}` }
    }

    return {
      success: true,
      documentUrl: publicUrl,
      documentId: documentRecord.id,
      message: 'Documento guardado exitosamente',
      compressionInfo
    }

  } catch (error) {
    console.error('Save document error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al guardar documento'
    }
  }
}

/**
 * Upload file using TUS resumable upload with real-time progress
 * @param pdfBytes PDF file bytes
 * @param fileName File name
 * @param compressionInfo Compression information
 * @param onProgress Progress callback function
 * @returns Upload result with document info
 */
export async function uploadFileResumable(
  pdfBytes: Uint8Array,
  fileName: string, 
  compressionInfo: any,
  onProgress?: (bytesUploaded: number, bytesTotal: number, percentage: number) => void
) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Get session for authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return { success: false, error: 'No se pudo obtener la sesión de autenticación' }
    }

    // Get Supabase project ID from the URL
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const projectId = supabaseUrl.replace('https://', '').replace('.supabase.co', '')

    // Create file from bytes
    const file = new File([pdfBytes], fileName, { type: 'application/pdf' })
    
    // Create unique file path
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 15)
    const fileExtension = fileName.split('.').pop() || 'pdf'
    const uniqueFileName = `${fileName.replace(/\.[^/.]+$/, '')}_${timestamp}_${randomId}.${fileExtension}`
    const filePath = `documents/${user.id}/${uniqueFileName}`

    return new Promise((resolve, reject) => {
      // Import tus dynamically to avoid SSR issues
      import('tus-js-client').then(({ Upload }) => {
        const upload = new Upload(file, {
          endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          headers: {
            authorization: `Bearer ${session.access_token}`,
            'x-upsert': 'true', // Allow overwriting
          },
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          metadata: {
            bucketName: BUCKET_PUBLIC,
            objectName: filePath,
            contentType: 'application/pdf',
            cacheControl: '3600',
          },
          chunkSize: 6 * 1024 * 1024, // 6MB chunks as required by Supabase
          onError: function (error) {
            console.error('TUS Upload failed:', error)
            reject({ success: false, error: `Error en upload: ${error.message}` })
          },
          onProgress: function (bytesUploaded, bytesTotal) {
            const percentage = Math.round((bytesUploaded / bytesTotal) * 100)
            console.log(`Upload progress: ${bytesUploaded}/${bytesTotal} bytes (${percentage}%)`)
            
            // Call progress callback if provided
            if (onProgress) {
              onProgress(bytesUploaded, bytesTotal, percentage)
            }
          },
          onSuccess: async function () {
            console.log('TUS Upload completed successfully')
            
            try {
              // Create document record in database
              const { data: documentRecord, error: dbError } = await supabase
                .from('documents')
                .insert({
                  created_by: user.id,
                  file_name: fileName,
                  file_path: filePath,
                  file_size: pdfBytes.length,
                  file_type: 'application/pdf',
                  document_type: 'fast_sign',
                  archived: false,
                  status: 'completed'
                })
                .select()
                .single()

              if (dbError) {
                console.error('Database error:', dbError)
                reject({ success: false, error: `Error al crear registro: ${dbError.message}` })
                return
              }

              // Get public URL
              const { data: urlData } = supabase.storage
                .from(BUCKET_PUBLIC)
                .getPublicUrl(filePath)

              resolve({
                success: true,
                documentUrl: urlData.publicUrl,
                documentId: documentRecord.id,
                message: 'Documento guardado exitosamente',
                compressionInfo
              })
              
            } catch (dbError) {
              console.error('Database operation failed:', dbError)
              reject({ 
                success: false, 
                error: dbError instanceof Error ? dbError.message : 'Error al guardar en base de datos' 
              })
            }
          },
        })

        // Check for previous uploads and resume if possible
        upload.findPreviousUploads().then(function (previousUploads) {
          if (previousUploads.length) {
            upload.resumeFromPreviousUpload(previousUploads[0])
            console.log('Resuming previous upload...')
          }
          
          // Start the upload
          upload.start()
        }).catch(error => {
          console.error('Error finding previous uploads:', error)
          // Still try to start upload
          upload.start()
        })
        
      }).catch(error => {
        console.error('Error importing tus-js-client:', error)
        reject({ success: false, error: 'Error al importar librería de upload' })
      })
    })

  } catch (error) {
    console.error('Resumable upload error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error en upload resumable'
    }
  }
}

export async function uploadChunkedFile(
  chunk: Blob,
  fileName: string,
  chunkIndex: number,
  totalChunks: number,
  fileId: string
) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Create chunk file path
    const chunkFileName = `${fileId}_chunk_${chunkIndex}`
    const chunkPath = `temp/${user.id}/${chunkFileName}`
    
    // Convert Blob to ArrayBuffer
    const arrayBuffer = await chunk.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)
    
    // Upload chunk to storage
    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from(BUCKET_PUBLIC)
      .upload(chunkPath, buffer, {
        contentType: 'application/octet-stream',
        cacheControl: '3600',
        upsert: true
      })

    if (uploadError) {
      console.error('Chunk upload error:', uploadError)
      return { success: false, error: `Error al subir fragmento: ${uploadError.message}` }
    }

    // If this is the last chunk, reassemble the file
    if (chunkIndex === totalChunks - 1) {
      return await reassembleChunkedFile(fileId, fileName, totalChunks, user.id)
    }

    return {
      success: true,
      chunkUploaded: chunkIndex + 1,
      totalChunks,
      message: `Fragmento ${chunkIndex + 1} de ${totalChunks} subido`
    }

  } catch (error) {
    console.error('Chunk upload error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al subir fragmento'
    }
  }
}

async function reassembleChunkedFile(
  fileId: string,
  fileName: string,
  totalChunks: number,
  userId: string
) {
  try {
    const adminClient = createAdminClient()
    
    // Download all chunks
    const chunks: Uint8Array[] = []
    for (let i = 0; i < totalChunks; i++) {
      const chunkFileName = `${fileId}_chunk_${i}`
      const chunkPath = `temp/${userId}/${chunkFileName}`
      
      const { data: chunkData, error: downloadError } = await adminClient.storage
        .from(BUCKET_PUBLIC)
        .download(chunkPath)
        
      if (downloadError) {
        console.error(`Error downloading chunk ${i}:`, downloadError)
        return { success: false, error: `Error al descargar fragmento ${i + 1}` }
      }
      
      const arrayBuffer = await chunkData.arrayBuffer()
      chunks.push(new Uint8Array(arrayBuffer))
    }
    
    // Combine chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const combined = new Uint8Array(totalLength)
    let offset = 0
    
    for (const chunk of chunks) {
      combined.set(chunk, offset)
      offset += chunk.length
    }
    
    // Upload reassembled file
    const normalizedFileName = normalizeFileName(fileName)
    const filePath = generateFilePath(normalizedFileName, userId)
    
    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from(BUCKET_PUBLIC)
      .upload(filePath, combined, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: true
      })

    if (uploadError) {
      console.error('Reassembled file upload error:', uploadError)
      return { success: false, error: `Error al subir archivo rearmado: ${uploadError.message}` }
    }

    // Clean up chunks
    for (let i = 0; i < totalChunks; i++) {
      const chunkFileName = `${fileId}_chunk_${i}`
      const chunkPath = `temp/${userId}/${chunkFileName}`
      
      await adminClient.storage
        .from(BUCKET_PUBLIC)
        .remove([chunkPath])
    }

    // Get public URL
    const { data: { publicUrl } } = adminClient.storage
      .from(BUCKET_PUBLIC)
      .getPublicUrl(filePath)

    return {
      success: true,
      filePath,
      publicUrl,
      originalFileName: fileName,
      normalizedFileName
    }

  } catch (error) {
    console.error('File reassembly error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al rearmar archivo'
    }
  }
}

/**
 * Compress PDF to reduce file size based on quality settings
 * @param pdfBytes Original PDF bytes
 * @param settings Compression settings
 * @returns Compressed PDF bytes
 */
async function compressPdf(pdfBytes: Uint8Array, settings?: any): Promise<Uint8Array> {
  try {
    // Set default settings if not provided
    const compressionSettings = settings || {
      quality: 'auto',
      dpi: 150,
      maxImageSize: 1024
    }
    
    console.log('Starting PDF compression with settings:', compressionSettings)
    
    // Load the original PDF
    const originalPdf = await PDFDocument.load(pdfBytes)
    
    // Create a new PDF with optimized settings
    const compressedPdf = await PDFDocument.create()
    
    // Set metadata for the compressed PDF
    compressedPdf.setTitle('Merged Document (Compressed)')
    compressedPdf.setCreator('AQSign Document System')
    compressedPdf.setProducer('PDF-lib with compression')
    compressedPdf.setCreationDate(new Date())
    compressedPdf.setModificationDate(new Date())
    
    // Get all pages from original PDF
    const pageCount = originalPdf.getPageCount()
    console.log(`Compressing ${pageCount} pages...`)
    
    // Copy pages with optimization
    const pageIndices = Array.from({ length: pageCount }, (_, index) => index)
    const copiedPages = await compressedPdf.copyPages(originalPdf, pageIndices)
    
    // Add pages to compressed PDF with optimizations based on quality settings
    copiedPages.forEach((page, index) => {
      // Optimize page content
      try {
        // Get original page dimensions
        const { width, height } = page.getSize()
        
        // Determine scaling based on quality setting
        let targetScale = 1
        let shouldScale = false
        
        switch (compressionSettings.quality) {
          case 'low':
            // Aggressive scaling - scale down pages larger than A4
            if (width > PageSizes.A4[0] || height > PageSizes.A4[1]) {
              const scaleX = PageSizes.A4[0] / width
              const scaleY = PageSizes.A4[1] / height
              targetScale = Math.min(scaleX, scaleY, 0.7) // Max 70% for low quality
              shouldScale = true
            }
            break
            
          case 'medium':
            // Moderate scaling - scale down oversized pages
            if (width > PageSizes.Letter[0] * 1.2 || height > PageSizes.Letter[1] * 1.2) {
              const scaleX = PageSizes.Letter[0] / width
              const scaleY = PageSizes.Letter[1] / height
              targetScale = Math.min(scaleX, scaleY, 0.85) // Max 85% for medium quality
              shouldScale = true
            }
            break
            
          case 'high':
            // Minimal scaling - only scale down very large pages
            if (width > PageSizes.Letter[0] * 1.5 || height > PageSizes.Letter[1] * 1.5) {
              const scaleX = (PageSizes.Letter[0] * 1.3) / width
              const scaleY = (PageSizes.Letter[1] * 1.3) / height
              targetScale = Math.min(scaleX, scaleY, 0.95) // Max 95% for high quality
              shouldScale = true
            }
            break
            
          case 'auto':
          default:
            // Auto scaling - intelligent based on content
            if (width > PageSizes.Letter[0] * 1.2 || height > PageSizes.Letter[1] * 1.2) {
              const scaleX = PageSizes.Letter[0] / width
              const scaleY = PageSizes.Letter[1] / height
              targetScale = Math.min(scaleX, scaleY, 0.8) // Max 80% for auto
              shouldScale = true
            }
            break
        }
        
        if (shouldScale && targetScale < 1) {
          page.scaleContent(targetScale, targetScale)
          page.setSize(width * targetScale, height * targetScale)
          const reductionPercent = ((1 - targetScale) * 100).toFixed(1)
          console.log(`Scaled down page ${index + 1} by ${reductionPercent}% (${compressionSettings.quality} quality)`)
        }
        
        compressedPdf.addPage(page)
      } catch (pageError) {
        console.warn(`Error optimizing page ${index + 1}, adding as-is:`, pageError)
        compressedPdf.addPage(page)
      }
    })
    
    // Save with compression settings
    const compressedBytes = await compressedPdf.save({
      useObjectStreams: false, // Disable object streams for better compatibility
      addDefaultPage: false,   // Don't add default blank page
      objectsPerTick: 50,      // Process fewer objects per tick to reduce memory usage
    })
    
    console.log('PDF compression completed successfully')
    return compressedBytes
    
  } catch (error) {
    console.warn('PDF compression failed, returning original:', error)
    // If compression fails, return original bytes
    return pdfBytes
  }
}

/**
 * Send merged PDF document via email
 * @param documentId Document ID from database
 * @param recipientEmail Email to send to
 * @param documentName Name of the document
 */
export async function sendMergedDocumentByEmail(
  documentId: string,
  recipientEmail: string,
  documentName: string,
  senderName?: string
) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Get document details
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (docError || !document) {
      return { success: false, error: 'Documento no encontrado' }
    }

    // Generate public URL for email
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_PUBLIC)
      .getPublicUrl(document.file_path)

    // Prepare email data
    const emailData = {
      to: recipientEmail,
      subject: `Documento fusionado: ${documentName}`,
      documentName: documentName,
      documentUrl: publicUrl,
      senderName: senderName || user.email || 'Sistema AQSign',
      documentSize: `${(document.file_size / 1024 / 1024).toFixed(2)} MB`,
      pageCount: await getDocumentPageCount(documentId)
    }

    // Here you would integrate with your email service (Resend, SendGrid, etc.)
    // For now, we'll just return success with the email data
    
    console.log('Email data prepared:', emailData)
    
    return {
      success: true,
      message: 'Documento preparado para envío por email',
      emailData,
      documentUrl: publicUrl
    }

  } catch (error) {
    console.error('Error preparing email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al preparar email'
    }
  }
}

/**
 * Get document page count
 * @param documentId Document ID
 */
async function getDocumentPageCount(documentId: string): Promise<number> {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // Get document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('file_path')
      .eq('id', documentId)
      .single()

    if (docError || !document) {
      return 0
    }

    // Download PDF to count pages
    const { data: pdfData, error: downloadError } = await adminClient.storage
      .from(BUCKET_PUBLIC)
      .download(document.file_path)

    if (downloadError || !pdfData) {
      return 0
    }

    // Load PDF and count pages
    const arrayBuffer = await pdfData.arrayBuffer()
    const pdfDoc = await PDFDocument.load(arrayBuffer)
    
    return pdfDoc.getPageCount()
  } catch (error) {
    console.error('Error counting pages:', error)
    return 0
  }
}