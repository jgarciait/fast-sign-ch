import { NextRequest, NextResponse } from 'next/server'
import { createClient } from "@/utils/supabase/server"

export async function POST(request: NextRequest) {
  try {
    console.log('Save PDF from memory API endpoint called')
    
    const body = await request.json()
    const { tempSessionId } = body
    
    if (!tempSessionId) {
      return NextResponse.json(
        { success: false, error: 'Missing tempSessionId' },
        { status: 400 }
      )
    }

    console.log('Retrieving PDF from server memory:', { tempSessionId })

    // Retrieve PDF data from server memory
    const globalAny = global as any
    const tempStorage = globalAny.tempPdfStorage
    
    if (!tempStorage || !tempStorage.has(tempSessionId)) {
      return NextResponse.json(
        { success: false, error: 'PDF data not found or expired' },
        { status: 404 }
      )
    }

    const tempData = tempStorage.get(tempSessionId)
    const { pdfData, compressionInfo, tempFileName, totalPages } = tempData

    console.log('Retrieved PDF from memory:', {
      sizeMB: (pdfData.length / 1024 / 1024).toFixed(2),
      totalPages
    })

    // Save using the existing function with progress simulation
    const { saveMergedDocument } = await import('@/app/actions/merge-pdf-actions')
    
    console.log('Starting upload with progress reporting...')
    
    // TODO: In future, implement real TUS progress with SSE
    // For now, use the existing save function
    const saveResult = await saveMergedDocument(
      pdfData,
      tempFileName,
      compressionInfo,
      totalPages
    )
    
    if (!saveResult.success) {
      throw new Error(saveResult.error || 'Failed to save PDF')
    }

    // Clean up from memory
    tempStorage.delete(tempSessionId)
    console.log('PDF saved and cleaned from memory:', {
      documentId: saveResult.documentId,
      remainingInMemory: tempStorage.size
    })

    return NextResponse.json({
      success: true,
      message: 'Documento guardado exitosamente',
      documentId: saveResult.documentId,
      documentUrl: saveResult.documentUrl
    })

  } catch (error) {
    console.error('Save PDF from memory API error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { message: 'Save PDF from memory API is running. Use POST to save PDFs.' },
    { status: 200 }
  )
} 