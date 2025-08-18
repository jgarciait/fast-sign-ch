"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { sendDocumentEmail } from "./email-actions"
import { revalidatePath } from "next/cache"

export async function resendDocumentNotification(requestId: string) {
  try {
    console.log("Resending document notification for request:", requestId)

    const supabase = await createClient()
    const adminClient = createAdminClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: "Not authenticated", success: false }
    }

    // Get the request details including customer and document
    const { data: request, error: requestError } = await supabase
      .from("requests")
      .select(`
        *,
        customer:customer_id(id, first_name, last_name, email),
        document:document_id(id, file_name, file_path)
      `)
      .eq("id", requestId)
      .eq("created_by", user.id)
      .single()

    if (requestError || !request) {
      console.error("Error fetching request:", requestError || "Request not found")
      return {
        error: requestError ? `Error fetching request: ${requestError.message}` : "Request not found",
        success: false,
      }
    }

    // Make sure we're using the correct URL for the email
    const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : process.env.NEXT_PUBLIC_SITE_URL
        ? process.env.NEXT_PUBLIC_SITE_URL
        : process.env.NODE_ENV === "development"
          ? `http://localhost:${process.env.PORT || "3000"}`
          : "http://localhost:3000"

    // Extract the necessary information
    const documentId = request.document.id
    const documentTitle = request.title
    const message = request.message
    const recipientEmail = request.customer.email
    const recipientName = `${request.customer.first_name || ""} ${request.customer.last_name || ""}`.trim()

    // Send the email
    console.log("Sending email to recipient:", recipientEmail)
    const emailResult = await sendDocumentEmail({
      recipientEmail,
      recipientName,
      documentTitle,
      documentId,
      message,
      baseUrl, // Add this line
    })

    if (emailResult && emailResult.error) {
      console.error("Error sending email:", emailResult.error)
      return { error: `Error sending email: ${emailResult.error}`, success: false }
    }

    // Update the request to reset status and indicate it was resent
    const { error: updateError } = await adminClient
      .from("requests")
      .update({
        status: "sent", // Reset status back to sent so it can be signed again
        resent_at: new Date().toISOString(),
        returned_at: null, // Clear the returned timestamp
        signed_at: null, // Clear the signed timestamp if it exists
        received_at: null, // Clear the received timestamp if it exists
      })
      .eq("id", requestId)

    if (updateError) {
      console.error("Error updating request:", updateError)
      return { error: `Error updating request: ${updateError.message}`, success: false }
    }

    // Also update request_details view if it exists
    const { error: requestDetailsError } = await adminClient
      .from("request_details")
      .update({
        status: "sent",
        resent_at: new Date().toISOString(),
        returned_at: null,
        signed_at: null,
        received_at: null,
      })
      .eq("id", requestId)

    if (requestDetailsError) {
      console.warn("Could not update request_details:", requestDetailsError)
      // Don't fail the whole operation if request_details update fails
    }

    // Reset any signing_requests for this document/recipient to pending
    const { error: resetSigningError } = await adminClient
      .from("signing_requests")
      .update({
        status: "pending",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Extend expiry by 7 days
      })
      .eq("document_id", documentId)
      .eq("recipient_email", recipientEmail)

    if (resetSigningError) {
      console.warn("Warning: Failed to reset signing requests:", resetSigningError)
      // Don't fail the whole operation for this
    }

    // Clear existing signatures for this document/recipient to allow re-signing
    const { error: clearSignaturesError } = await adminClient
      .from("document_signatures")
      .delete()
      .eq("document_id", documentId)
      .eq("recipient_email", recipientEmail)

    if (clearSignaturesError) {
      console.warn("Warning: Failed to clear existing signatures:", clearSignaturesError)
      // Don't fail the whole operation for this
    } else {
      console.log("Existing signatures cleared for document:", documentId)
    }

    console.log("Document resent successfully - status reset to 'sent'")
    revalidatePath(`/documents/${requestId}`)
    revalidatePath("/documents")

    return { success: true }
  } catch (error) {
    console.error("Error in resendDocumentNotification:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      success: false,
    }
  }
}
