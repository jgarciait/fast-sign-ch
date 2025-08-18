import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('=== PDF MERGE DEBUG ENDPOINT ===')
    
    // Log request headers
    console.log('Request headers:')
    request.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value}`)
    })
    
    // Check content length
    const contentLength = request.headers.get('content-length')
    const contentLengthMB = contentLength ? (parseInt(contentLength) / 1024 / 1024).toFixed(2) : 'unknown'
    
    console.log(`Content-Length: ${contentLength} bytes (${contentLengthMB} MB)`)
    
    // Try to parse form data with timeout
    const parseStart = Date.now()
    let formData: FormData
    let parseError: Error | null = null
    
    try {
      // Set a reasonable timeout for large files
      const parsePromise = request.formData()
      formData = await parsePromise
      
      const parseTime = Date.now() - parseStart
      console.log(`FormData parsed successfully in ${parseTime}ms`)
      
    } catch (error) {
      parseError = error as Error
      console.error('FormData parsing failed:', error)
      
      return NextResponse.json({
        success: false,
        error: 'Failed to parse FormData',
        details: {
          contentLengthMB,
          parseTime: Date.now() - parseStart,
          errorMessage: parseError.message,
          errorType: parseError.constructor.name
        }
      }, { status: 413 })
    }
    
    // Analyze files if parsing succeeded
    const files = formData.getAll('files') as File[]
    const fileInfo = files.map(file => ({
      name: file.name,
      size: file.size,
      sizeMB: (file.size / 1024 / 1024).toFixed(2),
      type: file.type
    }))
    
    const totalSize = files.reduce((sum, file) => sum + file.size, 0)
    const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2)
    
    console.log('Files analysis:', {
      count: files.length,
      totalSizeMB,
      files: fileInfo
    })
    
    return NextResponse.json({
      success: true,
      debug: {
        requestContentLengthMB: contentLengthMB,
        filesCount: files.length,
        totalFileSizeMB: totalSizeMB,
        parseTimeMs: Date.now() - parseStart,
        files: fileInfo,
        serverConfig: {
          nodeVersion: process.version,
          platform: process.platform,
          memoryUsage: process.memoryUsage(),
        }
      }
    })
    
  } catch (error) {
    console.error('Debug endpoint error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.constructor.name : 'UnknownError'
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'PDF Merge Debug Endpoint',
    purpose: 'Use POST with FormData to debug file upload issues',
    maxExpectedSize: '200MB (configured in next.config.mjs)'
  })
}
