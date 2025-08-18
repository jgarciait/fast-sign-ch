import { NextRequest, NextResponse } from "next/server"
import { createPublicClient } from "@/utils/supabase/public-client"
import { createAdminClient } from "@/utils/supabase/admin"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params
    const body = await request.json()
    const { annotations, token } = body

    console.log("Annotations API called:", { documentId, annotationCount: annotations?.length, hasToken: !!token })

    if (!annotations || !token) {
      return NextResponse.json(
        { error: "Missing annotations or token" },
        { status: 400 }
      )
    }

    // Decode the token to get recipient email
    let recipientEmail: string
    try {
      recipientEmail = Buffer.from(token, "base64").toString("utf-8")
      console.log("Decoded recipient email:", recipientEmail)
    } catch (error) {
      console.error("Invalid token:", error)
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 400 }
      )
    }

    const supabase = createPublicClient()
    const adminClient = createAdminClient()

    // Verify the document exists
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single()

    if (docError || !document) {
      console.error("Document not found:", docError)
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      )
    }

    // Filter out any signatures from the annotations (they should go to document_signatures table)
    const textOnlyAnnotations = annotations.filter((ann: any) => ann.type !== 'signature')

    // Check if annotations record already exists for this document and recipient
    const { data: existingAnnotations } = await supabase
      .from("document_annotations")
      .select("*")
      .eq("document_id", documentId)
      .eq("recipient_email", recipientEmail)
      .single()

    if (existingAnnotations) {
      // Update existing annotations with text-only annotations
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
    } else {
      // Insert new annotations record (only if there are text annotations)
      if (textOnlyAnnotations.length > 0) {
        const { error: insertError } = await adminClient
          .from("document_annotations")
          .insert({
            document_id: documentId,
            recipient_email: recipientEmail,
            annotations: textOnlyAnnotations,
          })

        if (insertError) {
          console.error("Error inserting annotations:", insertError)
          return NextResponse.json(
            { error: "Failed to save annotations" },
            { status: 500 }
          )
        }
      }
    }

    // Update the document's updated_at timestamp
    const { error: docUpdateError } = await adminClient
      .from("documents")
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId)

    if (docUpdateError) {
      console.warn("Failed to update document timestamp:", docUpdateError)
      // Don't fail the request if document timestamp update fails
    }

    console.log("Annotations saved successfully")
    return NextResponse.json(
      { success: true, message: "Annotations saved successfully" },
      { status: 200 }
    )

  } catch (error) {
    console.error("Error in annotations API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params
    const body = await request.json()
    const { token, clearAll } = body

    console.log("Annotations DELETE API called:", { documentId, clearAll, hasToken: !!token })

    if (!token) {
      return NextResponse.json(
        { error: "Missing token" },
        { status: 400 }
      )
    }

    // Decode the token to get recipient email
    let recipientEmail: string
    try {
      recipientEmail = Buffer.from(token, "base64").toString("utf-8")
      console.log("Decoded recipient email for deletion:", recipientEmail)
    } catch (error) {
      console.error("Invalid token:", error)
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 400 }
      )
    }

    const supabase = createPublicClient()
    const adminClient = createAdminClient()

    // Verify the document exists
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single()

    if (docError || !document) {
      console.error("Document not found:", docError)
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      )
    }

    if (clearAll) {
      // Clear all annotations for this document and recipient
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

      console.log("All annotations cleared successfully for document:", documentId)
    }

    // Update the document's updated_at timestamp
    const { error: docUpdateError } = await adminClient
      .from("documents")
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId)

    if (docUpdateError) {
      console.warn("Failed to update document timestamp:", docUpdateError)
      // Don't fail the request if document timestamp update fails
    }

    return NextResponse.json(
      { success: true, message: "Annotations cleared successfully" },
      { status: 200 }
    )

  } catch (error) {
    console.error("Error in annotations DELETE API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params
    const body = await request.json()
    const { annotations, token } = body

    console.log("Annotations PUT API called:", { documentId, annotationCount: annotations?.length, hasToken: !!token })

    if (!token) {
      return NextResponse.json(
        { error: "Missing token" },
        { status: 400 }
      )
    }

    if (!Array.isArray(annotations)) {
      return NextResponse.json(
        { error: "Missing or invalid annotations array" },
        { status: 400 }
      )
    }

    // Decode the token to get recipient email
    let recipientEmail: string
    try {
      recipientEmail = Buffer.from(token, "base64").toString("utf-8")
      console.log("Decoded recipient email for PUT:", recipientEmail)
    } catch (error) {
      console.error("Invalid token:", error)
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 400 }
      )
    }

    const supabase = createPublicClient()
    const adminClient = createAdminClient()

    // Verify the document exists
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single()

    if (docError || !document) {
      console.error("Document not found:", docError)
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      )
    }

    // Filter out any signatures from the annotations (they should go to document_signatures table)
    const textOnlyAnnotations = annotations.filter((ann: any) => ann.type !== 'signature')

    console.log(`🔄 ATOMIC REPLACE: Replacing all text annotations with ${textOnlyAnnotations.length} new annotations`)

    if (textOnlyAnnotations.length === 0) {
      // Delete all annotations for this document and recipient
      console.log("🗑️ ATOMIC REPLACE: No annotations provided, deleting annotation records")
      const { error: deleteError } = await adminClient
        .from("document_annotations")
        .delete()
        .eq("document_id", documentId)
        .eq("recipient_email", recipientEmail)

      if (deleteError && deleteError.code !== "PGRST116") {
        // PGRST116 is "no rows found" - not an error in this case
        console.error("Error deleting annotation records:", deleteError)
        return NextResponse.json(
          { error: "Failed to delete annotations" },
          { status: 500 }
        )
      }

      console.log("✅ ATOMIC REPLACE: Annotation records deleted successfully (no annotations)")
    } else {
      // Check if annotations record already exists for this document and recipient
      const { data: existingAnnotations } = await supabase
        .from("document_annotations")
        .select("*")
        .eq("document_id", documentId)
        .eq("recipient_email", recipientEmail)
        .single()

      if (existingAnnotations) {
        // Update existing annotations with new text-only annotations
        console.log("🔄 ATOMIC REPLACE: Updating existing annotation record")
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

        console.log(`✅ ATOMIC REPLACE: Updated annotation record with ${textOnlyAnnotations.length} annotations`)
      } else {
        // Insert new annotations record
        console.log("🆕 ATOMIC REPLACE: Creating new annotation record")
        const { error: insertError } = await adminClient
          .from("document_annotations")
          .insert({
            document_id: documentId,
            recipient_email: recipientEmail,
            annotations: textOnlyAnnotations,
          })

        if (insertError) {
          console.error("Error inserting annotations:", insertError)
          return NextResponse.json(
            { error: "Failed to save annotations" },
            { status: 500 }
          )
        }

        console.log(`✅ ATOMIC REPLACE: Created annotation record with ${textOnlyAnnotations.length} annotations`)
      }
    }

    // Update the document's updated_at timestamp
    const { error: docUpdateError } = await adminClient
      .from("documents")
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId)

    if (docUpdateError) {
      console.warn("Failed to update document timestamp:", docUpdateError)
      // Don't fail the request if document timestamp update fails
    }

    console.log("Text annotations replaced successfully")
    return NextResponse.json(
      { success: true, message: `Annotations updated successfully: ${textOnlyAnnotations.length} annotations saved` },
      { status: 200 }
    )

  } catch (error) {
    console.error("Error in annotations PUT API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  try {
    const { documentId } = await params
    const recipientEmail = request.nextUrl.searchParams.get("email")

    if (!documentId) {
      return NextResponse.json({ error: "Missing document ID" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Get the annotations
    // If no email is provided, return ALL annotations for the document (for fast-sign-docs)
    // If email is provided, filter by specific recipient_email (for regular document viewing)
    let annotationsQuery = supabase
      .from("document_annotations")
      .select("annotations, recipient_email")
      .eq("document_id", documentId)

    // Only filter by recipient_email if email parameter is provided
    if (recipientEmail) {
      annotationsQuery = annotationsQuery.eq("recipient_email", recipientEmail)
    }

    const { data, error } = await annotationsQuery

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "no rows returned" error
      console.error("Error fetching annotations:", error)
      return NextResponse.json({ error: "Error fetching annotations" }, { status: 500 })
    }

    // Get text annotations
    let textAnnotations: any[] = []
    if (data && data.length > 0) {
      if (!recipientEmail) {
        // Combine all annotations from all recipients
        textAnnotations = data.reduce((acc: any[], record: any) => {
          if (record.annotations && Array.isArray(record.annotations)) {
            return acc.concat(record.annotations)
          }
          return acc
        }, [])
      } else {
        // Single recipient
        const singleRecord = Array.isArray(data) ? data[0] : data
        textAnnotations = singleRecord?.annotations || []
      }
    }

    // Get signature annotations from document_signatures table
    let signatureAnnotations: any[] = []
    try {
      let signaturesQuery = supabase
        .from("document_signatures")
        .select("*")
        .eq("document_id", documentId)
        .eq("status", "signed")

      // Filter by recipient email if provided
      if (recipientEmail) {
        signaturesQuery = signaturesQuery.eq("recipient_email", recipientEmail)
      }

      const { data: signatures, error: signaturesError } = await signaturesQuery

      if (!signaturesError && signatures && signatures.length > 0) {
        signatures.forEach((sigRecord: any) => {
          // Handle both old format (direct signature_data) and new format (signatures array)
          if (sigRecord.signature_data?.signatures) {
            // New format: signatures array
            const signaturesArray = sigRecord.signature_data.signatures
            signaturesArray.forEach((sig: any) => {
              signatureAnnotations.push({
                id: sig.id,
                type: 'signature' as const,
                x: sig.position?.x || 100,
                y: sig.position?.y || 100,
                width: sig.position?.width || 150,
                height: sig.position?.height || 75,
                page: sig.position?.page || 1,
                relativeX: sig.position?.relativeX || 0.15,
                relativeY: sig.position?.relativeY || 0.15,
                relativeWidth: sig.position?.relativeWidth || 0.25,
                relativeHeight: sig.position?.relativeHeight || 0.1,
                imageData: sig.dataUrl || '',
                timestamp: sig.timestamp || sigRecord.signed_at,
                signatureSource: sig.source || sigRecord.signature_source || 'canvas',
                content: sig.content // Include content field for signature indexing
              })
            })
          } else if (sigRecord.signature_data?.dataUrl) {
            // Old format: direct signature data
            signatureAnnotations.push({
              id: sigRecord.id,
              type: 'signature' as const,
              x: sigRecord.signature_data.x || 100,
              y: sigRecord.signature_data.y || 100,
              width: sigRecord.signature_data.width || 150,
              height: sigRecord.signature_data.height || 75,
              page: sigRecord.signature_data.page || 1,
              relativeX: sigRecord.signature_data.relativeX || 0.15,
              relativeY: sigRecord.signature_data.relativeY || 0.15,
              relativeWidth: sigRecord.signature_data.relativeWidth || 0.25,
              relativeHeight: sigRecord.signature_data.relativeHeight || 0.1,
              imageData: sigRecord.signature_data.dataUrl,
              timestamp: sigRecord.signed_at,
              signatureSource: sigRecord.signature_source || 'canvas'
            })
          }
        })
      }
    } catch (sigError) {
      console.warn("Error fetching signatures:", sigError)
      // Continue without signatures
    }

    // Combine text annotations and signature annotations
    const allAnnotations = [...textAnnotations, ...signatureAnnotations]
    return NextResponse.json({ annotations: allAnnotations })
  } catch (error) {
    console.error("Error fetching annotations:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unexpected error occurred" },
      { status: 500 },
    )
  }
}
