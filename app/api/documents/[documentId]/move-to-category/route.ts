import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ documentId: string }> }
) {
  try {
    const supabase = await createClient()
    const { categoryId } = await request.json()
    const params = await context.params
    
    // DEBUG: Log the request details
    console.log('🔄 Move-to-category API called:', {
      documentId: params.documentId,
      categoryId: categoryId,
      categoryIdType: typeof categoryId,
      categoryIdIsNull: categoryId === null,
      categoryIdIsUndefined: categoryId === undefined
    })
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // First, get the current document to see what we're working with
    const { data: currentDoc, error: currentError } = await supabase
      .from('documents')
      .select('id, category_id, file_name')
      .eq('id', params.documentId)
      .single()

    if (currentError || !currentDoc) {
      console.error('❌ Document not found before update:', currentError)
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    console.log('📄 Current document before update:', currentDoc)

    // Update the document's category
    const { data, error } = await supabase
      .from('documents')
      .update({ 
        category_id: categoryId,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.documentId)
      .select('id, category_id, file_name, updated_at')

    if (error) {
      console.error('❌ Error updating document category:', error)
      return NextResponse.json({ error: 'Failed to update document category' }, { status: 500 })
    }

    if (!data || data.length === 0) {
      console.error('❌ Document not found after update:', params.documentId)
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // DEBUG: Log the update attempt result  
    console.log('🔍 Update query result:', {
      documentId: params.documentId,
      requestedCategoryId: categoryId,
      requestedIsNull: categoryId === null,
      returnedData: data,
      dataLength: data ? data.length : 0
    })

        // Simple update - no trigger interference after removing auto-categorization trigger
    console.log('📝 Performing simple category update...')

    // Let's also do a separate query to verify the current state after experiments
    const { data: verifyDoc, error: verifyError } = await supabase
      .from('documents')
      .select('id, category_id, file_name, updated_at')
      .eq('id', params.documentId)
      .single()

    console.log('🔎 Final verification after experiments:', {
      documentId: params.documentId,
      verificationDoc: verifyDoc,
      verificationError: verifyError,
      wasActuallyUpdated: verifyDoc?.category_id === categoryId,
      currentCategoryId: verifyDoc?.category_id,
      requestedCategoryId: categoryId
    })

    // Check if the update actually worked
    if (verifyDoc && verifyDoc.category_id !== categoryId) {
      console.error('❌ Update failed - category_id was not changed:', {
        expected: categoryId,
        actual: verifyDoc.category_id,
        documentId: params.documentId
      })
      
      return NextResponse.json({ 
        error: 'Failed to update document category - database did not persist the change',
        details: {
          requested: categoryId,
          actual: verifyDoc.category_id
        }
      }, { status: 500 })
    }

    console.log('✅ Document category successfully updated and verified!')

    return NextResponse.json({ 
      success: true, 
      document: verifyDoc || data[0],
      message: 'Document moved successfully'
    })

  } catch (error) {
    console.error('Error in move-to-category API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
