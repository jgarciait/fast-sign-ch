import { NextRequest, NextResponse } from 'next/server'
import { processPdfDocuments } from '@/app/actions/merge-pdf-actions'

export async function POST(request: NextRequest) {
  try {
    console.log('PDF merge API endpoint called')
    
    // Log request size info
    const contentLength = request.headers.get('content-length')
    const contentLengthMB = contentLength ? (parseInt(contentLength) / 1024 / 1024).toFixed(2) : 'unknown'
    console.log('Request content-length:', contentLength, `(${contentLengthMB} MB)`)
    
    // Check if request is too large for Vercel limits
    if (contentLength && parseInt(contentLength) > 45 * 1024 * 1024) { // 45MB safety margin
      console.log('Request too large for Vercel, need chunked upload')
      return NextResponse.json(
        { 
          success: false, 
          error: 'Files too large for direct merge. Please use smaller files or contact support.',
          needsChunkedUpload: true,
          sizeMB: contentLengthMB
        },
        { status: 413 }
      )
    }
    
    // Get the form data from the request with better error handling
    let formData: FormData
    try {
      formData = await request.formData()
      console.log('FormData parsed successfully')
    } catch (formDataError) {
      console.error('Error parsing FormData:', formDataError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Error parsing form data. Files may be too large for Vercel limits.',
          details: {
            contentLengthMB,
            vercelLimit: '50MB (Pro) / 4.5MB (Hobby)',
            suggestion: 'Try with smaller files or fewer files at once'
          }
        },
        { status: 413 }
      )
    }
    
    // Get files from form data
    const files = formData.getAll('files') as File[]
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No files provided' },
        { status: 400 }
      )
    }

    if (files.length < 2) {
      return NextResponse.json(
        { success: false, error: 'At least 2 files required for merge' },
        { status: 400 }
      )
    }

    if (files.length > 20) {
      return NextResponse.json(
        { success: false, error: 'Maximum 20 files allowed' },
        { status: 400 }
      )
    }

    // Calculate total size for logging
    const totalSize = files.reduce((sum, file) => sum + file.size, 0)
    const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2)
    
    console.log(`Processing ${files.length} files for merge`)
    console.log(`Total files size: ${totalSizeMB} MB`)
    console.log('Individual file sizes:', files.map(f => `${f.name}: ${(f.size / 1024 / 1024).toFixed(2)} MB`))

    // Validate each file
    for (const file of files) {
      if (!file || file.size === 0) {
        return NextResponse.json(
          { success: false, error: 'Empty or invalid file found' },
          { status: 400 }
        )
      }

      if (file.type !== 'application/pdf') {
        return NextResponse.json(
          { success: false, error: `File ${file.name} is not a valid PDF` },
          { status: 400 }
        )
      }

      if (file.size > 50 * 1024 * 1024) { // 50MB
        return NextResponse.json(
          { success: false, error: `File ${file.name} exceeds 50MB limit` },
          { status: 400 }
        )
      }
    }

    // Process the merge using the server action
    const result = await processPdfDocuments(formData)

    if (!result.success) {
      console.error('Merge failed:', result.error)
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    console.log('Merge successful:', result.message)
    console.log('PDF data info:', {
      type: typeof result.pdfData,
      isUint8Array: result.pdfData instanceof Uint8Array,
      length: result.pdfData?.length,
      constructor: result.pdfData?.constructor?.name
    })
    
    // Keep PDF in memory and let user decide - NO SAVING YET!
    if (!result.pdfData) {
      throw new Error('No PDF data to save')
    }
    
    const fileSizeMB = result.pdfData.length / 1024 / 1024
    console.log('PDF merge completed in memory:', {
      length: result.pdfData.length,
      sizeMB: fileSizeMB.toFixed(2)
    })
    
    // Store PDF in server memory temporarily with session ID
    console.log('Storing merged PDF in server memory for user confirmation...')
    
    // Generate a temporary session ID for this merge
    const tempSessionId = `merge_${Date.now()}_${Math.random().toString(36).substring(2)}`
    
    // Store PDF data temporarily (in production, use Redis or similar)
    const globalAny = global as any
    globalAny.tempPdfStorage = globalAny.tempPdfStorage || new Map()
    globalAny.tempPdfStorage.set(tempSessionId, {
      pdfData: result.pdfData,
      compressionInfo: result.compressionInfo,
      tempFileName: result.tempFileName,
      totalPages: result.totalPages,
      timestamp: Date.now()
    })
    
    // Clean up old temp data (older than 1 hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    for (const [key, value] of globalAny.tempPdfStorage.entries()) {
      if (value.timestamp < oneHourAgo) {
        globalAny.tempPdfStorage.delete(key)
      }
    }
    
    console.log('PDF stored in server memory:', {
      sessionId: tempSessionId,
      sizeMB: fileSizeMB.toFixed(2),
      tempStorageSize: globalAny.tempPdfStorage.size
    })
    
    return NextResponse.json({
      success: true,
      message: result.message,
      totalPages: result.totalPages,
      fileSize: result.fileSize,
      tempSessionId: tempSessionId, // Send session ID instead of data
      compressionInfo: result.compressionInfo,
      tempFileName: result.tempFileName,
      processingComplete: true,
      requiresUserConfirmation: true,
      availableForFastSign: true,
      availableForSentToSign: true
    })

  } catch (error) {
    console.error('PDF merge API error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { message: 'PDF merge API is running. Use POST to merge PDF files.' },
    { status: 200 }
  )
} 