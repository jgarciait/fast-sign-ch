import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileRecordId: string }> }
) {
  try {
    const resolvedParams = await params
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Try to get categories from the database if the table exists
    try {
      const { data: categories, error: categoriesError } = await supabase
        .from('document_categories')
        .select('*')
        .eq('file_record_id', resolvedParams.fileRecordId)
        .order('sort_order', { ascending: true })

      if (categoriesError) {
        if (categoriesError.code === '42P01') {
          // Table doesn't exist yet, return empty array
          return NextResponse.json({ categories: [] })
        }
        throw categoriesError
      }

      return NextResponse.json({
        categories: categories || []
      })

    } catch (error: any) {
      if (error.code === '42P01') {
        // Table doesn't exist yet, return empty array
        return NextResponse.json({ categories: [] })
      }
      throw error
    }

  } catch (error) {
    console.error('Error in categories API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fileRecordId: string }> }
) {
  try {
    const resolvedParams = await params
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, color, icon, parentCategoryId } = body

    if (!name) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    }

    // Check if document_categories table exists and create category if it does
    try {
      const { data: category, error: createError } = await supabase
        .from('document_categories')
        .insert({
          name,
          color: color || '#3B82F6',
          icon: icon || 'folder',
          parent_category_id: parentCategoryId || null,
          file_record_id: resolvedParams.fileRecordId,
          created_by: user.id
        })
        .select()
        .single()

      if (createError) {
        if (createError.code === '42P01') {
          // Table doesn't exist yet
          return NextResponse.json({ 
            message: 'Categories feature not yet available. Please run database migrations first.' 
          }, { status: 202 })
        }
        throw createError
      }

      return NextResponse.json({ category })

    } catch (dbError: any) {
      if (dbError.code === '42P01') {
        return NextResponse.json({ 
          message: 'Categories feature not yet available. Please run database migrations first.' 
        }, { status: 202 })
      }
      throw dbError
    }

  } catch (error) {
    console.error('Error creating category:', error)
    return NextResponse.json({ error: 'Error creating category' }, { status: 500 })
  }
}
