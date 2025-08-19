"use client"

import { useUserRole } from "@/hooks/use-user-role"
import { useIsMobile } from "@/hooks/use-mobile"
import { PageLoadingSpinner } from "@/components/ui/loading-spinner"

interface UserRoleAwarePageProps {
  choferComponent: React.ReactNode
  adminComponent: React.ReactNode
  mobileChoferComponent?: React.ReactNode
  loadingComponent?: React.ReactNode
}

export function UserRoleAwarePage({ 
  choferComponent, 
  adminComponent, 
  mobileChoferComponent,
  loadingComponent 
}: UserRoleAwarePageProps) {
  const { isChofer, isLoading: roleLoading } = useUserRole()
  const { isMobile, isLoading: mobileLoading } = useIsMobile()

  // Show loading spinner while determining user role or device type
  if (roleLoading || mobileLoading) {
    return loadingComponent || <PageLoadingSpinner />
  }

  // Return appropriate component based on role and device
  if (isChofer) {
    // For choferes, show mobile version if available and on mobile device
    if (isMobile && mobileChoferComponent) {
      return <>{mobileChoferComponent}</>
    }
    return <>{choferComponent}</>
  }
  
  // For admins/managers, always show admin component
  return <>{adminComponent}</>
}
