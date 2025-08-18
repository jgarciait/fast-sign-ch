import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { BUCKET_PUBLIC } from "@/utils/supabase/storage"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params
    const supabase = await createClient()

    // Get the current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    // Get the document - GLOBAL ACCESS: any authenticated user can access any document
    const { data: document, error } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single()

    if (error) {
      console.error("Error fetching document:", error)
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // Get the public URL for the document
    const { data: urlData } = supabase.storage
      .from("public-documents")
      .getPublicUrl(document.file_path)

    return NextResponse.json({
      ...document,
      file_url: urlData.publicUrl,
      url: urlData.publicUrl,
    })
  } catch (error) {
    console.error("Error in document API:", error)
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
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // Get the current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    console.log("Deleting document:", documentId)

    // Get the document details first
    const { data: document, error: fetchError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single()

    if (fetchError || !document) {
      console.error("Document not found:", fetchError)
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // Delete related records first (in correct order to avoid foreign key violations)
    
    // 1. Delete signature_mapping_templates (they reference document_signature_mappings)
    console.log("Getting signature mappings for document...")
    const { data: mappings, error: getMappingsError } = await adminClient
      .from("document_signature_mappings")
      .select("id")
      .eq("document_id", documentId)

    if (mappings && mappings.length > 0) {
      console.log("Deleting signature_mapping_templates...")
      const mappingIds = mappings.map((m: { id: string }) => m.id)
      
      const { error: deleteTemplatesError } = await adminClient
        .from("signature_mapping_templates")
        .delete()
        .in("document_mapping_id", mappingIds)

      if (deleteTemplatesError) {
        console.error("Error deleting signature_mapping_templates:", deleteTemplatesError)
      }

      // Delete document_signature_mappings
      console.log("Deleting document_signature_mappings...")
      const { error: deleteMappingsError } = await adminClient
        .from("document_signature_mappings")
        .delete()
        .eq("document_id", documentId)

      if (deleteMappingsError) {
        console.error("Error deleting document_signature_mappings:", deleteMappingsError)
      }
    }

    // 2. Delete signing_requests
    console.log("Deleting signing_requests...")
    const { error: deleteSigningRequestsError } = await adminClient
      .from("signing_requests")
      .delete()
      .eq("document_id", documentId)

    if (deleteSigningRequestsError) {
      console.error("Error deleting signing_requests:", deleteSigningRequestsError)
    }

    // 3. Delete document_signatures
    console.log("Deleting document_signatures...")
    const { error: deleteSignaturesError } = await adminClient
      .from("document_signatures")
      .delete()
      .eq("document_id", documentId)

    if (deleteSignaturesError) {
      console.error("Error deleting document_signatures:", deleteSignaturesError)
    }

    // 4. Delete document_annotations
    console.log("Deleting document_annotations...")
    const { error: deleteAnnotationsError } = await adminClient
      .from("document_annotations")
      .delete()
      .eq("document_id", documentId)

    if (deleteAnnotationsError) {
      console.warn("Warning: Could not delete document_annotations:", deleteAnnotationsError)
    }

    // 5. Delete any requests that reference this document
    console.log("Deleting requests...")
    const { error: deleteRequestsError } = await adminClient
      .from("requests")
      .delete()
      .eq("document_id", documentId)

    if (deleteRequestsError) {
      console.error("Error deleting requests:", deleteRequestsError)
    }

    // 6. Delete the file from storage if it exists
    if (document.file_path) {
      console.log("Deleting file from storage:", document.file_path)

      // Extract the path within the bucket
      let pathInBucket = document.file_path as string

      // Handle different path formats
      if (document.file_path.includes(`${BUCKET_PUBLIC}/`)) {
        pathInBucket = document.file_path.split(`${BUCKET_PUBLIC}/`)[1]
      }

      if (pathInBucket.startsWith("uploads/")) {
        // Already in correct format
      } else if (!pathInBucket.includes("/")) {
        pathInBucket = `uploads/${pathInBucket}`
      }

      console.log("Deleting from bucket:", BUCKET_PUBLIC, "Path:", pathInBucket)

      const { error: storageError } = await adminClient.storage
        .from(BUCKET_PUBLIC)
        .remove([pathInBucket])

      if (storageError) {
        console.error("Error deleting file from storage:", storageError)
        // Don't fail the whole operation
      } else {
        console.log("File deleted successfully from storage")
      }
    }

    // 7. Finally, delete the document record
    console.log("Deleting document record...")
    const { error: deleteDocumentError } = await adminClient
      .from("documents")
      .delete()
      .eq("id", documentId)

    if (deleteDocumentError) {
      console.error("Error deleting document:", deleteDocumentError)
      return NextResponse.json({ error: `Error deleting document: ${deleteDocumentError.message}` }, { status: 500 })
    }

    console.log("Document deleted successfully")
    return NextResponse.json({ success: true, message: "Document deleted successfully" })

  } catch (error) {
    console.error("Error in document DELETE API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
