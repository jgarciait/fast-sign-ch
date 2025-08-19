import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

// GET /api/customers - Get customers (metadata only)
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    const { data, error } = await supabase
      .from("customers")
      .select("id, user_id, first_name, last_name, email, telephone, postal_address, created_at")
      .or(`user_id.eq.${user.id},user_id.is.null`) // User's customers or legacy customers
      .order("created_at", { ascending: false })
      .limit(50) // Reasonable limit

    if (error) {
      console.error("Database error in GET /api/customers:", error)
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      customers: data || []
    })
  } catch (error) {
    console.error("Error in GET /api/customers:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unexpected error occurred" },
      { status: 500 }
    )
  }
}
