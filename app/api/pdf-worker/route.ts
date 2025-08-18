import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET(request: NextRequest) {
  try {
    // Read the PDF worker file from the public directory
    const workerPath = join(process.cwd(), 'public', 'pdf.worker.mjs')
    const workerContent = readFileSync(workerPath)

    // Return the worker with proper headers
    return new NextResponse(workerContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  } catch (error) {
    console.error('Error serving PDF worker:', error)
    return new NextResponse('PDF worker not found', { status: 404 })
  }
} 