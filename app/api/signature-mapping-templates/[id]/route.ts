import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, signature_fields } = body

    // Update template name/description - Global access
    const { data: template, error } = await supabase
      .from('signature_mapping_templates')
      .update({
        name,
        description,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating template:', error)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Template not found or access denied' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
    }

    // Update the associated document mapping if signature_fields provided
    if (signature_fields && template.document_mapping_id) {
      const { error: mappingError } = await supabase
        .from('document_signature_mappings')
        .update({
          signature_fields,
          updated_at: new Date().toISOString()
        })
        .eq('id', template.document_mapping_id)

      if (mappingError) {
        console.error('Error updating document mapping:', mappingError)
        return NextResponse.json({ error: 'Failed to update signature fields' }, { status: 500 })
      }
    }

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Error in PUT /api/signature-mapping-templates/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Step 1: Remove references from document_signature_mappings that point to this template
    // Set template_id to NULL for any document mappings that reference this template
    console.log(`Removing template references from document_signature_mappings for template ${id}...`)
    const { error: updateMappingsError } = await supabase
      .from('document_signature_mappings')
      .update({ template_id: null })
      .eq('template_id', id)

    if (updateMappingsError) {
      console.error('Error updating document mappings:', updateMappingsError)
      return NextResponse.json({ error: 'Failed to remove template references' }, { status: 500 })
    }

    // Step 2: Now safely delete the template
    console.log(`Deleting template ${id}...`)
    const { error } = await supabase
      .from('signature_mapping_templates')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting template:', error)
      return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/signature-mapping-templates/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, newFileName } = body

    if (action === 'create_document') {
      // Import the function dynamically to avoid circular dependencies
      const { createDocumentFromTemplate } = await import('@/app/actions/fast-sign-actions')
      
      const result = await createDocumentFromTemplate(id, newFileName)
      
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }

      return NextResponse.json({ 
        document: result.document,
        message: 'Document created successfully from template'
      })
    }

    if (action === 'get_document_id') {
      // Get the document ID associated with this template
      const { data: template, error } = await supabase
        .from('signature_mapping_templates')
        .select(`
          document_signature_mappings!signature_mapping_templates_document_mapping_id_fkey(
            document_id,
            documents(
              id,
              file_name,
              created_at
            )
          )
        `)
        .eq('id', id)
        .single()

      if (error || !template) {
        console.error('Error fetching template:', error)
        return NextResponse.json({ error: 'Template not found' }, { status: 404 })
      }

      const documentId = template.document_signature_mappings?.document_id
      const documentInfo = template.document_signature_mappings?.documents

      if (!documentId) {
        return NextResponse.json({ error: 'No document associated with this template' }, { status: 404 })
      }

      return NextResponse.json({ 
        document_id: documentId,
        document_info: documentInfo
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error in POST /api/signature-mapping-templates/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
