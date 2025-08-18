import type { NextRequest } from "next/server"
import { updateSession } from "./utils/supabase/middleware"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip authentication middleware for sign routes - they use token-based validation
  if (pathname.startsWith('/sign/')) {
    return
  }

  // Update the session for all other routes
  const response = await updateSession(request)

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - pdf.worker files (PDF.js workers) - anywhere in the path
     * - static file extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*pdf\\.worker|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js|mjs)$).*)",
  ],
}
