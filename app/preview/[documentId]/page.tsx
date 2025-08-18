"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import EnhancedPdfViewer from "@/components/enhanced-pdf-viewer"
import { createPublicClient } from "@/utils/supabase/public-client"

export default function PreviewDocumentPage() {
  const router = useRouter()

  const params = useParams<{ documentId: string }>()
  const documentId = params?.documentId

  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? undefined

  const [isLoading, setIsLoading] = useState(true)
  const [documentName, setDocumentName] = useState("Document")

  // Use our proxy URL
  const documentUrl = documentId ? `/api/pdf/${documentId}` : ""

  useEffect(() => {
    const fetchDocumentName = async () => {
      if (!token) return

      try {
        const supabase = createPublicClient()
        const { data, error } = await supabase.from("documents").select("file_name").eq("id", documentId).single()

        if (data && !error) {
          setDocumentName(data.file_name)
        }
      } catch (err) {
        console.error("Error fetching document name:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDocumentName()
  }, [documentId, token])

  const handleBack = () => {
    router.back()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      <EnhancedPdfViewer
        documentUrl={documentUrl}
        documentName={documentName}
        onBack={handleBack}
        showBackButton={true}
      />
    </div>
  )
}
