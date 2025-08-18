import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await context.params
    const supabase = await createClient()
    
    // Check for token in query params (for public access)
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    
    if (token) {
      // Public access with token - validate token and document access
      try {
        const decoded = Buffer.from(token, "base64").toString("utf-8")
        
        // Handle new token format (email:signingId) and legacy format (email only)
        let decodedToken: string
        if (decoded.includes(':')) {
          // New format: extract email from email:signingId
          decodedToken = decoded.split(':')[0]
        } else {
          // Legacy format: token contains only email
          decodedToken = decoded
        }
        
        if (!decodedToken.includes("@") || !decodedToken.includes(".")) {
          return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        }
        
        // Token is valid, allow access to signature mapping for public signing
        const { data: mapping, error } = await supabase
          .from('document_signature_mappings')
          .select('*')
          .eq('document_id', documentId)
          .single()

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching document mapping:', error)
          return NextResponse.json({ error: 'Failed to fetch document mapping' }, { status: 500 })
        }

        return NextResponse.json({ mapping })
      } catch (tokenError) {
        return NextResponse.json({ error: 'Invalid token format' }, { status: 401 })
      }
    }
    
    // Regular authenticated access
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get document mapping
    const { data: mapping, error } = await supabase
      .from('document_signature_mappings')
      .select('*')
      .eq('document_id', documentId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error fetching document mapping:', error)
      return NextResponse.json({ error: 'Failed to fetch document mapping' }, { status: 500 })
    }

    return NextResponse.json({ mapping })
  } catch (error) {
    console.error('Error in GET /api/documents/[documentId]/signature-mapping:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await context.params
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { signature_fields, template_id } = body

    if (!signature_fields || !Array.isArray(signature_fields)) {
      return NextResponse.json({ error: 'Missing signature_fields' }, { status: 400 })
    }

    if (signature_fields.length === 0) {
      return NextResponse.json({ error: 'At least one signature field is required' }, { status: 400 })
    }

    // Verify document exists and user has access
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, created_by, status, file_name')
      .eq('id', documentId)
      .single()

    if (docError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (document.created_by !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // CRITICAL: Block mapping only for certain restricted statuses
    // Allow re-mapping of signed documents for additional signatures
    const blockingStatuses = ["returned", "completed"]
    if (blockingStatuses.includes(document.status?.toLowerCase() || "")) {
      console.error(`❌ Mapping blocked: Document "${document.file_name}" is in status "${document.status}" - cannot modify mapping in this state`)
      return NextResponse.json({
        error: "Cannot modify signature mapping in current document state",
        details: `Document status: ${document.status}`,
        currentStatus: document.status
      }, { status: 423 }) // 423 Locked
    }

    // Upsert document mapping
    const { data: mapping, error } = await supabase
      .from('document_signature_mappings')
      .upsert({
        document_id: documentId,
        template_id,
        signature_fields,
        created_by: user.id
      }, {
        onConflict: 'document_id'
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving document mapping:', error)
      return NextResponse.json({ error: 'Failed to save document mapping' }, { status: 500 })
    }

    return NextResponse.json({ mapping })
  } catch (error) {
    console.error('Error in POST /api/documents/[documentId]/signature-mapping:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await context.params
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify document exists and user has access
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, created_by, status, file_name')
      .eq('id', documentId)
      .single()

    if (docError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (document.created_by !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // CRITICAL: Block mapping deletion only for certain restricted statuses
    // Allow re-mapping of signed documents for additional signatures
    const blockingStatuses = ["returned", "completed"]
    if (blockingStatuses.includes(document.status?.toLowerCase() || "")) {
      console.error(`❌ Mapping deletion blocked: Document "${document.file_name}" is in status "${document.status}" - cannot modify mapping in this state`)
      return NextResponse.json({
        error: "Cannot delete signature mapping in current document state",
        details: `Document status: ${document.status}`,
        currentStatus: document.status
      }, { status: 423 }) // 423 Locked
    }

    // Delete document mapping
    const { error } = await supabase
      .from('document_signature_mappings')
      .delete()
      .eq('document_id', documentId)

    if (error) {
      console.error('Error deleting document mapping:', error)
      return NextResponse.json({ error: 'Failed to delete document mapping' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/documents/[documentId]/signature-mapping:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
