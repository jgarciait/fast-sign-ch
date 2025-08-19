"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useUserRole } from "@/hooks/use-user-role"

export function ChoferRedirect() {
  const { isChofer, isLoading } = useUserRole()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Only redirect after loading is complete and user is confirmed as chofer
    if (!isLoading && isChofer && pathname !== '/mis-asignaciones') {
      console.log('🔄 CHOFER REDIRECT: Redirecting chofer to /mis-asignaciones')
      console.log('🔄 CHOFER REDIRECT: Current path:', pathname)
      console.log('🔄 CHOFER REDIRECT: isChofer:', isChofer)
      
      // Use replace to avoid adding to history stack
      router.replace('/mis-asignaciones')
    }
  }, [isChofer, isLoading, pathname, router])

  return null // This component doesn't render anything
}
