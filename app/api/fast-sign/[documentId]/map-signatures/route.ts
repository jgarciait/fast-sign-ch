import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params
    const { signatures } = await request.json()

    if (!signatures || !Array.isArray(signatures)) {
      return NextResponse.json(
        { error: "Invalid signatures data" },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // Get current user (for created_by field)
    let userId = null
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id || null
    } catch (userError) {
      console.warn("Could not get user for created_by field:", userError)
      // Continue without user ID - will use a default system user ID
    }

    // If no user ID, use a system default (this endpoint is called from fast-sign interface)
    if (!userId) {
      // For fast-sign mapping operations, we can use a system user ID or make it optional
      console.log("No user ID available, using system default for mapping operation")
    }

    // CRITICAL: Check document status before allowing mapping changes
    const { data: document, error: docError } = await adminClient
      .from("documents")
      .select("id, status, file_name, created_by")
      .eq("id", documentId)
      .single()

    if (docError || !document) {
      console.error("❌ Document not found:", docError)
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      )
    }

    // Block mapping only if document is in certain restricted statuses
    // Allow re-mapping of signed documents for additional signatures
    const blockingStatuses = ["returned", "completed"]
    if (blockingStatuses.includes(document.status?.toLowerCase() || "")) {
      console.error(`❌ Mapping blocked: Document "${document.file_name}" is in status "${document.status}" - cannot modify mapping in this state`)
      return NextResponse.json({
        error: "Cannot modify signature mapping in current document state",
        details: `Document status: ${document.status}`,
        currentStatus: document.status
      }, { status: 423 }) // 423 Locked
    }

    console.log(`✅ Document status "${document.status}" allows mapping modifications`)

    // Use document creator as created_by if no current user available
    if (!userId && document.created_by) {
      userId = document.created_by
      console.log("Using document creator as created_by for mapping operation")
    }

    // Final check - must have a valid created_by
    if (!userId) {
      console.error("❌ No valid user ID available for created_by field")
      return NextResponse.json({
        error: "Unable to determine user for mapping operation",
        details: "No authenticated user found and document has no creator"
      }, { status: 400 })
    }

    // Prepare signature fields for document_signature_mappings table
    const signatureFields = signatures.map((sig: any) => ({
      id: sig.id || `field_${Date.now()}_${Math.random()}`,
      page: sig.page,
      x: sig.x,
      y: sig.y,
      width: sig.width,
      height: sig.height,
      relativeX: sig.relativeX,
      relativeY: sig.relativeY,
      relativeWidth: sig.relativeWidth,
      relativeHeight: sig.relativeHeight,
      label: `Firma ${sig.page ? `página ${sig.page}` : 'sin página'}`,
      required: true,
      timestamp: sig.timestamp || new Date().toISOString()
    }))

    // Check if mapping already exists for this document
    const { data: existingMapping } = await adminClient
      .from("document_signature_mappings")
      .select("id")
      .eq("document_id", documentId)
      .single()

    let mappingError

    if (existingMapping) {
      // Update existing mapping
      const { error } = await adminClient
        .from("document_signature_mappings")
        .update({
          signature_fields: signatureFields,
          updated_at: new Date().toISOString()
        })
        .eq("document_id", documentId)
      
      mappingError = error
    } else {
      // Create new mapping
      const { error } = await adminClient
        .from("document_signature_mappings")
        .insert({
          document_id: documentId,
          signature_fields: signatureFields,
          created_by: userId || document.created_by, // Fallback to document creator
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      
      mappingError = error
    }

    if (mappingError) {
      console.error("❌ Error saving signature mapping:", mappingError)
      return NextResponse.json(
        { error: "Failed to save signature mappings" },
        { status: 500 }
      )
    }



    // Update document status to "mapeado" (mapped)
    // If document was previously signed, keep track of that but allow re-mapping
    const newStatus = document.status === "firmado" ? "remapeado" : "mapeado"
    const { error: docUpdateError } = await adminClient
      .from("documents")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq("id", documentId)

    if (docUpdateError) {
      console.warn("Warning: Failed to update document status to mapped:", docUpdateError)
    }

    console.log(`✅ Successfully saved ${signatures.length} signature field mappings for document ${documentId}`)

    return NextResponse.json({ 
      success: true,
      message: `${signatures.length} signature field mappings saved successfully`
    })

  } catch (error) {
    console.error("❌ Error in map-signatures API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
