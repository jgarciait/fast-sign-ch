import { createClient } from "@/utils/supabase/server"
import { getUserRedirectPath } from "@/utils/user-redirect"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")

  if (code) {
    const supabase = await createClient()
    const { data } = await supabase.auth.exchangeCodeForSession(code)
    
    if (data?.user?.id) {
      // Determine redirect path based on user role
      const redirectPath = await getUserRedirectPath(data.user.id)
      return NextResponse.redirect(new URL(redirectPath, request.url))
    }
  }

  // Default fallback redirect
  return NextResponse.redirect(new URL("/fast-sign-docs", request.url))
}
