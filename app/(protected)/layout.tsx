import type React from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { UserRoleProvider } from "@/hooks/use-user-role"
import ProtectedLayoutClient from "@/components/protected-layout-client"
import { ErrorBoundary } from "@/components/error-boundary"

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  return (
    <ErrorBoundary>
      <UserRoleProvider initialUser={user}>
        <ProtectedLayoutClient>{children}</ProtectedLayoutClient>
      </UserRoleProvider>
    </ErrorBoundary>
  )
}
