"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { createPublicClient } from "@/utils/supabase/public-client"
import { Logo } from "@/components/logo"
import EnhancedPdfViewer from "@/components/enhanced-pdf-viewer"
import EnvironmentError from "@/components/environment-error"

export default function ViewDocumentPage() {
  const router = useRouter()

  // Access route params & query in client components safely
  const params = useParams<{ documentId: string }>()
  const documentId = params?.documentId

  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? undefined

  const [documentName, setDocumentName] = useState<string>("")
  const [recipientEmail, setRecipientEmail] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [environmentError, setEnvironmentError] = useState(false)

  // Use our proxy URL instead of the direct Supabase URL
  const proxyUrl = `/api/pdf/${documentId}`

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
        setRecipientEmail(email)

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

        // Get the request details
        const { data: request, error: requestError } = await supabase
          .from("requests")
          .select("*, customer:customer_id(email)")
          .eq("document_id", documentId)
          .single()

        if (requestError || !request) {
          console.error("Error fetching request:", requestError)
          setError("Request not found")
          setLoading(false)
          return
        }

        // Verify that the token matches the recipient
        if (request.customer.email !== email) {
          setError("Unauthorized")
          setLoading(false)
          return
        }

        setDocumentName(document.file_name)
        setLoading(false)

        // Update document status to "received" when the document is viewed
        try {
          const response = await fetch(
            `/api/document-status?id=${documentId}&status=received&email=${encodeURIComponent(email)}`,
            {
              method: "POST",
            },
          )
          if (!response.ok) {
            console.error("Failed to update document status")
          }
        } catch (err) {
          console.error("Error updating document status:", err)
        }
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

  const handleBack = () => {
    router.push(`/sign/${documentId}?token=${token}`)
  }

  const handleSignClick = () => {
    router.push(`/sign/${documentId}/signature?token=${token}`)
  }

  return (
    <div className="flex flex-col h-screen">
      <EnhancedPdfViewer
        documentUrl={proxyUrl}
        documentName={documentName}
        onSign={handleSignClick}
        onBack={handleBack}
        showSignButton={true}
        showBackButton={true}
      />
    </div>
  )
}
