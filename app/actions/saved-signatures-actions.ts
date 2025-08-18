"use server"

import { createClient } from "@/utils/supabase/server"

export interface SavedSignature {
  id: string
  user_id: string
  file_record_id?: string
  signature_name: string
  signature_data: string
  signature_type: 'canvas' | 'wacom' | 'upload'
  client_name?: string
  description?: string
  is_default: boolean
  created_at: string
  updated_at: string
  file_records?: {
    valores_json: any
    filing_systems?: {
      nombre: string
    }
  }
}

export interface CreateSavedSignatureData {
  signature_name: string
  signature_data: string
  signature_type: 'canvas' | 'wacom' | 'upload'
  file_record_id?: string
  client_name?: string
  description?: string
  is_default?: boolean
}

// Get all saved signatures for the current user
export async function getSavedSignatures() {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", signatures: [] }
  }

  try {
    const { data, error } = await supabase
      .from("saved_signatures")
      .select(`
        *,
        file_records(
          valores_json,
          filing_systems(nombre)
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Database error in getSavedSignatures:", error)
      return { error: `Database error: ${error.message}`, signatures: [] }
    }

    return { signatures: data || [] }
  } catch (error) {
    console.error("Error in getSavedSignatures:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      signatures: [],
    }
  }
}

// Get saved signatures for a specific case file
export async function getSavedSignaturesByFileRecord(fileRecordId: string) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", signatures: [] }
  }

  try {
    const { data, error } = await supabase
      .from("saved_signatures")
      .select(`
        *,
        file_records(
          valores_json,
          filing_systems(nombre)
        )
      `)
      .eq("user_id", user.id)
      .eq("file_record_id", fileRecordId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Database error in getSavedSignaturesByFileRecord:", error)
      return { error: `Database error: ${error.message}`, signatures: [] }
    }

    return { signatures: data || [] }
  } catch (error) {
    console.error("Error in getSavedSignaturesByFileRecord:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      signatures: [],
    }
  }
}

// Get the default signature for the current user
export async function getDefaultSignature() {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", signature: null }
  }

  try {
    const { data, error } = await supabase
      .from("saved_signatures")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_default", true)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error("Database error in getDefaultSignature:", error)
      return { error: `Database error: ${error.message}`, signature: null }
    }

    return { signature: data || null }
  } catch (error) {
    console.error("Error in getDefaultSignature:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      signature: null,
    }
  }
}

// Create a new saved signature
export async function createSavedSignature(signatureData: CreateSavedSignatureData) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    const { data, error } = await supabase
      .from("saved_signatures")
      .insert({
        user_id: user.id,
        signature_name: signatureData.signature_name,
        signature_data: signatureData.signature_data,
        signature_type: signatureData.signature_type,
        file_record_id: signatureData.file_record_id || null,
        client_name: signatureData.client_name || null,
        description: signatureData.description || null,
        is_default: signatureData.is_default || false,
      })
      .select()
      .single()

    if (error) {
      console.error("Database error in createSavedSignature:", error)
      return { error: `Database error: ${error.message}` }
    }

    return { signature: data }
  } catch (error) {
    console.error("Error in createSavedSignature:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

// Update a saved signature
export async function updateSavedSignature(
  signatureId: string,
  updates: Partial<CreateSavedSignatureData>
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
      .from("saved_signatures")
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq("id", signatureId)
      .eq("user_id", user.id) // Ensure user owns the signature
      .select()
      .single()

    if (error) {
      console.error("Database error in updateSavedSignature:", error)
      return { error: `Database error: ${error.message}` }
    }

    return { signature: data }
  } catch (error) {
    console.error("Error in updateSavedSignature:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

// Delete a saved signature
export async function deleteSavedSignature(signatureId: string) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    const { error } = await supabase
      .from("saved_signatures")
      .delete()
      .eq("id", signatureId)
      .eq("user_id", user.id) // Ensure user owns the signature

    if (error) {
      console.error("Database error in deleteSavedSignature:", error)
      return { error: `Database error: ${error.message}` }
    }

    return { success: true }
  } catch (error) {
    console.error("Error in deleteSavedSignature:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

// Set a signature as default (unsets all other defaults)
export async function setDefaultSignature(signatureId: string) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    const { data, error } = await supabase
      .from("saved_signatures")
      .update({ is_default: true })
      .eq("id", signatureId)
      .eq("user_id", user.id) // Ensure user owns the signature
      .select()
      .single()

    if (error) {
      console.error("Database error in setDefaultSignature:", error)
      return { error: `Database error: ${error.message}` }
    }

    return { signature: data }
  } catch (error) {
    console.error("Error in setDefaultSignature:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}
