"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import type {
  Group,
  GroupWithMembers,
  CreateGroupRequest,
  AddUserToGroupRequest,
  GroupResponse,
  GroupsResponse
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

// Create a new group
export async function createGroup(data: CreateGroupRequest): Promise<GroupResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    const { data: group, error } = await supabase
      .from('groups')
      .insert([{
        ...data,
        created_by: user.id,
        group_type: data.group_type || 'choferes'
      }])
      .select()
      .single()

    if (error) {
      console.error("Error creating group:", error)
      return { success: false, error: error.message }
    }

    revalidatePath('/groups')
    return { success: true, data: group }
  } catch (error) {
    console.error("Error in createGroup:", error)
    return { success: false, error: "Failed to create group" }
  }
}

// Get all groups
export async function getGroups(): Promise<GroupsResponse> {
  try {
    const supabase = await createClient()

    const { data: groups, error } = await supabase
      .from('groups')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error("Error fetching groups:", error)
      return { success: false, error: error.message }
    }

    // Get members for each group separately
    const groupsWithMembers = await Promise.all(
      groups?.map(async (group) => {
        const { data: memberships } = await supabase
          .from('user_group_memberships')
          .select(`
            id, user_id, role_in_group, is_active, assigned_at,
            profiles!user_group_memberships_user_id_fkey(id, email, first_name, last_name)
          `)
          .eq('group_id', group.id)

        const membersWithUserInfo = memberships?.map(membership => ({
          ...membership,
          user: {
            ...membership.profiles,
            full_name: `${membership.profiles?.first_name || ''} ${membership.profiles?.last_name || ''}`.trim() || null
          }
        })) || []

        return {
          ...group,
          members: membersWithUserInfo,
          members_count: membersWithUserInfo.filter(m => m.is_active).length
        }
      }) || []
    )

    return { success: true, data: groupsWithMembers as GroupWithMembers[] }
  } catch (error) {
    console.error("Error in getGroups:", error)
    return { success: false, error: "Failed to fetch groups" }
  }
}

// Get single group with members
export async function getGroup(id: string): Promise<GroupResponse> {
  try {
    const supabase = await createClient()

    const { data: group, error } = await supabase
      .from('groups')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error("Error fetching group:", error)
      return { success: false, error: error.message }
    }

    // Get members separately
    const { data: memberships } = await supabase
      .from('user_group_memberships')
      .select(`
        id, user_id, role_in_group, is_active, assigned_at, assigned_by,
        profiles!user_group_memberships_user_id_fkey(id, email, full_name)
      `)
      .eq('group_id', id)

    const membersWithUserInfo = memberships?.map(membership => ({
      ...membership,
      user: membership.profiles
    })) || []

    // Add member count
    const groupWithCount = {
      ...group,
      members: membersWithUserInfo,
      members_count: membersWithUserInfo.filter(m => m.is_active).length
    } as GroupWithMembers

    return { success: true, data: groupWithCount }
  } catch (error) {
    console.error("Error in getGroup:", error)
    return { success: false, error: "Failed to fetch group" }
  }
}

// Get groups by type (e.g., 'choferes')
export async function getGroupsByType(groupType: string): Promise<GroupsResponse> {
  try {
    const supabase = await createClient()

    const { data: groups, error } = await supabase
      .from('groups')
      .select('*')
      .eq('group_type', groupType)
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error("Error fetching groups by type:", error)
      return { success: false, error: error.message }
    }

    // Get members for each group separately
    const groupsWithMembers = await Promise.all(
      groups?.map(async (group) => {
        const { data: memberships } = await supabase
          .from('user_group_memberships')
          .select(`
            id, user_id, role_in_group, is_active,
            profiles!user_group_memberships_user_id_fkey(id, email, first_name, last_name)
          `)
          .eq('group_id', group.id)

        const membersWithUserInfo = memberships?.map(membership => ({
          ...membership,
          user: {
            ...membership.profiles,
            full_name: `${membership.profiles?.first_name || ''} ${membership.profiles?.last_name || ''}`.trim() || null
          }
        })) || []

        return {
          ...group,
          members: membersWithUserInfo,
          members_count: membersWithUserInfo.filter(m => m.is_active).length
        }
      }) || []
    )

    return { success: true, data: groupsWithMembers as GroupWithMembers[] }
  } catch (error) {
    console.error("Error in getGroupsByType:", error)
    return { success: false, error: "Failed to fetch groups" }
  }
}

// Update group
export async function updateGroup(
  id: string, 
  data: Partial<CreateGroupRequest>
): Promise<GroupResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    const { data: group, error } = await supabase
      .from('groups')
      .update({
        ...data,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error("Error updating group:", error)
      return { success: false, error: error.message }
    }

    revalidatePath('/groups')
    return { success: true, data: group }
  } catch (error) {
    console.error("Error in updateGroup:", error)
    return { success: false, error: "Failed to update group" }
  }
}

// Delete group (soft delete)
export async function deleteGroup(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('groups')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)

    if (error) {
      console.error("Error deleting group:", error)
      return { success: false, error: error.message }
    }

    revalidatePath('/groups')
    return { success: true }
  } catch (error) {
    console.error("Error in deleteGroup:", error)
    return { success: false, error: "Failed to delete group" }
  }
}

// Add user to group
export async function addUserToGroup(data: AddUserToGroupRequest): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    // Check if user is already in the group
    const { data: existingMembership } = await supabase
      .from('user_group_memberships')
      .select('id, is_active')
      .eq('user_id', data.user_id)
      .eq('group_id', data.group_id)
      .single()

    let membershipCreated = false

    if (existingMembership) {
      if (existingMembership.is_active) {
        return { success: false, error: "User is already a member of this group" }
      } else {
        // Reactivate existing membership
        const { error } = await supabase
          .from('user_group_memberships')
          .update({
            is_active: true,
            role_in_group: data.role_in_group || 'member',
            assigned_by: user.id,
            assigned_at: new Date().toISOString()
          })
          .eq('id', existingMembership.id)

        if (error) {
          console.error("Error reactivating membership:", error)
          return { success: false, error: error.message }
        }
        membershipCreated = true
      }
    } else {
      // Create new membership
      const { error } = await supabase
        .from('user_group_memberships')
        .insert([{
          ...data,
          assigned_by: user.id,
          role_in_group: data.role_in_group || 'member'
        }])

      if (error) {
        console.error("Error adding user to group:", error)
        return { success: false, error: error.message }
      }
      membershipCreated = true
    }

    // If this is a choferes group, ensure chofer profile is created
    if (membershipCreated) {
      const { data: group } = await supabase
        .from('groups')
        .select('group_type')
        .eq('id', data.group_id)
        .single()

      if (group?.group_type === 'choferes') {
        // Try to ensure chofer profile exists using the SQL function
        const { error: fallbackError } = await supabase
          .rpc('ensure_chofer_profile_with_fallback', {
            target_user_id: data.user_id,
            creator_id: user.id
          })

        if (fallbackError) {
          console.error("Warning: Could not ensure chofer profile exists:", fallbackError)
          // Don't fail the group assignment, but log the issue
        }
      }
    }

    revalidatePath('/groups')
    revalidatePath(`/groups/${data.group_id}`)
    revalidatePath('/choferes') // Refresh choferes page too
    return { success: true }
  } catch (error) {
    console.error("Error in addUserToGroup:", error)
    return { success: false, error: "Failed to add user to group" }
  }
}

// Remove user from group (soft delete)
export async function removeUserFromGroup(
  userId: string, 
  groupId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('user_group_memberships')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('group_id', groupId)

    if (error) {
      console.error("Error removing user from group:", error)
      return { success: false, error: error.message }
    }

    revalidatePath('/groups')
    revalidatePath(`/groups/${groupId}`)
    return { success: true }
  } catch (error) {
    console.error("Error in removeUserFromGroup:", error)
    return { success: false, error: "Failed to remove user from group" }
  }
}

// Update user role in group
export async function updateUserRoleInGroup(
  userId: string,
  groupId: string,
  role: 'member' | 'admin' | 'supervisor'
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('user_group_memberships')
      .update({ role_in_group: role })
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .eq('is_active', true)

    if (error) {
      console.error("Error updating user role:", error)
      return { success: false, error: error.message }
    }

    revalidatePath('/groups')
    revalidatePath(`/groups/${groupId}`)
    return { success: true }
  } catch (error) {
    console.error("Error in updateUserRoleInGroup:", error)
    return { success: false, error: "Failed to update user role" }
  }
}

// Get users in a specific group
export async function getGroupMembers(groupId: string) {
  try {
    const supabase = await createClient()

    const { data: members, error } = await supabase
      .from('user_group_memberships')
      .select(`
        id, user_id, role_in_group, is_active, assigned_at,
        profiles!user_group_memberships_user_id_fkey(id, email, full_name)
      `)
      .eq('group_id', groupId)
      .eq('is_active', true)
      .order('assigned_at', { ascending: false })

    if (error) {
      console.error("Error fetching group members:", error)
      return { success: false, error: error.message }
    }

    const membersWithUserInfo = members?.map(membership => ({
      ...membership,
      user: membership.profiles
    })) || []

    return { success: true, data: membersWithUserInfo }
  } catch (error) {
    console.error("Error in getGroupMembers:", error)
    return { success: false, error: "Failed to fetch group members" }
  }
}

// Get groups that a user belongs to
export async function getUserGroups(userId?: string) {
  try {
    const supabase = await createClient()
    
    // If no userId provided, use current user
    const targetUserId = userId || (await getCurrentUser()).id

    const { data: memberships, error } = await supabase
      .from('user_group_memberships')
      .select(`
        id, role_in_group, assigned_at, group_id,
        groups!user_group_memberships_group_id_fkey(id, name, description, group_type, is_active)
      `)
      .eq('user_id', targetUserId)
      .eq('is_active', true)

    if (error) {
      console.error("Error fetching user groups:", error)
      return { success: false, error: error.message }
    }

    const membershipsWithGroupInfo = memberships?.map(membership => ({
      ...membership,
      group: membership.groups
    })) || []

    // Filter out inactive groups
    const activeGroups = membershipsWithGroupInfo.filter(m => m.group?.is_active) || []

    return { success: true, data: activeGroups }
  } catch (error) {
    console.error("Error in getUserGroups:", error)
    return { success: false, error: "Failed to fetch user groups" }
  }
}

// Get all users available to add to groups (not already members)
export async function getAvailableUsersForGroup(groupId: string) {
  try {
    const supabase = await createClient()

    // First, get all users who are already members of this group
    const { data: existingMembers } = await supabase
      .from('user_group_memberships')
      .select('user_id')
      .eq('group_id', groupId)
      .eq('is_active', true)

    const existingUserIds = existingMembers?.map(m => m.user_id) || []

    // Get all users from auth.users (this might need adjustment based on your user profile setup)
    // For now, we'll get from a profiles table if it exists, or you might need to adjust this
    let query = supabase
      .from('profiles') // Assuming you have a profiles table
      .select('id, email, full_name')

    if (existingUserIds.length > 0) {
      query = query.not('id', 'in', `(${existingUserIds.join(',')})`)
    }

    const { data: availableUsers, error } = await query.order('full_name')

    if (error) {
      console.error("Error fetching available users:", error)
      return { success: false, error: error.message }
    }

    return { success: true, data: availableUsers }
  } catch (error) {
    console.error("Error in getAvailableUsersForGroup:", error)
    return { success: false, error: "Failed to fetch available users" }
  }
}

// Check if user is in a specific group
export async function isUserInGroup(userId: string, groupId: string): Promise<boolean> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('user_group_memberships')
      .select('id')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .eq('is_active', true)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error("Error checking user group membership:", error)
      return false
    }

    return !!data
  } catch (error) {
    console.error("Error in isUserInGroup:", error)
    return false
  }
}

// Get Choferes group specifically (convenience function)
export async function getChoferesGroup(): Promise<GroupResponse> {
  try {
    const supabase = await createClient()

    const { data: group, error } = await supabase
      .from('groups')
      .select('*')
      .eq('group_type', 'choferes')
      .eq('is_active', true)
      .single()

    if (error) {
      console.error("Error fetching Choferes group:", error)
      return { success: false, error: error.message }
    }

    // Get members separately
    const { data: memberships } = await supabase
      .from('user_group_memberships')
      .select(`
        id, user_id, role_in_group, is_active, assigned_at,
        profiles!user_group_memberships_user_id_fkey(id, email, full_name)
      `)
      .eq('group_id', group.id)

    const membersWithUserInfo = memberships?.map(membership => ({
      ...membership,
      user: membership.profiles
    })) || []

    const groupWithCount = {
      ...group,
      members: membersWithUserInfo,
      members_count: membersWithUserInfo.filter(m => m.is_active).length
    } as GroupWithMembers

    return { success: true, data: groupWithCount }
  } catch (error) {
    console.error("Error in getChoferesGroup:", error)
    return { success: false, error: "Failed to fetch Choferes group" }
  }
}
