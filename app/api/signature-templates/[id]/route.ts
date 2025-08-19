import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

// GET /api/signature-templates/[id] - Get signature data for a specific template
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const resolvedParams = await params
  const { id } = resolvedParams

  try {
    const { data, error } = await supabase
      .from("signature_templates")
      .select("signature_data")
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: "Signature template not found" }, { status: 404 })
      }
      console.error("Database error in GET /api/signature-templates/[id]:", error)
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      signature_data: data?.signature_data || null
    })
  } catch (error) {
    console.error("Error in GET /api/signature-templates/[id]:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unexpected error occurred" },
      { status: 500 }
    )
  }
}
