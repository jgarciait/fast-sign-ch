import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    console.log('Prepare document for signing API endpoint called')
    
    const body = await request.json()
    const { documentId, signingType, recipientEmails } = body
    
    if (!documentId || !signingType) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: documentId, signingType' },
        { status: 400 }
      )
    }

    if (!['fast-sign', 'sent-to-sign'].includes(signingType)) {
      return NextResponse.json(
        { success: false, error: 'signingType must be either "fast-sign" or "sent-to-sign"' },
        { status: 400 }
      )
    }

    if (signingType === 'sent-to-sign' && (!recipientEmails || recipientEmails.length === 0)) {
      return NextResponse.json(
        { success: false, error: 'recipientEmails required for sent-to-sign workflow' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const adminClient = createAdminClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Usuario no autenticado' },
        { status: 401 }
      )
    }

    // Get document details
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (docError || !document) {
      return NextResponse.json(
        { success: false, error: 'Documento no encontrado' },
        { status: 404 }
      )
    }

    // Verify user owns the document
    if (document.created_by !== user.id) {
      return NextResponse.json(
        { success: false, error: 'No tienes permisos para preparar este documento' },
        { status: 403 }
      )
    }

    let result: any = {
      success: true,
      documentId,
      signingType,
      documentUrl: '',
      availableActions: []
    }

    if (signingType === 'fast-sign') {
      // Prepare for fast-sign workflow
      
      // Update document type to indicate it's ready for fast-sign
      const { error: updateError } = await supabase
        .from('documents')
        .update({
          document_type: 'fast_sign',
          status: 'ready_for_signing',
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId)

      if (updateError) {
        console.error('Error updating document for fast-sign:', updateError)
        return NextResponse.json(
          { success: false, error: 'Error al preparar documento para fast-sign' },
          { status: 500 }
        )
      }

      // Generate URLs for fast-sign workflow
      const editUrl = `/fast-sign/edit/${documentId}`
      const printUrl = `/api/fast-sign/${documentId}/print`
      
      // Get public URL for the document
      const { data: { publicUrl } } = supabase.storage
        .from('public-documents')
        .getPublicUrl(document.file_path)

      result = {
        ...result,
        documentUrl: publicUrl,
        editUrl,
        printUrl,
        availableActions: [
          'edit_signatures',
          'add_annotations',
          'print_document',
          'archive_document'
        ],
        message: 'Documento preparado para Fast Sign exitosamente'
      }

    } else if (signingType === 'sent-to-sign') {
      // Prepare for sent-to-sign workflow
      
      // Update document type to indicate it's ready for sent-to-sign
      const { error: updateError } = await supabase
        .from('documents')
        .update({
          document_type: 'email',
          status: 'ready_for_signing',
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId)

      if (updateError) {
        console.error('Error updating document for sent-to-sign:', updateError)
        return NextResponse.json(
          { success: false, error: 'Error al preparar documento para sent-to-sign' },
          { status: 500 }
        )
      }

      // Validate recipient emails
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const invalidEmails = recipientEmails.filter((email: string) => !emailRegex.test(email))
      
      if (invalidEmails.length > 0) {
        return NextResponse.json(
          { success: false, error: `Emails inválidos: ${invalidEmails.join(', ')}` },
          { status: 400 }
        )
      }

      // Get public URL for the document
      const { data: { publicUrl } } = supabase.storage
        .from('public-documents')
        .getPublicUrl(document.file_path)

      result = {
        ...result,
        documentUrl: publicUrl,
        recipientEmails,
        availableActions: [
          'create_signature_mapping',
          'send_for_signature',
          'track_signing_status',
          'view_completed_signatures'
        ],
        message: `Documento preparado para Sent-to-Sign con ${recipientEmails.length} destinatario(s)`
      }
    }

    console.log(`Document ${documentId} prepared for ${signingType} successfully`)
    
    return NextResponse.json(result)

  } catch (error) {
    console.error('Prepare for signing API error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { 
      message: 'Prepare document for signing API is running. Use POST to prepare document.',
      supportedSigningTypes: ['fast-sign', 'sent-to-sign'],
      requiredFields: {
        'fast-sign': ['documentId', 'signingType'],
        'sent-to-sign': ['documentId', 'signingType', 'recipientEmails']
      }
    },
    { status: 200 }
  )
} 