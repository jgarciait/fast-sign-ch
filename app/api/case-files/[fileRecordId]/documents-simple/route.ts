import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ fileRecordId: string }> }
) {
  try {
    const params = await context.params
    console.log('🔍 Documents-simple API called for fileRecordId:', params.fileRecordId)
    
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      console.log('❌ User not authenticated:', userError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('✅ User authenticated:', user.id)

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    
    const offset = (page - 1) * limit
    
    console.log('📊 Query parameters:', { page, limit, search, offset, fileRecordId: params.fileRecordId })

    // Query documents with signature status and category information
    let query = supabase
      .from('documents')
      .select(`
        id,
        file_name,
        file_path,
        file_size,
        file_type,
        created_at,
        updated_at,
        status,
        document_type,
        category_id,
        document_categories!left (
          id,
          name,
          color,
          icon
        )
      `, { count: 'exact' })
      .eq('file_record_id', params.fileRecordId)
      .order('created_at', { ascending: false })

    // Apply search filter
    if (search) {
      query = query.or(`file_name.ilike.%${search}%,document_type.ilike.%${search}%`)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: documents, error: documentsError, count } = await query

    if (documentsError) {
      console.error('❌ Error fetching documents:', documentsError)
      return NextResponse.json({ error: 'Error fetching documents' }, { status: 500 })
    }

    // Get signature status for all documents
    let documentsWithSignatures = documents || []
    
    if (documents && documents.length > 0) {
      const documentIds = documents.map(doc => doc.id)
      
      // Check for signatures in document_signatures table
      const { data: signatureData } = await supabase
        .from('document_signatures')
        .select('document_id')
        .in('document_id', documentIds)
        .eq('status', 'signed')
      
      // Check for signature annotations
      const { data: annotationData } = await supabase
        .from('document_annotations')
        .select('document_id, annotations')
        .in('document_id', documentIds)
      
      const documentsWithSignatureRecords = new Set(signatureData?.map(s => s.document_id) || [])
      const documentsWithSignatureAnnotations = new Set()
      
      // Check annotations for signature types
      annotationData?.forEach(annotation => {
        try {
          const annotations = annotation.annotations
          if (Array.isArray(annotations)) {
            const hasSignatureAnnotations = annotations.some(ann => ann.type === 'signature')
            if (hasSignatureAnnotations) {
              documentsWithSignatureAnnotations.add(annotation.document_id)
            }
          }
        } catch (error) {
          // Ignore parsing errors
        }
      })
      
      // Add signature status to documents
      documentsWithSignatures = documents.map(doc => {
        const category = Array.isArray(doc.document_categories) ? doc.document_categories[0] : doc.document_categories
        return {
          ...doc,
          hasSigned: documentsWithSignatureRecords.has(doc.id) || documentsWithSignatureAnnotations.has(doc.id),
          categoryName: category?.name || null,
          categoryColor: category?.color || null,
          categoryIcon: category?.icon || null,
          isUncategorized: !doc.category_id
        }
      })
    }

    console.log('📋 Documents query result:', { 
      documentsCount: documentsWithSignatures?.length || 0, 
      totalCount: count,
      sampleDocument: documentsWithSignatures?.[0]
    })

    return NextResponse.json({
      documents: documentsWithSignatures || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    })

  } catch (error) {
    console.error('Error in documents-simple API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
