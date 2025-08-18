"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { revalidatePath } from "next/cache"

// Types for filing system
export interface FilingSystem {
  id: string
  created_by: string
  nombre: string
  descripcion?: string
  esquema_json: any
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface FilingIndex {
  id: string
  sistema_id: string
  clave: string
  etiqueta: string
  tipo_dato: 'string' | 'int' | 'fecha' | 'bool' | 'enum'
  obligatorio: boolean
  opciones_enum?: any[]
  orden: number
  created_at: string
}

export interface FileRecord {
  id: string
  created_by: string
  sistema_id: string
  valores_json: any
  created_at: string
  updated_at: string
  assigned_to_user_id?: string
  customer_id?: string
}

export interface CreateFilingSystemData {
  nombre: string
  descripcion?: string
  indices: Omit<FilingIndex, 'id' | 'sistema_id' | 'created_at'>[]
}

// Get all filing systems (globally accessible)
export async function getFilingSystems() {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", systems: [] }
  }

  try {
    const { data, error } = await supabase
      .from("filing_systems")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Database error in getFilingSystems:", error)
      return { error: `Database error: ${error.message}`, systems: [] }
    }

    return { systems: data || [] }
  } catch (error) {
    console.error("Error in getFilingSystems:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      systems: [],
    }
  }
}

// Get active filing system (globally accessible)
export async function getActiveFilingSystem() {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", system: null }
  }

  try {
    const { data, error } = await supabase
      .from("filing_systems")
      .select("*")
      .eq("is_active", true)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error("Database error in getActiveFilingSystem:", error)
      return { error: `Database error: ${error.message}`, system: null }
    }

    return { system: data || null }
  } catch (error) {
    console.error("Error in getActiveFilingSystem:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      system: null,
    }
  }
}

// Create a simple filing system (wrapper for modal)
export async function createSimpleFilingSystem(nombre: string, descripcion?: string) {
  return createFilingSystem({
    nombre,
    descripcion,
    indices: [] // Empty indices for simple creation
  })
}

// Create a new filing system
export async function createFilingSystem(systemData: CreateFilingSystemData) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    // First create the filing system
    const { data: system, error: systemError } = await supabase
      .from("filing_systems")
      .insert({
        created_by: user.id,
        nombre: systemData.nombre,
        descripcion: systemData.descripcion,
        is_active: false // Will be activated separately
      })
      .select()
      .single()

    if (systemError) {
      console.error("Database error creating filing system:", systemError)
      return { error: `Database error: ${systemError.message}` }
    }

    // Then create the indices
    if (systemData.indices.length > 0) {
      const indicesData = systemData.indices.map((index, orden) => ({
        sistema_id: system.id,
        clave: index.clave,
        etiqueta: index.etiqueta,
        tipo_dato: index.tipo_dato,
        obligatorio: index.obligatorio,
        opciones_enum: index.opciones_enum,
        orden: orden
      }))

      const { error: indicesError } = await supabase
        .from("filing_indices")
        .insert(indicesData)

      if (indicesError) {
        console.error("Database error creating filing indices:", indicesError)
        // Clean up the system if indices creation failed
        await supabase.from("filing_systems").delete().eq("id", system.id)
        return { error: `Database error: ${indicesError.message}` }
      }
    }

    revalidatePath("/settings")
    return { system }
  } catch (error) {
    console.error("Error in createFilingSystem:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

// Update filing system
export async function updateFilingSystem(systemId: string, systemData: CreateFilingSystemData) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    // Update the filing system
    const { error: systemError } = await supabase
      .from("filing_systems")
      .update({
        nombre: systemData.nombre,
        descripcion: systemData.descripcion,
        updated_at: new Date().toISOString()
      })
      .eq("id", systemId)
      .eq("created_by", user.id)

    if (systemError) {
      console.error("Database error updating filing system:", systemError)
      return { error: `Database error: ${systemError.message}` }
    }

    // Delete existing indices
    const { error: deleteError } = await supabase
      .from("filing_indices")
      .delete()
      .eq("sistema_id", systemId)

    if (deleteError) {
      console.error("Database error deleting old indices:", deleteError)
      return { error: `Database error: ${deleteError.message}` }
    }

    // Create new indices
    if (systemData.indices.length > 0) {
      const indicesData = systemData.indices.map((index, orden) => ({
        sistema_id: systemId,
        clave: index.clave,
        etiqueta: index.etiqueta,
        tipo_dato: index.tipo_dato,
        obligatorio: index.obligatorio,
        opciones_enum: index.opciones_enum,
        orden: orden
      }))

      const { error: indicesError } = await supabase
        .from("filing_indices")
        .insert(indicesData)

      if (indicesError) {
        console.error("Database error creating new indices:", indicesError)
        return { error: `Database error: ${indicesError.message}` }
      }
    }

    revalidatePath("/settings")
    return { success: true }
  } catch (error) {
    console.error("Error in updateFilingSystem:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

// Activate a filing system
export async function activateFilingSystem(systemId: string) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    const { error } = await supabase
      .from("filing_systems")
      .update({ 
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq("id", systemId)
      .eq("created_by", user.id)

    if (error) {
      console.error("Database error activating filing system:", error)
      return { error: `Database error: ${error.message}` }
    }

    revalidatePath("/settings")
    return { success: true }
  } catch (error) {
    console.error("Error in activateFilingSystem:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

// Delete a filing system
export async function deleteFilingSystem(systemId: string) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    // Check if system has associated file records
    const { data: records, error: recordsError } = await supabase
      .from("file_records")
      .select("id")
      .eq("sistema_id", systemId)
      .limit(1)

    if (recordsError) {
      console.error("Database error checking file records:", recordsError)
      return { error: `Database error: ${recordsError.message}` }
    }

    if (records && records.length > 0) {
      return { error: "Cannot delete filing system that has associated file records" }
    }

    const { error } = await supabase
      .from("filing_systems")
      .delete()
      .eq("id", systemId)
      .eq("created_by", user.id)

    if (error) {
      console.error("Database error deleting filing system:", error)
      return { error: `Database error: ${error.message}` }
    }

    revalidatePath("/settings")
    return { success: true }
  } catch (error) {
    console.error("Error in deleteFilingSystem:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

// Update document to link with file record
export async function linkDocumentToFileRecord(documentId: string, fileRecordId: string) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    console.error("linkDocumentToFileRecord: User not authenticated")
    return { error: "Not authenticated" }
  }

  console.log("linkDocumentToFileRecord: Starting link process", {
    documentId,
    fileRecordId,
    userId: user.id
  })

  try {
    // First, verify the document exists (removed ownership check)
    const { data: existingDoc, error: checkError } = await supabase
      .from("documents")
      .select("id, created_by, file_record_id")
      .eq("id", documentId)
      .single()

    if (checkError) {
      console.error("linkDocumentToFileRecord: Error checking document:", checkError)
      return { error: `Error checking document: ${checkError.message}` }
    }

    if (!existingDoc) {
      console.error("linkDocumentToFileRecord: Document not found:", documentId)
      return { error: "Document not found" }
    }

    console.log("linkDocumentToFileRecord: Document verified, current file_record_id:", existingDoc.file_record_id)
    console.log("linkDocumentToFileRecord: Document created by:", existingDoc.created_by, "Current user:", user.id)

    // Update the document (removed created_by restriction)
    const { error } = await supabase
      .from("documents")
      .update({ 
        file_record_id: fileRecordId,
        updated_at: new Date().toISOString()
      })
      .eq("id", documentId)

    if (error) {
      console.error("linkDocumentToFileRecord: Database error linking document to file record:", error)
      return { error: `Database error: ${error.message}` }
    }

    // Verify the update was successful
    const { data: updatedDoc, error: verifyError } = await supabase
      .from("documents")
      .select("file_record_id")
      .eq("id", documentId)
      .single()

    if (verifyError) {
      console.error("linkDocumentToFileRecord: Error verifying update:", verifyError)
    } else {
      console.log("linkDocumentToFileRecord: Update verified, new file_record_id:", updatedDoc.file_record_id)
    }

    console.log("linkDocumentToFileRecord: Successfully linked document to file record")
    return { success: true }
  } catch (error) {
    console.error("Error in linkDocumentToFileRecord:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

// Update document to unlink from file record
export async function unlinkDocumentFromFileRecord(documentId: string) {
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
      .update({ 
        file_record_id: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", documentId)
      // Removed .eq("created_by", user.id) restriction

    if (error) {
      console.error("Database error unlinking document from file record:", error)
      return { error: `Database error: ${error.message}` }
    }

    return { success: true }
  } catch (error) {
    console.error("Error in unlinkDocumentFromFileRecord:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

// Filing Indices Actions
export async function getFilingIndices(systemId: string) {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from("filing_indices")
      .select("*")
      .eq("sistema_id", systemId)
      .order("orden", { ascending: true })

    if (error) {
      console.error("Database error in getFilingIndices:", error)
      return { error: `Database error: ${error.message}`, indices: [] }
    }

    return { indices: data || [] }
  } catch (error) {
    console.error("Error in getFilingIndices:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      indices: [],
    }
  }
}

export async function createFilingIndex(
  systemId: string,
  clave: string,
  etiqueta: string,
  tipo_dato: 'string' | 'int' | 'fecha' | 'bool' | 'enum',
  obligatorio: boolean,
  orden: number,
  opciones_enum?: any[]
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    // Check if user owns the filing system
    const { data: system, error: systemError } = await supabase
      .from("filing_systems")
      .select("created_by")
      .eq("id", systemId)
      .single()

    if (systemError || system?.created_by !== user.id) {
      return { error: "You can only modify your own filing systems" }
    }

    const { data, error } = await supabase
      .from("filing_indices")
      .insert({
        sistema_id: systemId,
        clave,
        etiqueta,
        tipo_dato,
        obligatorio,
        orden,
        opciones_enum: tipo_dato === 'enum' ? opciones_enum : null
      })
      .select()
      .single()

    if (error) {
      console.error("Database error in createFilingIndex:", error)
      return { error: `Database error: ${error.message}` }
    }

    return { index: data }
  } catch (error) {
    console.error("Error in createFilingIndex:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

export async function updateFilingIndex(
  indexId: string,
  updates: Partial<Pick<FilingIndex, 'clave' | 'etiqueta' | 'tipo_dato' | 'obligatorio' | 'orden' | 'opciones_enum'>>
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    // Check if user owns the filing system through the index
    const { data: index, error: indexError } = await supabase
      .from("filing_indices")
      .select(`
        *,
        filing_systems!inner(created_by)
      `)
      .eq("id", indexId)
      .single()

    if (indexError || index?.filing_systems?.created_by !== user.id) {
      return { error: "You can only modify indices for your own filing systems" }
    }

    const { data, error } = await supabase
      .from("filing_indices")
      .update(updates)
      .eq("id", indexId)
      .select()
      .single()

    if (error) {
      console.error("Database error in updateFilingIndex:", error)
      return { error: `Database error: ${error.message}` }
    }

    return { index: data }
  } catch (error) {
    console.error("Error in updateFilingIndex:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

export async function deleteFilingIndex(indexId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    // Check if user owns the filing system through the index
    const { data: index, error: indexError } = await supabase
      .from("filing_indices")
      .select(`
        *,
        filing_systems!inner(created_by)
      `)
      .eq("id", indexId)
      .single()

    if (indexError || index?.filing_systems?.created_by !== user.id) {
      return { error: "You can only delete indices from your own filing systems" }
    }

    const { error } = await supabase
      .from("filing_indices")
      .delete()
      .eq("id", indexId)

    if (error) {
      console.error("Database error in deleteFilingIndex:", error)
      return { error: `Database error: ${error.message}` }
    }

    return { success: true }
  } catch (error) {
    console.error("Error in deleteFilingIndex:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

// File Records Actions
// Create file record
export async function createFileRecord(
  systemId: string,
  valores: any
) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    const { data, error } = await supabase
      .from("file_records")
      .insert({
        created_by: user.id,
        sistema_id: systemId,
        valores_json: valores
      })
      .select()
      .single()

    if (error) {
      console.error("Database error creating file record:", error)
      return { error: `Database error: ${error.message}` }
    }

    revalidatePath("/expedientes")
    return { record: data }
  } catch (error) {
    console.error("Error in createFileRecord:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

export async function getFileRecordById(recordId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", record: null }
  }

  try {
    // Global access - get any file record by ID
    const { data, error } = await supabase
      .from("file_records")
      .select(`
        *,
        filing_systems(nombre, esquema_json)
      `)
      .eq("id", recordId)
      .single()

    if (error) {
      console.error("Database error in getFileRecordById:", error)
      return { error: `Database error: ${error.message}`, record: null }
    }

    return { record: data }
  } catch (error) {
    console.error("Error in getFileRecordById:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      record: null,
    }
  }
}

export async function getFileRecords(searchTerm?: string, systemId?: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", records: [] }
  }

  try {
    // Global access - get all file records
    let query = supabase
      .from("file_records")
      .select(`
        *,
        filing_systems(nombre, esquema_json)
      `)
      .order("created_at", { ascending: false })

    if (systemId) {
      query = query.eq("sistema_id", systemId)
    }

    const { data, error } = await query

    if (error) {
      console.error("Database error in getFileRecords:", error)
      return { error: `Database error: ${error.message}`, records: [] }
    }

    // Filter by search term if provided
    let filteredData = data || []
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filteredData = filteredData.filter(record => {
        // Search in JSON values
        const valuesString = JSON.stringify(record.valores_json).toLowerCase()
        return valuesString.includes(searchLower)
      })
    }

    return { records: filteredData }
  } catch (error) {
    console.error("Error in getFileRecords:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      records: [],
    }
  }
}

export async function updateFileRecord(
  recordId: string,
  valores: any
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    // Global access - any user can update any file record
    const { data, error } = await supabase
      .from("file_records")
      .update({
        valores_json: valores,
        updated_at: new Date().toISOString()
      })
      .eq("id", recordId)
      .select()
      .single()

    if (error) {
      console.error("Database error in updateFileRecord:", error)
      return { error: `Database error: ${error.message}` }
    }

    return { record: data }
  } catch (error) {
    console.error("Error in updateFileRecord:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

export async function deleteFileRecord(recordId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    // Simplified approach: Use admin client to delete the file record
    // The updated trigger will handle the "Sin Categorizar" category deletion intelligently
    // And CASCADE will clean up related records
    const adminClient = createAdminClient()
    
    // Delete the file record - CASCADE should handle everything else
    const { error } = await adminClient
      .from("file_records")
      .delete()
      .eq("id", recordId)

    if (error) {
      console.error("Database error in deleteFileRecord:", error)
      return { error: `Database error: ${error.message}` }
    }

    return { success: true }
  } catch (error) {
    console.error("Error in deleteFileRecord:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

// Utility function to search file records with advanced filters
export async function searchFileRecords(
  filters: {
    systemId?: string
    searchTerm?: string
    fieldFilters?: Record<string, any>
  }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", records: [] }
  }

  try {
    // Global access - search all file records
    let query = supabase
      .from("file_records")
      .select(`
        *,
        filing_systems(nombre, esquema_json)
      `)
      .order("created_at", { ascending: false })

    if (filters.systemId) {
      query = query.eq("sistema_id", filters.systemId)
    }

    // Add JSON field filters
    if (filters.fieldFilters) {
      Object.entries(filters.fieldFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query = query.contains("valores_json", { [key]: value })
        }
      })
    }

    const { data, error } = await query

    if (error) {
      console.error("Database error in searchFileRecords:", error)
      return { error: `Database error: ${error.message}`, records: [] }
    }

    // Additional text search if provided
    let filteredData = data || []
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase()
      filteredData = filteredData.filter(record => {
        const valuesString = JSON.stringify(record.valores_json).toLowerCase()
        return valuesString.includes(searchLower)
      })
    }

    return { records: filteredData }
  } catch (error) {
    console.error("Error in searchFileRecords:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      records: [],
    }
  }
}

export async function getDocumentsByFileRecord(fileRecordId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", documents: [] }
  }

  try {
    // With the new global document visibility, we can get all documents for a case file
    // regardless of who created them
    const { data, error } = await supabase
      .from("documents")
      .select(`
        id,
        file_name,
        file_path,
        file_size,
        file_type,
        created_at,
        updated_at,
        status,
        created_by,
        document_type,
        category_id,
        case_file_metadata
      `)
      .eq("file_record_id", fileRecordId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Database error in getDocumentsByFileRecord:", error)
      return { error: `Database error: ${error.message}`, documents: [] }
    }

    return { documents: data || [] }
  } catch (error) {
    console.error("Error in getDocumentsByFileRecord:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      documents: [],
    }
  }
}

// Assign a case file to a user (global access)
export async function assignFileRecord(recordId: string, assignedToUserId: string | null) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    // Global access - any user can assign any case file
    const { data, error } = await supabase
      .from("file_records")
      .update({ 
        assigned_to_user_id: assignedToUserId,
        updated_at: new Date().toISOString()
      })
      .eq("id", recordId)
      .select()
      .single()

    if (error) {
      console.error("Database error in assignFileRecord:", error)
      return { error: `Database error: ${error.message}` }
    }

    revalidatePath("/case-files")
    return { fileRecord: data }
  } catch (error) {
    console.error("Error in assignFileRecord:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

// Get all users for assignment dropdown
export async function getUsersForAssignment() {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", users: [] }
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .order("first_name", { ascending: true })

    if (error) {
      console.error("Database error in getUsersForAssignment:", error)
      return { error: `Database error: ${error.message}`, users: [] }
    }

    const users = data?.map(profile => ({
      id: profile.id,
      name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown User'
    })) || []

    return { users }
  } catch (error) {
    console.error("Error in getUsersForAssignment:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      users: [],
    }
  }
}

// Get file records assigned to current user
export async function getAssignedFileRecords() {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", records: [] }
  }

  try {
    const { data, error } = await supabase
      .from("file_records")
      .select(`
        *,
        filing_systems!inner (
          nombre,
          descripcion
        )
      `)
      .eq("assigned_to_user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Database error in getAssignedFileRecords:", error)
      return { error: `Database error: ${error.message}`, records: [] }
    }

    return { records: data || [] }
  } catch (error) {
    console.error("Error in getAssignedFileRecords:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      records: [],
    }
  }
}

// Get file record access info for current user
export async function getFileRecordAccessInfo(recordId: string) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", access: null }
  }

  try {
    const { data, error } = await supabase
      .rpc("get_file_record_access_info", {
        p_file_record_id: recordId,
        p_user_id: user.id
      })

    if (error) {
      console.error("Database error in getFileRecordAccessInfo:", error)
      return { error: `Database error: ${error.message}`, access: null }
    }

    return { access: data?.[0] || null }
  } catch (error) {
    console.error("Error in getFileRecordAccessInfo:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      access: null,
    }
  }
}

// Upload multiple files to a case file
export async function uploadMultipleFilesToCaseFile(
  caseFileId: string,
  files: File[]
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", uploadedFiles: [] }
  }

  try {
    const uploadResults = []
    const failedUploads = []

    for (const file of files) {
      try {
        // Validate file
        if (file.size > 50 * 1024 * 1024) { // 50MB limit
          failedUploads.push({ fileName: file.name, error: "File size exceeds 50MB limit" })
          continue
        }

        // Create FormData for the upload action
        const formData = new FormData()
        formData.append('file', file)

        // Use existing upload function
        const { uploadFileToPublicBucket } = await import("@/app/actions/upload-actions")
        const uploadResult = await uploadFileToPublicBucket(formData)

        if (uploadResult.error) {
          failedUploads.push({ fileName: file.name, error: uploadResult.error })
          continue
        }

        // Get the default "Sin Categorizar" category for this file record
        const { data: defaultCategory } = await supabase
          .from("document_categories")
          .select("id")
          .eq("file_record_id", caseFileId)
          .eq("name", "Sin Categorizar")
          .single()

        // Create document record (matching actual database schema)
        const { data: document, error: docError } = await supabase
          .from("documents")
          .insert({
            file_name: uploadResult.originalFileName,
            file_path: uploadResult.path,
            file_size: file.size,
            file_type: file.type,
            document_type: "case_file_attachment",
            file_record_id: caseFileId,
            category_id: defaultCategory?.id || null, // Assign to default category if available
            created_by: user.id, // Use created_by as per actual schema
            status: "uploaded"
          })
          .select()
          .single()

        if (docError) {
          failedUploads.push({ fileName: file.name, error: docError.message })
          continue
        }

        uploadResults.push({
          fileName: file.name,
          documentId: document.id,
          url: uploadResult.url, // Get URL from upload result since it's not stored in DB
          success: true
        })

      } catch (error) {
        failedUploads.push({ 
          fileName: file.name, 
          error: error instanceof Error ? error.message : "Unknown error" 
        })
      }
    }

    return {
      uploadedFiles: uploadResults,
      failedUploads: failedUploads,
      totalUploaded: uploadResults.length,
      totalFailed: failedUploads.length
    }

  } catch (error) {
    console.error("Error in uploadMultipleFilesToCaseFile:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      uploadedFiles: [],
      failedUploads: []
    }
  }
}
