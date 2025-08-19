"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { startOfDay, endOfDay } from "date-fns"
import type {
  AssignmentWithDetails,
  CreateAssignmentRequest,
  UpdateAssignmentRequest,
  CreateCommentRequest,
  CreateGpsTrackingRequest,
  CreateSignatureMappingRequest,
  AssignmentFilters,
  PaginationParams,
  AssignmentResponse,
  AssignmentsResponse
} from "@/types/assignment-types"

// Get current user
async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    throw new Error("Not authenticated")
  }
  
  return user
}

// Create a new document assignment
export async function createAssignment(data: CreateAssignmentRequest): Promise<AssignmentResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    const assignmentData = {
      ...data,
      assigned_by_user_id: user.id,
      assignment_type: data.assignment_type || 'conduce',
      requires_chofer_signature: data.requires_chofer_signature ?? true,
      requires_client_signature: data.requires_client_signature ?? true,
    }

    const { data: assignment, error } = await supabase
      .from('document_assignments')
      .insert([assignmentData])
      .select(`
        *,
        document:documents(id, file_name, file_path),
        assigned_to_user:profiles!document_assignments_assigned_to_user_id_fkey(id, email, first_name, last_name),
        assigned_by_user:profiles!document_assignments_assigned_by_user_id_fkey(id, email, first_name, last_name)
      `)
      .single()

    if (error) {
      console.error("Error creating assignment:", error)
      return { success: false, error: error.message }
    }

    // Create initial status history entry
    await supabase
      .from('assignment_status_history')
      .insert([{
        assignment_id: assignment.id,
        new_status: 'assigned',
        changed_by: user.id,
        change_reason: 'Assignment created'
      }])

    // Update document status to "asignado" after successful assignment
    const { error: documentError } = await supabase
      .from('documents')
      .update({ status: 'asignado' })
      .eq('id', assignmentData.document_id)

    if (documentError) {
      console.error('Error updating document status to asignado:', documentError)
      // Note: Assignment was created but document status couldn't be updated
    }

    revalidatePath('/fast-sign-docs')
    revalidatePath('/fast-sign-docs-v2')
    revalidatePath('/assignments')
    
    return { success: true, data: assignment as AssignmentWithDetails }
  } catch (error) {
    console.error("Error in createAssignment:", error)
    return { success: false, error: "Failed to create assignment" }
  }
}

// Update document status (for chofer workflow)
export async function updateDocumentStatus(
  documentId: string, 
  status: 'asignado' | 'en_transito' | 'firmado' | 'cancelado',
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    // Update document status
    const { error: documentError } = await supabase
      .from('documents')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId)

    if (documentError) {
      console.error('Error updating document status:', documentError)
      return { success: false, error: documentError.message }
    }

    // Find assignment related to this document and user
    const { data: assignment } = await supabase
      .from('document_assignments')
      .select('id')
      .eq('document_id', documentId)
      .eq('assigned_to_user_id', user.id)
      .single()

    // If assignment exists, update assignment status history
    if (assignment) {
      const assignmentStatus = status === 'asignado' ? 'assigned' :
                              status === 'en_transito' ? 'in_transit' :
                              status === 'firmado' ? 'completed' :
                              status === 'cancelado' ? 'cancelled' : 'assigned'

      await supabase
        .from('assignment_status_history')
        .insert([{
          assignment_id: assignment.id,
          new_status: assignmentStatus,
          changed_by: user.id,
          change_reason: reason || `Status updated to ${status}`
        }])

      // Update assignment status as well
      await supabase
        .from('document_assignments')
        .update({ status: assignmentStatus })
        .eq('id', assignment.id)
    }

    revalidatePath('/fast-sign-docs')
    revalidatePath('/fast-sign-docs-v2')
    revalidatePath('/assignments')
    
    return { success: true }
  } catch (error) {
    console.error("Error in updateDocumentStatus:", error)
    return { success: false, error: "Failed to update document status" }
  }
}

// Get assignments with filtering and pagination
export async function getAssignments(
  filters: AssignmentFilters = {},
  pagination: PaginationParams = {}
): Promise<AssignmentsResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()
    
    let query = supabase
      .from('document_assignments')
      .select(`
        *,
        document:documents(id, file_name, file_path),
        assigned_to_user:profiles!document_assignments_assigned_to_user_id_fkey(id, email, first_name, last_name),
        assigned_by_user:profiles!document_assignments_assigned_by_user_id_fkey(id, email, first_name, last_name),
        comments_count:assignment_comments(count),
        gps_tracking_count:assignment_gps_tracking(count),
        files_count:assignment_files(count)
      `, { count: 'exact' })

    // Apply filters
    if (filters.status && filters.status.length > 0) {
      query = query.in('status', filters.status)
    }
    
    if (filters.assigned_to_user_id) {
      query = query.eq('assigned_to_user_id', filters.assigned_to_user_id)
    }
    
    if (filters.assigned_by_user_id) {
      query = query.eq('assigned_by_user_id', filters.assigned_by_user_id)
    }
    
    if (filters.assignment_type) {
      query = query.eq('assignment_type', filters.assignment_type)
    }
    
    if (filters.priority && filters.priority.length > 0) {
      query = query.in('priority', filters.priority)
    }
    
    if (filters.date_from) {
      query = query.gte('assigned_at', filters.date_from)
    }
    
    if (filters.date_to) {
      query = query.lte('assigned_at', filters.date_to)
    }
    
    // Apply pagination and sorting
    const page = pagination.page || 1
    const limit = pagination.limit || 20
    const offset = (page - 1) * limit
    
    const sortBy = pagination.sort_by || 'assigned_at'
    const sortOrder = pagination.sort_order || 'desc'
    
    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1)

    const { data: assignments, error, count } = await query

    if (error) {
      console.error("Error fetching assignments:", error)
      return { success: false, error: error.message }
    }

    return { 
      success: true, 
      data: assignments as AssignmentWithDetails[], 
      total: count || 0 
    }
  } catch (error) {
    console.error("Error in getAssignments:", error)
    return { success: false, error: "Failed to fetch assignments" }
  }
}

// Get single assignment with full details
export async function getAssignment(id: string): Promise<AssignmentResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    const { data: assignment, error } = await supabase
      .from('document_assignments')
      .select(`
        *,
        document:documents(id, file_name, file_path),
        assigned_to_user:profiles!document_assignments_assigned_to_user_id_fkey(id, email, first_name, last_name),
        assigned_by_user:profiles!document_assignments_assigned_by_user_id_fkey(id, email, first_name, last_name),
        assignment_comments(
          id, comment, comment_type, is_internal, created_at,
          user:profiles!assignment_comments_user_id_fkey(id, email, first_name, last_name)
        ),
        assignment_gps_tracking(
          id, latitude, longitude, accuracy, address, 
          location_type, recorded_at
        ),
        assignment_files(
          id, file_name, file_path, file_type, description, created_at,
          uploaded_by_user:profiles!assignment_files_uploaded_by_fkey(id, email, first_name, last_name)
        ),
        assignment_signature_mappings(
          id, signature_type, page_number, x_coordinate, y_coordinate,
          width, height, is_required, label, placeholder_text
        ),
        assignment_status_history(
          id, previous_status, new_status, change_reason, changed_at,
          changed_by_user:profiles!assignment_status_history_changed_by_fkey(id, email, first_name, last_name)
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error("Error fetching assignment:", error)
      return { success: false, error: error.message }
    }

    return { success: true, data: assignment as AssignmentWithDetails }
  } catch (error) {
    console.error("Error in getAssignment:", error)
    return { success: false, error: "Failed to fetch assignment" }
  }
}

// Update assignment
export async function updateAssignment(
  id: string, 
  data: UpdateAssignmentRequest
): Promise<AssignmentResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    // Get current assignment to track status changes
    const { data: currentAssignment } = await supabase
      .from('document_assignments')
      .select('status')
      .eq('id', id)
      .single()

    const { data: assignment, error } = await supabase
      .from('document_assignments')
      .update({
        ...data,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        document:documents(id, file_name, file_path),
        assigned_to_user:profiles!document_assignments_assigned_to_user_id_fkey(id, email, first_name, last_name),
        assigned_by_user:profiles!document_assignments_assigned_by_user_id_fkey(id, email, first_name, last_name)
      `)
      .single()

    if (error) {
      console.error("Error updating assignment:", error)
      return { success: false, error: error.message }
    }

    // Track status change if status was updated
    if (data.status && currentAssignment && data.status !== currentAssignment.status) {
      await supabase
        .from('assignment_status_history')
        .insert([{
          assignment_id: id,
          previous_status: currentAssignment.status,
          new_status: data.status,
          changed_by: user.id
        }])
    }

    revalidatePath('/assignments')
    revalidatePath(`/assignments/${id}`)
    
    return { success: true, data: assignment as AssignmentWithDetails }
  } catch (error) {
    console.error("Error in updateAssignment:", error)
    return { success: false, error: "Failed to update assignment" }
  }
}

// Delete assignment
export async function deleteAssignment(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    const { error } = await supabase
      .from('document_assignments')
      .delete()
      .eq('id', id)

    if (error) {
      console.error("Error deleting assignment:", error)
      return { success: false, error: error.message }
    }

    revalidatePath('/assignments')
    return { success: true }
  } catch (error) {
    console.error("Error in deleteAssignment:", error)
    return { success: false, error: "Failed to delete assignment" }
  }
}

// Add comment to assignment
export async function addAssignmentComment(data: CreateCommentRequest) {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    const { data: comment, error } = await supabase
      .from('assignment_comments')
      .insert([{
        ...data,
        user_id: user.id
      }])
      .select(`
        *,
        user:profiles!assignment_comments_user_id_fkey(id, email, first_name, last_name)
      `)
      .single()

    if (error) {
      console.error("Error adding comment:", error)
      return { success: false, error: error.message }
    }

    revalidatePath(`/assignments/${data.assignment_id}`)
    return { success: true, data: comment }
  } catch (error) {
    console.error("Error in addAssignmentComment:", error)
    return { success: false, error: "Failed to add comment" }
  }
}

// Add GPS tracking data
export async function addGpsTracking(data: CreateGpsTrackingRequest) {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    const { data: gpsData, error } = await supabase
      .from('assignment_gps_tracking')
      .insert([{
        ...data,
        user_id: user.id,
        recorded_at: data.recorded_at || new Date().toISOString()
      }])
      .select()
      .single()

    if (error) {
      console.error("Error adding GPS tracking:", error)
      return { success: false, error: error.message }
    }

    revalidatePath(`/assignments/${data.assignment_id}`)
    return { success: true, data: gpsData }
  } catch (error) {
    console.error("Error in addGpsTracking:", error)
    return { success: false, error: "Failed to add GPS tracking" }
  }
}

// Add signature mapping
export async function addSignatureMapping(data: CreateSignatureMappingRequest) {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    const { data: mapping, error } = await supabase
      .from('assignment_signature_mappings')
      .insert([{
        ...data,
        created_by: user.id,
        width: data.width || 0.15,
        height: data.height || 0.08,
        is_required: data.is_required ?? true
      }])
      .select()
      .single()

    if (error) {
      console.error("Error adding signature mapping:", error)
      return { success: false, error: error.message }
    }

    revalidatePath(`/assignments/${data.assignment_id}`)
    return { success: true, data: mapping }
  } catch (error) {
    console.error("Error in addSignatureMapping:", error)
    return { success: false, error: "Failed to add signature mapping" }
  }
}

// Get assignments for current user (chofer view)
export async function getMyAssignments(
  filters: Omit<AssignmentFilters, 'assigned_to_user_id'> = {},
  pagination: PaginationParams = {}
): Promise<AssignmentsResponse> {
  try {
    const user = await getCurrentUser()
    
    console.log("🔍 getMyAssignments DEBUG:")
    console.log("  Current user ID:", user.id)
    console.log("  Current user email:", user.email)
    console.log("  Expected assignment user ID:", "b2905b30-b588-47f6-ae88-11ecc186b0ae")
    console.log("  User ID match:", user.id === "b2905b30-b588-47f6-ae88-11ecc186b0ae")
    console.log("  Filters:", { ...filters, assigned_to_user_id: user.id })
    
    const result = await getAssignments(
      { ...filters, assigned_to_user_id: user.id },
      pagination
    )
    
    console.log("  getAssignments result:", result)
    console.log("  Assignments count:", result.success ? result.data?.length : 0)
    
    return result
  } catch (error) {
    console.error("Error in getMyAssignments:", error)
    return { success: false, error: "Failed to fetch my assignments" }
  }
}

// Get assignments created by current user
export async function getAssignmentsCreatedByMe(
  filters: Omit<AssignmentFilters, 'assigned_by_user_id'> = {},
  pagination: PaginationParams = {}
): Promise<AssignmentsResponse> {
  try {
    const user = await getCurrentUser()
    
    return await getAssignments(
      { ...filters, assigned_by_user_id: user.id },
      pagination
    )
  } catch (error) {
    console.error("Error in getAssignmentsCreatedByMe:", error)
    return { success: false, error: "Failed to fetch created assignments" }
  }
}
