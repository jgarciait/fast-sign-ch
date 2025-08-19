import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

// GET /api/signature-templates - Get signature templates (metadata only)
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const url = new URL(request.url)
  const includeDefault = url.searchParams.get('includeDefault') === 'true'

  try {
    // Only load metadata, never signature_data
    const { data, error } = await supabase
      .from("signature_templates")
      .select("id, user_id, template_name, signature_type, is_default, is_active, created_at, updated_at")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10)

    if (error) {
      console.error("Database error in GET /api/signature-templates:", error)
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      )
    }

    const templates = data || []
    let defaultTemplate = null

    if (includeDefault) {
      defaultTemplate = templates.find(t => t.is_default) || null
    }

    return NextResponse.json({
      templates: templates.filter(t => !t.is_default), // Exclude default from templates
      defaultTemplate
    })
  } catch (error) {
    console.error("Error in GET /api/signature-templates:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unexpected error occurred" },
      { status: 500 }
    )
  }
}

// POST /api/signature-templates - Create new signature template
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { template_name, signature_data, signature_type = 'canvas', is_default = false } = body

    if (!template_name || !signature_data) {
      return NextResponse.json(
        { error: "template_name and signature_data are required" },
        { status: 400 }
      )
    }

    // If making this default, update existing default to false
    if (is_default) {
      await supabase
        .from("signature_templates")
        .update({ is_default: false })
        .eq("user_id", user.id)
        .eq("is_default", true)
    }

    const { data, error } = await supabase
      .from("signature_templates")
      .insert({
        user_id: user.id,
        template_name,
        signature_data,
        signature_type,
        is_default,
        is_active: true
      })
      .select("id, user_id, template_name, signature_type, is_default, is_active, created_at, updated_at")
      .single()

    if (error) {
      console.error("Database error in POST /api/signature-templates:", error)
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ template: data })
  } catch (error) {
    console.error("Error in POST /api/signature-templates:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unexpected error occurred" },
      { status: 500 }
    )
  }
}
