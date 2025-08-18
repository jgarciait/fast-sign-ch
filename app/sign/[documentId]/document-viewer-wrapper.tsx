"use client"

import { useState, useEffect } from "react"
import { SmartPDFViewer } from "@/components/smart-pdf-viewer"
import SimplePdfViewer, { type SimpleAnnotation } from "@/components/simple-pdf-viewer"
import SignDocumentViewer from "@/components/sign-document-viewer"
import { Logo } from "@/components/logo"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import SignWithMappingViewer from "@/components/sign-with-mapping-viewer"


// Configure PDF.js worker BEFORE any PDF operations - critical for non-authenticated users
import { pdfjs } from "react-pdf"

// Import both local and Vercel configurations
import PDF_CONFIG, { configurePdfWorker } from '@/utils/pdf-config-centralized'
import { configureVercelPdfWorker } from '@/utils/pdf-config-vercel'

// Configure PDF.js worker using environment-appropriate config
// Use simpler detection to avoid build-time issues
if (typeof window !== 'undefined') {
  // Client-side configuration
  if (window.location.hostname.includes('vercel.app') || process.env.NODE_ENV === 'production') {
    // Use Vercel-optimized configuration for production
    configureVercelPdfWorker()
  } else {
    // Use standard configuration for development
    configurePdfWorker()
  }
}

export default function DocumentViewWrapper({
  documentUrl,
  documentName,
  documentId,
  token,
  recipientEmail,
}: {
  documentUrl: string
  documentName: string
  documentId: string
  token: string
  recipientEmail: string
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSigningMode, setIsSigningMode] = useState(true) // Start in signing mode by default
  const [initialAnnotations, setInitialAnnotations] = useState<SimpleAnnotation[]>([])
  const [documentStatus, setDocumentStatus] = useState<string | null>(null)
  const [signatureMapping, setSignatureMapping] = useState<any>(null)


  const { toast } = useToast()
  const router = useRouter()

  // Use the proxy URL instead of the direct Supabase URL
  const proxyUrl = `/api/pdf/${documentId}`



  // Load signature mapping
  const loadSignatureMapping = async () => {
    try {
      const url = `/api/documents/${documentId}/signature-mapping?token=${encodeURIComponent(token)}`
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        if (data.mapping) {
          setSignatureMapping(data.mapping)
        }
      }
    } catch (error) {
      console.error("Error loading signature mapping:", error)
      // Don't fail loading if mapping load fails
    }
  }

  // Check document status
  const checkDocumentStatus = async () => {
    try {
      const response = await fetch(`/api/document-status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId: documentId,
          token: token
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setDocumentStatus(data.status)
      }
    } catch (error) {
      console.error("Error checking document status:", error)
      // Don't fail loading if status check fails
    }
  }

  // Handle manual save (for Save button - now just saves text annotations)
  const handleSaveAnnotations = async (annotations: SimpleAnnotation[]) => {
    try {
      // Separate signatures from text annotations
      const signatures = annotations.filter(ann => ann.type === 'signature')
      const textAnnotations = annotations.filter(ann => ann.type !== 'signature')

      // Save signatures to document_signatures table
      // First, clear existing signatures for this document and recipient
      try {
        await fetch(`/api/documents/${documentId}/signature`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: token,
            clearAll: true
          }),
        })
      } catch (clearError) {
        console.warn("Failed to clear existing signatures, continuing anyway")
      }

      // Save each signature individually
      for (const signature of signatures) {
        // CRITICAL: Use actual PDF page dimensions, not hardcoded values
        // Get actual page dimensions from the signature's source pageInfo
        let actualPageWidth = 612  // US Letter Portrait width (correct)
        let actualPageHeight = 792 // US Letter Portrait height (correct)
        
        // If signature has source dimension info, use those (from enhanced PDF detection)
        if (signature.sourcePageDimensions) {
          actualPageWidth = signature.sourcePageDimensions.width
          actualPageHeight = signature.sourcePageDimensions.height
          console.log(`🔧 Using actual PDF dimensions for signature save: ${actualPageWidth}x${actualPageHeight}`)
        } else {
          console.warn(`⚠️ No source dimensions found for signature, using US Letter Portrait fallback: ${actualPageWidth}x${actualPageHeight}`)
        }
        
        // Calculate relative dimensions using ACTUAL page dimensions
        const relativeWidth = signature.relativeWidth || (signature.width / actualPageWidth)
        const relativeHeight = signature.relativeHeight || (signature.height / actualPageHeight)
        
        console.log(`💾 Saving signature with corrected dimensions:`, {
          signature: signature.id,
          actualPageDimensions: { width: actualPageWidth, height: actualPageHeight },
          signatureDimensions: { width: signature.width, height: signature.height },
          relativeDimensions: { width: relativeWidth, height: relativeHeight },
          note: 'Using correct PDF dimensions for accurate positioning'
        })
        
        const signatureResponse = await fetch(`/api/documents/${documentId}/signature`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            signatureDataUrl: signature.imageData,
            signatureSource: signature.signatureSource || 'canvas',
            token: token,
            position: {
              x: signature.x,
              y: signature.y,
              width: signature.width,
              height: signature.height,
              page: signature.page,
              relativeX: signature.relativeX,
              relativeY: signature.relativeY,
              relativeWidth: relativeWidth,
              relativeHeight: relativeHeight
            }
          }),
        })

        if (!signatureResponse.ok) {
          throw new Error("Failed to save signature")
        }
      }

      // Save text annotations to document_annotations table (excluding signatures)
      const annotationResponse = await fetch(`/api/annotations/${documentId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          annotations: textAnnotations, // Only text annotations, no signatures
          token: token
        }),
      })

      if (!annotationResponse.ok) {
        throw new Error("Failed to save annotations")
      }
      
    } catch (error) {
      console.error("Error saving annotations:", error)
      toast({
        title: "Failed to save",
        description: "We couldn't save the document. Please try again.",
        duration: 5000,
      })
    }
  }

  // Handle sending document
  const handleSendDocument = async (annotations: SimpleAnnotation[]) => {
    // Check if document is already sent
    if (documentStatus === "returned" || documentStatus === "RETURNED") {
      toast({
        title: "Document already sent",
        description: "This document has already been completed and sent.",
        duration: 5000,
      })
      return
    }

    try {
      // Check if signatures exist in the database (not just in memory)
      const response = await fetch(`/api/documents/${documentId}/signatures/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: token
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to check signature status")
      }

      const { hasSignatures } = await response.json()
      
      if (!hasSignatures) {
        toast({
          title: "Add a signature",
          description: "You need at least one signature before sending.",
          duration: 5000,
        })
        return
      }

      // Send the document (signatures are already saved)
      const sendResponse = await fetch(`/api/documents/${documentId}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: token
        }),
      })

      if (!sendResponse.ok) {
        const errorData = await sendResponse.json()
        throw new Error(errorData.error || "Failed to send document")
      }

      setIsSigningMode(false)
      setDocumentStatus("returned")
      
      // Redirect to completion page
      window.location.href = '/sign-complete'
      
    } catch (error) {
      console.error("Error sending document:", error)
      toast({
        title: "Failed to send",
        description: error instanceof Error ? error.message : "Unknown error",
        duration: 5000,
      })
    }
  }

  // Load existing annotations and signatures
  const loadExistingAnnotations = async () => {
    try {
      let allAnnotations: SimpleAnnotation[] = []

      // First, clean up any signatures that might be in the document_annotations table
      try {
        await fetch('/api/cleanup-signatures', {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            documentId: documentId,
            token: token
          }),
        })
      } catch (cleanupError) {
        console.warn("Cleanup failed, continuing anyway:", cleanupError)
      }

      // Load text annotations from document_annotations table (excluding signatures)
      const annotationResponse = await fetch(
        `/api/annotations/${documentId}?email=${encodeURIComponent(recipientEmail)}`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        },
      )
      
      if (annotationResponse.ok) {
        const annotationData = await annotationResponse.json()
        const textAnnotations = (annotationData.annotations || []).filter((ann: any) => ann.type !== 'signature')
        allAnnotations = [...allAnnotations, ...textAnnotations]
      }

      // Load signatures ONLY from document_signatures table
      const signatureResponse = await fetch(`/api/documents/${documentId}/signatures/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: token,
          includeData: true // Request to include signature data
        }),
      })

      if (signatureResponse.ok) {
        const signatureData = await signatureResponse.json()
        
        if (signatureData.signatures && signatureData.signatures.length > 0) {
          // Convert signatures to annotation format
          const signatureAnnotations: SimpleAnnotation[] = []
          
          signatureData.signatures.forEach((sigRecord: any) => {
            // Handle both old format (direct signature_data) and new format (signatures array)
            if (sigRecord.signature_data?.signatures) {
              // New format: signatures array
              const signatures = sigRecord.signature_data.signatures
              signatures.forEach((sig: any) => {
                signatureAnnotations.push({
                  id: sig.id,
                  type: 'signature' as const,
                  x: sig.x || 100, // Use direct x coordinate
                  y: sig.y || 100, // Use direct y coordinate
                  width: sig.width || 300,
                  height: sig.height || 150,
                  page: sig.page || 1,
                  relativeX: sig.relativeX || 0.15,
                  relativeY: sig.relativeY || 0.15,
                  relativeWidth: sig.relativeWidth || 0.49,
                  relativeHeight: sig.relativeHeight || 0.19,
                  imageData: sig.dataUrl || '',
                  signatureSource: sig.source || 'canvas',
                  timestamp: sig.timestamp || new Date().toISOString(),
                  content: sig.content // Include content field for signature indexing
                })
              })
            } else if (sigRecord.signature_data?.dataUrl) {
              // Old format: direct signature data
              // Use relative coordinates if available, fallback to absolute coordinates
              const relativeX = sigRecord.signature_data.position?.relativeX
              const relativeY = sigRecord.signature_data.position?.relativeY
              const relativeWidth = sigRecord.signature_data.position?.relativeWidth
              const relativeHeight = sigRecord.signature_data.position?.relativeHeight
              
              signatureAnnotations.push({
                id: sigRecord.id,
                type: 'signature' as const,
                x: sigRecord.signature_data.position?.x || 100, // Will be recalculated from relative coordinates
                y: sigRecord.signature_data.position?.y || 100, // Will be recalculated from relative coordinates
                width: sigRecord.signature_data.position?.width || 300,
                height: sigRecord.signature_data.position?.height || 150,
                page: sigRecord.signature_data.position?.page || 1,
                relativeX: relativeX || 0.15,
                relativeY: relativeY || 0.15,
                relativeWidth: relativeWidth || 0.49,
                relativeHeight: relativeHeight || 0.19,
                imageData: sigRecord.signature_data.dataUrl || '',
                signatureSource: sigRecord.signature_source || 'canvas',
                timestamp: sigRecord.signature_data.timestamp || sigRecord.signed_at || new Date().toISOString()
              })
            }
          })
          
          allAnnotations = [...allAnnotations, ...signatureAnnotations]
        }
      }

      setInitialAnnotations(allAnnotations)
      
    } catch (error) {
      console.error("Error loading existing annotations:", error)
      // Don't fail loading if annotations can't be loaded
    }
  }

  useEffect(() => {
    const initializeDocument = async () => {
      console.log("Starting document initialization...")
      
      // Set a timeout to prevent hanging indefinitely
      const timeoutId = setTimeout(() => {
        console.warn("Document initialization timed out after 10 seconds, proceeding anyway")
        setLoading(false)
      }, 10000) // 10 second timeout
      
      try {
        await loadExistingAnnotations()
        await checkDocumentStatus()
        await loadSignatureMapping()
        clearTimeout(timeoutId)
        setLoading(false)
      } catch (error) {
        console.error("Error during initialization:", error)
        clearTimeout(timeoutId)
        setLoading(false) // Still set loading to false even if there's an error
      }
    }

    initializeDocument()
  }, [documentId, token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Logo className="h-12 w-12 mx-auto mb-4" color="#0d2340" />
          <h1 className="text-2xl font-bold mb-4">Loading Document</h1>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-md">
          <div className="text-center mb-6">
            <Logo className="h-12 w-12 mx-auto mb-4" color="#0d2340" />
            <h1 className="text-2xl font-bold">Error Loading Document</h1>
          </div>
          <p className="text-center text-gray-600 mb-6">{error}</p>
          <div className="flex justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  const handleSignClick = () => {
    router.push(`/sign/${documentId}/signature?token=${token}`)
  }

  const handleMappingComplete = () => {
    // Redirect to completion page
    window.location.href = '/sign-complete'
  }

  const hasSignatureMapping = signatureMapping && signatureMapping.signature_fields && signatureMapping.signature_fields.length > 0

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 overflow-hidden">
        <div className="h-full">
          {hasSignatureMapping ? (
            <SignWithMappingViewer
              documentId={documentId}
              documentName={documentName}
              documentUrl={proxyUrl}
              signatureFields={signatureMapping.signature_fields}
              token={token}
              onComplete={handleMappingComplete}
            />
          ) : (
            <SignDocumentViewer
              documentId={documentId}
              documentName={documentName}
              token={token}
              onSign={documentStatus === "returned" || documentStatus === "RETURNED" ? undefined : handleSignClick}
              showSignButton={documentStatus !== "returned" && documentStatus !== "RETURNED"}
            />
          )}
        </div>
      </main>

    </div>
  )
}
