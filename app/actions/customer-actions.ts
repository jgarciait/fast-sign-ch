"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export type Customer = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  telephone?: string | null
  postal_address?: string | null
  created_at?: string
  user_id?: string
}

export async function getCustomers() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    const { data, error } = await supabase.from("customers").select("*").order("created_at", { ascending: false })

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    return { customers: data as Customer[] }
  } catch (error) {
    console.error("Error fetching customers:", error)
    return { error: error instanceof Error ? error.message : "An unexpected error occurred" }
  }
}

export async function getCustomer(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    const { data, error } = await supabase.from("customers").select("*").eq("id", id).single()

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    return { customer: data as Customer }
  } catch (error) {
    console.error("Error fetching customer:", error)
    return { error: error instanceof Error ? error.message : "An unexpected error occurred" }
  }
}

export async function createCustomer(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    const firstName = formData.get("first_name") as string
    const lastName = formData.get("last_name") as string
    const email = formData.get("email") as string
    const telephone = (formData.get("telephone") as string) || null
    const postalAddress = (formData.get("postal_address") as string) || null

    // Check if customer with this email already exists
    const { data: existingCustomer } = await supabase.from("customers").select("id").eq("email", email).limit(1)

    if (existingCustomer && existingCustomer.length > 0) {
      return { error: "A customer with this email already exists" }
    }

    const { data, error } = await supabase
      .from("customers")
      .insert({
        first_name: firstName || null,
        last_name: lastName || null,
        email: email,
        telephone: telephone,
        postal_address: postalAddress,
      })
      .select()

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    revalidatePath("/sent-to-sign")
    revalidatePath("/customers")
    return { customer: data[0] as Customer }
  } catch (error) {
    console.error("Error creating customer:", error)
    return { error: error instanceof Error ? error.message : "An unexpected error occurred" }
  }
}

export async function updateCustomer(id: string, formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    const firstName = formData.get("first_name") as string
    const lastName = formData.get("last_name") as string
    const email = formData.get("email") as string
    const telephone = (formData.get("telephone") as string) || null
    const postalAddress = (formData.get("postal_address") as string) || null

    // Check if another customer with this email already exists (excluding current customer)
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("email", email)
      .neq("id", id)
      .limit(1)

    if (existingCustomer && existingCustomer.length > 0) {
      return { error: "A customer with this email already exists" }
    }

    const { data, error } = await supabase
      .from("customers")
      .update({
        first_name: firstName || null,
        last_name: lastName || null,
        email: email,
        telephone: telephone,
        postal_address: postalAddress,
      })
      .eq("id", id)
      .select()

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    if (!data || data.length === 0) {
      return { error: "Customer not found" }
    }

    revalidatePath("/sent-to-sign")
    revalidatePath("/customers")
    revalidatePath(`/customers/${id}`)
    return { customer: data[0] as Customer }
  } catch (error) {
    console.error("Error updating customer:", error)
    return { error: error instanceof Error ? error.message : "An unexpected error occurred" }
  }
}

export async function deleteCustomer(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    // Global deletion - allow deleting customers with associated documents
    const { error } = await supabase.from("customers").delete().eq("id", id)

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    revalidatePath("/customers")
    return { success: true }
  } catch (error) {
    console.error("Error deleting customer:", error)
    return { error: error instanceof Error ? error.message : "An unexpected error occurred" }
  }
}
