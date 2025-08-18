"use server"

import { createClient } from "@/utils/supabase/server"
import { validateInvitationCode, useInvitationCode } from "./user-management-actions"

export async function handleSignup(
  email: string,
  password: string,
  invitationCode?: string,
  firstName?: string,
  lastName?: string,
) {
  const supabase = await createClient()

  // Validate required fields
  if (!email || !password) {
    return { error: "Email and password are required" }
  }

  // If invitation code is provided, validate it
  let validInvitation = true
  let invitedEmail = ""
  let validationError = ""

  if (invitationCode) {
    const {
      valid,
      email: emailFromInvitation,
      error: errorFromValidation,
    } = await validateInvitationCode(invitationCode)

    validInvitation = valid
    invitedEmail = emailFromInvitation
    validationError = errorFromValidation || "Invalid invitation code"
  }

  if (!validInvitation) {
    return { error: validationError }
  }

  // Check if the email matches the invitation
  if (invitedEmail && email.toLowerCase() !== invitedEmail.toLowerCase()) {
    return { error: "Email does not match the invitation" }
  }

  try {
    // Sign up the user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
        data: {
          first_name: firstName || null,
          last_name: lastName || null,
        },
      },
    })

    if (error) {
      return { error: error.message }
    }

    if (data.user) {
      // If invitation code was used, mark it as used
      if (invitationCode) {
        await useInvitationCode(invitationCode, data.user.id)
      }
    }

    return {
      success: true,
      message: "Check your email for the confirmation link",
    }
  } catch (error) {
    console.error("Signup error:", error)
    return { error: "An unexpected error occurred during signup" }
  }
}

export async function signUpWithInvitation(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const firstName = formData.get("firstName") as string
  const lastName = formData.get("lastName") as string
  const invitationCode = formData.get("invitationCode") as string

  return handleSignup(email, password, invitationCode, firstName, lastName)
}
