import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ fileRecordId: string, categoryId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const params = await context.params
    const { name, color, icon, description } = body

    if (!name) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    }

    const { data: category, error: updateError } = await supabase
      .from('document_categories')
      .update({
        name,
        color: color || '#3B82F6',
        icon: icon || 'folder',
        description: description || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.categoryId)
      .eq('file_record_id', params.fileRecordId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating category:', updateError)
      return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
    }

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    return NextResponse.json({ category })

  } catch (error) {
    console.error('Error in update category API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ fileRecordId: string, categoryId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = await context.params

    // First, move any documents in this category to uncategorized
    const { error: moveDocsError } = await supabase
      .from('documents')
      .update({ category_id: null })
      .eq('category_id', params.categoryId)

    if (moveDocsError) {
      console.error('Error moving documents:', moveDocsError)
      return NextResponse.json({ error: 'Failed to move documents from category' }, { status: 500 })
    }

    // Delete the category
    const { error: deleteError } = await supabase
      .from('document_categories')
      .delete()
      .eq('id', params.categoryId)
      .eq('file_record_id', params.fileRecordId)

    if (deleteError) {
      console.error('Error deleting category:', deleteError)
      return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in delete category API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
