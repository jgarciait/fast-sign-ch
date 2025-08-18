"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { BUCKET_PUBLIC } from "@/utils/supabase/storage"

export async function getFastSignDocumentById(documentId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", document: null }
  }

  try {
    const { data, error } = await supabase
      .from("documents")
      .select(`
        *,
        file_records (
          id,
          valores_json,
          created_at,
          filing_systems (
            id,
            nombre,
            esquema_json
          )
        )
      `)
      .eq("id", documentId)
      .single()

    if (error) {
      console.error("Database error in getFastSignDocumentById:", error)
      if (error.code === 'PGRST116') {
        return { error: "Document not found", document: null }
      }
      return { error: `Database error: ${error.message}`, document: null }
    }

    if (!data) {
      return { error: "Document not found", document: null }
    }

    // Get creator information
    let creator = null
    if (data.created_by) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("id", data.created_by)
        .single()
      
      if (profileError) {
        console.warn("Profile not found for document creator:", profileError)
        creator = null
      } else if (profile) {
        creator = {
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email,
          full_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown User'
        }
      }
    }

    return { 
      document: {
        ...data,
        creator
      }
    }
  } catch (error) {
    console.error("Error in getFastSignDocumentById:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      document: null,
    }
  }
}

export async function getFastSignDocuments(searchTerm?: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", documents: [] }
  }

  try {
    // GLOBAL ACCESS: get all fast_sign documents with creator information
    let query = supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false })

    if (searchTerm) {
      query = query.ilike("file_name", `%${searchTerm}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error("Database error in getFastSignDocuments:", error)
      return { error: `Database error: ${error.message}`, documents: [] }
    }

    // Get creator information for each document
    const documentsWithCreators = await Promise.all(
      (data || []).map(async (doc) => {
        if (doc.created_by) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name, email")
            .eq("id", doc.created_by)
            .single()
          
          return {
            ...doc,
            creator: profile ? {
              first_name: profile.first_name,
              last_name: profile.last_name,
              email: profile.email,
              full_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown User'
            } : null
          }
        }
        return { ...doc, creator: null }
      })
    )

    return { documents: documentsWithCreators }
  } catch (error) {
    console.error("Error in getFastSignDocuments:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      documents: [],
    }
  }
}

export async function getFastSignDocumentsCount(
  archived: boolean,
  showOnlyMyDocuments: boolean = false
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", totalCount: 0, currentUserId: null }
  }

  try {
    // OPTIMIZACIÓN: Solo consulta de conteo
    let countQuery = supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("archived", archived)

    if (showOnlyMyDocuments) {
      countQuery = countQuery.eq("created_by", user.id)
    }

    const countResult = await countQuery

    if (countResult.error) {
      console.error("Database error in getFastSignDocumentsCount:", countResult.error)
      return { error: `Database error: ${countResult.error.message}`, totalCount: 0, currentUserId: user.id }
    }

    return {
      totalCount: countResult.count || 0,
      currentUserId: user.id
    }
  } catch (error) {
    console.error("Error in getFastSignDocumentsCount:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      totalCount: 0,
      currentUserId: user.id
    }
  }
}

export async function getFastSignDocumentsByArchiveStatus(
  archived: boolean, 
  searchTerm?: string, 
  page: number = 1, 
  limit: number = 5,
  showOnlyMyDocuments: boolean = false
) {
  console.log('getFastSignDocumentsByArchiveStatus called with:', {
    archived,
    searchTerm,
    page,
    limit,
    showOnlyMyDocuments
  })
  
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    console.log('getFastSignDocumentsByArchiveStatus: No authenticated user')
    return { error: "Not authenticated", documents: [], totalCount: 0, totalPages: 0, currentUserId: null }
  }

  console.log('getFastSignDocumentsByArchiveStatus: User authenticated:', user.id)

  try {
    // Calculate offset for pagination
    const offset = (page - 1) * limit
    console.log('getFastSignDocumentsByArchiveStatus: Calculated offset:', offset)

    // OPTIMIZACIÓN MEJORADA: Consulta principal con solo campos necesarios
    let query = supabase
      .from("documents")
      .select(`
        id,
        file_name,
        file_path,
        file_size,
        file_type,
        status,
        created_at,
        updated_at,
        archived,
        created_by,
        document_type,
        file_record_id,
        category_id,
        case_file_metadata,
        file_records (
          id,
          valores_json,
          created_at,
          filing_systems (
            id,
            nombre,
            filing_indices (
              clave,
              etiqueta,
              tipo_dato,
              obligatorio,
              orden
            )
          )
        )
      `)
      .eq("archived", archived)
      .order("created_at", { ascending: false })

    // Add user filter if requested
    if (showOnlyMyDocuments) {
      query = query.eq("created_by", user.id)
    }

    if (searchTerm) {
      query = query.ilike("file_name", `%${searchTerm}%`)
    }

    // OPTIMIZACIÓN: Consulta de conteo más eficiente
    let countQuery = supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("archived", archived)

    if (showOnlyMyDocuments) {
      countQuery = countQuery.eq("created_by", user.id)
    }

    if (searchTerm) {
      countQuery = countQuery.ilike("file_name", `%${searchTerm}%`)
    }

    console.log('getFastSignDocumentsByArchiveStatus: About to execute queries with filters:', {
      archived,
      showOnlyMyDocuments,
      searchTerm,
      offset,
      limit,
      range: `${offset}-${offset + limit - 1}`
    })

    // OPTIMIZACIÓN: Ejecutar consultas principales en paralelo
    const [dataResult, countResult] = await Promise.all([
      query.range(offset, offset + limit - 1),
      countQuery
    ])

    console.log('getFastSignDocumentsByArchiveStatus: Query results:', {
      dataError: dataResult.error,
      dataCount: dataResult.data?.length,
      countError: countResult.error,
      totalCount: countResult.count
    })

    if (dataResult.error) {
      console.error("Database error in getFastSignDocumentsByArchiveStatus:", dataResult.error)
      return { error: `Database error: ${dataResult.error.message}`, documents: [], totalCount: 0, totalPages: 0, currentUserId: user.id }
    }

    if (countResult.error) {
      console.error("Database error in count query:", countResult.error)
      return { error: `Database error: ${countResult.error.message}`, documents: [], totalCount: 0, totalPages: 0, currentUserId: user.id }
    }

    const totalCount = countResult.count || 0
    const totalPages = Math.ceil(totalCount / limit)
    const documents = dataResult.data || []

    console.log('getFastSignDocumentsByArchiveStatus: Final results:', {
      documentsLength: documents.length,
      totalCount,
      totalPages,
      firstDocumentId: documents[0]?.id,
      firstDocumentName: documents[0]?.file_name
    })

    if (documents.length === 0) {
      return { 
        documents: [], 
        totalCount, 
        totalPages,
        currentPage: page,
        currentUserId: user.id
      }
    }

    // OPTIMIZACIÓN MEJORADA: Obtener datos relacionados con consultas más específicas
    const documentIds = documents.map(doc => doc.id)
    const creatorIds = [...new Set(documents.map(doc => doc.created_by).filter(Boolean))]

    // Usar Promise.all para máxima paralelización
    const [profilesResult, signaturesResult, annotationsResult, requestsResult] = await Promise.all([
      // Obtener solo campos necesarios de profiles
      creatorIds.length > 0 ? supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", creatorIds) : Promise.resolve({ data: [] }),
      
      // Verificar firmas - solo necesitamos saber si existe
      supabase
        .from("document_signatures")
        .select("document_id")
        .in("document_id", documentIds),
      
      // Verificar annotations - buscar solo documentos con firmas
      supabase
        .from("document_annotations")
        .select("document_id, annotations")
        .in("document_id", documentIds)
        .not("annotations", "is", null),
      
      // Verificar signing_requests completadas
      supabase
        .from("signing_requests")
        .select("document_id")
        .in("document_id", documentIds)
        .not("signed_at", "is", null)
    ])

    // OPTIMIZACIÓN: Crear estructuras de datos eficientes
    const profilesMap = new Map()
    if (profilesResult.data) {
      profilesResult.data.forEach(profile => {
        profilesMap.set(profile.id, {
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email,
          full_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown User'
        })
      })
    }

    const documentsWithSignatures = new Set(signaturesResult.data?.map(s => s.document_id) || [])
    const documentsWithRequests = new Set(requestsResult.data?.map(r => r.document_id) || [])
    
    // OPTIMIZACIÓN: Procesar annotations de forma más eficiente
    const documentsWithAnnotationSignatures = new Set<string>()
    if (annotationsResult.data) {
      annotationsResult.data.forEach(annotation => {
        try {
          const annotations = annotation.annotations
          if (Array.isArray(annotations) && annotations.some((ann: any) => ann.type === "signature")) {
            documentsWithAnnotationSignatures.add(annotation.document_id)
          }
        } catch {
          // Ignore parsing errors silently
        }
      })
    }

    // OPTIMIZACIÓN: Transformar documentos de forma más eficiente
    const documentsWithAllData = documents.map((doc: any) => {
      const hasSigned = documentsWithSignatures.has(doc.id) || 
                       documentsWithRequests.has(doc.id) || 
                       documentsWithAnnotationSignatures.has(doc.id)

      const creator = profilesMap.get(doc.created_by) || null

      return {
        ...doc,
        creator,
        hasSigned
      }
    })

    // Now get comprehensive status for all documents
    const documentsForStatus = documentsWithAllData.map(doc => ({
      id: doc.id,
      document_type: doc.document_type
    }))
    const statusMap = await getDocumentsWithStatus(documentsForStatus)

    // Add status information to each document
    const documentsWithStatus = documentsWithAllData.map(doc => ({
      ...doc,
      documentStatus: statusMap[doc.id]?.status || (doc.document_type === "fast_sign" ? "sin_firma" : "sin_mapeo"),
      statusDetails: statusMap[doc.id]?.details || {}
    }))

    console.log('getFastSignDocumentsByArchiveStatus: Returning successful result:', {
      documentsLength: documentsWithStatus.length,
      totalCount,
      totalPages,
      currentPage: page,
      sampleDocument: documentsWithStatus[0] ? {
        id: documentsWithStatus[0].id,
        file_name: documentsWithStatus[0].file_name,
        status: documentsWithStatus[0].status,
        documentStatus: documentsWithStatus[0].documentStatus
      } : null
    })

    return { 
      documents: documentsWithStatus, 
      totalCount, 
      totalPages,
      currentPage: page,
      currentUserId: user.id
    }
  } catch (error) {
    console.error("Error in getFastSignDocumentsByArchiveStatus:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      documents: [],
      totalCount: 0,
      totalPages: 0,
      currentUserId: user.id
    }
  }
}

export async function archiveFastSignDocument(documentId: string) {
  console.log('🔄 archiveFastSignDocument called with:', documentId)
  
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    console.error('❌ User not authenticated')
    return { error: "Not authenticated" }
  }

  try {
    // GLOBAL ACCESS: any user can archive any document in fast-sign-docs
    const { data, error } = await supabase
      .from("documents")
      .update({ 
        archived: true,
        updated_at: new Date().toISOString() 
      })
      .eq("id", documentId)
      .select()

    if (error) {
      console.error("Database error in archiveFastSignDocument:", error)
      return { error: `Database error: ${error.message}` }
    }

    if (!data || data.length === 0) {
      console.error("Document not found or not updated")
      return { error: "Document not found or could not be archived" }
    }

    console.log('✅ Document archived successfully:', data[0])
    return { success: true, document: data[0] }
  } catch (error) {
    console.error("Unexpected error in archiveFastSignDocument:", error)
    return { error: "An unexpected error occurred while archiving the document" }
  }
}

export async function unarchiveFastSignDocument(documentId: string) {
  console.log('🔄 unarchiveFastSignDocument called with:', documentId)
  
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    console.error('❌ User not authenticated')
    return { error: "Not authenticated" }
  }

  try {
    // GLOBAL ACCESS: any user can unarchive any document in fast-sign-docs
    const { data, error } = await supabase
      .from("documents")
      .update({ 
        archived: false,
        updated_at: new Date().toISOString() 
      })
      .eq("id", documentId)
      .select()

    if (error) {
      console.error("Database error in unarchiveFastSignDocument:", error)
      return { error: `Database error: ${error.message}` }
    }

    if (!data || data.length === 0) {
      console.error("Document not found or not updated")
      return { error: "Document not found or could not be unarchived" }
    }

    console.log('✅ Document unarchived successfully:', data[0])
    return { success: true, document: data[0] }
  } catch (error) {
    console.error("Unexpected error in unarchiveFastSignDocument:", error)
    return { error: "An unexpected error occurred while unarchiving the document" }
  }
}



export async function deleteFastSignDocument(documentId: string) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    // GLOBAL ACCESS: get the document to delete (any user can delete any document in fast-sign-docs)
    const { data: document, error: fetchError } = await supabase
      .from("documents")
      .select("id, file_path, original_file_path, created_by")
      .eq("id", documentId)
      .single()

    if (fetchError || !document) {
      console.error("Document not found:", fetchError)
      return { error: "Document not found" }
    }

    // Delete related records first (in correct order to avoid foreign key violations)
    
    // 1. First, get any signature mappings for this document
    console.log("Getting signature mappings for document...")
    const { data: mappings, error: getMappingsError } = await adminClient
      .from("document_signature_mappings")
      .select("id")
      .eq("document_id", documentId)

    if (getMappingsError) {
      console.error("Error getting document mappings:", getMappingsError)
    }

    // 2. Delete signature_mapping_templates first (they reference document_signature_mappings)
    if (mappings && mappings.length > 0) {
      console.log("Deleting signature_mapping_templates...")
      const mappingIds = mappings.map((m: { id: string }) => m.id)
      
      const { error: deleteTemplatesError } = await adminClient
        .from("signature_mapping_templates")
        .delete()
        .in("document_mapping_id", mappingIds)

      if (deleteTemplatesError) {
        console.error("Error deleting signature_mapping_templates:", deleteTemplatesError)
        return { error: `Error deleting signature mapping templates: ${deleteTemplatesError.message}` }
      }

      // 3. Now delete document_signature_mappings
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

    // 4. Delete document_signatures
    console.log("Deleting document_signatures...")
    const { error: deleteSignaturesError } = await adminClient
      .from("document_signatures")
      .delete()
      .eq("document_id", documentId)

    if (deleteSignaturesError) {
      console.error("Error deleting document_signatures:", deleteSignaturesError)
    }

    // 5. Delete signing_requests
    console.log("Deleting signing_requests...")
    const { error: deleteSigningRequestsError } = await adminClient
      .from("signing_requests")
      .delete()
      .eq("document_id", documentId)

    if (deleteSigningRequestsError) {
      console.warn("Warning: Could not delete signing_requests:", deleteSigningRequestsError)
    }

    // 6. Delete document_annotations
    console.log("Deleting document_annotations...")
    const { error: deleteAnnotationsError } = await adminClient
      .from("document_annotations")
      .delete()
      .eq("document_id", documentId)

    if (deleteAnnotationsError) {
      console.warn("Warning: Could not delete document_annotations:", deleteAnnotationsError)
    }

    // Delete both original and signed files from storage
    const filesToDelete: string[] = []

    // Helper function to normalize file path
    const normalizePath = (filePath: string) => {
      let pathInBucket = filePath
      
      // If the path includes the bucket name, extract just the file path part
      if (filePath.includes(`${BUCKET_PUBLIC}/`)) {
        pathInBucket = filePath.split(`${BUCKET_PUBLIC}/`)[1]
      }

      // If the path starts with "uploads/" or "signed/", use that directly
      if (pathInBucket.startsWith("uploads/") || pathInBucket.startsWith("signed/")) {
        // This is already the correct format
      } else if (!pathInBucket.includes("/")) {
        // If there's no slash, assume it's just the filename and add the uploads/ prefix
        pathInBucket = `uploads/${pathInBucket}`
      }
      
      return pathInBucket
    }

    // Add signed document (current file_path) to deletion list
    if (document.file_path) {
      const signedPath = normalizePath(document.file_path)
      filesToDelete.push(signedPath)
      console.log("Added signed document to deletion list:", signedPath)
    }

    // Add original document (original_file_path) to deletion list if different
    if (document.original_file_path && document.original_file_path !== document.file_path) {
      const originalPath = normalizePath(document.original_file_path)
      filesToDelete.push(originalPath)
      console.log("Added original document to deletion list:", originalPath)
    }

    // Delete all files at once
    if (filesToDelete.length > 0) {
      console.log("Deleting files from bucket:", BUCKET_PUBLIC, "Paths:", filesToDelete)

      // Use the admin client to bypass RLS policies
      const { data: deleteData, error: storageError } = await adminClient.storage
        .from(BUCKET_PUBLIC)
        .remove(filesToDelete)

      if (storageError) {
        console.error("Error deleting files from storage:", storageError)
        // Don't fail the whole operation, but log the error
      } else {
        console.log("File deletion response:", deleteData)
        
        // Check if the files were actually deleted
        if (!deleteData || deleteData.length === 0) {
          console.warn("File deletion may have failed - no confirmation from storage API")
        } else {
          console.log(`Successfully deleted ${deleteData.length} file(s) from storage`)
        }
      }
    } else {
      console.warn("No file paths found for document, skipping storage deletion")
    }

    // Finally, delete the document record - GLOBAL ACCESS
    const { error: deleteDocumentError } = await supabase
      .from("documents")
      .delete()
      .eq("id", documentId)

    if (deleteDocumentError) {
      console.error("Error deleting document:", deleteDocumentError)
      return { error: `Error deleting document: ${deleteDocumentError.message}` }
    }

    return { success: true }
  } catch (error) {
    console.error("Error in deleteFastSignDocument:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

// Update manual document status (e.g., sin_firma, firmado, borrador)
export async function updateFastSignDocumentStatus(documentId: string, status: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    const { error } = await supabase
      .from("documents")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", documentId)

    if (error) {
      console.error("Database error in updateFastSignDocumentStatus:", error)
      return { error: `Database error: ${error.message}` }
    }

    return { success: true }
  } catch (error) {
    console.error("Error in updateFastSignDocumentStatus:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

export async function createFastSignDocument(
  fileName: string, 
  filePath: string, 
  fileUrl: string, 
  fileSize: number, 
  fileType: string
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    const { data: document, error } = await supabase
      .from("documents")
      .insert({
        created_by: user.id,
        file_name: fileName,
        file_path: filePath,
        original_file_path: filePath, // Set original path on first upload
        file_size: fileSize,
        file_type: fileType,
        document_type: "fast_sign",
        archived: false,
      })
      .select()
      .single()

    if (error) {
      console.error("Database error in createFastSignDocument:", error)
      return { error: `Database error: ${error.message}` }
    }

    return { document }
  } catch (error) {
    console.error("Error in createFastSignDocument:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

export async function checkDocumentSignatureStatus(documentId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", hasSigned: false }
  }

  try {
    // Check multiple tables for signatures in parallel
    const [annotationsResult, signaturesResult, requestsResult] = await Promise.all([
      // Check document_annotations for signature annotations
      supabase
        .from("document_annotations")
        .select("id, annotations")
        .eq("document_id", documentId),
      
      // Check document_signatures table
      supabase
        .from("document_signatures")
        .select("id")
        .eq("document_id", documentId),
      
      // Check signing_requests table for completed signatures
      supabase
        .from("signing_requests")
        .select("id")
        .eq("document_id", documentId)
        .not("signed_at", "is", null)
    ])

    // Check if document_signatures has any records
    if (signaturesResult.data && signaturesResult.data.length > 0) {
      return { hasSigned: true }
    }

    // Check if signing_requests has any completed signatures
    if (requestsResult.data && requestsResult.data.length > 0) {
      return { hasSigned: true }
    }

    // Check document_annotations for signature type annotations
    if (annotationsResult.data && annotationsResult.data.length > 0) {
      const hasSignatureAnnotations = annotationsResult.data.some(annotation => {
        try {
          const annotations = annotation.annotations
          if (Array.isArray(annotations)) {
            return annotations.some(ann => ann.type === "signature")
          }
          return false
        } catch {
          return false
        }
      })
      
      if (hasSignatureAnnotations) {
        return { hasSigned: true }
      }
    }

    return { hasSigned: false }
  } catch (error) {
    console.error("Error in checkDocumentSignatureStatus:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      hasSigned: false,
    }
  }
}

export async function checkMultipleDocumentsSignatureStatus(documentIds: string[]) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", results: {} }
  }

  if (documentIds.length === 0) {
    return { results: {} }
  }

  try {
    // Optimized: Only check document_signatures table first (most common case for fast-sign)
    const { data: signaturesResult, error: sigError } = await supabase
      .from("document_signatures")
      .select("document_id")
      .in("document_id", documentIds)

    if (sigError) {
      console.error("Error checking signatures:", sigError)
      return { error: sigError.message, results: {} }
    }

    // Create set for O(1) lookup
    const documentsWithSignatures = new Set(signaturesResult?.map(s => s.document_id) || [])
    
    // Build results object - most fast-sign documents will have signatures here
    const results: { [documentId: string]: boolean } = {}
    const documentsNeedingFurtherCheck: string[] = []
    
    documentIds.forEach(docId => {
      if (documentsWithSignatures.has(docId)) {
        results[docId] = true
      } else {
        results[docId] = false
        documentsNeedingFurtherCheck.push(docId)
      }
    })

    // Only check other tables for documents that don't have signatures in document_signatures
    if (documentsNeedingFurtherCheck.length > 0) {
      const [annotationsResult, requestsResult] = await Promise.all([
        // Check document_annotations for signature annotations
        supabase
          .from("document_annotations")
          .select("document_id, annotations")
          .in("document_id", documentsNeedingFurtherCheck),
        
        // Check signing_requests table for completed signatures
        supabase
          .from("signing_requests")
          .select("document_id")
          .in("document_id", documentsNeedingFurtherCheck)
          .not("signed_at", "is", null)
      ])

      // Process signing requests
      const documentsWithSigningRequests = new Set(requestsResult.data?.map(r => r.document_id) || [])
      
      // Process annotations to find signature types
      const documentsWithAnnotationSignatures = new Set<string>()
      if (annotationsResult.data) {
        annotationsResult.data.forEach(annotation => {
          try {
            const annotations = annotation.annotations
            if (Array.isArray(annotations)) {
              const hasSignature = annotations.some(ann => ann.type === "signature")
              if (hasSignature) {
                documentsWithAnnotationSignatures.add(annotation.document_id)
              }
            }
          } catch {
            // Ignore parsing errors
          }
        })
      }

      // Update results for documents that needed further checking
      documentsNeedingFurtherCheck.forEach(docId => {
        results[docId] = documentsWithSigningRequests.has(docId) || 
                       documentsWithAnnotationSignatures.has(docId)
      })
    }

    return { results }
  } catch (error) {
    console.error("Error in checkMultipleDocumentsSignatureStatus:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      results: {},
    }
  }
}

export async function checkDocumentTemplateUsage(documentId: string) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", isUsedAsTemplate: false, templateCount: 0 }
  }

  try {
    // First, get document signature mappings for this document
    const { data: mappings, error: mappingsError } = await adminClient
      .from("document_signature_mappings")
      .select("id")
      .eq("document_id", documentId)

    if (mappingsError) {
      console.error("Error checking document mappings:", mappingsError)
      return { error: `Database error: ${mappingsError.message}`, isUsedAsTemplate: false, templateCount: 0 }
    }

    if (!mappings || mappings.length === 0) {
      return { isUsedAsTemplate: false, templateCount: 0 }
    }

    // Check if any of these mappings are used as templates
    const mappingIds = mappings.map((m: { id: string }) => m.id)
    const { data: templates, error: templatesError } = await adminClient
      .from("signature_mapping_templates")
      .select("id, name")
      .in("document_mapping_id", mappingIds)

    if (templatesError) {
      console.error("Error checking templates:", templatesError)
      return { error: `Database error: ${templatesError.message}`, isUsedAsTemplate: false, templateCount: 0 }
    }

    const templateCount = templates?.length || 0
    const isUsedAsTemplate = templateCount > 0

    // Also check if there are any documents created from this template
    let copiedDocumentsCount = 0
    if (isUsedAsTemplate) {
      const templateIds = templates?.map((t: { id: string }) => t.id) || []
      
      const { data: copiedMappings, error: copiedError } = await adminClient
        .from("document_signature_mappings")
        .select("document_id")
        .in("template_id", templateIds)

      if (!copiedError && copiedMappings) {
        copiedDocumentsCount = copiedMappings.length
      }
    }

    return { 
      isUsedAsTemplate, 
      templateCount,
      copiedDocumentsCount,
      templates: templates || [],
      warning: isUsedAsTemplate ? 
        `This document is used as a template for ${templateCount} template(s). ${copiedDocumentsCount > 0 ? `${copiedDocumentsCount} document(s) have been created from this template.` : ''}` : 
        null
    }
  } catch (error) {
    console.error("Error in checkDocumentTemplateUsage:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      isUsedAsTemplate: false,
      templateCount: 0
    }
  }
}

export async function createDocumentFromTemplate(templateId: string, newFileName?: string) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", document: null }
  }

  try {
    // Get template information
    const { data: template, error: templateError } = await supabase
      .from("signature_mapping_templates")
      .select(`
        *,
        document_signature_mappings!signature_mapping_templates_document_mapping_id_fkey(
          document_id,
          signature_fields,
          documents(
            id,
            file_name,
            file_path,
            file_size,
            file_type
          )
        )
      `)
      .eq("id", templateId)
      .single()

    if (templateError || !template) {
      console.error("Template not found:", templateError)
      return { error: "Template not found", document: null }
    }

    const originalDocument = template.document_signature_mappings?.documents
    if (!originalDocument) {
      return { error: "Original document not found for template", document: null }
    }

    // Generate unique filename
    const timestamp = Date.now()
    const originalName = originalDocument.file_name
    const fileExtension = originalName.split('.').pop()
    const baseName = originalName.replace(/\.[^/.]+$/, "")
    const newDocumentName = newFileName || `${baseName}_${timestamp}.${fileExtension}`

    // Copy file in storage bucket
    const originalPath = originalDocument.file_path
    const newPath = `uploads/${user.id}/${timestamp}_${originalName}`

    console.log(`Copying file from ${originalPath} to ${newPath}`)

    // Download original file
    const { data: originalFileData, error: downloadError } = await adminClient.storage
      .from(BUCKET_PUBLIC)
      .download(originalPath)

    if (downloadError || !originalFileData) {
      console.error("Error downloading original file:", downloadError)
      return { error: "Failed to access original document", document: null }
    }

    // Upload as new file
    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from(BUCKET_PUBLIC)
      .upload(newPath, originalFileData, {
        contentType: originalDocument.file_type || 'application/pdf',
        upsert: false
      })

    if (uploadError) {
      console.error("Error uploading copied file:", uploadError)
      return { error: "Failed to create document copy", document: null }
    }

    // Get public URL for the new file
    const { data: urlData } = adminClient.storage
      .from(BUCKET_PUBLIC)
      .getPublicUrl(newPath)

    // Create new document record
    const { data: newDocument, error: documentError } = await supabase
      .from("documents")
      .insert({
        created_by: user.id,
        file_name: newDocumentName,
        file_path: newPath,
        file_size: originalDocument.file_size,
        file_type: originalDocument.file_type,
        document_type: "sent_to_sign", // Template copies are for sending
        archived: false,
      })
      .select()
      .single()

    if (documentError) {
      console.error("Error creating document record:", documentError)
      
      // Clean up uploaded file
      await adminClient.storage
        .from(BUCKET_PUBLIC)
        .remove([newPath])
        
      return { error: "Failed to create document record", document: null }
    }

    // Copy signature mappings to new document
    const originalSignatureFields = template.document_signature_mappings?.signature_fields
    if (originalSignatureFields) {
      const { error: mappingError } = await supabase
        .from("document_signature_mappings")
        .insert({
          document_id: newDocument.id,
          template_id: templateId,
          signature_fields: originalSignatureFields,
          created_by: user.id,
        })

      if (mappingError) {
        console.error("Error copying signature mappings:", mappingError)
        
        // Clean up created document and file
        await supabase.from("documents").delete().eq("id", newDocument.id)
        await adminClient.storage.from(BUCKET_PUBLIC).remove([newPath])
        
        return { error: "Failed to copy signature mappings", document: null }
      }
    }

    return { 
      document: {
        ...newDocument,
        file_url: urlData.publicUrl,
        template_name: template.name,
        copied_from_template: true
      }
    }
  } catch (error) {
    console.error("Error in createDocumentFromTemplate:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      document: null,
    }
  }
}

// Function to determine comprehensive document status
export async function getDocumentStatus(documentId: string, documentType?: string) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  try {
    // Get document type if not provided
    if (!documentType) {
      const { data: doc, error: docError } = await adminClient
        .from("documents")
        .select("document_type")
        .eq("id", documentId)
        .single()

      if (docError || !doc) {
        console.error("Error getting document type:", docError)
        return { status: "error", hasMapping: false, hasSigning: false, hasSignatures: false }
      }
      documentType = doc.document_type
    }

    // Check if document has signature mappings
    const { data: mappings, error: mappingsError } = await adminClient
      .from("document_signature_mappings")
      .select("id, signature_fields")
      .eq("document_id", documentId)

    if (mappingsError) {
      console.error("Error checking mappings:", mappingsError)
      return { status: "error", hasMapping: false, hasSigning: false, hasSignatures: false }
    }

    const hasMapping = mappings && mappings.length > 0

    // Check if document has signing requests
    const { data: signingRequests, error: signingError } = await adminClient
      .from("signing_requests")
      .select("id, status, signed_at")
      .eq("document_id", documentId)

    if (signingError) {
      console.error("Error checking signing requests:", signingError)
      return { status: "error", hasMapping, hasSigning: false, hasSignatures: false }
    }

    const hasSigning = signingRequests && signingRequests.length > 0
    const hasCompletedSigning = signingRequests && signingRequests.some((req: any) => req.signed_at !== null)

    // Check if document has signatures (document_signatures table)
    const { data: signatures, error: signaturesError } = await adminClient
      .from("document_signatures")
      .select("id")
      .eq("document_id", documentId)

    if (signaturesError) {
      console.error("Error checking signatures:", signaturesError)
      return { status: "error", hasMapping, hasSigning, hasSignatures: false }
    }

    const hasSignatures = signatures && signatures.length > 0

    // Check if document has annotation signatures
    const { data: annotations, error: annotationsError } = await adminClient
      .from("document_annotations")
      .select("annotations")
      .eq("document_id", documentId)

    let hasAnnotationSignatures = false
    if (!annotationsError && annotations && annotations.length > 0) {
      hasAnnotationSignatures = annotations.some((annotation: any) => {
        try {
          const annotationData = annotation.annotations
          return Array.isArray(annotationData) && annotationData.some((ann: any) => ann.type === "signature")
        } catch {
          return false
        }
      })
    }

    // Determine status based on the checks and document type
    const hasAnySignatures = hasSignatures || hasCompletedSigning || hasAnnotationSignatures

    let status = "sin_mapeo" // Default for email documents without mapping
    
    if (documentType === "fast_sign") {
      // For fast_sign documents: only "Firmado" or "Sin Firma"
      if (hasAnySignatures) {
        status = "firmado" // Signed
      } else {
        status = "sin_firma" // No signatures (fast_sign documents are binary: signed or not)
      }
    } else {
      // For email documents: use the full status logic
      if (hasMapping) {
        if (hasAnySignatures) {
          status = "firmado" // Signed
        } else if (hasSigning) {
          status = "enviado" // Sent for signing
        } else {
          status = "mapeado" // Mapped but not sent
        }
      } else {
        status = "sin_mapeo" // No mapping
      }
    }

    return {
      status,
      hasMapping,
      hasSigning,
      hasSignatures: hasAnySignatures,
      details: {
        mappingCount: mappings?.length || 0,
        signingRequestCount: signingRequests?.length || 0,
        signatureCount: signatures?.length || 0,
        hasAnnotationSignatures
      }
    }
  } catch (error) {
    console.error("Error in getDocumentStatus:", error)
    return { status: "error", hasMapping: false, hasSigning: false, hasSignatures: false }
  }
}

// Enhanced function to get multiple documents with comprehensive status
export async function getDocumentsWithStatus(documentsData: Array<{id: string, document_type: string}>) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  if (documentsData.length === 0) {
    return {}
  }

  const documentIds = documentsData.map(doc => doc.id)

  try {
    // Get all data in parallel for better performance
    const [mappingsResult, signingRequestsResult, signaturesResult, annotationsResult] = await Promise.all([
      // Get signature mappings
      adminClient
        .from("document_signature_mappings")
        .select("document_id, id, signature_fields")
        .in("document_id", documentIds),
      
      // Get signing requests
      adminClient
        .from("signing_requests")
        .select("document_id, id, status, signed_at")
        .in("document_id", documentIds),
      
      // Get signatures
      adminClient
        .from("document_signatures")
        .select("document_id, id")
        .in("document_id", documentIds),
      
      // Get annotations
      adminClient
        .from("document_annotations")
        .select("document_id, annotations")
        .in("document_id", documentIds)
    ])

    // Process results into maps for efficient lookup
    const mappingsMap = new Map<string, any[]>()
    if (mappingsResult.data) {
      mappingsResult.data.forEach((mapping: any) => {
        if (!mappingsMap.has(mapping.document_id)) {
          mappingsMap.set(mapping.document_id, [])
        }
        mappingsMap.get(mapping.document_id)!.push(mapping)
      })
    }

    const signingRequestsMap = new Map<string, any[]>()
    if (signingRequestsResult.data) {
      signingRequestsResult.data.forEach((request: any) => {
        if (!signingRequestsMap.has(request.document_id)) {
          signingRequestsMap.set(request.document_id, [])
        }
        signingRequestsMap.get(request.document_id)!.push(request)
      })
    }

    const signaturesMap = new Map<string, any[]>()
    if (signaturesResult.data) {
      signaturesResult.data.forEach((signature: any) => {
        if (!signaturesMap.has(signature.document_id)) {
          signaturesMap.set(signature.document_id, [])
        }
        signaturesMap.get(signature.document_id)!.push(signature)
      })
    }

    const annotationsMap = new Map<string, boolean>()
    if (annotationsResult.data) {
      annotationsResult.data.forEach((annotation: any) => {
        try {
          const annotationData = annotation.annotations
          const hasSignature = Array.isArray(annotationData) && annotationData.some((ann: any) => ann.type === "signature")
          annotationsMap.set(annotation.document_id, hasSignature)
        } catch {
          annotationsMap.set(annotation.document_id, false)
        }
      })
    }

    // Build status for each document
    const statusMap: Record<string, any> = {}
    
    documentsData.forEach(doc => {
      const documentId = doc.id
      const documentType = doc.document_type
      
      const mappings = mappingsMap.get(documentId) || []
      const signingRequests = signingRequestsMap.get(documentId) || []
      const signatures = signaturesMap.get(documentId) || []
      const hasAnnotationSignatures = annotationsMap.get(documentId) || false

      const hasMapping = mappings.length > 0
      const hasSigning = signingRequests.length > 0
      const hasCompletedSigning = signingRequests.some((req: any) => req.signed_at !== null)
      const hasSignatures = signatures.length > 0
      const hasAnySignatures = hasSignatures || hasCompletedSigning || hasAnnotationSignatures

      let status = "sin_mapeo" // Default for email documents without mapping
      
      if (documentType === "fast_sign") {
        // For fast_sign documents: only "Firmado" or "Sin Firma"
        if (hasAnySignatures) {
          status = "firmado" // Signed
        } else {
          status = "sin_firma" // No signatures (fast_sign documents are binary: signed or not)
        }
      } else {
        // For email documents: use the full status logic
        if (hasMapping) {
          if (hasAnySignatures) {
            status = "firmado" // Signed
          } else if (hasSigning) {
            status = "enviado" // Sent for signing
          } else {
            status = "mapeado" // Mapped but not sent
          }
        } else {
          status = "sin_mapeo" // No mapping
        }
      }

      statusMap[documentId] = {
        status,
        hasMapping,
        hasSigning,
        hasSignatures: hasAnySignatures,
        details: {
          mappingCount: mappings.length,
          signingRequestCount: signingRequests.length,
          signatureCount: signatures.length,
          hasAnnotationSignatures
        }
      }
    })

    return statusMap
  } catch (error) {
    console.error("Error in getDocumentsWithStatus:", error)
    return {}
  }
}