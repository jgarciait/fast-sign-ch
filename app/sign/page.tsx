import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import Link from "next/link"
import { Logo } from "@/components/logo"

export default async function SignPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If user is authenticated, redirect to the protected fast-sign route
  if (user) {
    redirect("/fast-sign")
  }

  // If user is not authenticated and accessing /sign directly, show helpful message
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6 text-center">
        <div className="mb-6">
          <Logo className="h-16 w-16 mx-auto mb-4" color="#0d2340" />
        </div>
        
        <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Document Signing</h1>
        <p className="text-gray-600 mb-6">
          To sign a document, you need a signing link sent to your email. If you're looking to manage documents, please log in first.
        </p>
        
        <div className="space-y-3">
          <Link 
            href="/"
            className="block w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
          >
            Go to Login
          </Link>
          
          <p className="text-sm text-gray-500">
            Have a signing link? Check your email for the complete URL with the document ID and token.
          </p>
        </div>
      </div>
    </div>
  )
} 