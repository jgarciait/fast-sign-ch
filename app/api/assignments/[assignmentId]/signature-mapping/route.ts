import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// GET - Obtener mapeo de firmas de una asignación
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const { assignmentId } = await context.params
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify assignment exists and user has access
    const { data: assignment, error: assignmentError } = await supabase
      .from('document_assignments')
      .select(`
        id,
        assigned_to_user_id,
        assigned_by_user_id,
        document_id,
        title
      `)
      .eq('id', assignmentId)
      .single()

    if (assignmentError || !assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    // Check if user has access to this assignment
    if (assignment.assigned_to_user_id !== user.id && assignment.assigned_by_user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get signature mappings for this assignment
    const { data: mappings, error: mappingsError } = await supabase
      .from('assignment_signature_mappings')
      .select('*')
      .eq('assignment_id', assignmentId)
      .order('signature_type', { ascending: true })

    if (mappingsError) {
      console.error('Error fetching signature mappings:', mappingsError)
      return NextResponse.json({ error: 'Failed to fetch mappings' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      mappings: mappings || [],
      assignment: {
        id: assignment.id,
        title: assignment.title,
        document_id: assignment.document_id
      }
    })

  } catch (error) {
    console.error('Error in signature mapping GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Crear o actualizar mapeo de firmas para una asignación
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const { assignmentId } = await context.params
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { mappings } = body

    if (!mappings || !Array.isArray(mappings)) {
      return NextResponse.json({ error: 'Missing or invalid mappings array' }, { status: 400 })
    }

    if (mappings.length === 0) {
      return NextResponse.json({ error: 'At least one signature mapping is required' }, { status: 400 })
    }

    // Verify assignment exists and user has access
    const { data: assignment, error: assignmentError } = await supabase
      .from('document_assignments')
      .select(`
        id,
        assigned_to_user_id,
        assigned_by_user_id,
        document_id,
        title,
        status
      `)
      .eq('id', assignmentId)
      .single()

    if (assignmentError || !assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    // Check if user has access to create/update mappings (only creator can map)
    if (assignment.assigned_by_user_id !== user.id) {
      return NextResponse.json({ error: 'Only the assignment creator can create signature mappings' }, { status: 403 })
    }

    // Check assignment status - don't allow mapping for completed assignments
    if (assignment.status === 'completed' || assignment.status === 'cancelled') {
      return NextResponse.json({ 
        error: 'Cannot modify signature mapping for completed or cancelled assignments',
        currentStatus: assignment.status
      }, { status: 423 })
    }

    // Validate each mapping
    for (const mapping of mappings) {
      if (!mapping.signature_type || !['chofer', 'client'].includes(mapping.signature_type)) {
        return NextResponse.json({ 
          error: 'Invalid signature_type. Must be "chofer" or "client"' 
        }, { status: 400 })
      }

      if (!mapping.page_number || mapping.page_number < 1) {
        return NextResponse.json({ 
          error: 'Invalid page_number. Must be >= 1' 
        }, { status: 400 })
      }

      if (typeof mapping.x_coordinate !== 'number' || 
          typeof mapping.y_coordinate !== 'number' ||
          mapping.x_coordinate < 0 || mapping.x_coordinate > 1 ||
          mapping.y_coordinate < 0 || mapping.y_coordinate > 1) {
        return NextResponse.json({ 
          error: 'Invalid coordinates. Must be between 0 and 1' 
        }, { status: 400 })
      }
    }

    // Delete existing mappings for this assignment
    const { error: deleteError } = await supabase
      .from('assignment_signature_mappings')
      .delete()
      .eq('assignment_id', assignmentId)

    if (deleteError) {
      console.error('Error deleting existing mappings:', deleteError)
      return NextResponse.json({ error: 'Failed to update mappings' }, { status: 500 })
    }

    // Insert new mappings
    const mappingsToInsert = mappings.map(mapping => ({
      assignment_id: assignmentId,
      signature_type: mapping.signature_type,
      page_number: mapping.page_number,
      x_coordinate: mapping.x_coordinate,
      y_coordinate: mapping.y_coordinate,
      width: mapping.width || 0.15, // Default width 15% of page
      height: mapping.height || 0.08, // Default height 8% of page
      is_required: mapping.is_required !== false, // Default to true
      label: mapping.label || `Firma ${mapping.signature_type}`,
      placeholder_text: mapping.placeholder_text || `Firma aquí - ${mapping.signature_type}`,
      created_by: user.id
    }))

    const { data: insertedMappings, error: insertError } = await supabase
      .from('assignment_signature_mappings')
      .insert(mappingsToInsert)
      .select()

    if (insertError) {
      console.error('Error inserting new mappings:', insertError)
      return NextResponse.json({ error: 'Failed to save mappings' }, { status: 500 })
    }

    console.log(`✅ Saved ${insertedMappings?.length || 0} signature mappings for assignment ${assignmentId}`)

    return NextResponse.json({
      success: true,
      mappings: insertedMappings,
      message: `Signature mapping saved successfully for assignment ${assignment.title}`
    })

  } catch (error) {
    console.error('Error in signature mapping POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Eliminar mapeo de firmas de una asignación
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const { assignmentId } = await context.params
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify assignment exists and user has access
    const { data: assignment, error: assignmentError } = await supabase
      .from('document_assignments')
      .select('id, assigned_by_user_id, title')
      .eq('id', assignmentId)
      .single()

    if (assignmentError || !assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    // Check if user has access (only creator can delete mappings)
    if (assignment.assigned_by_user_id !== user.id) {
      return NextResponse.json({ error: 'Only the assignment creator can delete signature mappings' }, { status: 403 })
    }

    // Delete mappings
    const { error: deleteError } = await supabase
      .from('assignment_signature_mappings')
      .delete()
      .eq('assignment_id', assignmentId)

    if (deleteError) {
      console.error('Error deleting mappings:', deleteError)
      return NextResponse.json({ error: 'Failed to delete mappings' }, { status: 500 })
    }

    console.log(`✅ Deleted signature mappings for assignment ${assignmentId}`)

    return NextResponse.json({
      success: true,
      message: 'Signature mappings deleted successfully'
    })

  } catch (error) {
    console.error('Error in signature mapping DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
