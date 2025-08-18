import { NextRequest, NextResponse } from 'next/server'
import { uploadFileResumable } from '@/app/actions/merge-pdf-actions'

export async function POST(request: NextRequest) {
  try {
    console.log('Save resumable endpoint called')
    
    const body = await request.json()
    const { pdfData, fileName, compressionInfo } = body

    if (!pdfData || !fileName) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: pdfData, fileName' },
        { status: 400 }
      )
    }

    // Convert base64 back to Uint8Array
    const pdfBytes = Uint8Array.from(atob(pdfData), c => c.charCodeAt(0))
    
    console.log(`Starting resumable upload for: ${fileName} (${(pdfBytes.length / 1024 / 1024).toFixed(2)} MB)`)

    // Note: Since this is a server-side API route, we'll return metadata for the client
    // The actual TUS upload will be handled on the client side
    return NextResponse.json({
      success: true,
      message: 'Ready for resumable upload',
      fileSize: pdfBytes.length,
      fileName,
      compressionInfo,
      pdfData // Return the data for client-side upload
    })

  } catch (error) {
    console.error('Save resumable error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error preparing resumable upload' 
      },
      { status: 500 }
    )
  }
} 