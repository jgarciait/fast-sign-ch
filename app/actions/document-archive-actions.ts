"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

// Archive a document by linking it to a file record
export async function archiveDocumentToExpediente(documentId: string, fileRecordId: string) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    // First verify the document exists
    const { data: existingDoc, error: checkError } = await supabase
      .from("documents")
      .select("id, created_by, file_record_id, archived")
      .eq("id", documentId)
      .single()

    if (checkError) {
      console.error("Error checking document:", checkError)
      return { error: `Error checking document: ${checkError.message}` }
    }

    if (!existingDoc) {
      return { error: "Document not found" }
    }

    // Verify the file record exists
    const { data: fileRecord, error: fileRecordError } = await supabase
      .from("file_records")
      .select("id")
      .eq("id", fileRecordId)
      .single()

    if (fileRecordError || !fileRecord) {
      return { error: "Expediente not found" }
    }

    // Update the document to link it to the file record and set archived = true
    const { error: updateError } = await supabase
      .from("documents")
      .update({ 
        file_record_id: fileRecordId,
        archived: true,
        updated_at: new Date().toISOString()
      })
      .eq("id", documentId)

    if (updateError) {
      console.error("Error archiving document to expediente:", updateError)
      return { error: `Error archiving document: ${updateError.message}` }
    }

    // Revalidate relevant paths
    revalidatePath("/documents")
    revalidatePath("/fast-sign")
    revalidatePath("/case-files")

    return { success: true }
  } catch (error) {
    console.error("Error in archiveDocumentToExpediente:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

// Unarchive a document by unlinking it from file record  
export async function unarchiveDocumentFromExpediente(documentId: string) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    // First verify the document exists and is currently linked
    const { data: existingDoc, error: checkError } = await supabase
      .from("documents")
      .select("id, created_by, file_record_id, archived")
      .eq("id", documentId)
      .single()

    if (checkError) {
      console.error("Error checking document:", checkError)
      return { error: `Error checking document: ${checkError.message}` }
    }

    if (!existingDoc) {
      return { error: "Document not found" }
    }

    // Update the document to unlink it from file record and set archived = false
    const { error: updateError } = await supabase
      .from("documents")
      .update({ 
        file_record_id: null,
        archived: false,
        updated_at: new Date().toISOString()
      })
      .eq("id", documentId)

    if (updateError) {
      console.error("Error unarchiving document:", updateError)
      return { error: `Error unarchiving document: ${updateError.message}` }
    }

    // Revalidate relevant paths
    revalidatePath("/documents")
    revalidatePath("/fast-sign")
    revalidatePath("/case-files")

    return { success: true }
  } catch (error) {
    console.error("Error in unarchiveDocumentFromExpediente:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

// Get archive status and expediente info for a document
export async function getDocumentArchiveInfo(documentId: string) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", info: null }
  }

  try {
    const { data, error } = await supabase
      .from("documents")
      .select(`
        id,
        archived,
        file_record_id,
        file_records (
          id,
          valores_json,
          created_at,
          filing_systems (
            nombre
          )
        )
      `)
      .eq("id", documentId)
      .single()

    if (error) {
      console.error("Error getting document archive info:", error)
      return { error: `Error getting archive info: ${error.message}`, info: null }
    }

    return { info: data }
  } catch (error) {
    console.error("Error in getDocumentArchiveInfo:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      info: null,
    }
  }
}

// Enhanced version of linkDocumentToFileRecord that automatically sets archived status
export async function linkDocumentToFileRecordWithArchive(documentId: string, fileRecordId: string) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    console.error("User not authenticated")
    return { error: "Not authenticated" }
  }

  console.log("Starting enhanced link process", {
    documentId,
    fileRecordId,
    userId: user.id
  })

  try {
    // First, verify the document exists
    const { data: existingDoc, error: checkError } = await supabase
      .from("documents")
      .select("id, created_by, file_record_id, archived")
      .eq("id", documentId)
      .single()

    if (checkError) {
      console.error("Error checking document:", checkError)
      return { error: `Error checking document: ${checkError.message}` }
    }

    if (!existingDoc) {
      console.error("Document not found:", documentId)
      return { error: "Document not found" }
    }

    // Verify the file record exists
    const { data: fileRecord, error: fileRecordError } = await supabase
      .from("file_records")
      .select("id")
      .eq("id", fileRecordId)
      .single()

    if (fileRecordError || !fileRecord) {
      console.error("File record not found:", fileRecordId)
      return { error: "Expediente not found" }
    }

    console.log("Document and file record verified")

    // Update the document to link it and set archived = true
    const { error } = await supabase
      .from("documents")
      .update({ 
        file_record_id: fileRecordId,
        archived: true,
        updated_at: new Date().toISOString()
      })
      .eq("id", documentId)

    if (error) {
      console.error("Database error linking document to file record:", error)
      return { error: `Database error: ${error.message}` }
    }

    // Verify the update was successful
    const { data: updatedDoc, error: verifyError } = await supabase
      .from("documents")
      .select("file_record_id, archived")
      .eq("id", documentId)
      .single()

    if (verifyError) {
      console.error("Error verifying update:", verifyError)
    } else {
      console.log("Update verified:", {
        fileRecordId: updatedDoc.file_record_id,
        archived: updatedDoc.archived
      })
    }

    console.log("Successfully linked document to file record and set archived=true")
    
    // Revalidate relevant paths
    revalidatePath("/documents")
    revalidatePath("/fast-sign")
    revalidatePath("/case-files")
    
    return { success: true }
  } catch (error) {
    console.error("Error in linkDocumentToFileRecordWithArchive:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

// Enhanced version of unlinkDocumentFromFileRecord that automatically sets archived status
export async function unlinkDocumentFromFileRecordWithArchive(documentId: string) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    // Update the document to unlink it and set archived = false
    const { error } = await supabase
      .from("documents")
      .update({ 
        file_record_id: null,
        archived: false,
        updated_at: new Date().toISOString()
      })
      .eq("id", documentId)

    if (error) {
      console.error("Database error unlinking document from file record:", error)
      return { error: `Database error: ${error.message}` }
    }

    // Revalidate relevant paths
    revalidatePath("/documents")
    revalidatePath("/fast-sign")
    revalidatePath("/case-files")

    return { success: true }
  } catch (error) {
    console.error("Error in unlinkDocumentFromFileRecordWithArchive:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}
