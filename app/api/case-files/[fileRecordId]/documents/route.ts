import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ fileRecordId: string }> }
) {
  try {
    const params = await context.params
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || 'all'
    
    const offset = (page - 1) * limit

    // Build query for documents with categories
    let query = supabase
      .from('case_file_documents_with_categories')
      .select('*', { count: 'exact' })
      .eq('file_record_id', params.fileRecordId)
      .order('created_at', { ascending: false })

    // Apply search filter
    if (search) {
      query = query.or(`file_name.ilike.%${search}%,document_type.ilike.%${search}%`)
    }

    // Apply category filter
    if (category !== 'all') {
      if (category === 'uncategorized') {
        query = query.is('category_id', null)
      } else {
        query = query.eq('category_id', category)
      }
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: documents, error: documentsError, count } = await query

    if (documentsError) {
      console.error('Error fetching documents:', documentsError)
      return NextResponse.json({ error: 'Error fetching documents' }, { status: 500 })
    }

    return NextResponse.json({
      documents: documents || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    })

  } catch (error) {
    console.error('Error in documents API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
