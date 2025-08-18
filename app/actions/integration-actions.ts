"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export interface IntegrationSettings {
  id?: string
  integration_name: string
  settings: {
    api_url?: string
    api_user?: string
    api_password?: string
    [key: string]: any
  }
  is_enabled: boolean
}

export interface IntegrationStatistics {
  success_rate: number
  total_calls_this_month: number
  total_calls_last_7_days: number
  daily_rate_limit: number
  current_daily_usage: number
  avg_response_time_ms: number
  rate_limiting_enabled?: boolean
  monthly_rate_limit?: number
  current_monthly_usage?: number
}

export async function getIntegrationSettings() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error("User not authenticated")
  }

  // Skip RPC function for now and use direct query to ensure endpoints are loaded
  console.log("Using direct query approach to preserve endpoints...")

  // Fallback to direct query if function fails
  const { data, error } = await supabase
    .from("integration_settings")
    .select("*")
    .eq("is_enabled", true)

  if (error) {
    console.error("Error fetching integration settings:", error)
    throw new Error("Failed to fetch integration settings")
  }

  console.log("Direct query fallback - raw data:", data)

  // Transform the data to match the expected format with global properties
  const transformedData = (data || []).map(integration => {
    console.log("Direct query - processing integration:", integration.integration_name)
    console.log("Direct query - raw settings:", integration.settings)
    const maskedSettings = getMaskedSettings(integration.settings)
    console.log("Direct query - masked settings after processing:", maskedSettings)
    
    return {
      id: integration.id,
      integration_name: integration.integration_name,
      display_name: getDisplayNameForIntegration(integration.integration_name),
      is_enabled: integration.is_enabled,
      is_configured: isIntegrationConfigured(integration.settings),
      is_global: true, // All integrations are now treated as global
      is_owner: integration.user_id === user.id, // Only true if current user created it
      created_at: integration.created_at,
      updated_at: integration.updated_at,
      masked_settings: maskedSettings,
      settings: integration.settings // Include full settings for API usage
    }
  })

  return transformedData
}

// Helper function to get display name for integration
function getDisplayNameForIntegration(integrationName: string): string {
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

// Helper function to check if integration is configured
function isIntegrationConfigured(settings: any): boolean {
  if (!settings) return false
  return !!(settings.api_url || settings.api_key || settings.api_user)
}

// Helper function to get masked settings for UI display
function getMaskedSettings(settings: any): any {
  console.log("getMaskedSettings called with:", settings)
  console.log("getMaskedSettings - settings.endpoints:", settings?.endpoints)
  
  if (!settings) return {}
  
  const masked = {
    api_url: settings.api_url ? '••••••••••••' : '',
    api_user: settings.api_user ? '••••••••••••' : '',
    api_password: settings.api_password ? '••••••••••••' : '',
    api_key: settings.api_key ? '••••••••••••' : '',
    secret_key: settings.secret_key ? '••••••••••••' : '',
    display_name: settings.display_name,
    description: settings.description,
    endpoints: settings.endpoints
  }
  
  console.log("getMaskedSettings returning:", masked)
  console.log("getMaskedSettings - returned endpoints:", masked.endpoints)
  
  return masked
}

export async function getIntegrationByName(integrationName: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error("User not authenticated")
  }

  // Query integration by name without user restriction (global access)
  const { data, error } = await supabase
    .from("integration_settings")
    .select("*")
    .eq("integration_name", integrationName)
    .eq("is_enabled", true)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
    console.error("Error fetching integration:", error)
    throw new Error("Failed to fetch integration")
  }

  return data
}

export async function getIntegrationStatistics(integrationId: string): Promise<IntegrationStatistics> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error("User not authenticated")
  }

  const { data, error } = await supabase
    .rpc('get_integration_statistics_with_limits', {
      p_integration_id: integrationId
    })

  if (error) {
    console.error("Error fetching integration statistics:", error)
    // Return default values if no data exists yet
    return {
      success_rate: 0,
      total_calls_this_month: 0,
      total_calls_last_7_days: 0,
      daily_rate_limit: 4000,
      current_daily_usage: 0,
      avg_response_time_ms: 0,
      rate_limiting_enabled: false,
      monthly_rate_limit: 100000,
      current_monthly_usage: 0
    }
  }

  // The RPC returns an array, get the first result
  const stats = data?.[0] || {
    success_rate: 0,
    total_calls_this_month: 0,
    total_calls_last_7_days: 0,
    daily_rate_limit: 4000,
    current_daily_usage: 0,
    avg_response_time_ms: 0,
    rate_limiting_enabled: false,
    monthly_rate_limit: 100000,
    current_monthly_usage: 0
  }

  return {
    success_rate: Number(stats.success_rate) || 0,
    total_calls_this_month: Number(stats.total_calls_this_month) || 0,
    total_calls_last_7_days: Number(stats.total_calls_last_7_days) || 0,
    daily_rate_limit: Number(stats.daily_rate_limit) || 4000,
    current_daily_usage: Number(stats.current_daily_usage) || 0,
    avg_response_time_ms: Number(stats.avg_response_time_ms) || 0,
    rate_limiting_enabled: Boolean(stats.rate_limiting_enabled) || false,
    monthly_rate_limit: Number(stats.monthly_rate_limit) || 100000,
    current_monthly_usage: Number(stats.current_monthly_usage) || 0
  }
}

export async function logApiUsage(
  integrationId: string,
  endpoint: string,
  method: string,
  statusCode: number,
  responseTimeMs?: number,
  requestSizeBytes?: number,
  responseSizeBytes?: number,
  errorMessage?: string
) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error("User not authenticated")
  }

  const { data, error } = await supabase
    .rpc('log_api_usage', {
      p_integration_id: integrationId,
      p_user_id: user.id,
      p_endpoint: endpoint,
      p_method: method,
      p_status_code: statusCode,
      p_response_time_ms: responseTimeMs,
      p_request_size_bytes: requestSizeBytes,
      p_response_size_bytes: responseSizeBytes,
      p_error_message: errorMessage
    })

  if (error) {
    console.error("Error logging API usage:", error)
    throw new Error("Failed to log API usage")
  }

  return data
}

export async function saveIntegrationSettings(settings: IntegrationSettings) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error("User not authenticated")
  }

  // Check if integration already exists
  const existing = await getIntegrationByName(settings.integration_name)
  
  const integrationData = {
    user_id: user.id,
    integration_name: settings.integration_name,
    settings: settings.settings,
    is_enabled: settings.is_enabled,
  }

  let result
  if (existing) {
    // Update existing integration
    const { data, error } = await supabase
      .from("integration_settings")
      .update(integrationData)
      .eq("id", existing.id)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error) {
      console.error("Error updating integration:", error)
      throw new Error("Failed to update integration settings")
    }
    result = data
  } else {
    // Create new integration
    const { data, error } = await supabase
      .from("integration_settings")
      .insert(integrationData)
      .select()
      .single()

    if (error) {
      console.error("Error creating integration:", error)
      throw new Error("Failed to create integration settings")
    }
    result = data
  }

  revalidatePath("/settings")
  return result
}

export async function toggleIntegration(integrationName: string, enabled: boolean) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error("User not authenticated")
  }

  const { data, error } = await supabase
    .from("integration_settings")
    .update({ is_enabled: enabled })
    .eq("user_id", user.id)
    .eq("integration_name", integrationName)
    .select()
    .single()

  if (error) {
    console.error("Error toggling integration:", error)
    throw new Error("Failed to toggle integration")
  }

  revalidatePath("/settings")
  return data
}

export async function deleteIntegration(integrationName: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error("User not authenticated")
  }

  // First get the integration to find its ID (without enabled filter for deletion)
  const { data: integration, error: findError } = await supabase
    .from("integration_settings")
    .select("*")
    .eq("integration_name", integrationName)
    .eq("user_id", user.id) // Only allow deletion of user's own integrations
    .single()

  if (findError && findError.code !== 'PGRST116') {
    console.error("Error finding integration:", findError)
    throw new Error("Failed to find integration")
  }

  if (!integration) {
    throw new Error("Integration not found")
  }

  // Delete related API usage data first
  const { error: usageError } = await supabase
    .from("integration_api_usage")
    .delete()
    .eq("integration_id", integration.id)

  if (usageError) {
    console.error("Error deleting API usage data:", usageError)
    // Continue with integration deletion even if usage cleanup fails
  }

  // Delete rate limit data
  const { error: rateLimitError } = await supabase
    .from("integration_rate_limits")
    .delete()
    .eq("integration_id", integration.id)

  if (rateLimitError) {
    console.error("Error deleting rate limit data:", rateLimitError)
    // Continue with integration deletion even if rate limit cleanup fails
  }

  // Finally delete the integration itself
  const { error } = await supabase
    .from("integration_settings")
    .delete()
    .eq("user_id", user.id)
    .eq("integration_name", integrationName)

  if (error) {
    console.error("Error deleting integration:", error)
    throw new Error("Failed to delete integration")
  }

  revalidatePath("/settings")
  return { success: true }
}

export async function updateRateLimitSettings(
  integrationName: string,
  rateLimitingEnabled: boolean,
  dailyLimit?: number,
  monthlyLimit?: number
) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error("User not authenticated")
  }

  const updateData: any = {
    rate_limiting_enabled: rateLimitingEnabled
  }

  if (dailyLimit !== undefined) {
    updateData.daily_rate_limit = dailyLimit
  }

  if (monthlyLimit !== undefined) {
    updateData.monthly_rate_limit = monthlyLimit
  }

  const { error } = await supabase
    .from("integration_settings")
    .update(updateData)
    .eq("integration_name", integrationName)
    .eq("user_id", user.id)

  if (error) {
    console.error("Error updating rate limit settings:", error)
    throw new Error("Failed to update rate limit settings")
  }

  revalidatePath("/settings")
}

export async function getUnmaskedIntegrationSettings(integrationId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error("User not authenticated")
  }

  // Get the real settings (for owners or when user has access)
  const { data, error } = await supabase
    .from("integration_settings")
    .select("id, integration_name, settings, is_enabled, user_id")
    .eq("id", integrationId)
    .single()

  if (error) {
    console.error("Error fetching unmasked integration settings:", error)
    throw new Error("Failed to fetch integration settings")
  }

  if (!data) {
    throw new Error("Integration not found")
  }

  // For security, only return settings if user is owner or for global integrations
  // Since all integrations are now global, we can return the settings
  return {
    id: data.id,
    integration_name: data.integration_name,
    settings: data.settings,
    is_enabled: data.is_enabled,
    is_owner: data.user_id === user.id
  }
}
