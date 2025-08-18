import type React from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import Sidebar from "@/components/sidebar"

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
    <div className="flex h-screen relative">
      <Sidebar user={user} />
      <main className="flex-1 w-full lg:w-auto overflow-auto" style={{ backgroundColor: '#F8F9FB' }}>{children}</main>
    </div>
  )
}
