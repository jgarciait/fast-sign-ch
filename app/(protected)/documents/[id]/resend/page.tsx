"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { resendDocumentNotification } from "@/app/actions/resend-document-actions"
import { Logo } from "@/components/logo"

/**
 * NOTE:
 * This page is a client component, therefore it should **not** rely on the
 * `params` prop that is usually injected into Server Components. Starting from
 * Next.js 14 the `params` prop is proxied in client components and will emit a
 * warning when accessed synchronously. The recommended way is to read the
 * dynamic route segment by using the `useParams` hook from `next/navigation`.
 */

export default function ResendDocumentPage() {
  const [isResending, setIsResending] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  // `useParams` provides access to the dynamic route segments in a safe way for
  // client components.
  const params = useParams<{ id: string }>()
  const id = params?.id

  useEffect(() => {
    if (!id) return // Wait until the param is available

    const resendDocument = async () => {
      try {
        setIsResending(true)
        setError(null)

        const result = await resendDocumentNotification(id)

        if (result.error) {
          setError(result.error)
        } else {
          setSuccess(true)
          // Redirect after a short delay
          setTimeout(() => {
            router.push(`/documents/${id}`)
          }, 2000)
        }
      } catch (err) {
        setError("An unexpected error occurred")
        console.error("Error resending document:", err)
      } finally {
        setIsResending(false)
      }
    }

    resendDocument()
  }, [id, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full p-8 bg-card rounded-lg shadow-md">
        <div className="text-center mb-6">
          <Logo className="h-12 w-12 mx-auto mb-4" color="#3857A6" />
          <h1 className="text-2xl font-bold">
            {isResending ? "Resending Document..." : success ? "Document Resent" : "Failed to Resend"}
          </h1>
        </div>

        {isResending ? (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Please wait while we resend the document notification...</p>
          </div>
        ) : error ? (
          <div className="text-center">
            <div className="bg-destructive/10 text-destructive p-4 rounded-md mb-4">{error}</div>
            <button
              onClick={() => router.push(`/documents/${id}`)}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-primary-foreground bg-primary hover:bg-primary/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
            >
              Back to Document
            </button>
          </div>
        ) : (
          <div className="text-center">
            <div className="bg-success/10 text-success p-4 rounded-md mb-4">
              The document notification has been successfully resent to the recipient.
            </div>
            <p className="text-muted-foreground mb-4">You will be redirected back to the document details page shortly.</p>
          </div>
        )}
      </div>
    </div>
  )
}
