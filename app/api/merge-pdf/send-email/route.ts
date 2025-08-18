import { NextRequest, NextResponse } from 'next/server'
import { sendMergedDocumentByEmail } from '@/app/actions/merge-pdf-actions'

export async function POST(request: NextRequest) {
  try {
    console.log('Send merged PDF email API endpoint called')
    
    const body = await request.json()
    const { documentId, recipientEmail, documentName, senderName } = body
    
    if (!documentId || !recipientEmail || !documentName) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: documentId, recipientEmail, documentName' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(recipientEmail)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      )
    }

    console.log(`Preparing to send document ${documentId} to ${recipientEmail}`)

    // Send document via email
    const result = await sendMergedDocumentByEmail(
      documentId,
      recipientEmail,
      documentName,
      senderName
    )

    if (!result.success) {
      console.error('Email sending failed:', result.error)
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    console.log('Email prepared successfully')
    
    return NextResponse.json({
      success: true,
      message: result.message,
      emailData: result.emailData,
      documentUrl: result.documentUrl
    })

  } catch (error) {
    console.error('Send email API error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { message: 'Send merged PDF email API is running. Use POST to send email.' },
    { status: 200 }
  )
} 