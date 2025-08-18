import { createClient } from '@/utils/supabase/client'
import { BUCKET_PUBLIC } from '@/utils/supabase/storage'

interface UploadProgress {
  bytesUploaded: number
  bytesTotal: number
  percentage: number
}

interface UploadResult {
  success: boolean
  documentUrl?: string
  documentId?: string
  message?: string
  error?: string
  compressionInfo?: any
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
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  try {
    const supabase = createClient()
    
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

    // Get Supabase URL from environment
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    if (!supabaseUrl) {
      return { success: false, error: 'URL de Supabase no configurada' }
    }

    // Create file from bytes
    const file = new File([pdfBytes], fileName, { type: 'application/pdf' })
    
    // Create unique file path
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 15)
    const fileExtension = fileName.split('.').pop() || 'pdf'
    const uniqueFileName = `${fileName.replace(/\.[^/.]+$/, '')}_${timestamp}_${randomId}.${fileExtension}`
    const filePath = `documents/${user.id}/${uniqueFileName}`

    const bucketName = BUCKET_PUBLIC

    console.log('Starting TUS upload with config:', {
      supabaseUrl,
      bucketName,
      filePath,
      fileSize: pdfBytes.length,
      hasSession: !!session,
      hasAccessToken: !!session?.access_token,
      userId: user.id
    })

    // Let's also check what user info we have
    console.log('User info:', {
      id: user.id,
      email: user.email,
      role: user.role
    })

    return new Promise((resolve, reject) => {
      // Import tus dynamically to avoid SSR issues
      import('tus-js-client').then(({ Upload }) => {
        // Create a proper File object for TUS
        const uploadFile = new File([file], fileName, { type: 'application/pdf' })
        
        const upload = new Upload(uploadFile, {
          endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          headers: {
            authorization: `Bearer ${session.access_token}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          },
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          chunkSize: 6 * 1024 * 1024, // 6MB chunks as required by Supabase
          metadata: {
            bucketName: bucketName,
            objectName: filePath,
            contentType: 'application/pdf',
            cacheControl: '3600',
          },
          onError: function (error) {
            console.error('TUS Upload failed:', error)
            console.error('TUS Upload error details:', {
              message: error.message,
              cause: error.cause,
              stack: error.stack,
              supabaseUrl,
              bucketName,
              filePath
            })
            reject({ success: false, error: `Error en upload: ${error.message || 'Error desconocido en TUS'}` })
          },
          onProgress: function (bytesUploaded, bytesTotal) {
            const percentage = Math.round((bytesUploaded / bytesTotal) * 100)
            console.log(`Upload progress: ${bytesUploaded}/${bytesTotal} bytes (${percentage}%)`)
            
            // Call progress callback if provided
            if (onProgress) {
              onProgress({
                bytesUploaded,
                bytesTotal,
                percentage
              })
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
                  document_type: 'merged',
                  archived: false
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
                .from(bucketName)
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
        reject({ success: false, error: 'Error al importar librería de upload TUS' })
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

/**
 * Wrapper for uploadFileResumable that ensures it never throws and always returns a valid result
 */
export async function uploadFileResumableSafe(
  pdfBytes: Uint8Array,
  fileName: string,
  compressionInfo: any,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  try {
    return await uploadFileResumable(pdfBytes, fileName, compressionInfo, onProgress)
  } catch (error) {
    console.error('Unexpected error in uploadFileResumable:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error inesperado en upload resumable'
    }
  }
}

/**
 * Fallback upload using standard Supabase upload (non-resumable)
 * @param pdfBytes PDF file bytes
 * @param fileName File name
 * @param compressionInfo Compression information
 * @returns Upload result with document info
 */
export async function uploadFileStandard(
  pdfBytes: Uint8Array,
  fileName: string,
  compressionInfo: any
): Promise<UploadResult> {
  try {
    const supabase = createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Create file from bytes
    const file = new File([pdfBytes], fileName, { type: 'application/pdf' })
    
    // Create unique file path
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 15)
    const fileExtension = fileName.split('.').pop() || 'pdf'
    const uniqueFileName = `${fileName.replace(/\.[^/.]+$/, '')}_${timestamp}_${randomId}.${fileExtension}`
    const filePath = `documents/${user.id}/${uniqueFileName}`

    console.log('Starting standard upload as fallback:', {
      fileName: uniqueFileName,
      filePath,
      fileSize: pdfBytes.length
    })

    // Upload file using standard Supabase upload
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_PUBLIC)
      .upload(filePath, file, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: true
      })

    if (uploadError) {
      console.error('Standard upload error:', uploadError)
      return { success: false, error: `Error en upload estándar: ${uploadError.message}` }
    }

    // Create document record in database
    console.log('Attempting to insert document with:', {
      created_by: user.id,
      file_name: fileName,
      file_path: filePath,
      file_size: pdfBytes.length,
      file_type: 'application/pdf',
      document_type: 'merged',
      archived: false
    })
    
    const { data: documentRecord, error: dbError } = await supabase
      .from('documents')
      .insert({
        created_by: user.id,
        file_name: fileName,
        file_path: filePath,
        file_size: pdfBytes.length,
        file_type: 'application/pdf',
        document_type: 'merged',
        archived: false
      })
      .select()
      .single()

    console.log('Database insert result:', { data: documentRecord, error: dbError })

    if (dbError) {
      console.error('Database error:', dbError)
      return { success: false, error: `Error al crear registro: ${dbError.message}` }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_PUBLIC)
      .getPublicUrl(filePath)

    return {
      success: true,
      documentUrl: urlData.publicUrl,
      documentId: documentRecord.id,
      message: 'Documento guardado exitosamente (upload estándar)',
      compressionInfo
    }

  } catch (error) {
    console.error('Standard upload error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error en upload estándar'
    }
  }
} 