"use server"

import { createClient } from "@/utils/supabase/server"

// Types
export interface SignatureTemplate {
  id: string
  user_id: string
  template_name: string
  signature_data: string
  signature_type: 'canvas' | 'wacom' | 'upload'
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CustomerSignature {
  id: string
  user_id: string
  customer_id: string
  signature_name: string
  signature_data: string
  signature_type: 'canvas' | 'wacom' | 'upload'
  is_default_for_customer: boolean
  created_at: string
  updated_at: string
}

export interface Customer {
  id: string
  user_id?: string
  first_name?: string
  last_name?: string
  email: string
  telephone?: string
  postal_address?: string
  created_at: string
}

// Signature Templates Actions
export async function getSignatureTemplates() {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", templates: [] }
  }

  try {
    // Only load metadata, not signature_data to avoid 431 errors
    const { data, error } = await supabase
      .from("signature_templates")
      .select("id, user_id, template_name, signature_type, is_default, is_active, created_at, updated_at")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10) // Limit to prevent too much data

    if (error) {
      console.error("Database error in getSignatureTemplates:", error)
      return { error: `Database error: ${error.message}`, templates: [] }
    }

    return { templates: data || [] }
  } catch (error) {
    console.error("Error in getSignatureTemplates:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      templates: [],
    }
  }
}

export async function createSignatureTemplate(
  templateName: string,
  signatureData: string,
  signatureType: 'canvas' | 'wacom' | 'upload' = 'canvas',
  isDefault: boolean = false
) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    const { data, error } = await supabase
      .from("signature_templates")
      .insert({
        user_id: user.id,
        template_name: templateName,
        signature_data: signatureData,
        signature_type: signatureType,
        is_default: isDefault,
        is_active: true
      })
      .select()
      .single()

    if (error) {
      console.error("Database error in createSignatureTemplate:", error)
      return { error: `Database error: ${error.message}` }
    }

    return { template: data }
  } catch (error) {
    console.error("Error in createSignatureTemplate:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

export async function updateSignatureTemplate(
  templateId: string,
  updates: Partial<Pick<SignatureTemplate, 'template_name' | 'signature_data' | 'signature_type' | 'is_default' | 'is_active'>>
) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    const { data, error } = await supabase
      .from("signature_templates")
      .update(updates)
      .eq("id", templateId)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error) {
      console.error("Database error in updateSignatureTemplate:", error)
      return { error: `Database error: ${error.message}` }
    }

    return { template: data }
  } catch (error) {
    console.error("Error in updateSignatureTemplate:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

export async function deleteSignatureTemplate(templateId: string) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    const { error } = await supabase
      .from("signature_templates")
      .delete()
      .eq("id", templateId)
      .eq("user_id", user.id)

    if (error) {
      console.error("Database error in deleteSignatureTemplate:", error)
      return { error: `Database error: ${error.message}` }
    }

    return { success: true }
  } catch (error) {
    console.error("Error in deleteSignatureTemplate:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

// Get signature data for a specific template
export async function getSignatureTemplateData(templateId: string) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", signature_data: null }
  }

  try {
    const { data, error } = await supabase
      .from("signature_templates")
      .select("signature_data")
      .eq("id", templateId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single()

    if (error) {
      console.error("Database error in getSignatureTemplateData:", error)
      return { error: `Database error: ${error.message}`, signature_data: null }
    }

    return { signature_data: data?.signature_data || null }
  } catch (error) {
    console.error("Error in getSignatureTemplateData:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      signature_data: null,
    }
  }
}

// Get customer signature data for a specific customer signature
export async function getCustomerSignatureData(signatureId: string) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", signature_data: null }
  }

  try {
    const { data, error } = await supabase
      .from("customer_signatures")
      .select("signature_data")
      .eq("id", signatureId)
      .eq("user_id", user.id)
      .single()

    if (error) {
      console.error("Database error in getCustomerSignatureData:", error)
      return { error: `Database error: ${error.message}`, signature_data: null }
    }

    return { signature_data: data?.signature_data || null }
  } catch (error) {
    console.error("Error in getCustomerSignatureData:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      signature_data: null,
    }
  }
}

export async function getDefaultSignatureTemplate() {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", template: null }
  }

  try {
    // Only get metadata first - NO signature_data
    const { data, error } = await supabase
      .from("signature_templates")
      .select("id, user_id, template_name, signature_type, is_default, is_active, created_at, updated_at")
      .eq("user_id", user.id)
      .eq("is_default", true)
      .eq("is_active", true)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error("Database error in getDefaultSignatureTemplate:", error)
      return { error: `Database error: ${error.message}`, template: null }
    }

    return { template: data || null }
  } catch (error) {
    console.error("Error in getDefaultSignatureTemplate:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      template: null,
    }
  }
}

// Customer Actions
export async function getCustomers() {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", customers: [] }
  }

  try {
    const { data, error } = await supabase
      .from("customers")
      .select("id, user_id, first_name, last_name, email, telephone, postal_address, created_at")
      .or(`user_id.eq.${user.id},user_id.is.null`) // User's customers or legacy customers
      .order("created_at", { ascending: false })
      .limit(50) // Reasonable limit

    if (error) {
      console.error("Database error in getCustomers:", error)
      return { error: `Database error: ${error.message}`, customers: [] }
    }

    return { customers: data || [] }
  } catch (error) {
    console.error("Error in getCustomers:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      customers: [],
    }
  }
}

export async function createCustomer(customerData: {
  first_name?: string
  last_name?: string
  email: string
  telephone?: string
  postal_address?: string
}) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    const { data, error } = await supabase
      .from("customers")
      .insert({
        ...customerData,
        user_id: user.id
      })
      .select()
      .single()

    if (error) {
      console.error("Database error in createCustomer:", error)
      return { error: `Database error: ${error.message}` }
    }

    return { customer: data }
  } catch (error) {
    console.error("Error in createCustomer:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

// Customer Signatures Actions
export async function getCustomerSignatures(customerId: string) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", signatures: [] }
  }

  try {
    // Only load metadata, not signature_data to avoid 431 errors
    const { data, error } = await supabase
      .from("customer_signatures")
      .select("id, user_id, customer_id, signature_name, signature_type, is_default_for_customer, created_at, updated_at")
      .eq("user_id", user.id)
      .eq("customer_id", customerId)
      .order("is_default_for_customer", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20) // Reasonable limit

    if (error) {
      console.error("Database error in getCustomerSignatures:", error)
      return { error: `Database error: ${error.message}`, signatures: [] }
    }

    return { signatures: data || [] }
  } catch (error) {
    console.error("Error in getCustomerSignatures:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      signatures: [],
    }
  }
}

export async function createCustomerSignature(
  customerId: string,
  signatureName: string,
  signatureData: string,
  signatureType: 'canvas' | 'wacom' | 'upload' = 'canvas',
  isDefaultForCustomer: boolean = false
) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    const { data, error } = await supabase
      .from("customer_signatures")
      .insert({
        user_id: user.id,
        customer_id: customerId,
        signature_name: signatureName,
        signature_data: signatureData,
        signature_type: signatureType,
        is_default_for_customer: isDefaultForCustomer
      })
      .select()
      .single()

    if (error) {
      console.error("Database error in createCustomerSignature:", error)
      return { error: `Database error: ${error.message}` }
    }

    return { signature: data }
  } catch (error) {
    console.error("Error in createCustomerSignature:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

export async function getDefaultCustomerSignature(customerId: string) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", signature: null }
  }

  try {
    // Only get metadata first
    const { data, error } = await supabase
      .from("customer_signatures")
      .select("id, user_id, customer_id, signature_name, signature_type, is_default_for_customer, created_at, updated_at")
      .eq("user_id", user.id)
      .eq("customer_id", customerId)
      .eq("is_default_for_customer", true)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error("Database error in getDefaultCustomerSignature:", error)
      return { error: `Database error: ${error.message}`, signature: null }
    }

    return { signature: data || null }
  } catch (error) {
    console.error("Error in getDefaultCustomerSignature:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      signature: null,
    }
  }
}

// File Records - Customer linking
export async function linkFileRecordToCustomer(fileRecordId: string, customerId: string) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    const { data, error } = await supabase
      .from("file_records")
      .update({ 
        customer_id: customerId,
        updated_at: new Date().toISOString()
      })
      .eq("id", fileRecordId)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error) {
      console.error("Database error in linkFileRecordToCustomer:", error)
      return { error: `Database error: ${error.message}` }
    }

    return { fileRecord: data }
  } catch (error) {
    console.error("Error in linkFileRecordToCustomer:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

export async function unlinkFileRecordFromCustomer(fileRecordId: string) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    const { data, error } = await supabase
      .from("file_records")
      .update({ 
        customer_id: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", fileRecordId)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error) {
      console.error("Database error in unlinkFileRecordFromCustomer:", error)
      return { error: `Database error: ${error.message}` }
    }

    return { fileRecord: data }
  } catch (error) {
    console.error("Error in unlinkFileRecordFromCustomer:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}
