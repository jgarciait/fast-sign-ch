"use client"

import type React from "react"
import { useState, useEffect } from "react"

interface SmartPDFViewerProps {
  url: string
  onError?: (error: string) => void
}

// Define the component
export const SmartPDFViewer: React.FC<SmartPDFViewerProps> = ({ url, onError }) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const loadPdf = async () => {
      try {
        console.log(`SmartPDFViewer: Loading PDF from URL: ${url}`)
        setLoading(true)

        // Test if the URL is accessible with a HEAD request first
        try {
          const headResponse = await fetch(url, { method: "HEAD" })
          if (!headResponse.ok) {
            console.error(`SmartPDFViewer: HEAD request failed with status ${headResponse.status}`)
            if (mounted) {
              setError(`Failed to access PDF (status ${headResponse.status})`)
              setLoading(false)
              if (onError) onError(`Failed to access PDF (status ${headResponse.status})`)
            }
            return
          }
        } catch (headError) {
          console.error("SmartPDFViewer: HEAD request error:", headError)
          // Continue anyway, as some servers might not support HEAD
        }

        // Proceed with the actual PDF fetch
        const response = await fetch(url)

        if (!response.ok) {
          console.error(`SmartPDFViewer: Fetch failed with status ${response.status}`)
          if (mounted) {
            setError(`Failed to load PDF (status ${response.status})`)
            setLoading(false)
            if (onError) onError(`Failed to load PDF (status ${response.status})`)
          }
          return
        }

        const contentType = response.headers.get("content-type")
        if (contentType && !contentType.includes("application/pdf")) {
          console.error(`SmartPDFViewer: Unexpected content type: ${contentType}`)
          if (mounted) {
            setError(`The server returned a non-PDF file (${contentType})`)
            setLoading(false)
            if (onError) onError(`The server returned a non-PDF file (${contentType})`)
          }
          return
        }

        const blob = await response.blob()
        console.log(`SmartPDFViewer: PDF loaded successfully, size: ${blob.size} bytes`)

        if (mounted) {
          setObjectUrl(URL.createObjectURL(blob))
          setLoading(false)
        }
      } catch (error) {
        console.error("SmartPDFViewer: Error loading PDF:", error)
        if (mounted) {
          setError(error instanceof Error ? error.message : "Failed to load PDF")
          setLoading(false)
          if (onError) onError(error instanceof Error ? error.message : "Failed to load PDF")
        }
      }
    }

    loadPdf()

    return () => {
      mounted = false
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [url, onError])

  if (loading) {
    return <div>Loading PDF...</div>
  }

  if (error) {
    return <div>Error: {error}</div>
  }

  return objectUrl ? <iframe src={objectUrl} style={{ width: "100%", height: "800px" }} title="PDF Viewer" /> : null
}

// Also export as default for backward compatibility
export default SmartPDFViewer
