import { NextRequest, NextResponse } from "next/server"
import { createPublicClient } from "@/utils/supabase/public-client"
import { createAdminClient } from "@/utils/supabase/admin"
import { randomUUID } from "crypto"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params
    const body = await request.json()

    // Handle two different formats:
    // 1. consolidatedSignatureData: Multiple signatures in one record (fast-sign)
    // 2. signatureDataUrl: Single signature (sent-to-sign)
    const { consolidatedSignatureData, signatureDataUrl, signatureSource, token, position } = body

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 })
    }

    if (!consolidatedSignatureData && !signatureDataUrl) {
      return NextResponse.json({ error: "Missing signature data" }, { status: 400 })
    }

    // Decode the token to get recipient email
    let recipientEmail: string
    try {
      recipientEmail = Buffer.from(token, "base64").toString("utf-8")
    } catch (error) {
      console.error("Invalid token:", error)
      return NextResponse.json({ error: "Invalid token" }, { status: 400 })
    }



    const adminClient = createAdminClient()

    // Handle special tokens - when using "fast-sign-docs@view-all", save signatures as "fast-sign@system"
    const effectiveRecipientEmail = recipientEmail === "fast-sign-docs@view-all" ? "fast-sign@system" : recipientEmail

    // Handle consolidated signature data (multiple signatures in one record)
    if (consolidatedSignatureData) {

      if (!consolidatedSignatureData.signatures || consolidatedSignatureData.signatures.length === 0) {
        return NextResponse.json({ error: "No signatures provided in consolidated data" }, { status: 400 })
      }

      // Check if there's an existing signature record to update
      const { data: existingSignature } = await adminClient
        .from("document_signatures")
        .select("id")
        .eq("document_id", documentId)
        .eq("recipient_email", effectiveRecipientEmail)
        .single()

      let signatureRecord
      let signatureError

      // Transform payload to store coordinates/location and signature metadata (no images) in DB
      const coordinatesOnly = {
        signatures: (consolidatedSignatureData.signatures || []).map((s: any) => ({
          id: s.id,
          source: s.source || s.signatureSource || 'canvas',
          position: s.position,
          timestamp: s.timestamp || new Date().toISOString(),
          // Include absolute coordinates
          x: s.x,
          y: s.y,
          width: s.width,
          height: s.height,
          page: s.page,
          // Include relative coordinates
          relativeX: s.relativeX,
          relativeY: s.relativeY,
          relativeWidth: s.relativeWidth,
          relativeHeight: s.relativeHeight,
          // Include content field for signature indexing
          content: s.content,
        }))
      }

      if (existingSignature) {
        // Update existing record with coordinates-only data
        const { data, error } = await adminClient
          .from("document_signatures")
          .update({
            signature_data: coordinatesOnly,
            signed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingSignature.id)
          .select()
          .single()
        
        signatureRecord = data
        signatureError = error
      } else {
        // Create a new signature record (coords only)
        console.log("Creating new signature record (coords only)...")
        const { data, error } = await adminClient
          .from("document_signatures")
          .insert({
            document_id: documentId,
            recipient_email: effectiveRecipientEmail,
            status: "signed",
            signed_at: new Date().toISOString(),
            signature_data: coordinatesOnly,
            signature_source: "canvas",
          })
          .select()
          .single()
        
        signatureRecord = data
        signatureError = error
      }

      if (signatureError) {
        console.error("Error creating consolidated signature record:", signatureError)
        console.error("SignatureError details:", {
          message: signatureError.message,
          details: signatureError.details,
          hint: signatureError.hint,
          code: signatureError.code
        })
        return NextResponse.json({ 
          error: "Failed to save signatures", 
          details: signatureError.message,
          code: signatureError.code 
        }, { status: 500 })
      }

      

      // Update the document's status and updated_at timestamp
      const nowIso = new Date().toISOString()
      const { error: docUpdateError } = await adminClient
        .from("documents")
        .update({
          status: "signed",
          updated_at: nowIso,
        })
        .eq("id", documentId)

      if (docUpdateError) {
        console.warn("Failed to update document status:", docUpdateError)
        // Don't fail the request if document update fails
      }

      // Also update related request status to keep UI in sync in realtime
      const { error: reqUpdateError } = await adminClient
        .from("requests")
        .update({ status: "signed", signed_at: nowIso, updated_at: nowIso })
        .eq("document_id", documentId)
        .eq("recipient_email", effectiveRecipientEmail)

      if (reqUpdateError) {
        console.warn("Failed to update request status:", reqUpdateError)
      }

      return NextResponse.json(
        { success: true, message: "Signatures saved successfully", signatureId: signatureRecord.id },
        { status: 200 }
      )
    }

    // Handle single signature data (original format)
    if (signatureDataUrl) {
      console.log("Processing single signature data (coords only)...")
      console.log("Signature source:", signatureSource)
      console.log("Position:", position)
      console.log("Signature data length:", signatureDataUrl.length)

      if (!signatureSource || !position) {
        return NextResponse.json({ error: "Missing signature source or position" }, { status: 400 })
      }

      // Generate a unique ID for this signature
      const signatureId = crypto.randomUUID()
      console.log("Generated signature ID:", signatureId)

      // Create signature data in the new format
      const signatureData = {
        signatures: [{
          id: signatureId,
          dataUrl: signatureDataUrl,
          source: signatureSource,
          position: position,
          timestamp: new Date().toISOString(),
        }]
      }

      try {
        // Try to get existing signature record for this document and recipient
        const { data: existingSignature, error: fetchError } = await adminClient
          .from("document_signatures")
          .select("*")
          .eq("document_id", documentId)
          .eq("recipient_email", effectiveRecipientEmail)
          .single()

        if (fetchError && fetchError.code !== "PGRST116") {
          // Error other than "no rows found"
          console.error("Error checking existing signature:", fetchError)
          return NextResponse.json({ error: "Database error" }, { status: 500 })
        }

        if (existingSignature) {
          // Update existing record by adding new coordinates-only signature to the signatures array
          const currentSignatures = existingSignature.signature_data?.signatures || []
          const coordsOnly = {
            id: signatureData.signatures[0].id,
            source: signatureSource,
            position,
            timestamp: signatureData.signatures[0].timestamp,
            content: `${currentSignatures.length + 1}`, // Sequential numbering for added signatures
          }
          const updatedSignatures = [...currentSignatures, coordsOnly]
          
          const { error: updateError } = await adminClient
            .from("document_signatures")
            .update({
              signature_data: { signatures: updatedSignatures },
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingSignature.id)

          if (updateError) {
            console.error("Error updating signature:", updateError)
            return NextResponse.json({ error: "Failed to update signature" }, { status: 500 })
          }


        } else {
          // Create new signature record (store only coords)
          const { error: createError } = await adminClient
            .from("document_signatures")
            .insert({
              document_id: documentId,
              recipient_email: effectiveRecipientEmail,
              status: "signed",
              signed_at: new Date().toISOString(),
              signature_data: { signatures: [{ 
                id: signatureId, 
                source: signatureSource, 
                position, 
                timestamp: new Date().toISOString(),
                content: "1" // Single signature gets index 1
              }] },
              signature_source: signatureSource,
            })

          if (createError) {
            console.error("Error creating signature:", createError)
            return NextResponse.json({ error: "Failed to create signature" }, { status: 500 })
          }


        }

      } catch (error) {
        console.error("Error processing signature:", error)
        return NextResponse.json({ error: "Failed to save signature" }, { status: 500 })
      }

      // Update the document's status and updated_at timestamp
      const nowIso = new Date().toISOString()
      const { error: docUpdateError } = await adminClient
        .from("documents")
        .update({
          status: "signed",
          updated_at: nowIso,
        })
        .eq("id", documentId)

      if (docUpdateError) {
        console.warn("Failed to update document status:", docUpdateError)
        // Don't fail the request if document update fails
      }

      // Clean up signature mappings when document is signed
      // Mappings are no longer needed once the document is signed
      const { error: mappingCleanupError } = await adminClient
        .from("document_signature_mappings")
        .delete()
        .eq("document_id", documentId)
      
      if (mappingCleanupError) {
        console.warn("Warning: Failed to clean up signature mappings:", mappingCleanupError)
        // Don't fail the whole operation for this
      } else {
        console.log("✅ Signature mappings cleaned up for signed document")
      }

      // Also update related request status in realtime
      const { error: reqUpdateError } = await adminClient
        .from("requests")
        .update({ status: "signed", signed_at: nowIso, updated_at: nowIso })
        .eq("document_id", documentId)
        .eq("recipient_email", effectiveRecipientEmail)

      if (reqUpdateError) {
        console.warn("Failed to update request status:", reqUpdateError)
      }

      return NextResponse.json(
        { success: true, message: "Signature saved successfully", signatureId: signatureId },
        { status: 200 }
      )
    }

    return NextResponse.json({ error: "Invalid request format" }, { status: 400 })

  } catch (error) {
    console.error("Error in signature API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// UPDATE signature position/size OR replace all signatures atomically
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params
    const body = await request.json()
    const { signatureId, token, position, signatures } = body



    if (!token) {
      return NextResponse.json(
        { error: "Missing token" },
        { status: 400 }
      )
    }

    // Check for the two different operation modes
    const isReplaceAll = signatures !== undefined
    const isSingleUpdate = signatureId && position

    if (!isReplaceAll && !isSingleUpdate) {
      return NextResponse.json(
        { error: "Must provide either 'signatures' array for replace-all or 'signatureId' + 'position' for single update" },
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

    // Handle special token - when using "fast-sign-docs@view-all", work with "fast-sign@system"
    const effectiveRecipientEmail = recipientEmail === "fast-sign-docs@view-all" ? "fast-sign@system" : recipientEmail

    // REPLACE ALL SIGNATURES (new atomic approach)
    if (isReplaceAll) {
      console.log(`🔄 ATOMIC REPLACE: Replacing all signatures with ${signatures.length} new signatures`)
      
      if (signatures.length === 0) {
        // Delete the entire signature record when no signatures
        console.log("🗑️ ATOMIC REPLACE: No signatures provided, deleting signature record")
        const { error: deleteError } = await adminClient
          .from("document_signatures")
          .delete()
          .eq("document_id", documentId)
          .eq("recipient_email", effectiveRecipientEmail)

        if (deleteError && deleteError.code !== "PGRST116") {
          // PGRST116 is "no rows found" - not an error in this case
          console.error("Error deleting signature record:", deleteError)
          return NextResponse.json(
            { error: "Failed to delete signature record" },
            { status: 500 }
          )
        }

        console.log("✅ ATOMIC REPLACE: Signature record deleted successfully (no signatures)")
      } else {
        // Validate signatures have required data
        const validSignatures = signatures.filter((signature: any) => {
          if (!signature.imageData || signature.imageData.length < 10) {
            console.warn(`❌ ATOMIC REPLACE: Signature ${signature.id} missing imageData, skipping`)
            return false
          }
          return true
        }).map((signature: any) => ({
          id: signature.id,
          dataUrl: signature.imageData,
          source: signature.signatureSource || "canvas",
          position: {
            x: Number.isFinite(signature.x) ? signature.x : 0,
            y: Number.isFinite(signature.y) ? signature.y : 0,
            width: Number.isFinite(signature.width) ? signature.width : 120,
            height: Number.isFinite(signature.height) ? signature.height : 60,
            page: Number.isFinite(signature.page) ? signature.page : 1,
            relativeX: Number.isFinite(signature.relativeX) ? signature.relativeX : 0,
            relativeY: Number.isFinite(signature.relativeY) ? signature.relativeY : 0,
            relativeWidth: Number.isFinite(signature.relativeWidth) ? signature.relativeWidth : 0.2,
            relativeHeight: Number.isFinite(signature.relativeHeight) ? signature.relativeHeight : 0.08,
          },
          timestamp: signature.timestamp || new Date().toISOString(),
        }))

        if (validSignatures.length === 0) {
          return NextResponse.json(
            { error: "No valid signatures provided (all missing imageData)" },
            { status: 400 }
          )
        }

        const signatureData = { signatures: validSignatures }

        // Check if signature record exists
        const { data: existingSignature } = await adminClient
          .from("document_signatures")
          .select("id")
          .eq("document_id", documentId)
          .eq("recipient_email", effectiveRecipientEmail)
          .single()

        if (existingSignature) {
          // Update existing record

          const { error: updateError } = await adminClient
            .from("document_signatures")
            .update({
              signature_data: signatureData,
              signed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingSignature.id)

          if (updateError) {
            console.error("Error updating signature record:", updateError)
            return NextResponse.json(
              { error: "Failed to update signatures" },
              { status: 500 }
            )
          }


        } else {
          // Create new record

          const { error: createError } = await adminClient
            .from("document_signatures")
            .insert({
              document_id: documentId,
              recipient_email: effectiveRecipientEmail,
              status: "signed",
              signed_at: new Date().toISOString(),
              signature_data: signatureData,
              signature_source: "canvas",
            })

          if (createError) {
            console.error("Error creating signature record:", createError)
            return NextResponse.json(
              { error: "Failed to create signatures" },
              { status: 500 }
            )
          }


        }
      }

      // Update document timestamp
      const { error: docUpdateError } = await adminClient
        .from("documents")
        .update({
          status: signatures.length > 0 ? "signed" : "draft",
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentId)

      if (docUpdateError) {
        console.warn("Failed to update document status:", docUpdateError)
      }

      return NextResponse.json(
        { success: true, message: `Signatures updated successfully: ${signatures.length} signatures saved` },
        { status: 200 }
      )
    }

    // Get the existing signature record to find and update the specific signature
    const { data: existingSignature, error: fetchError } = await adminClient
      .from("document_signatures")
      .select("signature_data")
      .eq("document_id", documentId)
      .eq("recipient_email", effectiveRecipientEmail)
      .single()

    if (fetchError || !existingSignature) {
      console.error("Error fetching existing signature record:", fetchError)
      return NextResponse.json(
        { error: "Signature record not found" },
        { status: 404 }
      )
    }

    // Handle both old and new signature formats
    let updatedSignatureData
    
    if (existingSignature.signature_data?.signatures) {
      // New format: signatures array - find and update the specific signature
      const signatures = existingSignature.signature_data.signatures
      const signatureIndex = signatures.findIndex((sig: any) => sig.id === signatureId)
      
      if (signatureIndex === -1) {
        return NextResponse.json(
          { error: "Signature not found in signatures array" },
          { status: 404 }
        )
      }
      
      // Update the specific signature's position while preserving other data
      const updatedSignatures = [...signatures]
      const oldSignature = updatedSignatures[signatureIndex]
      console.log("Old signature data:", oldSignature)
      
      updatedSignatures[signatureIndex] = {
        ...updatedSignatures[signatureIndex],
        position: {
          ...updatedSignatures[signatureIndex].position,
          ...position
        },
        timestamp: new Date().toISOString()
      }
      
      console.log("Updated signature data:", updatedSignatures[signatureIndex])
      
      updatedSignatureData = {
        signatures: updatedSignatures
      }
    } else {
      // Old format: direct signature data - update position while preserving dataUrl
      updatedSignatureData = {
        dataUrl: existingSignature.signature_data?.dataUrl,
        position: {
          ...existingSignature.signature_data?.position,
          ...position
        },
        timestamp: new Date().toISOString()
      }
    }

    // Update the signature record
    const { error: updateError } = await adminClient
      .from("document_signatures")
      .update({
        signature_data: updatedSignatureData
      })
      .eq("document_id", documentId)
      .eq("recipient_email", effectiveRecipientEmail)

    if (updateError) {
      console.error("Error updating signature:", updateError)
      return NextResponse.json(
        { error: "Failed to update signature" },
        { status: 500 }
      )
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

    console.log("✅ Signature position updated successfully in database")
    return NextResponse.json(
      { success: true, message: "Signature updated successfully" },
      { status: 200 }
    )

  } catch (error) {
    console.error("Error in signature UPDATE API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// DELETE signature
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params
    const body = await request.json()
    const { signatureId, token, clearAll } = body

    console.log('🗑️ DELETE signature endpoint called:', {
      documentId,
      signatureId,
      clearAll,
      hasToken: !!token
    })

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
    } catch (error) {
      console.error("Invalid token:", error)
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    if (clearAll) {
      // Handle special token - when using "fast-sign-docs@view-all", clear ALL signatures for this document
      if (recipientEmail === "fast-sign-docs@view-all") {
        console.log("Clearing ALL signatures for document (special token)")
        const { error: deleteError } = await adminClient
          .from("document_signatures")
          .delete()
          .eq("document_id", documentId)

        if (deleteError) {
          console.error("Error clearing all signatures:", deleteError)
          return NextResponse.json(
            { error: "Failed to clear signatures" },
            { status: 500 }
          )
        }
      } else {
        // Clear signatures for specific recipient
        console.log("Clearing signatures for recipient:", recipientEmail)
        const { error: deleteError } = await adminClient
          .from("document_signatures")
          .delete()
          .eq("document_id", documentId)
          .eq("recipient_email", recipientEmail)

        if (deleteError) {
          console.error("Error clearing signatures:", deleteError)
          return NextResponse.json(
            { error: "Failed to clear signatures" },
            { status: 500 }
          )
        }
      }

      return NextResponse.json(
        { success: true, message: "All signatures cleared successfully" },
        { status: 200 }
      )
    } else if (signatureId) {
      // Handle special token for specific signature deletion
      const effectiveRecipientEmail = recipientEmail === "fast-sign-docs@view-all" ? "fast-sign@system" : recipientEmail
      
      // Delete specific signature from the signatures array
      console.log('🔍 Looking for signature record:', {
        documentId,
        effectiveRecipientEmail,
        signatureId
      })

      const { data: existingSignature } = await adminClient
        .from("document_signatures")
        .select("*")
        .eq("document_id", documentId)
        .eq("recipient_email", effectiveRecipientEmail)
        .single()

      console.log('🔍 Found signature record:', existingSignature)

      if (!existingSignature) {
        console.log('❌ No signature record found')
        return NextResponse.json(
          { error: "Signature record not found" },
          { status: 404 }
        )
      }

      // Remove the specific signature from the array
      const signatures = existingSignature.signature_data?.signatures || []
      console.log('🔍 Current signatures in record:', signatures.length, signatures.map((s: any) => s.id))
      
      const updatedSignatures = signatures.filter((sig: any) => sig.id !== signatureId)
      console.log('🔍 Updated signatures after filtering:', updatedSignatures.length)

      if (updatedSignatures.length === 0) {
        // If no signatures left, delete the entire record
        const { error: deleteError } = await adminClient
          .from("document_signatures")
          .delete()
          .eq("document_id", documentId)
          .eq("recipient_email", effectiveRecipientEmail)

        if (deleteError) {
          console.error("Error deleting signature record:", deleteError)
          return NextResponse.json(
            { error: "Failed to delete signature record" },
            { status: 500 }
          )
        }
      } else {
        // Update the record with the remaining signatures
        const { error: updateError } = await adminClient
          .from("document_signatures")
          .update({
            signature_data: { signatures: updatedSignatures }
          })
          .eq("document_id", documentId)
          .eq("recipient_email", effectiveRecipientEmail)

        if (updateError) {
          console.error("Error updating signature record:", updateError)
          return NextResponse.json(
            { error: "Failed to update signature record" },
            { status: 500 }
          )
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

      return NextResponse.json(
        { success: true, message: "Signature deleted successfully" },
        { status: 200 }
      )
    } else {
      return NextResponse.json(
        { error: "Missing signature ID or clearAll flag" },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error("Error in signature DELETE API:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
