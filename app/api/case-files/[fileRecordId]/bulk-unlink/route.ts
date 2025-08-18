import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ fileRecordId: string }> }
) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error('Authentication error:', userError)
      return NextResponse.json({ error: 'Unauthorized - user not authenticated' }, { status: 401 })
    }

    console.log('Bulk unlink request by user:', user.id)

    const body = await request.json()
    const params = await context.params
    const { documentIds } = body

    console.log('Bulk unlink request:', { fileRecordId: params.fileRecordId, documentIds })

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json({ error: 'Document IDs are required' }, { status: 400 })
    }

    // Verify user has access to the file record - use admin client for more reliable access
    const { data: fileRecord, error: fileRecordError } = await adminClient
      .from('file_records')
      .select('id, created_by, assigned_to_user_id')
      .eq('id', params.fileRecordId)
      .single()

    if (fileRecordError || !fileRecord) {
      console.error('File record not found:', fileRecordError)
      return NextResponse.json({ error: 'File record not found' }, { status: 404 })
    }

    console.log('File record found:', { 
      id: fileRecord.id, 
      created_by: fileRecord.created_by, 
      assigned_to: fileRecord.assigned_to_user_id,
      current_user: user.id 
    })

    // Check if user has permission to modify this file record
    // Allow if user is creator, assigned to the record, or if no specific assignment (global access)
    const hasPermission = fileRecord.created_by === user.id || 
                         fileRecord.assigned_to_user_id === user.id ||
                         !fileRecord.assigned_to_user_id // Allow if not specifically assigned

    if (!hasPermission) {
      console.log('User does not have permission to modify this file record')
      return NextResponse.json({ error: 'Unauthorized to modify this file record' }, { status: 403 })
    }

    // Use the bulk unlink function from the database - use admin client for reliable execution
    console.log('Executing bulk unlink for documents:', documentIds)
    const { data: result, error: unlinkError } = await adminClient
      .rpc('bulk_unlink_documents_from_case_file', { 
        p_document_ids: documentIds 
      })

    if (unlinkError) {
      console.error('Error bulk unlinking documents:', unlinkError)
      return NextResponse.json({ error: `Error unlinking documents: ${unlinkError.message}` }, { status: 500 })
    }

    console.log('Bulk unlink completed successfully. Count:', result)
    return NextResponse.json({
      unlinkedCount: result || 0,
      message: `${result || 0} documents unlinked successfully`
    })

  } catch (error) {
    console.error('Error in bulk unlink API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
