"use client"

import { useState } from "react"
import { Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface PreviewDocumentButtonProps {
  documentId: string
  recipientEmail: string
}

export default function PreviewDocumentButton({ documentId, recipientEmail }: PreviewDocumentButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  // Create the same token format that's sent to customers
  const token = btoa(recipientEmail)

  // Use the exact same URL format that's sent to customers
  const getBaseUrl = () => {
    if (typeof window === "undefined") return ""

    // First check for NEXT_PUBLIC_VERCEL_URL
    if (process.env.NEXT_PUBLIC_VERCEL_URL) {
      return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    }

    // Then check for NEXT_PUBLIC_SITE_URL
    if (process.env.NEXT_PUBLIC_SITE_URL) {
      return process.env.NEXT_PUBLIC_SITE_URL
    }

    // Fall back to window.location.origin
    return window.location.origin
  }

  const baseUrl = getBaseUrl()
  // Use our proxy URL for the preview
  const previewUrl = `${baseUrl}/sign/${documentId}/signature?token=${token}`

  const handlePreview = () => {
    setIsLoading(true)
    // Open in a new tab
    window.open(previewUrl, "_blank")
    setIsLoading(false)
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handlePreview}
            disabled={isLoading}
            variant="ghost"
            size="sm"
            className="text-primary hover:text-primary/80 hover:bg-primary/10"
          >
            <Eye className="h-4 w-4 mr-1" />
            View as Customer
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>View exactly what the customer sees</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
