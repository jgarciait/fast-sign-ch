"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import type { User } from "@supabase/supabase-js"

interface UserRoleContextType {
  user: User | null
  isChofer: boolean | null // null = loading, boolean = determined
  isLoading: boolean
}

const UserRoleContext = createContext<UserRoleContextType | undefined>(undefined)

export function UserRoleProvider({ 
  children, 
  initialUser 
}: { 
  children: React.ReactNode
  initialUser: User | null 
}) {
  const [user] = useState<User | null>(initialUser)
  const [isChofer, setIsChofer] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const checkUserRole = async () => {
      if (!user?.id) {
        setIsLoading(false)
        return
      }

      try {
        // First get the choferes group ID
        const { data: choferesGroup, error: groupError } = await supabase
          .from('groups')
          .select('id')
          .eq('group_type', 'choferes')
          .eq('is_active', true)
          .maybeSingle() // Use maybeSingle to handle no results gracefully

        if (groupError) {
          console.error("Error fetching choferes group:", groupError)
          setIsChofer(false)
          setIsLoading(false)
          return
        }

        if (!choferesGroup) {
          setIsChofer(false)
          setIsLoading(false)
          return
        }

        // Check if user is a member of the choferes group
        const { data: membership, error: membershipError } = await supabase
          .from('user_group_memberships')
          .select('id')
          .eq('user_id', user.id)
          .eq('group_id', choferesGroup.id)
          .eq('is_active', true)
          .maybeSingle() // Use maybeSingle to handle no results gracefully

        if (membershipError) {
          console.error("Error checking group membership:", membershipError)
          setIsChofer(false)
          setIsLoading(false)
          return
        }

        const userIsChofer = !!membership
        setIsChofer(userIsChofer)
        setIsLoading(false)

        // Handle redirect after state is set, in a separate effect or component
        // Remove automatic redirect from here to avoid conflicts
      } catch (error) {
        console.error("Error checking user role:", error)
        setIsChofer(false)
        setIsLoading(false)
      }
    }

    checkUserRole()
  }, [user?.id, supabase])

  return (
    <UserRoleContext.Provider value={{ user, isChofer, isLoading }}>
      {children}
    </UserRoleContext.Provider>
  )
}

export function useUserRole() {
  const context = useContext(UserRoleContext)
  if (context === undefined) {
    throw new Error('useUserRole must be used within a UserRoleProvider')
  }
  return context
}
