import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // GLOBAL ACCESS: Get all templates for all users (not just current user)
    const { data: templates, error } = await supabase
      .from('signature_mapping_templates')
      .select(`
        *,
        document_signature_mappings!signature_mapping_templates_document_mapping_id_fkey(
          signature_fields
        )
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching templates:', error)
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
    }

    // Get all unique creator IDs
    const creatorIds = [...new Set(templates?.map(template => template.created_by).filter(Boolean))]
    
    // Get creator information for all templates
    const { data: creators } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', creatorIds)

    // Create a map of creator information
    const creatorsMap = new Map(creators?.map(creator => [creator.id, creator]) || [])

    // Transform the data to include signature_fields at the template level
    const transformedTemplates = templates?.map(template => {
      const creator = creatorsMap.get(template.created_by)
      
      return {
        ...template,
        signature_fields: template.document_signature_mappings?.signature_fields || [],
        creator: {
          full_name: creator?.full_name || 'Usuario',
          email: creator?.email || ''
        }
      }
    }) || []

    return NextResponse.json({ templates: transformedTemplates })
  } catch (error) {
    console.error('Error in GET /api/signature-mapping-templates:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, signature_fields, document_id } = body

    if (!name || !signature_fields || !document_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // First create or update a document signature mapping
    const { data: mapping, error: mappingError } = await supabase
      .from('document_signature_mappings')
      .upsert({
        document_id,
        signature_fields,
        created_by: user.id,
        is_template: true
      }, {
        onConflict: 'document_id'
      })
      .select()
      .single()

    if (mappingError) {
      console.error('Error creating document mapping:', mappingError)
      return NextResponse.json({ error: 'Failed to create document mapping' }, { status: 500 })
    }

    // Then create the template referencing the mapping
    const { data: template, error } = await supabase
      .from('signature_mapping_templates')
      .insert({
        name,
        description,
        created_by: user.id,
        document_mapping_id: mapping.id
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating template:', error)
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
    }

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Error in POST /api/signature-mapping-templates:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
