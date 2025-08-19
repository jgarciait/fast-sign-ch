import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

// POST /api/customer-signatures - Create new customer signature
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
    const { 
      customer_id, 
      signature_name, 
      signature_data, 
      signature_type = 'canvas', 
      is_default_for_customer = false 
    } = body

    if (!customer_id || !signature_name || !signature_data) {
      return NextResponse.json(
        { error: "customer_id, signature_name and signature_data are required" },
        { status: 400 }
      )
    }

    // If making this default for customer, update existing default to false
    if (is_default_for_customer) {
      await supabase
        .from("customer_signatures")
        .update({ is_default_for_customer: false })
        .eq("user_id", user.id)
        .eq("customer_id", customer_id)
        .eq("is_default_for_customer", true)
    }

    const { data, error } = await supabase
      .from("customer_signatures")
      .insert({
        user_id: user.id,
        customer_id,
        signature_name,
        signature_data,
        signature_type,
        is_default_for_customer
      })
      .select("id, user_id, customer_id, signature_name, signature_type, is_default_for_customer, created_at, updated_at")
      .single()

    if (error) {
      console.error("Database error in POST /api/customer-signatures:", error)
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ signature: data })
  } catch (error) {
    console.error("Error in POST /api/customer-signatures:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unexpected error occurred" },
      { status: 500 }
    )
  }
}
