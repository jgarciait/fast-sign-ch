import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/utils/supabase/admin"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { documentId, token } = body

    if (!documentId || !token) {
      return NextResponse.json(
        { error: "Missing documentId or token" },
        { status: 400 }
      )
    }

    // Decode the token to get recipient email
    let recipientEmail: string
    try {
      recipientEmail = Buffer.from(token, "base64").toString("utf-8")
    } catch (error) {
      console.error("Invalid token:", error)
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // Get existing annotations
    const { data: existingAnnotations, error: fetchError } = await adminClient
      .from("document_annotations")
      .select("*")
      .eq("document_id", documentId)
      .eq("recipient_email", recipientEmail)
      .single()

    if (fetchError) {
      console.log("No existing annotations found")
      return NextResponse.json(
        { success: true, message: "No annotations to clean up" },
        { status: 200 }
      )
    }

    // Filter out signatures, keep only text annotations
    const textOnlyAnnotations = (existingAnnotations.annotations || []).filter(
      (ann: any) => ann.type !== 'signature'
    )

    if (textOnlyAnnotations.length === 0) {
      // Delete the record if no text annotations remain
      const { error: deleteError } = await adminClient
        .from("document_annotations")
        .delete()
        .eq("document_id", documentId)
        .eq("recipient_email", recipientEmail)

      if (deleteError) {
        console.error("Error deleting annotations:", deleteError)
        return NextResponse.json(
          { error: "Failed to delete annotations" },
          { status: 500 }
        )
      }
    } else {
      // Update with text-only annotations
      const { error: updateError } = await adminClient
        .from("document_annotations")
        .update({
          annotations: textOnlyAnnotations,
          updated_at: new Date().toISOString(),
        })
        .eq("document_id", documentId)
        .eq("recipient_email", recipientEmail)

      if (updateError) {
        console.error("Error updating annotations:", updateError)
        return NextResponse.json(
          { error: "Failed to update annotations" },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(
      { 
        success: true, 
        message: "Signatures cleaned up from annotations table",
        removedSignatures: (existingAnnotations.annotations || []).filter((ann: any) => ann.type === 'signature').length
      },
      { status: 200 }
    )

  } catch (error) {
    console.error("Error in cleanup API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
