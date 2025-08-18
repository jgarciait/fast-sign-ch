import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let integrations = null

    // First try to get integrations using the existing function
    try {
      const { data, error } = await supabase
        .rpc('get_available_integrations', { p_user_id: user.id })

      if (!error && data) {
        integrations = data
      }
    } catch (error) {
      console.log("Function approach failed, trying direct query:", error)
    }

    // Fallback to direct query if function fails
    if (!integrations) {
      const { data, error } = await supabase
        .from("integration_settings")
        .select("*")
        .eq("is_enabled", true)

      if (error) {
        console.error("Error fetching integrations:", error)
        return NextResponse.json({ error: "Failed to fetch integrations" }, { status: 500 })
      }

      integrations = data
    }

    // Transform the data to match expected format
    const transformedIntegrations = (integrations || []).map((integration: any) => ({
      id: integration.id,
      name: integration.integration_name,
      display_name: getDisplayName(integration.integration_name),
      type: 'aquarius', // All integrations are currently Aquarius type
      created_at: integration.created_at,
      is_enabled: integration.is_enabled,
      is_global: true, // All integrations are now global
      is_owner: integration.user_id === user.id,
      is_configured: !!(integration.settings?.api_url || integration.settings?.api_key || integration.settings?.api_user)
    }))

    return NextResponse.json(transformedIntegrations)
  } catch (error) {
    console.error("Error in integrations API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Helper function to get display name
function getDisplayName(integrationName: string): string {
  switch (integrationName) {
    case 'aquarius_software':
      return 'Aquarius Software'
    case 'stripe':
      return 'Stripe'
    case 'quickbooks':
      return 'QuickBooks'
    case 'paypal':
      return 'PayPal'
    default:
      return integrationName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }
}
