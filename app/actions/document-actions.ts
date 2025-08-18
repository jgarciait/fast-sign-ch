"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { revalidatePath } from "next/cache"
import { sendDocumentEmail } from "./email-actions"

export async function sendDocument(formData: FormData) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient() // Use admin client to bypass RLS if needed

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: "Not authenticated", success: false }
    }

    console.log("Starting document creation process...")

    // Extract form data
    const fileName = formData.get("fileName") as string
    const fileSize = Number.parseInt(formData.get("fileSize") as string) || 0
    const fileType = formData.get("fileType") as string
    const title = formData.get("subject") as string
    const message = formData.get("message") as string
    const recipientEmail = formData.get("recipient") as string
    const filePath = formData.get("filePath") as string
    const fileUrl = formData.get("fileUrl") as string
    const createOnly = formData.get("createOnly") === "true"
    const existingDocumentId = formData.get("existingDocumentId") as string

    console.log("Form data extracted:", { fileName, fileSize, fileType, title, recipientEmail, filePath })

    // Optional customer fields
    const firstName = (formData.get("first_name") as string) || null
    const lastName = (formData.get("last_name") as string) || null
    const telephone = (formData.get("telephone") as string) || null
    const postalAddress = (formData.get("postal_address") as string) || null

    // Get or create customer (skip if createOnly mode and no recipient email)
    let customerId: string | null = null
    let recipientName = ""

    if (!createOnly || (recipientEmail && recipientEmail.trim() !== "")) {
      console.log("Checking if customer exists:", recipientEmail)

      // Check if customer exists
      const { data: existingCustomers, error: customerQueryError } = await supabase
        .from("customers")
        .select("id, first_name, last_name")
        .eq("email", recipientEmail)
        .limit(1)

      if (customerQueryError) {
        console.error("Error querying customer:", customerQueryError)
        return { error: `Error querying customer: ${customerQueryError.message}`, success: false }
      }

      if (existingCustomers && existingCustomers.length > 0) {
        customerId = existingCustomers[0].id
        recipientName = `${existingCustomers[0].first_name || ""} ${existingCustomers[0].last_name || ""}`.trim()
        console.log("Existing customer found:", customerId)
      } else if (recipientEmail && recipientEmail.trim() !== "") {
        console.log("Creating new customer...")
        // Create a new customer
        const { data: newCustomer, error: customerError } = await supabase
          .from("customers")
          .insert({
            email: recipientEmail,
            first_name: firstName,
            last_name: lastName,
            telephone: telephone,
            postal_address: postalAddress,
          })
          .select()

        if (customerError) {
          console.error("Error creating customer:", customerError)
          return { error: `Error creating customer: ${customerError.message}`, success: false }
        }

        if (!newCustomer || newCustomer.length === 0) {
          console.error("No customer data returned after insert")
          return { error: "Failed to create customer: No data returned", success: false }
        }

        customerId = newCustomer[0].id
        recipientName = `${firstName || ""} ${lastName || ""}`.trim()
        console.log("New customer created:", customerId)
      }
    } else {
      console.log("CreateOnly mode without recipient - skipping customer creation")
    }

    let document: any[]
    
    // CRITICAL: First check if we have signature fields (mapping) - if so, find the existing mapped document
    const signatureFieldsData = formData.get("signatureFields") as string
    let existingMappedDocument: any = null
    
    if (signatureFieldsData) {
      try {
        const signatureFields = JSON.parse(signatureFieldsData)
        console.log("Found signature fields, looking for existing mapped document...")
        
        // Look for the most recent mapped document by this user
        const { data: mappedDocs, error: mappingQueryError } = await supabase
          .from("document_signature_mappings")
          .select("document_id, documents!inner(*)")
          .eq("created_by", user.id)
          .order("created_at", { ascending: false })
          .limit(5) // Get last 5 to find the right one

        if (!mappingQueryError && mappedDocs && mappedDocs.length > 0) {
          // Find a mapped document that is not yet sent
          // Include "remapeado" status for documents that were previously signed and re-mapped
          const availableMappedDoc = mappedDocs.find(doc => 
            doc.documents && 
            (doc.documents.status === 'mapped' || doc.documents.status === 'mapeado' || 
             doc.documents.status === 'remapeado' || doc.documents.status === null || 
             doc.documents.status === 'draft')
          )
          
          if (availableMappedDoc) {
            existingMappedDocument = availableMappedDoc.documents
            console.log("Found existing mapped document to reuse:", existingMappedDocument.id)
          }
        }
      } catch (parseError) {
        console.error("Error parsing signature fields:", parseError)
      }
    }
    
    // Handle existing document vs new document
    if (existingMappedDocument) {
      console.log("Using existing mapped document:", existingMappedDocument.id)
      document = [existingMappedDocument]
    } else if (existingDocumentId && formData.get("source") !== "template") {
      console.log("Using existing document:", existingDocumentId)
      
      // Get existing document
      const { data: existingDoc, error: existingDocError } = await supabase
        .from("documents")
        .select("*")
        .eq("id", existingDocumentId)
        .single()

      if (existingDocError || !existingDoc) {
        console.error("Error fetching existing document:", existingDocError)
        return { error: "Existing document not found", success: false }
      }

      document = [existingDoc]
      console.log("Using existing document:", document[0].id)
    } else {
      console.log("Creating new document record...")

      // For templates, get the file info from the template's original document but create a new record
      let finalFileName = fileName
      let finalFilePath = filePath
      let finalFileUrl = fileUrl
      let finalFileSize = fileSize
      let finalFileType = fileType
      
      if (formData.get("source") === "template" && existingDocumentId) {
        console.log("Template mode: Creating new document record with template file info")
        
        // Get the original document info for file details
        const { data: templateDoc, error: templateDocError } = await supabase
          .from("documents")
          .select("file_name, file_path, file_size, file_type")
          .eq("id", existingDocumentId)
          .single()

        if (templateDocError || !templateDoc) {
          console.error("Error fetching template document:", templateDocError)
          return { error: "Template document not found", success: false }
        }

        finalFileName = templateDoc.file_name
        finalFilePath = templateDoc.file_path
        finalFileUrl = formData.get("fileUrl") as string || templateDoc.file_path
        finalFileSize = templateDoc.file_size || 0
        finalFileType = templateDoc.file_type || 'application/pdf'
      }

      // Insert new document record
      const { data: newDocument, error: documentError } = await supabase
        .from("documents")
        .insert({
          file_name: finalFileName,
          file_path: finalFilePath,
          file_size: finalFileSize,
          file_type: finalFileType,
          created_by: user.id,
          document_type: 'email',
          archived: false,
        })
        .select()

      if (documentError) {
        console.error("Error creating document:", documentError)
        return { error: `Error creating document: ${documentError.message}`, success: false }
      }

      if (!newDocument || newDocument.length === 0) {
        console.error("No document data returned after insert")
        return { error: "Failed to create document: No data returned", success: false }
      }

      document = newDocument
      console.log("Document created:", document[0].id)
    }

    // If createOnly is true, just return the document ID without sending emails
    if (createOnly) {
      console.log("CreateOnly mode - skipping request and email creation")
      return { success: true, documentId: document[0].id }
    }

    // Simplified approach: Try direct insert with minimal fields
    console.log("Creating request record...")

    const requestData = {
      title: title || "Document Request",
      message: message || "Document for review",
      customer_id: customerId, // This can be null in createOnly mode
      document_id: document[0].id,
      created_by: user.id,
      sent_at: new Date().toISOString(),
      status: "sent", // Try with lowercase
    }

    console.log("Request data:", requestData)

    const { data: request, error: requestError } = await supabase.from("requests").insert(requestData).select()

    if (requestError) {
      console.error("Error creating request:", requestError)

      // If that fails, try with uppercase
      const { data: requestUpper, error: requestUpperError } = await supabase
        .from("requests")
        .insert({
          ...requestData,
          status: "SENT",
        })
        .select()

      if (requestUpperError) {
        console.error("Error creating request with uppercase status:", requestUpperError)
        return { error: `Error creating request: ${requestError.message}`, success: false }
      }

      console.log("Request created with uppercase status:", requestUpper)
    } else {
      console.log("Request created:", request)
    }

    // Handle signature field mapping (only if we have signature fields and we're using the document)
    if (signatureFieldsData) {
      try {
        const signatureFields = JSON.parse(signatureFieldsData)
        console.log("Saving signature field mapping for document:", document[0].id)
        
        // Save or update signature field mapping for the document we're using
        const { error: mappingError } = await supabase
          .from("document_signature_mappings")
          .upsert({
            document_id: document[0].id,
            signature_fields: signatureFields,
            created_by: user.id,
          }, {
            onConflict: 'document_id'
          })

        if (mappingError) {
          console.error("Error saving signature mapping:", mappingError)
          // Don't fail the whole process, but log the error
          console.warn("Continuing without signature mapping")
        } else {
          console.log("Signature mapping saved successfully")
        }
      } catch (parseError) {
        console.error("Error parsing signature fields:", parseError)
      }
    }

    // Create signing request entry for public access
    console.log("Creating signing request...")
    const signingId = Buffer.from(`${recipientEmail}-${document[0].id}-${Date.now()}`).toString("base64")
    const signingRequestData = {
      document_id: document[0].id,
      recipient_email: recipientEmail,
      signing_id: signingId,
      status: 'pending',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    }

    const { data: signingRequest, error: signingRequestError } = await supabase
      .from("signing_requests")
      .insert(signingRequestData)
      .select()

    if (signingRequestError) {
      console.error("Error creating signing request:", signingRequestError)
      // Don't fail the whole process, but log the error
      console.warn("Continuing without signing request - direct document access may not work")
    } else {
      console.log("Signing request created:", signingRequest[0].id)
    }

    // Make sure we're using the correct URL for the email
    const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : process.env.NEXT_PUBLIC_SITE_URL
        ? process.env.NEXT_PUBLIC_SITE_URL
        : process.env.NODE_ENV === "development"
          ? `http://localhost:${process.env.PORT || "3000"}`
          : "http://localhost:3000"

    // Send email to recipient
    console.log("Sending email to recipient...")
    const emailResult = await sendDocumentEmail({
      recipientEmail,
      recipientName,
      documentTitle: title,
      documentId: document[0].id,
      message,
      baseUrl, // Add this line
      signingId: signingRequest?.[0]?.signing_id, // Pass the specific signing_id for this request
    })

    if (emailResult && emailResult.error) {
      console.error("Error sending email:", emailResult.error)
      // Surface the error so the client can react accordingly.
      return {
        error: `Failed to send email: ${emailResult.error}`,
        success: false,
      }
    }

    console.log("Email sent successfully")

    // CRITICAL: Update document status to "enviado" after successful email send
    console.log("Updating document status to 'enviado' after successful email send...")
    const { error: docStatusError } = await supabase
      .from("documents")
      .update({
        status: "enviado",
        updated_at: new Date().toISOString()
      })
      .eq("id", document[0].id)

    if (docStatusError) {
      console.error("Error updating document status to 'enviado':", docStatusError)
      // Don't fail the whole process, but log the error since email was already sent
      console.warn("Document was sent but status was not updated - mapping may still be possible")
    } else {
      console.log("Document status updated to 'enviado' - mapping is now locked")
    }

    revalidatePath("/sent-to-sign")
    revalidatePath("/documents")
    return { success: true, documentId: document[0].id }
  } catch (error) {
    console.error("Error in sendDocument:", error)
    return { error: error instanceof Error ? error.message : "An unexpected error occurred", success: false }
  }
}

export async function getDocuments() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", documents: [] }
  }

  try {
    // Filter documents to show only those created by the current user
    const { data, error } = await supabase
      .from("documents")
      .select(`
        *
      `)
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Database error in getDocuments:", error)
      return { error: `Database error: ${error.message}`, documents: [] }
    }

    return { documents: data || [] }
  } catch (error) {
    console.error("Error in getDocuments:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      documents: [],
    }
  }
}

export async function getRequests(showOnlyMyDocuments: boolean = false) {
  try {
    if (process.env.NODE_ENV === "development") {
      console.log("getRequests: Starting...")
    }
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.log("getRequests: Not authenticated")
      return { error: "Not authenticated", requests: [], currentUserId: null }
    }

    if (process.env.NODE_ENV === "development") {
      console.log("getRequests: User authenticated, fetching requests...")
    }
    
    // Build query with optional user filter
    let query = supabase
      .from("requests")
      .select(`
        *,
        customer:customer_id(id, first_name, last_name, email),
        document:document_id(id, file_name, file_path)
      `)
      .order("created_at", { ascending: false })

    // Add user filter if requested
    if (showOnlyMyDocuments) {
      query = query.eq("created_by", user.id)
    }

    const { data, error } = await query

    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Database error in getRequests:", error)
      }
      return { error: `Database error: ${error.message}`, requests: [], currentUserId: user.id }
    }

    if (process.env.NODE_ENV === "development") {
      console.log("getRequests: Found", data?.length, "requests")
    }
    return { requests: data || [], currentUserId: user.id }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error in getRequests:", error)
    }
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      requests: [],
      currentUserId: null
    }
  }
}

// NEW: Get signing requests for document management
export async function getSigningRequests(showOnlyMyDocuments: boolean = false) {
  try {
    console.log("getSigningRequests: Starting...")
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.log("getSigningRequests: Not authenticated")
      return { error: "Not authenticated", requests: [], currentUserId: null }
    }

    console.log("getSigningRequests: User authenticated, fetching signing requests...")
    
    // Get signing requests with related document and customer info
    let query = adminClient
      .from("signing_requests")
      .select(`
        id,
        document_id,
        recipient_email,
        status,
        created_at,
        updated_at,
        signed_at,
        expires_at,
        signing_id
      `)
      .order("created_at", { ascending: false })

    const { data: signingRequestsData, error } = await query

    if (error) {
      console.error("Database error in getSigningRequests:", error)
      return { error: `Database error: ${error.message}`, requests: [], currentUserId: user.id }
    }

    if (!signingRequestsData || signingRequestsData.length === 0) {
      console.log("getSigningRequests: No signing requests found")
      return { requests: [], currentUserId: user.id }
    }

    // Get unique document IDs and recipient emails
    const documentIds = [...new Set(signingRequestsData.map(req => req.document_id))]
    const recipientEmails = [...new Set(signingRequestsData.map(req => req.recipient_email))]
    
    // Get document data for all signing requests
    const { data: documentsData } = await adminClient
      .from("documents")
      .select("id, file_name, file_path, status, created_by, created_at")
      .in("id", documentIds)

    // Get customer data for all recipients
    const { data: customersData } = await adminClient
      .from("customers")
      .select("id, first_name, last_name, email")
      .in("email", recipientEmails)

    // Create maps for quick lookup
    const documentsMap = new Map()
    documentsData?.forEach(doc => {
      documentsMap.set(doc.id, doc)
    })

    const customersMap = new Map()
    customersData?.forEach(customer => {
      customersMap.set(customer.email, customer)
    })

    // Transform signing requests to match expected format
    const transformedRequests = signingRequestsData?.map(req => {
      const document = documentsMap.get(req.document_id)
      return {
        id: req.id, // signing_request id for deletion
        title: document?.file_name || "Documento sin nombre",
        status: req.status,
        created_at: req.created_at,
        updated_at: req.updated_at,
        signed_at: req.signed_at,
        expires_at: req.expires_at,
        recipient_email: req.recipient_email,
        document_id: req.document_id,
        document_status: document?.status,
        created_by: document?.created_by,
        customer: customersMap.get(req.recipient_email) || {
          id: null,
          first_name: "",
          last_name: "",
          email: req.recipient_email
        },
        document: document ? {
          id: document.id,
          file_name: document.file_name,
          file_path: document.file_path
        } : null
      }
    }) || []

    // Filter by user if requested
    let filteredRequests = transformedRequests
    if (showOnlyMyDocuments) {
      filteredRequests = transformedRequests.filter(req => req.created_by === user.id)
    }

    console.log("getSigningRequests: Found", filteredRequests.length, "signing requests")
    return { requests: filteredRequests, currentUserId: user.id }
  } catch (error) {
    console.error("Error in getSigningRequests:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      requests: [],
      currentUserId: null
    }
  }
}

export async function getRequestById(id: string) {
  try {
    console.log("getRequestById: Starting with ID:", id)
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.log("getRequestById: Not authenticated")
      return { error: "Not authenticated", request: null }
    }

    console.log("getRequestById: User authenticated, fetching request...")
    // Global access - get any request by ID with creator information
    const { data, error } = await supabase
      .from("requests")
      .select(`
        *,
        customer:customer_id(id, first_name, last_name, email, telephone, postal_address),
        document:document_id(id, file_name, file_path, file_size, file_type)
      `)
      .eq("id", id)
      .single()

    if (error) {
      console.error("getRequestById: Database error:", error)
      return { error: `Database error: ${error.message}`, request: null }
    }

    if (!data) {
      console.log("getRequestById: No request found with ID:", id)
      return { error: "Request not found", request: null }
    }

    console.log("getRequestById: Request found:", data)
    return { request: data }
  } catch (error) {
    console.error("getRequestById: Error:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      request: null,
    }
  }
}

// NEW: Delete only signing request (not the document)
export async function deleteSigningRequest(signingRequestId: string) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: "Not authenticated" }
    }

    console.log("Deleting signing request:", signingRequestId)

    // Get signing request details before deletion
    const { data: signingRequest, error: fetchError } = await adminClient
      .from("signing_requests")
      .select("document_id, recipient_email, status")
      .eq("id", signingRequestId)
      .single()

    if (fetchError || !signingRequest) {
      console.error("Signing request not found:", fetchError)
      return { error: "Signing request not found" }
    }

    // Delete the signing request
    const { error: deleteError } = await adminClient
      .from("signing_requests")
      .delete()
      .eq("id", signingRequestId)

    if (deleteError) {
      console.error("Error deleting signing request:", deleteError)
      return { error: `Error deleting signing request: ${deleteError.message}` }
    }

    // Update document status based on remaining state
    // If this was the last signing request and document was "enviado", revert to previous state
    const { data: remainingRequests } = await adminClient
      .from("signing_requests")
      .select("id")
      .eq("document_id", signingRequest.document_id)

    let newDocumentStatus = "firmado" // Default fallback
    
    if (!remainingRequests || remainingRequests.length === 0) {
      // No more signing requests - check if document has signatures to determine status
      const { data: signatures } = await adminClient
        .from("document_signatures")
        .select("id")
        .eq("document_id", signingRequest.document_id)
        .limit(1)

      if (signatures && signatures.length > 0) {
        newDocumentStatus = "firmado" // Has signatures
      } else {
        // Check if has mapping
        const { data: mapping } = await adminClient
          .from("document_signature_mappings")
          .select("id")
          .eq("document_id", signingRequest.document_id)
          .limit(1)

        newDocumentStatus = mapping && mapping.length > 0 ? "mapeado" : "draft"
      }
    } else {
      // Still has other signing requests - keep as "enviado"
      newDocumentStatus = "enviado"
    }

    // Update document status
    const { error: statusUpdateError } = await adminClient
      .from("documents")
      .update({
        status: newDocumentStatus,
        updated_at: new Date().toISOString()
      })
      .eq("id", signingRequest.document_id)

    if (statusUpdateError) {
      console.warn("Warning: Failed to update document status after deleting signing request:", statusUpdateError)
    } else {
      console.log(`Document status updated to: ${newDocumentStatus}`)
    }

    console.log("Signing request deleted successfully")
    return { success: true }
  } catch (error) {
    console.error("Error in deleteSigningRequest:", error)
    return { error: error instanceof Error ? error.message : "An unexpected error occurred" }
  }
}

export async function deleteDocument(requestId: string) {
  try {
    console.log("Starting document deletion process for request:", requestId)

    // Use admin client to bypass RLS policies
    const adminClient = createAdminClient()
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: "Not authenticated" }
    }

    // STEP 1: Get the request and document details
    console.log("Fetching request and document details...")
    const { data: request, error: requestFetchError } = await supabase
      .from("requests")
      .select(`
        id,
        document_id,
        document:document_id(id, file_path, file_name)
      `)
      .eq("id", requestId)
      .single()

    if (requestFetchError) {
      console.error("Error fetching request:", requestFetchError)
      return { error: `Error fetching request: ${requestFetchError.message}` }
    }

    if (!request) {
      console.error("Request not found")
      return { error: "Request not found" }
    }

    console.log("Request found:", request)
    const documentId = request.document_id
    const document = Array.isArray(request.document) ? request.document[0] : request.document
    const filePath = document?.file_path
    const fileName = document?.file_name

    if (!filePath) {
      console.error("No file path found for document")
      return { error: "No file path found for document" }
    }

    console.log("Document details:", { documentId, filePath, fileName })

    // STEP 2: Delete related records first (to avoid foreign key constraint violations)
    if (documentId) {
      console.log("Deleting related records...")

      // Delete signing_requests first (this was causing the foreign key constraint error)
      console.log("Deleting signing_requests...")
      const { error: deleteSigningRequestsError } = await adminClient
        .from("signing_requests")
        .delete()
        .eq("document_id", documentId)

      if (deleteSigningRequestsError) {
        console.error("Error deleting signing_requests:", deleteSigningRequestsError)
        return { error: `Error deleting signing requests: ${deleteSigningRequestsError.message}` }
      }

      // Delete document_signatures
      console.log("Deleting document_signatures...")
      const { error: deleteSignaturesError } = await adminClient
        .from("document_signatures")
        .delete()
        .eq("document_id", documentId)

      if (deleteSignaturesError) {
        console.error("Error deleting document_signatures:", deleteSignaturesError)
        return { error: `Error deleting document signatures: ${deleteSignaturesError.message}` }
      }

      // Delete signature_mapping_templates first (they reference document_signature_mappings)
      console.log("Deleting signature_mapping_templates...")
      const { data: mappings, error: getMappingsError } = await adminClient
        .from("document_signature_mappings")
        .select("id")
        .eq("document_id", documentId)

      if (getMappingsError) {
        console.error("Error getting document mappings:", getMappingsError)
        return { error: `Error getting document mappings: ${getMappingsError.message}` }
      }

      if (mappings && mappings.length > 0) {
        const mappingIds = mappings.map((m: { id: string }) => m.id)
        
        const { error: deleteTemplatesError } = await adminClient
          .from("signature_mapping_templates")
          .delete()
          .in("document_mapping_id", mappingIds)

        if (deleteTemplatesError) {
          console.error("Error deleting signature_mapping_templates:", deleteTemplatesError)
          return { error: `Error deleting signature mapping templates: ${deleteTemplatesError.message}` }
        }

        // Now delete document_signature_mappings
        console.log("Deleting document_signature_mappings...")
        const { error: deleteMappingsError } = await adminClient
          .from("document_signature_mappings")
          .delete()
          .eq("document_id", documentId)

        if (deleteMappingsError) {
          console.error("Error deleting document_signature_mappings:", deleteMappingsError)
          return { error: `Error deleting document signature mappings: ${deleteMappingsError.message}` }
        }
      }

      // Delete document_annotations if the table exists
      console.log("Deleting document_annotations...")
      const { error: deleteAnnotationsError } = await adminClient
        .from("document_annotations")
        .delete()
        .eq("document_id", documentId)

      if (deleteAnnotationsError) {
        console.warn("Warning: Could not delete document_annotations:", deleteAnnotationsError)
        // Don't fail the whole operation for this
      }

      console.log("Related records deleted successfully")
    }

    // STEP 3: Delete the request record
    console.log("Deleting request record...")
    const { error: deleteRequestError } = await supabase
      .from("requests")
      .delete()
      .eq("id", requestId)

    if (deleteRequestError) {
      console.error("Error deleting request:", deleteRequestError)
      return { error: `Error deleting request: ${deleteRequestError.message}` }
    }

    console.log("Request deleted successfully")

    // STEP 4: Finally, delete the document record
    if (documentId) {
      console.log("Deleting document record...")
      const { error: deleteDocumentError } = await supabase
        .from("documents")
        .delete()
        .eq("id", documentId)

      if (deleteDocumentError) {
        console.error("Error deleting document:", deleteDocumentError)
        return { error: `Error deleting document: ${deleteDocumentError.message}` }
      }

      console.log("Document deleted successfully")
    }

    console.log("Document deletion process completed successfully")
    revalidatePath("/documents")
    return { success: true }
  } catch (error) {
    console.error("Error in deleteDocument:", error)
    return { error: error instanceof Error ? error.message : "An unexpected error occurred" }
  }
}
