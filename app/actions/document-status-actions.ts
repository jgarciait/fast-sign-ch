"use server"
import { createAdminClient } from "@/utils/supabase/admin"

export async function updateDocumentStatus(documentId: string, status: string, recipientEmail: string) {
  try {
    console.log(`Updating document ${documentId} status to ${status} for ${recipientEmail}`)

    // Check if environment variables are available
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
      console.error("Missing Supabase environment variables")
      return { error: "Missing Supabase environment variables" }
    }

    // Use admin client to bypass RLS
    const adminClient = createAdminClient()

    // First, get the request to verify the recipient
    const { data: request, error: requestError } = await adminClient
      .from("requests")
      .select("id, customer:customer_id(email)")
      .eq("document_id", documentId)
      .single()

    if (requestError) {
      console.error("Error fetching request:", requestError)
      return { error: `Error fetching request: ${requestError.message}` }
    }

    if (!request) {
      console.error("Request not found")
      return { error: "Request not found" }
    }

    // Verify recipient email
    if (request.customer.email !== recipientEmail) {
      console.error("Unauthorized: Email mismatch")
      return { error: "Unauthorized" }
    }

    // Update the request status
    const updateData: Record<string, any> = {
      status: status,
    }

    // Add timestamp based on status
    if (status === "received" || status === "RECEIVED") {
      updateData.received_at = new Date().toISOString()
    } else if (status === "signed" || status === "SIGNED") {
      updateData.signed_at = new Date().toISOString()
    } else if (status === "returned" || status === "RETURNED") {
      updateData.returned_at = new Date().toISOString()
    }

    const { error: updateError } = await adminClient.from("requests").update(updateData).eq("id", request.id)

    if (updateError) {
      console.error("Error updating request status:", updateError)
      return { error: `Error updating request status: ${updateError.message}` }
    }

    return { success: true }
  } catch (error) {
    console.error("Error in updateDocumentStatus:", error)
    return { error: error instanceof Error ? error.message : "An unexpected error occurred" }
  }
}
