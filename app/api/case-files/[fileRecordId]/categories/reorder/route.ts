import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ fileRecordId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const params = await context.params
    const { categories } = body

    if (!categories || !Array.isArray(categories)) {
      return NextResponse.json({ error: 'Categories array is required' }, { status: 400 })
    }

    // Update each category's sort order
    const updatePromises = categories.map(async (categoryUpdate: { id: string; sortOrder: number }) => {
      const { error } = await supabase
        .from('document_categories')
        .update({ sort_order: categoryUpdate.sortOrder })
        .eq('id', categoryUpdate.id)
        .eq('file_record_id', params.fileRecordId)

      if (error) {
        console.error(`Error updating category ${categoryUpdate.id}:`, error)
        throw error
      }
    })

    await Promise.all(updatePromises)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in reorder categories API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
