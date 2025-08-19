import { createClient } from "@/utils/supabase/server"

/**
 * Determines the correct redirect path for a user based on their role
 * @param userId - The user's ID
 * @returns The path to redirect to
 */
export async function getUserRedirectPath(userId: string): Promise<string> {
  try {
    const supabase = await createClient()
    
    // Get the choferes group ID
    const { data: choferesGroup } = await supabase
      .from('groups')
      .select('id')
      .eq('group_type', 'choferes')
      .eq('is_active', true)
      .maybeSingle()

    if (!choferesGroup) {
      // No choferes group found, redirect to default
      return '/fast-sign-docs'
    }

    // Check if user is a member of the choferes group
    const { data: membership } = await supabase
      .from('user_group_memberships')
      .select('id')
      .eq('user_id', userId)
      .eq('group_id', choferesGroup.id)
      .eq('is_active', true)
      .maybeSingle()

    // If user is a chofer, redirect to mis-asignaciones
    if (membership) {
      return '/mis-asignaciones'
    }

    // Default redirect for non-chofer users
    return '/fast-sign-docs'
  } catch (error) {
    console.error('Error determining user redirect path:', error)
    // Fallback to default on error
    return '/fast-sign-docs'
  }
}

/**
 * Client-side version that determines redirect path based on role
 * @param isChofer - Whether the user is a chofer
 * @returns The path to redirect to
 */
export function getClientRedirectPath(isChofer: boolean | null): string {
  if (isChofer === true) {
    return '/mis-asignaciones'
  }
  return '/fast-sign-docs'
}
