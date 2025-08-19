import { createClient } from '@/utils/supabase/client'

interface UploadResult {
  success: boolean
  path?: string
  error?: string
}

interface UploadProgress {
  bytesUploaded: number
  bytesTotal: number
  percentage: number
}

export async function uploadFileToTempStorage(
  file: File, 
  sessionId: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  try {
    const supabase = createClient()
    
    // Get current user and session for TUS auth
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return { success: false, error: 'No se pudo obtener la sesión de autenticación' }
    }

    // Generate unique file path for temporary storage
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 15)
    const fileExtension = file.name.split('.').pop()
    const tempPath = `temp-merge/${sessionId}/${timestamp}-${randomId}.${fileExtension}`
    
    console.log(`Uploading file via TUS to temp storage: ${tempPath}`)
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    
    return new Promise((resolve, reject) => {
      // Import TUS dynamically to avoid SSR issues
      import('tus-js-client').then(({ Upload }) => {
        const upload = new Upload(file, {
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
            bucketName: 'public_documents',
            objectName: tempPath,
            contentType: file.type,
            cacheControl: '3600',
          },
          onError: function (error) {
            console.error('TUS Upload failed:', error)
            reject({ success: false, error: `Error en upload: ${error.message || 'Error desconocido en TUS'}` })
          },
          onProgress: function (bytesUploaded, bytesTotal) {
            const percentage = Math.round((bytesUploaded / bytesTotal) * 100)
            console.log(`TUS Upload progress: ${bytesUploaded}/${bytesTotal} bytes (${percentage}%)`)
            
            if (onProgress) {
              onProgress({
                bytesUploaded,
                bytesTotal,
                percentage
              })
            }
          },
          onSuccess: function () {
            console.log('TUS Upload completed successfully:', tempPath)
            resolve({ success: true, path: tempPath })
          }
        })
        
        upload.start()
      }).catch((importError) => {
        console.error('Failed to import TUS client:', importError)
        reject({ success: false, error: 'Error al cargar el cliente de upload' })
      })
    })
    
  } catch (error) {
    console.error('Upload error:', error)
    return { success: false, error: 'Upload failed' }
  }
}

export async function cleanupTempFiles(sessionId: string): Promise<void> {
  try {
    const supabase = createClient()
    
    // List all files in the session directory
    const { data: files, error: listError } = await supabase.storage
      .from('public_documents')
      .list(`temp-merge/${sessionId}`)
    
    if (listError) {
      console.error('Error listing temp files:', listError)
      return
    }
    
    if (!files || files.length === 0) {
      console.log('No temp files to clean up')
      return
    }
    
    // Delete all files in the session
    const filePaths = files.map(file => `temp-merge/${sessionId}/${file.name}`)
    
    const { error: deleteError } = await supabase.storage
      .from('public_documents')
      .remove(filePaths)
    
    if (deleteError) {
      console.error('Error deleting temp files:', deleteError)
    } else {
      console.log(`Cleaned up ${filePaths.length} temp files for session ${sessionId}`)
    }
    
  } catch (error) {
    console.error('Cleanup error:', error)
  }
}

export function generateMergeSessionId(): string {
  return `merge-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
}
