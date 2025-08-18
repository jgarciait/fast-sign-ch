import { NextRequest, NextResponse } from 'next/server'
import { mergePdfFromStorage } from '@/app/actions/merge-pdf-from-storage-actions'

export async function POST(request: NextRequest) {
  try {
    console.log('PDF merge v2 API endpoint called (storage-based)')
    
    // Parse JSON body (much smaller than FormData!)
    const body = await request.json()
    const { filePaths, fileName, sessionId } = body
    
    // Validate input
    if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No file paths provided' },
        { status: 400 }
      )
    }
    
    if (!fileName || !sessionId) {
      return NextResponse.json(
        { success: false, error: 'Missing fileName or sessionId' },
        { status: 400 }
      )
    }
    
    console.log(`Processing merge request:`)
    console.log(`- Files: ${filePaths.length}`)
    console.log(`- Session: ${sessionId}`)
    console.log(`- Output: ${fileName}`)
    
    // Call server action to process the merge
    const result = await mergePdfFromStorage({
      filePaths,
      fileName,
      sessionId
    })
    
    if (!result.success) {
      console.error('Merge failed:', result.error)
      return NextResponse.json(result, { status: 500 })
    }
    
    console.log('Merge completed successfully')
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('Error in merge-pdf-v2 API:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'PDF Merge v2 API - Storage-based merging (JSON payload)',
    info: 'This endpoint accepts JSON with file paths instead of FormData with files'
  })
}
