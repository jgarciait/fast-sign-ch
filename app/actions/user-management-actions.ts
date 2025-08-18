"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { revalidatePath } from "next/cache"

// Generate a random alphanumeric code
function generateRandomCode(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let result = ""
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export interface InvitationCode {
  id: string
  email: string
  code: string
  created_at: string
  used_at: string | null
  used_by_user_id: string | null
  created_by_user_id: string
}

export interface AppUser {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  created_at: string
}

export async function generateInvitationCode(email: string): Promise<{ code?: string; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  if (!email) {
    return { error: "Email is required" }
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { error: "Invalid email format" }
  }

  let code: string
  let isUnique = false
  let attempts = 0
  const MAX_ATTEMPTS = 10

  // Generate a unique 5-character code
  while (!isUnique && attempts < MAX_ATTEMPTS) {
    code = generateRandomCode(5)
    const { data, error } = await supabase.from("invitation_codes").select("id").eq("code", code).single()

    if (error && error.code === "PGRST116") {
      // No rows found - code is unique
      isUnique = true
    } else if (error) {
      console.error("Error checking code uniqueness:", error)
      return { error: "Failed to generate unique code" }
    }
    attempts++
  }

  if (!isUnique) {
    return { error: "Could not generate a unique invitation code after multiple attempts." }
  }

  try {
    const { data, error } = await supabase
      .from("invitation_codes")
      .insert({
        email,
        code: code!,
        created_by_user_id: user.id,
      })
      .select("code")
      .single()

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    revalidatePath("/settings")
    return { code: data.code }
  } catch (error) {
    console.error("Error generating invitation code:", error)
    return { error: error instanceof Error ? error.message : "An unexpected error occurred" }
  }
}

export async function getInvitationCodes(): Promise<{ codes?: InvitationCode[]; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    const { data, error } = await supabase
      .from("invitation_codes")
      .select("*")
      .eq("created_by_user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    return { codes: data as InvitationCode[] }
  } catch (error) {
    console.error("Error fetching invitation codes:", error)
    return { error: error instanceof Error ? error.message : "An unexpected error occurred" }
  }
}

export async function getAppUsers(): Promise<{ users?: AppUser[]; error?: string }> {
  try {
    // Use admin client to access auth.users table
    const supabaseAdmin = createAdminClient()

    // First get all users from auth.users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers()

    if (authError) {
      throw new Error(`Auth error: ${authError.message}`)
    }

    if (!authData || !authData.users) {
      throw new Error("No users data returned from auth service")
    }

    // Then get profiles data
    const supabase = await createClient()
    const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id, first_name, last_name")

    if (profilesError) {
      console.warn("Profiles error:", profilesError.message)
      // Continue without profiles data if there's an error
    }

    // Combine the data
    const users: AppUser[] = authData.users.map((authUser) => {
      const profile = profiles?.find((p) => p.id === authUser.id)
      return {
        id: authUser.id,
        email: authUser.email || "N/A",
        first_name: profile?.first_name || null,
        last_name: profile?.last_name || null,
        created_at: authUser.created_at,
      }
    })

    return { users }
  } catch (error) {
    console.error("Error fetching app users:", error)
    return { error: error instanceof Error ? error.message : "An unexpected error occurred" }
  }
}

export async function resetUserPassword(
  userId: string,
  userEmail: string,
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    // Use admin client to generate password reset link
    const supabaseAdmin = createAdminClient()

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: userEmail,
    })

    if (error) {
      throw new Error(`Supabase error: ${error.message}`)
    }

    // In a real application, you would send this link via email
    // For now, we'll just return success
    console.log("Password reset link generated:", data.properties?.action_link)

    return { success: true }
  } catch (error) {
    console.error("Error resetting user password:", error)
    return { error: error instanceof Error ? error.message : "An unexpected error occurred" }
  }
}

export async function validateInvitationCode(
  code: string,
): Promise<{ valid: boolean; email?: string; error?: string }> {
  if (!code) {
    return { valid: false, error: "Invitation code is required" }
  }

  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from("invitation_codes")
      .select("email, used_at")
      .eq("code", code.toUpperCase())
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return { valid: false, error: "Invalid invitation code" }
      }
      throw new Error(`Database error: ${error.message}`)
    }

    if (data.used_at) {
      return { valid: false, error: "This invitation code has already been used" }
    }

    return { valid: true, email: data.email }
  } catch (error) {
    console.error("Error validating invitation code:", error)
    return { valid: false, error: error instanceof Error ? error.message : "An unexpected error occurred" }
  }
}

export async function useInvitationCode(code: string, userId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from("invitation_codes")
      .update({
        used_at: new Date().toISOString(),
        used_by_user_id: userId,
      })
      .eq("code", code.toUpperCase())
      .is("used_at", null) // Only update if not already used

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    return { success: true }
  } catch (error) {
    console.error("Error using invitation code:", error)
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred" }
  }
}
