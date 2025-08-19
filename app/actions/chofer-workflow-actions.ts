"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

// Get current user
async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    throw new Error("Not authenticated")
  }
  
  return user
}

// Update assignment status specifically for chofer workflow
export async function updateChoferAssignmentStatus(
  assignmentId: string,
  newStatus: 'assigned' | 'in_transit' | 'completed' | 'signed' | 'cancelled',
  reason?: string
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    console.log('🚛 CHOFER WORKFLOW: Updating assignment', assignmentId, 'to status', newStatus)
    
    const supabase = await createClient()
    const user = await getCurrentUser()

    // First, get the current assignment to verify ownership and current state
    const { data: currentAssignment, error: fetchError } = await supabase
      .from('document_assignments')
      .select(`
        id,
        status,
        document_id,
        assigned_to_user_id,
        document:documents(id, file_name)
      `)
      .eq('id', assignmentId)
      .eq('assigned_to_user_id', user.id) // Ensure user owns this assignment
      .single()

    if (fetchError) {
      console.error('🚛 CHOFER WORKFLOW: Error fetching assignment:', fetchError)
      return { success: false, error: fetchError.message }
    }

    if (!currentAssignment) {
      console.error('🚛 CHOFER WORKFLOW: Assignment not found or not owned by user')
      return { success: false, error: "Assignment not found or not accessible" }
    }

    console.log('🚛 CHOFER WORKFLOW: Current assignment:', {
      id: currentAssignment.id,
      currentStatus: currentAssignment.status,
      newStatus: newStatus,
      documentId: currentAssignment.document_id
    })

    // Validate status transition
    const validTransitions: Record<string, string[]> = {
      assigned: ['in_transit', 'cancelled'],
      in_transit: ['assigned', 'completed', 'cancelled'], // Allow going back to assigned
      completed: ['in_transit', 'signed'], // Allow going back to in_transit
      signed: [], // Final state
      cancelled: ['assigned'] // Allow reactivating cancelled assignments
    }

    const currentStatus = currentAssignment.status
    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      console.error('🚛 CHOFER WORKFLOW: Invalid transition from', currentStatus, 'to', newStatus)
      return { 
        success: false, 
        error: `Invalid status transition from ${currentStatus} to ${newStatus}` 
      }
    }

    // Update the assignment
    const { data: updatedAssignment, error: updateError } = await supabase
      .from('document_assignments')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', assignmentId)
      .select(`
        *,
        document:documents(id, file_name, file_path),
        assigned_to_user:profiles!document_assignments_assigned_to_user_id_fkey(id, email, first_name, last_name)
      `)
      .single()

    if (updateError) {
      console.error('🚛 CHOFER WORKFLOW: Error updating assignment:', updateError)
      return { success: false, error: updateError.message }
    }

    // Add status history entry
    await supabase
      .from('assignment_status_history')
      .insert([{
        assignment_id: assignmentId,
        previous_status: currentStatus,
        new_status: newStatus,
        changed_by: user.id,
        change_reason: reason || `Chofer updated status to ${newStatus}`
      }])

    console.log('🚛 CHOFER WORKFLOW: Successfully updated assignment:', {
      id: assignmentId,
      from: currentStatus,
      to: newStatus
    })

    // Revalidate relevant paths
    revalidatePath('/mis-asignaciones')
    revalidatePath('/assignments')
    revalidatePath('/fast-sign-docs')
    revalidatePath('/fast-sign-docs-v2')
    
    return { 
      success: true, 
      data: updatedAssignment
    }
  } catch (error) {
    console.error("🚛 CHOFER WORKFLOW: Error in updateChoferAssignmentStatus:", error)
    return { success: false, error: "Failed to update assignment status" }
  }
}
