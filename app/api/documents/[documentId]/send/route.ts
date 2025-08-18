import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { BUCKET_PUBLIC } from "@/utils/supabase/storage"
import { PDFDocument } from "pdf-lib"
import { sanitizeFilename } from "@/utils/filename-utils"
import { calculateSignaturePosition, debugCoordinateConversion, validateSignatureCoordinates, getRawPDFPageDimensions, getPageRotationAndIgnoreIt } from '@/utils/signature-coordinate-utils'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { token, updateStatus = false, consolidatedSignatureData } = await req.json()
    const { documentId } = await params

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    let recipientEmail: string
    try {
      const decoded = Buffer.from(token, "base64").toString("utf-8")
      
      // Handle new token format (email:signingId) and legacy format (email only)
      if (decoded.includes(':')) {
        // New format: extract email from email:signingId
        recipientEmail = decoded.split(':')[0]
      } else {
        // Legacy format: token contains only email
        recipientEmail = decoded
      }
    } catch (e) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Extract signing ID from token if available
    let signingId: string | null = null
    const decoded = Buffer.from(token, "base64").toString("utf-8")
    if (decoded.includes(':')) {
      signingId = decoded.split(':')[1]
    }

    // Verify signing request exists and is valid
    let signingRequestQuery = adminClient
      .from("signing_requests")
      .select("id, status, recipient_email, document_id")
      .eq("document_id", documentId)
      .eq("recipient_email", recipientEmail)

    if (signingId) {
      // Use specific signing request if signingId is provided
      signingRequestQuery = signingRequestQuery.eq("signing_id", signingId)
    } else {
      // Fallback: use most recent pending request
      signingRequestQuery = signingRequestQuery
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
    }

    const { data: signingRequest, error: signingRequestError } = await signingRequestQuery.single()

    if (signingRequestError || !signingRequest) {
      console.error("Signing request not found:", signingRequestError)
      return NextResponse.json({ error: "Signing request not found or expired" }, { status: 404 })
    }

    // Verify the signing request is still pending
    if (signingRequest.status !== "pending") {
      return NextResponse.json({ error: "Signing request is no longer available" }, { status: 400 })
    }

    const currentTime = new Date().toISOString()

    if (updateStatus) {
      try {
        const { data: document, error: docError } = await adminClient
          .from("documents")
          .select("id, file_path, file_name, original_file_path, created_by, file_size, file_type")
          .eq("id", documentId)
          .single()
        
        if (!document || docError) {
          console.error("Document not found for signing process:", docError)
          throw new Error("Document not found")
        }

        // Step 1: Collect signatures from consolidatedSignatureData (from browser state)
        let allSignatures: any[] = []
        if (consolidatedSignatureData?.signatures?.length) {
          allSignatures = consolidatedSignatureData.signatures.map((sig: any) => ({
            id: sig.id,
            imageData: sig.dataUrl, // Keep image for PDF merge
            signatureSource: sig.source || "mapping",
            // Use flat structure coordinates
            x: sig.x,
            y: sig.y,
            width: sig.width,
            height: sig.height,
            page: sig.page,
            relativeX: sig.relativeX,
            relativeY: sig.relativeY,
            relativeWidth: sig.relativeWidth,
            relativeHeight: sig.relativeHeight,
            timestamp: sig.timestamp,
          }))
        }

        if (allSignatures.length === 0) {
          console.warn("No signatures found for signing process")
          throw new Error("No signatures found")
        }

        // Step 2: Download original document and merge signatures
        const { data: originalPdfData, error: downloadError } = await adminClient.storage
          .from(BUCKET_PUBLIC)
          .download(document.file_path)
        
        if (!originalPdfData || downloadError) {
          console.error("Failed to download original PDF:", downloadError)
          throw new Error("Failed to download original PDF")
        }

        const pdfDoc = await PDFDocument.load(await originalPdfData.arrayBuffer())
        const pages = pdfDoc.getPages()

        // Merge signatures into PDF using RAW DIMENSIONS (no corrections)
        for (const sig of allSignatures) {
          const pageIndex = Math.max(0, Math.min((sig.page || 1) - 1, pages.length - 1))
          const page = pages[pageIndex]
          
          // CRÍTICO: Usar dimensiones RAW del PDF directamente (sin correcciones automáticas)
          const { width: rawPageWidth, height: rawPageHeight } = page.getSize()
          
          // 🚫 DETECTAR Y IGNORAR ROTACIÓN DE PÁGINA COMPLETAMENTE
          const pageRotationInfo = getPageRotationAndIgnoreIt(page)
          console.log(`🚫 DOCUMENTS SEND: ${pageRotationInfo.message}`)
          
          if (!sig.imageData) continue
          const base64 = sig.imageData.split(",")[1]
          if (!base64) continue
          
          const bytes = Buffer.from(base64, "base64")
          const image = sig.imageData.includes("image/png")
            ? await pdfDoc.embedPng(bytes)
            : await pdfDoc.embedJpg(bytes)
          
          // CRITICAL FIX: Use unified coordinate system that matches mapping system EXACTLY
          if (!validateSignatureCoordinates(sig)) {
            console.warn(`Skipping signature ${sig.id}: missing coordinate data`)
            continue
          }

          // 🚫 PASAR ROTACIÓN PERO IGNORARLA COMPLETAMENTE
          const position = debugCoordinateConversion(sig, { width: rawPageWidth, height: rawPageHeight }, pageRotationInfo.rotation)
          
          console.log(`🎯 DOCUMENTS SEND: Using RAW PDF dimensions for page ${sig.page}:`, {
            rawDimensions: { width: rawPageWidth, height: rawPageHeight },
            signaturePosition: position,
            orientation: rawPageWidth > rawPageHeight ? 'LANDSCAPE' : 'PORTRAIT',
            note: 'Using RAW dimensions - NO automatic corrections applied'
          })
          
          // CRÍTICO: NO hacer rotaciones automáticas - las firmas siempre horizontales
          page.drawImage(image, {
            x: position.x,
            y: position.y,
            width: position.width,
            height: position.height
          })
          
          console.log(`✅ DOCUMENTS SEND: Applied signature ${sig.id} at RAW coordinates:`, position)
        }

        // Step 3: Save merged PDF to new location
        const mergedBytes = await pdfDoc.save()
        const timestamp = Date.now()
        const sanitizedFileName = sanitizeFilename(document.file_name)
        const signedPath = `signed/${documentId}/${timestamp}_${sanitizedFileName}`

        const { error: uploadError } = await adminClient.storage
          .from(BUCKET_PUBLIC)
          .upload(signedPath, mergedBytes, { contentType: "application/pdf", upsert: true })
        
        if (uploadError) {
          console.error("Failed to upload signed PDF:", uploadError)
          throw new Error("Failed to upload signed PDF")
        }

        // Step 4: Create signature locations data (without images) for indexing
        const signatureLocationsData = {
          signatures: allSignatures.map(sig => ({
            x: sig.x,
            y: sig.y,
            id: sig.id,
            page: sig.page,
            width: sig.width,
            height: sig.height,
            source: sig.signatureSource || "mapping",
            relativeX: sig.relativeX,
            relativeY: sig.relativeY,
            timestamp: sig.timestamp,
            relativeWidth: sig.relativeWidth,
            relativeHeight: sig.relativeHeight,
          }))
        }

        // Step 5: Update existing document with signed PDF and mark as signed
        const { data: updatedDocument, error: updateDocError } = await adminClient
          .from("documents")
          .update({
            file_name: `SIGNED_${document.file_name}`,
            file_path: signedPath,
            file_size: mergedBytes.length,
            original_file_path: document.file_path,
            status: "firmado",
            document_type: "fast_sign", // Set to fast_sign so it appears in /fast-sign-docs
            updated_at: new Date().toISOString()
          })
          .eq("id", documentId)
          .select()
          .single()
        
        if (updateDocError) {
          console.error("Failed to update document record:", updateDocError)
          throw new Error("Failed to update document record")
        }

        // Step 6: Save signature locations to document_signatures for viewing
        // Check if signatures already exist for this document and recipient
        const { data: existingSignatures } = await adminClient
          .from("document_signatures")
          .select("id, signature_data")
          .eq("document_id", documentId)
          .eq("recipient_email", recipientEmail)
          .eq("status", "signed")
          .single()

        let sigSaveError = null
        if (existingSignatures) {
          // Update existing signatures by merging with previous signature data
          console.log("Updating existing signatures for re-signed document")
          
          // Parse existing signature data
          let existingSignatureData = { signatures: [] }
          try {
            if (existingSignatures.signature_data && typeof existingSignatures.signature_data === 'object') {
              existingSignatureData = existingSignatures.signature_data as any
            }
          } catch (parseError) {
            console.warn("Could not parse existing signature data, starting fresh:", parseError)
          }

          // Merge new signatures with existing ones
          const existingSignaturesList = existingSignatureData.signatures || []
          const newSignaturesList = signatureLocationsData.signatures || []
          
          // Combine signatures, with new ones taking priority if they have the same ID
          const combinedSignatures = [...existingSignaturesList]
          
          newSignaturesList.forEach((newSig: any) => {
            const existingIndex = combinedSignatures.findIndex((existingSig: any) => existingSig.id === newSig.id)
            if (existingIndex >= 0) {
              // Replace existing signature with same ID
              combinedSignatures[existingIndex] = newSig
            } else {
              // Add new signature
              combinedSignatures.push(newSig)
            }
          })

          const mergedSignatureData = {
            signatures: combinedSignatures
          }

          console.log(`Merging signatures: ${existingSignaturesList.length} existing + ${newSignaturesList.length} new = ${combinedSignatures.length} total`)

          const { error } = await adminClient
            .from("document_signatures")
            .update({
              signature_data: mergedSignatureData,
              signed_at: new Date().toISOString(),
              signature_source: "mapping",
              updated_at: new Date().toISOString()
            })
            .eq("document_id", documentId)
            .eq("recipient_email", recipientEmail)
            .eq("status", "signed")
          sigSaveError = error
        } else {
          // Insert new signatures record
          console.log("Creating new signatures record for first-time signed document")
          const { error } = await adminClient
            .from("document_signatures")
            .insert({
              document_id: documentId,
              recipient_email: recipientEmail,
              signature_data: signatureLocationsData,
              signed_at: new Date().toISOString(),
              signature_source: "mapping",
              status: "signed"
            })
          sigSaveError = error
        }

        if (sigSaveError) {
          console.error("Failed to save signature locations:", sigSaveError)
          throw new Error("Failed to save signature locations")
        }

        // Step 7: Clean up signature mappings - they're no longer needed
        const { error: mappingCleanupError } = await adminClient
          .from("document_signature_mappings")
          .delete()
          .eq("document_id", documentId)
        
        if (mappingCleanupError) {
          console.warn("Warning: Failed to clean up signature mappings:", mappingCleanupError)
        }

        // Step 8: Update request status to signed (keep same document_id)
        const { error: requestUpdateError } = await adminClient
          .from("requests")
          .update({
            status: "signed",
            signed_at: new Date().toISOString()
          })
          .eq("document_id", documentId)
        
        if (requestUpdateError) {
          console.warn("Warning: Failed to update request status:", requestUpdateError)
        }

        // Step 9: Update the current signing request status to completed
        const { error: signingRequestUpdateError } = await adminClient
          .from("signing_requests")
          .update({
            status: "completed",
            signed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq("document_id", documentId)
          .eq("recipient_email", recipientEmail)
          .eq("status", "pending") // Only update pending requests
        
        if (signingRequestUpdateError) {
          console.warn("Warning: Failed to update signing request status:", signingRequestUpdateError)
        } else {
          console.log("Signing request marked as completed")
        }

        console.log(`✅ Successfully updated document ${documentId} as signed with ${allSignatures.length} indexed signatures`)
        
        // Return success with same document ID
        return NextResponse.json({ 
          success: true, 
          message: "Document signed and statuses updated successfully", 
          status: "signed", 
          timestamp: currentTime,
          documentId: documentId
        })
        
      } catch (error) {
        console.error("❌ SEND API: Error during signing process:", {
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
          documentId,
          step: 'signing_process'
        })
        throw error
      }
    }

    const signingRequestStatus = updateStatus ? "signed" : "completed"
    const signingRequestUpdate: any = { status: signingRequestStatus, updated_at: currentTime }
    if (updateStatus) signingRequestUpdate.signed_at = currentTime
    await adminClient
      .from("signing_requests")
      .update(signingRequestUpdate)
      .eq("document_id", documentId)
      .eq("recipient_email", recipientEmail)

    const message = updateStatus
      ? "Document signed and statuses updated successfully"
      : "Document sent successfully"

    const status = updateStatus ? "signed" : "sent"
    return NextResponse.json({ success: true, message, status, timestamp: currentTime })
  } catch (error) {
    console.error("❌ SEND API: Unhandled error:", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      documentId: (await params).documentId
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}


