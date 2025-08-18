"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface CopyLinkButtonProps {
  documentId: string
  recipientEmail: string
}

export default function CopyLinkButton({ documentId, recipientEmail }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false)

  // Create the same token format that's sent to customers
  const token = btoa(recipientEmail)

  // Get the base URL for the production environment
  // First check for VERCEL_URL (production), then NEXT_PUBLIC_VERCEL_URL, then fall back to window.location.origin
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
  // Update the URL generation to use the new direct view route
  const fullUrl = `${baseUrl}/view/${documentId}?token=${token}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleCopy}
            variant="ghost"
            size="sm"
            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
          >
            {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
            {copied ? "¡Copiado!" : "Copiar Enlace"}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{copied ? "¡Copiado al portapapeles!" : "Copiar enlace de firma al portapapeles"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
