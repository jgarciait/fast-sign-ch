"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import type {
  ChoferProfile,
  ChoferWithProfile,
  CreateChoferProfileRequest,
  UpdateChoferProfileRequest,
  CreateChoferDocumentRequest,
  CreateChoferAvailabilityRequest,
  ChoferResponse,
  ChoferesResponse,
  ChoferFilters,
  ChoferPaginationParams,
  AvailableUser
} from "@/types/chofer-types"

// Get current user
async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    throw new Error("Not authenticated")
  }
  
  return user
}

// Get all choferes with their profile information
export async function getChoferes(
  filters: ChoferFilters = {},
  pagination: ChoferPaginationParams = {}
): Promise<ChoferesResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()
    
    // First get the choferes group ID
    const { data: choferesGroup } = await supabase
      .from('groups')
      .select('id')
      .eq('group_type', 'choferes')
      .eq('is_active', true)
      .single()

    if (!choferesGroup) {
      return { success: false, error: "Choferes group not found" }
    }
    
    // Get user IDs who are active members of the choferes group
    const { data: groupMembers } = await supabase
      .from('user_group_memberships')
      .select('user_id, role_in_group, assigned_at, assigned_by')
      .eq('group_id', choferesGroup.id)
      .eq('is_active', true)

    if (!groupMembers || groupMembers.length === 0) {
      return { success: true, data: [], total: 0 }
    }

    const choferUserIds = groupMembers.map(m => m.user_id)
    
    // Build query for chofer profiles with explicit ID selection
    let query = supabase
      .from('chofer_profiles')
      .select(`
        id,
        user_id,
        first_name,
        last_name,
        phone,
        email,
        emergency_contact_name,
        emergency_contact_phone,
        employee_id,
        license_number,
        license_expiry,
        hire_date,
        truck_plate,
        truck_brand,
        truck_model,
        truck_year,
        truck_color,
        truck_capacity_kg,
        truck_type,
        status,
        is_available,
        address,
        city,
        state,
        postal_code,
        country,
        notes,
        created_at,
        updated_at,
        created_by,
        updated_by,
        profiles!chofer_profiles_user_id_fkey(id, email, first_name, last_name),
        documents:chofer_documents(count)
      `, { count: 'exact' })
      .in('user_id', choferUserIds)
    
    // Apply filters
    if (filters.status && filters.status.length > 0) {
      query = query.in('status', filters.status)
    }
    
    if (filters.truck_type && filters.truck_type.length > 0) {
      query = query.in('truck_type', filters.truck_type)
    }
    
    if (filters.is_available !== undefined) {
      query = query.eq('is_available', filters.is_available)
    }
    
    if (filters.city) {
      query = query.ilike('city', `%${filters.city}%`)
    }
    
    // Search filter (name, email, employee_id, truck_plate)
    if (filters.search) {
      const searchTerm = `%${filters.search.toLowerCase()}%`
      query = query.or(`
        first_name.ilike.${searchTerm},
        last_name.ilike.${searchTerm},
        email.ilike.${searchTerm},
        employee_id.ilike.${searchTerm},
        truck_plate.ilike.${searchTerm}
      `)
    }
    
    // Apply pagination and sorting
    const page = pagination.page || 1
    const limit = pagination.limit || 20
    const offset = (page - 1) * limit
    
    const sortBy = pagination.sort_by || 'created_at'
    const sortOrder = pagination.sort_order || 'desc'
    
    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1)

    const { data: choferes, error, count } = await query

    if (error) {
      console.error("Error fetching choferes:", error)
      return { success: false, error: error.message }
    }

    // Check if any choferes have missing IDs
    const missingIdCount = choferes?.filter(c => !c.id).length || 0
    if (missingIdCount > 0) {
      console.log('🔧 getChoferes: Found', missingIdCount, 'choferes with missing IDs')
    }
    
    // Ensure all choferes have valid IDs - create missing profiles if needed
    if (choferes) {
      for (let i = 0; i < choferes.length; i++) {
        if (!choferes[i].id && choferes[i].user_id) {
          console.log('🔧 getChoferes: Chofer missing ID, attempting to create profile for user:', choferes[i].user_id)
          try {
            const { error: createError } = await supabase.rpc('ensure_chofer_profile_with_fallback', {
              target_user_id: choferes[i].user_id,
              creator_id: user.id
            })
            
            if (!createError) {
              // Re-fetch this specific chofer to get the ID
              const { data: refetchedChofer } = await supabase
                .from('chofer_profiles')
                .select('id, *')
                .eq('user_id', choferes[i].user_id)
                .single()
              
              if (refetchedChofer?.id) {
                console.log('🔧 getChoferes: Successfully created profile with ID:', refetchedChofer.id)
                choferes[i] = { ...choferes[i], id: refetchedChofer.id }
              }
            }
          } catch (error) {
            console.error('🔧 getChoferes: Failed to create chofer profile:', error)
          }
        }
      }
    }

    // Create a map of group membership data for easy lookup
    const membershipMap = new Map()
    groupMembers.forEach(member => {
      membershipMap.set(member.user_id, member)
    })

    // Transform data to include computed fields
    const choferesWithProfile = choferes?.map(chofer => {
      const membership = membershipMap.get(chofer.user_id)
      const result = {
        ...chofer,
        full_name: `${chofer.first_name || ''} ${chofer.last_name || ''}`.trim(),
        auth_email: chofer.profiles?.email,
        auth_first_name: chofer.profiles?.first_name,
        auth_last_name: chofer.profiles?.last_name,
        documents_count: chofer.documents?.[0]?.count || 0,
        expired_documents_count: 0, // Will be calculated when needed
        role_in_group: membership?.role_in_group,
        assigned_at: membership?.assigned_at,
        assigned_by: membership?.assigned_by,
      }
      
      // Warn if ID is still missing after processing
      if (!result.id) {
        console.warn('⚠️ getChoferes: Profile still missing ID:', { user_id: result.user_id, email: result.email })
      }
      
      return result
    }) as ChoferWithProfile[]

    return { 
      success: true, 
      data: choferesWithProfile, 
      total: count || 0 
    }
  } catch (error) {
    console.error("Error in getChoferes:", error)
    return { success: false, error: "Failed to fetch choferes" }
  }
}

// Get single chofer with full details
export async function getChofer(profileId: string): Promise<ChoferResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    const { data: chofer, error } = await supabase
      .from('chofer_profiles')
      .select(`
        *,
        profiles!chofer_profiles_user_id_fkey(id, email, first_name, last_name),
        documents:chofer_documents(
          id, document_name, document_type, expiry_date, 
          status, created_at
        ),
        availability:chofer_availability(
          id, date, start_time, end_time, availability_type, reason
        )
      `)
      .eq('id', profileId)
      .single()

    if (error) {
      console.error("Error fetching chofer:", error)
      return { success: false, error: error.message }
    }

    // Get group membership data separately
    let { data: membership } = await supabase
      .from('user_group_memberships')
      .select('role_in_group, assigned_at, assigned_by, group_id')
      .eq('user_id', chofer.user_id)
      .eq('is_active', true)
      .single()

    // Verify it's a choferes group membership
    if (membership) {
      const { data: group } = await supabase
        .from('groups')
        .select('group_type')
        .eq('id', membership.group_id)
        .eq('group_type', 'choferes')
        .single()
      
      if (!group) {
        // Not a choferes group membership, ignore it
        membership = null
      }
    }

    // Calculate expired documents count
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
    const expiredDocuments = chofer.documents?.filter(d => 
      d.expiry_date && d.expiry_date < today
    ) || []

    const choferWithProfile = {
      ...chofer,
      full_name: `${chofer.first_name || ''} ${chofer.last_name || ''}`.trim(),
      auth_email: chofer.profiles?.email,
      auth_first_name: chofer.profiles?.first_name,
      auth_last_name: chofer.profiles?.last_name,
      documents_count: chofer.documents?.length || 0,
      expired_documents_count: expiredDocuments.length,
      role_in_group: membership?.role_in_group,
      assigned_at: membership?.assigned_at,
      assigned_by: membership?.assigned_by,
    } as ChoferWithProfile

    return { success: true, data: choferWithProfile }
  } catch (error) {
    console.error("Error in getChofer:", error)
    return { success: false, error: "Failed to fetch chofer" }
  }
}

// Get chofer by user ID
export async function getChoferByUserId(userId: string): Promise<ChoferResponse> {
  try {
    const supabase = await createClient()
    
    const { data: chofer, error } = await supabase
      .from('chofer_profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error("Error fetching chofer by user ID:", error)
      return { success: false, error: error.message }
    }

    return { success: true, data: chofer as ChoferWithProfile }
  } catch (error) {
    console.error("Error in getChoferByUserId:", error)
    return { success: false, error: "Failed to fetch chofer" }
  }
}

// Create chofer profile (called when user is added to choferes group)
export async function createChoferProfile(data: CreateChoferProfileRequest): Promise<ChoferResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    // First, ensure the profile exists by calling the SQL function
    const { error: fallbackError } = await supabase
      .rpc('ensure_chofer_profile_with_fallback', {
        target_user_id: data.user_id,
        creator_id: user.id
      })

    if (fallbackError) {
      console.error("Error ensuring chofer profile exists:", fallbackError)
      // Continue anyway, maybe the profile exists
    }

    const { data: profile, error } = await supabase
      .from('chofer_profiles')
      .insert([{
        ...data,
        country: data.country || 'República Dominicana',
        created_by: user.id,
        updated_by: user.id
      }])
      .select()
      .single()

    if (error) {
      console.error("Error creating chofer profile:", error)
      return { success: false, error: error.message }
    }

    revalidatePath('/choferes')
    return { success: true, data: profile as ChoferWithProfile }
  } catch (error) {
    console.error("Error in createChoferProfile:", error)
    return { success: false, error: "Failed to create chofer profile" }
  }
}

// Update chofer profile
export async function updateChoferProfile(
  profileId: string,
  data: UpdateChoferProfileRequest
): Promise<ChoferResponse> {
  try {
    console.log('🔧 updateChoferProfile called for profile:', profileId)
    
    const supabase = await createClient()
    const user = await getCurrentUser()

    // Clean data: convert empty strings to undefined and filter out undefined values
    const cleanData = Object.fromEntries(
      Object.entries(data)
        .map(([key, value]) => [key, value === '' ? undefined : value])
        .filter(([_, value]) => value !== undefined)
    )

    const updateData = {
      ...cleanData,
      updated_by: user.id,
      updated_at: new Date().toISOString()
    }

    const { data: profile, error } = await supabase
      .from('chofer_profiles')
      .update(updateData)
      .eq('id', profileId)
      .select()
      .single()

    if (error) {
      console.error("❌ Error updating chofer profile:", error)
      console.error("❌ Error details:", { 
        message: error.message, 
        details: error.details, 
        hint: error.hint,
        code: error.code
      })
      return { success: false, error: error.message }
    }

    console.log('✅ Profile updated successfully:', profile)

    revalidatePath('/choferes')
    revalidatePath(`/choferes/${profileId}`)
    return { success: true, data: profile as ChoferWithProfile }
  } catch (error) {
    console.error("❌ Error in updateChoferProfile:", error)
    return { success: false, error: "Failed to update chofer profile" }
  }
}

// Delete chofer profile (soft delete by removing from group)
export async function deleteChoferProfile(profileId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    // Get the user_id from the profile
    const { data: profile } = await supabase
      .from('chofer_profiles')
      .select('user_id')
      .eq('id', profileId)
      .single()

    if (!profile) {
      return { success: false, error: "Chofer profile not found" }
    }

    // Get choferes group ID first
    const { data: choferesGroup } = await supabase
      .from('groups')
      .select('id')
      .eq('group_type', 'choferes')
      .eq('is_active', true)
      .single()

    if (!choferesGroup) {
      return { success: false, error: "Choferes group not found" }
    }

    // Remove from choferes group (soft delete)
    const { error: groupError } = await supabase
      .from('user_group_memberships')
      .update({ is_active: false })
      .eq('user_id', profile.user_id)
      .eq('group_id', choferesGroup.id)

    if (groupError) {
      console.error("Error removing chofer from group:", groupError)
      return { success: false, error: groupError.message }
    }

    // Update profile status to inactive
    const { error: profileError } = await supabase
      .from('chofer_profiles')
      .update({ 
        status: 'inactive',
        is_available: false,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', profileId)

    if (profileError) {
      console.error("Error updating chofer profile status:", profileError)
      return { success: false, error: profileError.message }
    }

    revalidatePath('/choferes')
    return { success: true }
  } catch (error) {
    console.error("Error in deleteChoferProfile:", error)
    return { success: false, error: "Failed to delete chofer" }
  }
}

// Add document to chofer
export async function addChoferDocument(data: CreateChoferDocumentRequest) {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    const { data: document, error } = await supabase
      .from('chofer_documents')
      .insert([{
        ...data,
        uploaded_by: user.id
      }])
      .select()
      .single()

    if (error) {
      console.error("Error adding chofer document:", error)
      return { success: false, error: error.message }
    }

    revalidatePath('/choferes')
    return { success: true, data: document }
  } catch (error) {
    console.error("Error in addChoferDocument:", error)
    return { success: false, error: "Failed to add document" }
  }
}

// Set chofer availability
export async function setChoferAvailability(data: CreateChoferAvailabilityRequest) {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    const { data: availability, error } = await supabase
      .from('chofer_availability')
      .upsert([{
        ...data,
        created_by: user.id
      }], { onConflict: 'chofer_profile_id,date' })
      .select()
      .single()

    if (error) {
      console.error("Error setting chofer availability:", error)
      return { success: false, error: error.message }
    }

    revalidatePath('/choferes')
    return { success: true, data: availability }
  } catch (error) {
    console.error("Error in setChoferAvailability:", error)
    return { success: false, error: "Failed to set availability" }
  }
}

// Get users available to add as choferes
export async function getAvailableUsersForChoferes(): Promise<{ success: boolean; data?: AvailableUser[]; error?: string }> {
  try {
    const supabase = await createClient()

    // First get the choferes group ID
    const { data: choferesGroup } = await supabase
      .from('groups')
      .select('id')
      .eq('group_type', 'choferes')
      .eq('is_active', true)
      .single()

    if (!choferesGroup) {
      return { success: false, error: "Choferes group not found" }
    }

    // Get all existing chofer user IDs
    const { data: existingChoferes } = await supabase
      .from('user_group_memberships')
      .select('user_id')
      .eq('group_id', choferesGroup.id)
      .eq('is_active', true)

    const existingChoferIds = existingChoferes?.map(c => c.user_id) || []

    // Get all users from auth.users (has complete user information including created_at)
    // Note: auth.users is in private schema, need to use rpc function
    const { data: authUsers, error } = await supabase
      .rpc('get_all_users_for_chofer_assignment')

    if (error) {
      console.error("Error fetching available users:", error)
      return { success: false, error: error.message }
    }

    // Filter out existing choferes and transform data
    const availableUsers = authUsers
      ?.filter(user => !existingChoferIds.includes(user.id))
      ?.map(user => {
        // Extract names from user metadata or email
        const firstName = user.raw_user_meta_data?.first_name || ''
        const lastName = user.raw_user_meta_data?.last_name || ''
        const fullName = `${firstName} ${lastName}`.trim() || null
        
        return {
          id: user.id,
          email: user.email,
          first_name: firstName,
          last_name: lastName,
          full_name: fullName,
          created_at: user.created_at,
          is_chofer: false,
          chofer_profile: undefined
        }
      }) || []

    return { success: true, data: availableUsers }
  } catch (error) {
    console.error("Error in getAvailableUsersForChoferes:", error)
    return { success: false, error: "Failed to fetch available users" }
  }
}

// Get choferes for dropdown/selector (active only)
export async function getActiveChoferes(): Promise<ChoferesResponse> {
  return await getChoferes(
    { status: ['active'], is_available: true },
    { limit: 100, sort_by: 'first_name', sort_order: 'asc' }
  )
}

// Toggle chofer availability
export async function toggleChoferAvailability(profileId: string): Promise<ChoferResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    // Get current availability status
    const { data: current, error: fetchError } = await supabase
      .from('chofer_profiles')
      .select('is_available')
      .eq('id', profileId)
      .single()

    if (fetchError) {
      return { success: false, error: fetchError.message }
    }

    // Toggle availability
    const { data: updated, error: updateError } = await supabase
      .from('chofer_profiles')
      .update({ 
        is_available: !current.is_available,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', profileId)
      .select()
      .single()

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    revalidatePath('/choferes')
    return { success: true, data: updated as ChoferWithProfile }
  } catch (error) {
    console.error("Error in toggleChoferAvailability:", error)
    return { success: false, error: "Failed to toggle availability" }
  }
}
