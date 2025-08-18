import { NextResponse } from "next/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { BUCKET_PUBLIC } from "@/utils/supabase/storage"
import { sanitizeFilename } from "@/utils/filename-utils"
import { applySignaturesToPDF, extractSignatureDataFromState } from "@/utils/pdf-signature-placement"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params
    const adminClient = createAdminClient()

    // Load document
    const { data: document, error: docError } = await adminClient
      .from("documents")
      .select("id, file_path, file_name, original_file_path")
      .eq("id", documentId)
      .single()

    if (docError || !document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // Parse signatures from request (comes from browser cache during save)
    const body = await request.json().catch(() => ({}))
    const signatures = Array.isArray(body.signatures) ? body.signatures : []
    const isEditMode = body.isEditMode === true

    if (!signatures || signatures.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: "No signatures to merge",
        documentId 
      })
    }

    // Determine source document path
    let sourceDocumentPath: string
    if (!document.original_file_path) {
      sourceDocumentPath = document.file_path
    } else if (isEditMode) {
      sourceDocumentPath = document.file_path
    } else {
      sourceDocumentPath = document.original_file_path
    }
    
    // Download the source document
    const { data: originalPdfData, error: downloadError } = await adminClient.storage
      .from(BUCKET_PUBLIC)
      .download(sourceDocumentPath)

    if (downloadError || !originalPdfData) {
      return NextResponse.json({ error: 'Failed to download PDF document' }, { status: 500 })
    }

    const pdfArrayBuffer = await originalPdfData.arrayBuffer()

    // Extract signature data using official format
    const signatureData = extractSignatureDataFromState(signatures)

    // IMPORTANT: Save signature metadata to database before creating PDF
    // This ensures signature data is available for viewers and indexing
    if (signatures.length > 0) {

      
      try {
        // Check if there's an existing signature record to update
        const { data: existingSignature } = await adminClient
          .from("document_signatures")
          .select("id")
          .eq("document_id", documentId)
          .eq("recipient_email", "fast-sign@system")
          .single()

        // Transform signature data for database storage
        const coordinatesWithMetadata = {
          signatures: signatures.map(sig => ({
            id: sig.id,
            source: sig.source || sig.signatureSource || 'canvas',
            timestamp: sig.timestamp || new Date().toISOString(),
            // Include absolute coordinates
            x: sig.x,
            y: sig.y,
            width: sig.width,
            height: sig.height,
            page: sig.page,
            // Include relative coordinates
            relativeX: sig.relativeX,
            relativeY: sig.relativeY,
            relativeWidth: sig.relativeWidth,
            relativeHeight: sig.relativeHeight,
            // Include content field for signature indexing
            content: sig.content,
          }))
        }

        if (existingSignature) {
          // Update existing record with new signature data
          const { error: updateError } = await adminClient
            .from("document_signatures")
            .update({
              signature_data: coordinatesWithMetadata,
              signed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingSignature.id)
          
          if (updateError) {
            console.error('❌ Failed to update signature metadata:', updateError)
          }
        } else {
          // Create new signature record
          const { error: createError } = await adminClient
            .from("document_signatures")
            .insert({
              document_id: documentId,
              recipient_email: "fast-sign@system",
              status: "signed",
              signed_at: new Date().toISOString(),
              signature_data: coordinatesWithMetadata,
              signature_source: "canvas",
            })
          
          if (createError) {
            console.error('❌ Failed to create signature metadata:', createError)
          }
        }
      } catch (error) {
        console.error('❌ Error saving signature metadata:', error)
        // Don't fail the entire operation, but log the error
      }
    }

    // Apply signatures using official pdf-lib implementation
    let mergedBytes: Uint8Array
    try {
      mergedBytes = await applySignaturesToPDF(pdfArrayBuffer, signatureData)
    } catch (error) {
      console.error('❌ OFFICIAL PDF-LIB FAILED:', error)
      return NextResponse.json({ 
        error: 'Failed to apply signatures to PDF', 
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    }

    // Generate new signed document path
    const timestamp = Date.now()
    const sanitizedFileName = sanitizeFilename(document.file_name)
    const signedPath = `signed/${documentId}/${timestamp}_${sanitizedFileName}`

    // Handle original_file_path logic
    let updateData: any = { 
      file_path: signedPath, 
      updated_at: new Date().toISOString(), 
      status: 'firmado' 
    }
    
    if (!document.original_file_path && sourceDocumentPath !== document.file_path) {
      updateData.original_file_path = document.file_path
    } else if (document.original_file_path) {
      updateData.original_file_path = document.original_file_path
    }

    // Upload the signed PDF
    const { error: uploadError } = await adminClient.storage
      .from(BUCKET_PUBLIC)
      .upload(signedPath, mergedBytes, { contentType: 'application/pdf', upsert: true })

    if (uploadError) {
      return NextResponse.json({ 
        error: 'Failed to upload merged PDF', 
        details: uploadError.message,
        path: signedPath 
      }, { status: 500 })
    }

    // Update document record
    const { error: updateError } = await adminClient
      .from('documents')
      .update(updateData)
      .eq('id', documentId)

    if (updateError) {
      return NextResponse.json({ 
        error: 'Failed to update document record', 
        details: updateError.message 
      }, { status: 500 })
    }

    // Store signature data for historical tracking
    for (const sig of signatures) {
      console.log('💾 OFFICIAL PDF-LIB - Signature coordinates saved:', {
        signatureId: sig.id,
        pageNumber: sig.page,
        coordinates: {
          absolute: { x: sig.x, y: sig.y, width: sig.width, height: sig.height },
          relative: { x: sig.relativeX, y: sig.relativeY, width: sig.relativeWidth, height: sig.relativeHeight }
        },
        note: 'Coordinates processed by official pdf-lib implementation'
      })
    }

    console.log(`✅ OFFICIAL PDF-LIB SUCCESS: Document saved with ${signatures.length} signatures`)

    return NextResponse.json({ 
      success: true, 
      documentId, 
      signedPath,
      signatureCount: signatures.length,
      implementation: 'official-pdf-lib'
    })

  } catch (error) {
    console.error('❌ OFFICIAL PDF-LIB SAVE ERROR:', error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : 'Unknown error',
      implementation: 'official-pdf-lib'
    }, { status: 500 })
  }
}
