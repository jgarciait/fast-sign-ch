"use client"

import { useState, use } from "react"
import { useRouter } from "next/navigation"
import { X } from "lucide-react"
import SimpleSignatureCanvas from "@/components/simple-signature-canvas"
import { useToast } from "@/hooks/use-toast"

interface SignaturePageProps {
  params: Promise<{
    documentId: string
  }>
  searchParams: Promise<{
    token?: string
  }>
}

export default function SignaturePage({ params, searchParams }: SignaturePageProps) {
  const { documentId } = use(params)
  const { token } = use(searchParams)
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleSignatureComplete = async (signatureDataUrl: string) => {
    if (!signatureDataUrl) {
      return
    }

    setIsLoading(true)
    try {
      // Save the signature
      const response = await fetch(`/api/documents/${documentId}/signature`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signatureDataUrl,
          token,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to save signature")
      }

      // Redirect back to the document
      router.push(`/sign/${documentId}?token=${token}`)
    } catch (error) {
      console.error("Error saving signature:", error)
      toast({
        title: "Failed to save signature",
        description: "Please try again.",
        duration: 5000,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    router.push(`/sign/${documentId}?token=${token}`)
  }

  return (
    <>
      <SimpleSignatureCanvas 
        isOpen={true} 
        onClose={handleCancel} 
        onComplete={handleSignatureComplete} 
      />

        {isLoading && (
        <div className="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-[60]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
          </div>
        )}
    </>
  )
}
