"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { createPublicClient } from "@/utils/supabase/public-client"
import { Logo } from "@/components/logo"
import { CheckCircle } from "lucide-react"
import EnvironmentError from "@/components/environment-error"

export default function CompletePage() {
  const router = useRouter()

  const params = useParams<{ documentId: string }>()
  const documentId = params?.documentId

  const searchParamsHook = useSearchParams()
  const token = searchParamsHook.get("token") ?? undefined

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [documentName, setDocumentName] = useState<string>("")
  const [environmentError, setEnvironmentError] = useState(false)

  useEffect(() => {
    if (!documentId) return

    // Check if environment variables are available
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setEnvironmentError(true)
      setLoading(false)
      return
    }

    const fetchDocument = async () => {
      if (!token) {
        setError("Invalid token")
        setLoading(false)
        return
      }

      try {
        // Decode the token to get the recipient email
        const email = atob(token)

        // Create a Supabase client
        const supabase = createPublicClient()

        // Get the document details
        const { data: document, error: documentError } = await supabase
          .from("documents")
          .select("*")
          .eq("id", documentId)
          .single()

        if (documentError || !document) {
          console.error("Error fetching document:", documentError)
          setError("Document not found")
          setLoading(false)
          return
        }

        setDocumentName(document.file_name)
        setLoading(false)
      } catch (err) {
        console.error("Error:", err)
        setError("An unexpected error occurred")
        setLoading(false)
      }
    }

    fetchDocument()
  }, [documentId, token])

  if (environmentError) {
    return <EnvironmentError />
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-md">
          <div className="text-center mb-6">
            <Logo className="h-12 w-12 mx-auto mb-4" color="#0d2340" />
            <h1 className="text-2xl font-bold">Error</h1>
          </div>
          <p className="text-center text-gray-600 mb-6">{error}</p>
          <div className="flex justify-center">
            <button
              onClick={() => router.push("/")}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Logo className="h-8 w-8" color="#0d2340" />
                <span className="ml-2 font-semibold">AQSign</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Document Signed Successfully!</h1>
            <p className="text-gray-600 mb-6">
              Thank you for signing "{documentName}". The document has been successfully signed and the sender has been
              notified.
            </p>
            <div className="mt-6">
              <button
                onClick={() => window.close()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-[#0d2340] hover:bg-[#1a3a5f] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-white border-t py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} AQSign. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
