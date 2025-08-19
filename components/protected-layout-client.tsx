"use client"

import { useUserRole } from "@/hooks/use-user-role"
import { useIsMobile } from "@/hooks/use-mobile"
import Sidebar from "@/components/sidebar"
import { PageLoadingSpinner } from "@/components/ui/loading-spinner"
import { ChoferRedirect } from "@/components/chofer-redirect"

export default function ProtectedLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isChofer, isLoading: roleLoading } = useUserRole()
  const { isMobile, isLoading: mobileLoading } = useIsMobile()

  // Show loading spinner while determining user role or device type
  if (roleLoading || mobileLoading) {
    return <PageLoadingSpinner />
  }

  // For mobile choferes, don't show sidebar - full screen layout
  if (isChofer && isMobile) {
    return (
      <>
        <ChoferRedirect />
        <div className="h-screen w-full">
          {children}
        </div>
      </>
    )
  }

  // For desktop or admin users, show sidebar
  return (
    <>
      <ChoferRedirect />
      <div className="flex h-screen relative">
        {user && <Sidebar user={user} />}
        <main className="flex-1 w-full lg:w-auto overflow-auto" style={{ backgroundColor: '#F8F9FB' }}>
          {children}
        </main>
      </div>
    </>
  )
}
