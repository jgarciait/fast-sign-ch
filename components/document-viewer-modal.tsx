"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Download, Loader2, FileText, CheckCircle, AlertCircle, ArrowRight, Edit3, PanelRightOpen, PanelRightClose, RefreshCw } from "lucide-react"
import dynamic from "next/dynamic"
import { ensureValidRelativeDimensions } from "@/utils/signature-dimensions"
import React from "react" // Added missing import for React
import { pdfjs, Document, Page } from "react-pdf"
import { getUnifiedPageDimensions } from "@/utils/pdf-dimensions"
import { initializePDFWorker, initializePDFWorkerSync, UNIFIED_PDF_OPTIONS, usePDFWorker } from "@/utils/unified-pdf-config"

// Initialize PDF.js worker with unified configuration (sync first, then async verification)
initializePDFWorkerSync()
initializePDFWorker().catch(console.error)



// Lazy load styles - solo si estamos en el cliente
const loadPdfStyles = () => {
  if (typeof window !== 'undefined') {
    // Styles will be loaded automatically by react-pdf when needed
    // Removed direct CSS imports to avoid TypeScript errors
  }
}

interface DocumentViewerModalProps {
  isOpen: boolean
  onClose: () => void
  documentId: string
  documentName: string
  token?: string
  requestId?: string
}

interface SignatureAnnotation {
  id: string
  type: 'signature'
  page: number
  imageData: string
  x?: number
  y?: number
  width?: number
  height?: number
  relativeX?: number
  relativeY?: number
  relativeWidth?: number
  relativeHeight?: number
  timestamp?: string
  signatureSource?: string
}

// View-only signature overlay component
const SignatureOverlay = React.memo(({ 
  signature, 
  pageWidth, 
  pageHeight, 
  scale 
}: { 
  signature: SignatureAnnotation
  pageWidth: number
  pageHeight: number
  scale: number
}) => {
  // Memoize position calculations to prevent accumulating scale issues
  const position = React.useMemo(() => {
    // ORIGINAL COORDINATE SYSTEM: Use direct multiplication for backward compatibility
    if (signature.relativeX !== undefined && signature.relativeY !== undefined && 
        signature.relativeWidth !== undefined && signature.relativeHeight !== undefined) {
      
      // ORIGINAL CALCULATION: Direct conversion from relative to display coordinates
      // This maintains compatibility with 200+ existing signed documents
      const finalX = signature.relativeX * pageWidth * scale
      const finalY = signature.relativeY * pageHeight * scale
      const finalWidth = signature.relativeWidth * pageWidth * scale
      const finalHeight = signature.relativeHeight * pageHeight * scale
      
      // debug suppressed
      
      return {
        x: finalX,
        y: finalY,
        width: finalWidth,
        height: finalHeight
      }
    } else {
      // NO FALLBACK: Missing relative coordinates means we can't display the signature
      console.error(`DocumentViewerModal: Signature ${signature.id} missing relative coordinates - cannot display`)
      return {
        x: 0,
        y: 0,
        width: 0,
        height: 0
      }
    }
  }, [signature.relativeX, signature.relativeY, signature.relativeWidth, signature.relativeHeight, pageWidth, pageHeight, scale])

  return (
    <div
      className="absolute border-2 border-blue-500 bg-blue-50 bg-opacity-20 pointer-events-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${position.width}px`,
        height: `${position.height}px`,
        zIndex: 10
      }}
    >
      {signature.imageData && (
        <img
          src={signature.imageData}
          alt="Signature"
          className="w-full h-full object-contain"
          style={{
            filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))'
          }}
        />
      )}
    </div>
  )
})

// Enhanced PDF page component with signature overlays
const PDFPageWithSignatures = React.memo(({
  pageNumber,
  scale,
  signatures,
  onPageLoad,
  showOverlays = true
}: {
  pageNumber: number
  scale: number
  signatures: SignatureAnnotation[]
  onPageLoad?: (pageNumber: number, width: number, height: number) => void
  showOverlays?: boolean
}) => {
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null)
  const [isPageReady, setIsPageReady] = useState(false)
  const pageRef = useRef<HTMLDivElement>(null)

  const handlePageLoadSuccess = (page: any) => {
    const { width, height } = page
    // debug suppressed
    
    // FORCE ORIGINAL PDF DIMENSIONS: Always use original PDF page dimensions for consistency
    // This ensures exact match with editor coordinate calculations
    setPageSize({ width, height })
    setIsPageReady(true) // Set ready immediately with PDF dimensions
    
    // debug suppressed
    
    if (onPageLoad) {
      onPageLoad(pageNumber, width, height)
    }
  }

  const getActualPageDimensions = () => {
    if (pageRef.current) {
      const canvas = pageRef.current.querySelector('canvas')
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        // debug suppressed
        
        // Check if canvas has actually been rendered (width/height > 0)
        if (rect.width > 0 && rect.height > 0) {
          return {
            width: rect.width,
            height: rect.height
          }
        }
      }
    }
    return null
  }

  // Add a resize observer to monitor when the canvas actually gets its size
  React.useEffect(() => {
    if (!pageRef.current) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target.tagName === 'CANVAS') {
          const { width, height } = entry.contentRect
          if (width > 0 && height > 0) {
            // debug suppressed
            // DO NOT UPDATE pageSize - keep using original PDF dimensions
            // setPageSize({ width, height }) // DISABLED for consistency
            // setIsPageReady(true) // Already set by handlePageLoadSuccess
          }
        }
      }
    })

    // Observe all canvas elements within the page
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLCanvasElement) {
            console.log(`PDFPageWithSignatures: Canvas element added, observing resize`)
            resizeObserver.observe(node)
          }
        })
      })
    })

    observer.observe(pageRef.current, { childList: true, subtree: true })

    // Also observe any existing canvas
    const existingCanvas = pageRef.current.querySelector('canvas')
    if (existingCanvas) {
       // debug suppressed
      resizeObserver.observe(existingCanvas)
    }

    return () => {
      resizeObserver.disconnect()
      observer.disconnect()
    }
  }, [pageNumber, signatures.length]) // Add signatures.length dependency

  // Reset page ready state when page number changes to prevent stale signature positions
  React.useEffect(() => {
    // debug suppressed
    setIsPageReady(false)
    setPageSize(null)
  }, [pageNumber])

  const pageSignatures = signatures.filter(sig => sig.page === pageNumber)

  // Debug logging for signature display conditions
  React.useEffect(() => {
    // debug suppressed
    
    // If we have signatures but no page size yet, and page is ready, 
    // this might indicate a timing issue
    if (pageSignatures.length > 0 && !pageSize && isPageReady) {
      console.warn(`PDFPageWithSignatures: Signatures available but no page size on page ${pageNumber} - possible timing issue`)
    }
  }, [showOverlays, pageSize, isPageReady, signatures, pageSignatures, pageNumber])

  // Force re-render when signatures change and page is ready
  React.useEffect(() => {
    if (signatures.length > 0 && pageSize && isPageReady) {
       // debug suppressed
      
      // Force immediate recalculation by triggering the same process that happens on click
      setTimeout(() => {
        const actualDimensions = getActualPageDimensions()
        if (actualDimensions && (actualDimensions.width !== pageSize.width || actualDimensions.height !== pageSize.height)) {
          // debug suppressed
          setPageSize(actualDimensions)
        }
      }, 50)
    }
  }, [signatures.length, pageSize, isPageReady, pageSignatures.length])

  return (
    <div className="relative" ref={pageRef}>
      <Page
        pageNumber={pageNumber}
        scale={scale}
        onLoadSuccess={handlePageLoadSuccess}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        loading={<PDFLoadingSkeleton />}
        onLoadError={(error) => {
          console.warn("Page load error:", error)
        }}
      />
      
      {/* Signature overlays - only show if not using merged PDF AND page is fully ready */}
      {showOverlays && pageSize && isPageReady && pageSignatures.map((signature) => {
        // debug suppressed
        
        // Only render if signature is on current page
        if (signature.page !== pageNumber) {
          console.log(`PDFPageWithSignatures: Skipping signature ${signature.id} - not on current page (${signature.page} vs ${pageNumber})`)
          return null
        }
        
        return (
          <SignatureOverlay
            key={signature.id}
            signature={signature}
            pageWidth={pageSize.width}
            pageHeight={pageSize.height}
            scale={scale}
          />
        )
      })}
    </div>
  )
})

// Signature location component (without thumbnail)
const SignatureThumbnail = ({ 
  signature, 
  index, 
  onGoToPage,
  isCurrentPage 
}: { 
  signature: SignatureAnnotation
  index: number
  onGoToPage: (page: number) => void
  isCurrentPage: boolean
}) => {
  const getSignatureSourceIcon = (source?: string) => {
    switch (source) {
      case 'wacom':
        return '🖊️'
      case 'mouse':
        return '🖱️'
      case 'touch':
        return '👆'
      default:
        return '✍️'
    }
  }

  const getSignatureSourceText = (source?: string) => {
    switch (source) {
      case 'wacom':
        return 'Tableta gráfica'
      case 'mouse':
        return 'Ratón'
      case 'touch':
        return 'Táctil'
      default:
        return 'Canvas'
    }
  }

  return (
    <div 
      className={`group flex items-center justify-between p-3 rounded-lg transition-all cursor-pointer border-2 ${
        isCurrentPage 
          ? 'bg-blue-50 border-blue-200 shadow-sm' 
          : 'bg-gray-50 border-gray-200 hover:bg-blue-50 hover:border-blue-200'
      }`}
      onClick={() => {
        // Trigger signature highlight pulse
        window.dispatchEvent(new CustomEvent('highlightSignature', {
          detail: { 
            signatureId: signature.id,
            page: signature.page,
            x: signature.x || 0,
            y: signature.y || 0,
            width: signature.width || 150,
            height: signature.height || 75
          }
        }))
        onGoToPage(signature.page)
      }}
    >
      <div className="flex items-center">
        {/* Signature info (sin thumbnail) */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">
              Firma {index + 1}
            </span>
            <span className="text-xs" title={getSignatureSourceText(signature.signatureSource)}>
              {getSignatureSourceIcon(signature.signatureSource)}
            </span>
          </div>
          <span className="text-xs text-gray-500">
            Página {signature.page}
          </span>
          {signature.timestamp && (
            <span className="text-xs text-gray-400">
              {new Date(signature.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>
      
      {/* Go to page indicator */}
      <div className={`p-1 rounded-full transition-colors ${
        isCurrentPage 
          ? 'bg-blue-100 text-blue-600' 
          : 'bg-gray-100 text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600'
      }`}>
        <ArrowRight className="h-3 w-3" />
      </div>
    </div>
  )
}

// Loading component with better visual feedback
const LoadingComponent = ({ stage }: { stage: string }) => {
  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center max-w-md">
        {/* Animated document icon */}
        <div className="relative mb-6">
          <div className="w-16 h-16 mx-auto mb-4 relative">
            <FileText className="w-16 h-16 text-blue-500" />
            <div className="absolute inset-0 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
          </div>
          
          {/* Progress dots */}
          <div className="flex justify-center space-x-2 mb-4">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
        
        {/* Loading text */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">Preparando documento</h3>
          <p className="text-sm text-gray-600">{stage}</p>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
            <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Enhanced loading skeleton for PDF pages
const PDFLoadingSkeleton = () => {
  return (
    <div className="bg-white shadow-lg rounded-lg p-8 animate-pulse">
      <div className="space-y-4">
        {/* Header lines */}
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        
        {/* Content blocks */}
        <div className="space-y-3 mt-8">
          <div className="h-3 bg-gray-200 rounded"></div>
          <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          <div className="h-3 bg-gray-200 rounded w-4/6"></div>
        </div>
        
        {/* More content */}
        <div className="space-y-3 mt-8">
          <div className="h-3 bg-gray-200 rounded w-3/4"></div>
          <div className="h-3 bg-gray-200 rounded"></div>
          <div className="h-3 bg-gray-200 rounded w-2/3"></div>
        </div>
        
        {/* Signature placeholder */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-8 bg-gray-200 rounded animate-pulse"></div>
            <div className="flex-1">
              <div className="h-2 bg-gray-200 rounded w-1/3"></div>
              <div className="h-2 bg-gray-200 rounded w-1/4 mt-2"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DocumentViewerModal({
  isOpen,
  onClose,
  documentId,
  documentName,
  token,
  requestId
}: DocumentViewerModalProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.0)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [loadingStage, setLoadingStage] = useState<string>("Iniciando...")
  const [documentUrl, setDocumentUrl] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [hasSignatures, setHasSignatures] = useState<boolean>(false)
  const [signatures, setSignatures] = useState<SignatureAnnotation[]>([])
  const [isLoadingSignatures, setIsLoadingSignatures] = useState<boolean>(false)
  const [showSignaturesPanel, setShowSignaturesPanel] = useState<boolean>(true)
  const [isUsingMergedPdf, setIsUsingMergedPdf] = useState<boolean>(false)
  const [isFirstPageLoaded, setIsFirstPageLoaded] = useState<boolean>(false)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [refreshKey, setRefreshKey] = useState<number>(0)
  
  // Signature highlight pulse state
  const [highlightedSignature, setHighlightedSignature] = useState<{
    id: string
    page: number
    x: number
    y: number
    width: number
    height: number
  } | null>(null)

  // Sort signatures by page number
  const sortedSignatures = [...signatures].sort((a, b) => {
    if (a.page === b.page) {
      // If on same page, sort by y position (top to bottom)
      return (a.y || 0) - (b.y || 0)
    }
    return a.page - b.page
  })

  // Use unified PDF.js configuration
  const pdfWorker = usePDFWorker()
  const PDF_OPTIONS = useMemo(() => UNIFIED_PDF_OPTIONS, [])

  // Initialize PDF.js when component mounts
  useEffect(() => {
    // Ensure PDF worker is configured with better validation
    const validateWorker = async () => {
      if (!pdfWorker.isConfigured) {
        console.warn('⚠️ PDF worker not configured, attempting to initialize...')
        try {
          await pdfWorker.initializeAsync()
          console.log('✅ PDF worker initialized successfully')
        } catch (error) {
          console.error('❌ Failed to initialize PDF worker:', error)
        }
      } else {
        console.log('✅ PDF worker is configured:', pdfWorker.workerSrc)
        
        // Verify the worker is actually working by testing if WorkerMessageHandler exists
        try {
          // This will help prevent the "Cannot read properties of undefined (reading 'WorkerMessageHandler')" error
          const workerUrl = pdfWorker.workerSrc
          if (workerUrl && !workerUrl.includes('data:')) {
            const response = await fetch(workerUrl, { method: 'HEAD' })
            if (!response.ok) {
              console.warn('⚠️ Worker URL not accessible, resetting...')
              pdfWorker.reset()
            }
          }
        } catch (error) {
          console.warn('⚠️ Worker validation failed, resetting...', error)
          pdfWorker.reset()
        }
      }
    }
    
    validateWorker()
    loadPdfStyles()
    
    // Cleanup function to prevent transport destroyed errors
    return () => {
      // Reset loading state on unmount
      setIsLoading(true)
      setError("")
    }
  }, [])

  // Listen for signature highlight events from signature panel
  useEffect(() => {
    const handleHighlightSignature = (event: CustomEvent) => {
      const { signatureId, page, x, y, width, height } = event.detail
      console.log('📍 Modal: Highlighting signature:', { signatureId, page, x, y, width, height })
      
      // Set current page if different
      if (page !== pageNumber) {
        setPageNumber(page)
      }
      
      // Set highlighted signature for pulse effect
      setHighlightedSignature({ id: signatureId, page, x, y, width, height })
      
      // Remove highlight after pulse animation (2 seconds)
      setTimeout(() => {
        setHighlightedSignature(null)
      }, 2000)
    }

    window.addEventListener('highlightSignature', handleHighlightSignature as EventListener)
    return () => window.removeEventListener('highlightSignature', handleHighlightSignature as EventListener)
  }, [pageNumber])

  // Generate the document URL when modal opens
  useEffect(() => {
    if (isOpen && documentId) {
      console.log('📄 DocumentViewerModal: Opening document', {
        documentId,
        documentName,
        hasToken: !!token,
        hasRequestId: !!requestId,
        pdfWorkerConfigured: pdfWorker.isConfigured,
        workerSrc: pdfWorker.workerSrc
      })
      
      setIsLoading(true)
      setError("")
      setLoadingStage("Iniciando...")
      // Reset scale to prevent accumulated scaling from previous views
      setScale(1.0)
      setPageNumber(1)
      setIsFirstPageLoaded(false) // Reset first page loaded state
      
      // For signed documents with token and requestId, use the signed document print API
      if (token && requestId) {
        // This is a signed document - use print API to get merged PDF
        console.log('📄 Using signed document API for document', documentId)
        setLoadingStage("Cargando documento firmado...")
        const url = `/api/documents/${documentId}/print?token=${encodeURIComponent(token)}&requestId=${encodeURIComponent(requestId)}`
        setDocumentUrl(url)
        setHasSignatures(true)
        setIsUsingMergedPdf(true) // This is a merged PDF with signatures baked in
        setIsLoading(false)
        loadSignaturesForSignedDocument()
      } else {
        // Check if this is a fast-sign document or case file document
        // We'll try the fast-sign print endpoint first, then fallback to regular PDF
        console.log('📄 Checking document type and setting URL for document', documentId)
        checkDocumentTypeAndSetUrl()
      }

    }
  }, [isOpen, documentId, token, requestId])

  // Re-trigger signature positioning when first page loads - SAME AS CLICKING THE DOCUMENT
  useEffect(() => {
    if (isFirstPageLoaded && signatures.length > 0) {
      // debug suppressed
      // Force signature repositioning by triggering a state update - EXACTLY WHAT THE CLICK DOES
      const timer = setTimeout(() => {
        setSignatures(prev => [...prev])
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isFirstPageLoaded, signatures.length])

  // Listen for signature recalculation events
  useEffect(() => {
    const handleSignatureRecalc = () => {
      // debug suppressed
      setSignatures(prev => [...prev])
    }

    window.addEventListener('signature-recalc', handleSignatureRecalc)
    return () => window.removeEventListener('signature-recalc', handleSignatureRecalc)
  }, [])

  const loadSignaturesForSignedDocument = async () => {
    if (!token || !requestId) return
    
    setIsLoadingSignatures(true)
    try {
      // First try to load signatures from document_signatures table (new format)
      const signaturesResponse = await fetch(`/api/documents/${documentId}/signatures/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: token,
          includeData: true // Request full signature data
        }),
      })

      if (signaturesResponse.ok) {
        const sigData = await signaturesResponse.json()
        const signatureAnnotations: SignatureAnnotation[] = []
        
        // Process signatures from document_signatures table
        if (sigData.signatures && Array.isArray(sigData.signatures)) {
          sigData.signatures.forEach((sigRecord: any) => {
            if (sigRecord.signature_data?.signatures) {
              sigRecord.signature_data.signatures.forEach((sig: any) => {
                signatureAnnotations.push({
                  id: sig.id,
                  type: "signature",
                  page: sig.page || 1,
                  imageData: sig.imageData || sig.dataUrl || '',
                  x: sig.x,
                  y: sig.y,
                  width: sig.width,
                  height: sig.height,
                  relativeX: sig.relativeX,
                  relativeY: sig.relativeY,
                  timestamp: sig.timestamp,
                  signatureSource: sig.source || "canvas",
                })
              })
            }
          })
        }
        
        if (signatureAnnotations.length > 0) {
          setSignatures(signatureAnnotations)
          setIsLoadingSignatures(false)
          return
        }
      }

      // Fallback: For signed documents, we can extract signatures from the document annotations
      const response = await fetch(`/api/annotations/${documentId}?token=${encodeURIComponent(token)}&requestId=${encodeURIComponent(requestId)}`)
      
      if (response.ok) {
        const data = await response.json()
        const signatureAnnotations: SignatureAnnotation[] = []
        
        // Look for signature annotations in the response
        if (data.annotations && Array.isArray(data.annotations)) {
          data.annotations.forEach((annotation: any, index: number) => {
            if (annotation.type === 'signature' && annotation.imageData) {
              signatureAnnotations.push({
                id: annotation.id || `signature-${index}`,
                type: "signature",
                page: annotation.page || 1,
                imageData: annotation.imageData,
                x: annotation.x,
                y: annotation.y,
                width: annotation.width,
                height: annotation.height,
                relativeX: annotation.relativeX,
                relativeY: annotation.relativeY,
                timestamp: annotation.timestamp,
                signatureSource: annotation.signatureSource || "canvas",
              })
            }
          })
        }
        
        setSignatures(signatureAnnotations)
      } else {
        // Fallback: try to get signatures from the original API pattern
        console.log("Fallback: using signed document signature extraction")
        setSignatures([])
      }
    } catch (error) {
      console.error("Error loading signatures for signed document:", error)
      setSignatures([])
    } finally {
      setIsLoadingSignatures(false)
    }
  }

  const loadSignaturesForFastSign = async () => {
    setIsLoadingSignatures(true)
    // debug suppressed
    
    try {
      // Use a special token that allows loading ALL signatures for the document
      // This bypasses the recipient_email filter for fast-sign-docs viewing
      const response = await fetch(`/api/documents/${documentId}/signatures/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: Buffer.from("fast-sign-docs@view-all").toString("base64"),
          includeData: true,
        }),
      })

      // debug suppressed

      if (response.ok) {
        const data = await response.json()
        // debug suppressed
        
        // Process signature records (debug suppressed)
        if (data.signatures && data.signatures.length > 0) {
          // Signature processing logic here if needed
        }
        
        const signatureAnnotations: SignatureAnnotation[] = []

        if (data.signatures && data.signatures.length > 0) {
          data.signatures.forEach((sigRecord: any) => {
            // debug suppressed
            
            if (sigRecord.signature_data?.signatures) {
              // debug suppressed
              // New format: signatures array
              sigRecord.signature_data.signatures.forEach((sig: any, sigIndex: number) => {
                // Process signature (debug suppressed)
                
                // Calculate missing relative dimensions from absolute ones if available
                let relativeWidth = sig.relativeWidth
                let relativeHeight = sig.relativeHeight
                
                // If relative dimensions are missing but absolute ones exist, calculate them using ACTUAL page dimensions
                if (!relativeWidth && sig.width) {
                  relativeWidth = sig.width / (pageSize?.width || 612) // Use actual page width, fallback to 612
                  // debug suppressed
                }
                if (!relativeHeight && sig.height) {
                  relativeHeight = sig.height / (pageSize?.height || 792) // Use actual page height, fallback to 792
                  // debug suppressed
                }
                
                // Skip signatures without proper relative coordinates (X,Y are mandatory, W,H can be calculated)
                if (!sig.relativeX || !sig.relativeY) {
                  console.warn('DocumentViewerModal: Signature missing essential relative coordinates (X,Y), skipping:', {
                    id: sig.id,
                    relativeX: sig.relativeX,
                    relativeY: sig.relativeY
                  })
                  return
                }
                
                // If we still don't have dimensions, use fallback values
                if (!relativeWidth) {
                  relativeWidth = 0.2 // 20% of page width as fallback
                  // debug suppressed
                }
                if (!relativeHeight) {
                  relativeHeight = 0.1 // 10% of page height as fallback
                  // debug suppressed
                }
                
                signatureAnnotations.push({
                  id: sig.id,
                  type: "signature",
                  page: sig.page || 1, // Direct page property, not sig.position.page
                  imageData: "", // No thumbnail needed - images not stored in DB
                  // Keep both relative and absolute coordinates for compatibility (using calculated values)
                  relativeX: sig.relativeX,
                  relativeY: sig.relativeY,
                  relativeWidth: relativeWidth, // Use calculated/corrected value
                  relativeHeight: relativeHeight, // Use calculated/corrected value
                  // Use existing absolute coordinates if available, otherwise calculate from relative using ACTUAL page dimensions
                  x: sig.x || (sig.relativeX * (pageSize?.width || 612)), // Use actual page width, fallback to 612
                  y: sig.y || (sig.relativeY * (pageSize?.height || 792)), // Use actual page height, fallback to 792  
                  width: sig.width || (relativeWidth * (pageSize?.width || 612)),
                  height: sig.height || (relativeHeight * (pageSize?.height || 792)),
                  timestamp: sig.timestamp || sigRecord.signed_at,
                  signatureSource: sig.source || sigRecord.signature_source || "canvas",
                })
              })
            } else if (sigRecord.signature_data?.dataUrl && sigRecord.signature_data?.position) {
              // debug suppressed
              // Old format: direct signature data
              const position = sigRecord.signature_data.position
              
              // Process old format signature (debug suppressed)
              
              // Calculate missing relative dimensions from absolute ones if available (old format)
              let oldRelativeWidth = position.relativeWidth
              let oldRelativeHeight = position.relativeHeight
              
              // If relative dimensions are missing but absolute ones exist, calculate them using ACTUAL page dimensions
              if (!oldRelativeWidth && position?.width) {
                oldRelativeWidth = position.width / (pageSize?.width || 612) // Use actual page width, fallback to 612
                // debug suppressed
              }
              if (!oldRelativeHeight && position?.height) {
                oldRelativeHeight = position.height / (pageSize?.height || 792) // Use actual page height, fallback to 792
                // debug suppressed
              }
              
              // Skip signatures without proper relative coordinates (X,Y are mandatory)
              if (!position.relativeX || !position.relativeY) {
                console.warn('DocumentViewerModal: Old format signature missing essential relative coordinates (X,Y), skipping:', sigRecord.id)
                return
              }
              
              // If we still don't have dimensions, use fallback values
              if (!oldRelativeWidth) {
                oldRelativeWidth = 0.2 // 20% of page width as fallback
                // debug suppressed
              }
              if (!oldRelativeHeight) {
                oldRelativeHeight = 0.1 // 10% of page height as fallback
                // debug suppressed
              }
              
              signatureAnnotations.push({
                id: sigRecord.id,
                type: "signature",
                page: position?.page || 1,
                imageData: "", // No thumbnail needed
                // Keep both relative and absolute coordinates for compatibility (using calculated values)
                relativeX: position.relativeX,
                relativeY: position.relativeY,
                relativeWidth: oldRelativeWidth, // Use calculated/corrected value
                relativeHeight: oldRelativeHeight, // Use calculated/corrected value
                // Use existing absolute coordinates if available, otherwise calculate from relative using ACTUAL page dimensions
                x: position?.x || (position.relativeX * (pageSize?.width || 612)), // Use actual page width, fallback to 612
                y: position?.y || (position.relativeY * (pageSize?.height || 792)), // Use actual page height, fallback to 792
                width: position?.width || (oldRelativeWidth * (pageSize?.width || 612)),
                height: position?.height || (oldRelativeHeight * (pageSize?.height || 792)),
                timestamp: sigRecord.signature_data.timestamp || sigRecord.signed_at,
                signatureSource: sigRecord.signature_source || "canvas",
              })
            } else {
              // Handle other signature formats (debug suppressed)
            }
          })
        }

        // Process signature annotations (debug suppressed)

        setSignatures(signatureAnnotations)
        setHasSignatures(signatureAnnotations.length > 0)
        
        // Debug: Check signature data quality
        const signaturesWithImageData = signatureAnnotations.filter(s => s.imageData)
        const signaturesWithoutImageData = signatureAnnotations.filter(s => !s.imageData)
        
        // Quality check completed (debug suppressed)
        
        if (signaturesWithoutImageData.length > 0) {
          // warn suppressed
        }
      }
    } catch (error) {
      console.error("Error loading signatures:", error)
      setSignatures([])
      setHasSignatures(false)
    } finally {
      setIsLoadingSignatures(false)
    }
  }

  const checkDocumentTypeAndSetUrl = async () => {
    try {
      setLoadingStage("Verificando tipo de documento...")
      console.log('📄 Checking document type for:', documentId)
      
      const startTime = Date.now()
      
      // Use Promise.allSettled to make parallel requests for better performance
      const [docResponse, signatureResponse] = await Promise.allSettled([
        fetch(`/api/pdf/${documentId}`, { method: 'HEAD' }),
        fetch(`/api/documents/${documentId}/signatures/check`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: Buffer.from("fast-sign-docs@view-all").toString("base64"),
            includeData: false,
          }),
        })
      ])
      
      const parallelRequestsTime = Date.now() - startTime
      console.log('📄 Document type check completed in', parallelRequestsTime, 'ms')
      
      const docExists = docResponse.status === 'fulfilled' && docResponse.value.ok
      console.log('📄 Document exists in /api/pdf/', docExists)
      
      if (signatureResponse.status === 'fulfilled' && signatureResponse.value.ok) {
        setLoadingStage("Verificando firmas...")
        
        try {
          const signatureData = await signatureResponse.value.json()
          
          if (signatureData.hasSignatures) {
            // This document has signatures - use fast-sign print endpoint for merged PDF
            console.log('📄 Document has signatures, using fast-sign print endpoint')
            setLoadingStage("Procesando documento con firmas...")
            const url = `/api/fast-sign/${documentId}/print?_t=${Date.now()}`
            console.log('📄 Setting document URL:', url)
            setDocumentUrl(url)
            setHasSignatures(true)
            setIsUsingMergedPdf(true) // This is a merged PDF with signatures baked in
            // Load signature metadata for the panel but don't show overlays (signatures already in PDF)
            loadSignaturesForFastSign()
            return
          }
        } catch (jsonError) {
            // debug suppressed
        }
      }
      
      if (docExists) {
        // No signatures detected in initial check, but still try to load any existing signatures
        console.log('📄 Using regular PDF endpoint (no signatures detected)')
        setLoadingStage("Cargando documento original...")
        const url = `/api/pdf/${documentId}?_t=${Date.now()}`
        console.log('📄 Setting document URL:', url)
        setDocumentUrl(url)
        setIsUsingMergedPdf(false) // Regular PDF, no merged signatures
        // Always try to load signatures - they might exist even if initial check failed
        loadSignaturesForFastSign()
      } else {
        // Document not found in regular endpoint, try fast-sign endpoint as fallback
        setLoadingStage("Verificando documento en fast-sign...")
        console.log('📄 Document not found in regular PDF endpoint, trying fast-sign fallback')
        
        try {
          const fastSignResponse = await fetch(`/api/fast-sign/${documentId}/print`, { method: 'HEAD' })
          
          if (fastSignResponse.ok) {
            // Document found in fast-sign endpoint
            console.log('📄 Document found in fast-sign endpoint')
            setLoadingStage("Procesando documento con firmas...")
            const url = `/api/fast-sign/${documentId}/print?_t=${Date.now()}`
            console.log('📄 Setting document URL:', url)
            setDocumentUrl(url)
            setHasSignatures(true)
            setIsUsingMergedPdf(true) // This is also a merged PDF with signatures baked in
            loadSignaturesForFastSign()
          } else {
            console.error('📄 Document not found in fast-sign endpoint either')
            setError("Documento no encontrado")
          }
        } catch (fastSignError) {
          console.error('📄 Error checking fast-sign endpoint:', fastSignError)
          setError("Error al cargar el documento")
        }
      }
    } catch (error) {
      // debug suppressed
      setError("Error al cargar el documento")
    } finally {
      setIsLoading(false)
    }
  }

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    // debug suppressed
    setNumPages(numPages)
    setPageNumber(1)
    setIsLoading(false)
    setError("")
  }

  const onFirstPageLoaded = () => {
    // debug suppressed
    setIsFirstPageLoaded(true)
    
    // Automatically trigger signature recalculation after a short delay
    setTimeout(() => {
      // debug suppressed
      setSignatures(prev => [...prev])
    }, 300)
  }

  const onDocumentLoadError = (error: any) => {
    console.error("Error loading PDF:", error)
    console.log("PDF worker status:", {
      isConfigured: pdfWorker.isConfigured,
      workerSrc: pdfWorker.workerSrc,
      documentUrl,
      documentId
    })
    
    // Handle specific error types
    if (error?.message?.includes('Transport destroyed')) {
      setError('Conexión interrumpida. Por favor, recargue la página.')
    } else if (error?.message?.includes('worker')) {
      console.error('PDF Worker error details:', {
        workerConfigured: pdfWorker.isConfigured,
        workerSrc: pdfWorker.workerSrc,
        globalWorkerSrc: pdfjs.GlobalWorkerOptions.workerSrc
      })
      setError('Error de configuración del visor PDF. Intentando reconfigurar...')
      // Try to reset worker
      setTimeout(() => {
        pdfWorker.reset()
        // Retry loading after a delay
        setTimeout(() => {
          setError("")
          setIsLoading(true)
          setLoadingStage("Reintentando carga del documento...")
        }, 1000)
      }, 500)
      return
    } else if (error?.message?.includes('404') || error?.message?.includes('fetch')) {
      setError(`Documento no encontrado. URL: ${documentUrl}`)
    } else {
      setError(`Error al cargar el documento: ${error?.message || 'Error desconocido'}`)
    }
    
    setIsLoading(false)
  }

  const goToPrevPage = () => {
    setPageNumber(prev => Math.max(prev - 1, 1))
  }

  const goToNextPage = () => {
    setPageNumber(prev => Math.min(prev + 1, numPages))
  }

  const goToPage = (page: number) => {
    setPageNumber(Math.max(1, Math.min(page, numPages)))
  }

  const zoomIn = () => {
    setScale(prev => Math.min(prev + 0.2, 1.75))
  }

  const zoomOut = () => {
    setScale(prev => Math.max(prev - 0.2, 0.5))
  }

  const handleDownload = () => {
    if (documentUrl) {
      const link = document.createElement('a')
      link.href = documentUrl
      link.download = documentName
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const handleRefresh = async () => {
    if (isRefreshing) return
    
    // debug suppressed
    setIsRefreshing(true)
    setError("")
    
    try {
      // Reset all states to force complete reload
      setNumPages(0)
      setPageNumber(1)
      setScale(1.0)
      setSignatures([])
      setHasSignatures(false)
      setIsUsingMergedPdf(false)
      setIsFirstPageLoaded(false)
      setIsLoading(true)
      setLoadingStage("Actualizando documento...")
      
      // Increment refresh key to force complete re-render of Document component
      setRefreshKey(prev => prev + 1)
      
      // Short delay to ensure state updates are processed
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Reload document type and signatures
      if (token && requestId) {
        // For signed documents
        setLoadingStage("Actualizando documento firmado...")
        const url = `/api/documents/${documentId}/print?token=${encodeURIComponent(token)}&requestId=${encodeURIComponent(requestId)}&_t=${Date.now()}`
        setDocumentUrl(url)
        setHasSignatures(true)
        setIsUsingMergedPdf(true)
        setIsLoading(false)
        await loadSignaturesForSignedDocument()
      } else {
        // For regular/fast-sign documents
        await checkDocumentTypeAndSetUrl()
      }
      
      // debug suppressed
    } catch (error) {
      // debug suppressed
      setError("Error al actualizar el documento")
      setIsLoading(false)
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose} >
      <DialogContent className="max-w-7xl w-full h-[100vh] p-0 overflow-hidden flex flex-col gap-0" hideCloseButton>
        <DialogHeader className="px-4 py-2 bg-gray-50 shrink-0">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-2">
              <DialogTitle className="text-base font-semibold truncate max-w-md">
                {documentName}
              </DialogTitle>
              {hasSignatures && !isLoading && (
                <div className="flex items-center space-x-1 text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full text-xs">
                  <CheckCircle className="h-3 w-3" />
                  <span>Con firmas ({signatures.length})</span>
                  {isUsingMergedPdf && (
                    <span className="text-xs text-green-700 bg-green-100 px-1 rounded">
                      Integradas
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading || isRefreshing || !!error}
                title="Actualizar documento y firmas"
                className="h-7 px-2 text-xs"
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Actualizando...' : 'Actualizar'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={isLoading || !!error}
                className="h-7 px-2 text-xs"
              >
                <Download className="h-3 w-3 mr-1" />
                Descargar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-7 w-7 p-0"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Toolbar */}
        <div className="px-4 py-1.5 border-b bg-gray-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            {/* Page navigation */}
            <Button
              variant="outline"
              size="sm"
              onClick={goToPrevPage}
              disabled={pageNumber <= 1 || isLoading}
              className="h-6 w-6 p-0"
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <span className="text-xs font-medium min-w-[70px] text-center">
              {isLoading ? "..." : `${pageNumber} de ${numPages}`}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextPage}
              disabled={pageNumber >= numPages || isLoading}
              className="h-6 w-6 p-0"
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Signatures panel toggle */}
            {hasSignatures && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSignaturesPanel(!showSignaturesPanel)}
                className="h-6 w-6 p-0"
                title={showSignaturesPanel ? "Ocultar panel de firmas" : "Mostrar panel de firmas"}
              >
                {showSignaturesPanel ? (
                  <PanelRightClose className="h-3 w-3" />
                ) : (
                  <PanelRightOpen className="h-3 w-3" />
                )}
              </Button>
            )}

            {/* Zoom controls */}
            <Button
              variant="outline"
              size="sm"
              onClick={zoomOut}
              disabled={scale <= 0.5 || isLoading}
              className="h-6 w-6 p-0"
            >
              <ZoomOut className="h-3 w-3" />
            </Button>
            <span className="text-xs font-medium min-w-[45px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={zoomIn}
              disabled={scale >= 1.75 || isLoading}
              className="h-6 w-6 p-0"
            >
              <ZoomIn className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex flex-1 min-h-0">
          {/* Document viewer */}
          <div className="flex-1 overflow-auto bg-gray-100 p-4">
            <div className="flex justify-center">
              {isLoading ? (
                <LoadingComponent stage={loadingStage} />
              ) : error ? (
                <div className="flex items-center justify-center h-96">
                  <div className="text-center max-w-md">
                    <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Error al cargar</h3>
                    <p className="text-red-600 mb-4">{error}</p>
                    <Button onClick={() => window.location.reload()}>
                      Reintentar
                    </Button>
                  </div>
                </div>
              ) : (
                <div 
                  className="bg-white shadow-lg relative"
                    onClick={() => {
                    // Force signature repositioning by triggering a state update
                    setSignatures(prev => [...prev])
                  }}
                >
                  {/* CSS for signature pulse animation */}
                  <style>{`
                    @keyframes signaturePulse {
                      0% {
                        opacity: 0;
                        transform: scale(0.9);
                        box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.8);
                      }
                      50% {
                        opacity: 1;
                        transform: scale(1.1);
                        box-shadow: 0 0 0 20px rgba(59, 130, 246, 0.3);
                      }
                      100% {
                        opacity: 0;
                        transform: scale(1.2);
                        box-shadow: 0 0 0 40px rgba(59, 130, 246, 0);
                      }
                    }
                    
                    .signature-highlight-pulse {
                      position: absolute;
                      border: 3px solid #3b82f6;
                      background-color: rgba(59, 130, 246, 0.1);
                      border-radius: 8px;
                      pointer-events: none;
                      z-index: 30;
                      animation: signaturePulse 2s ease-out;
                    }
                  `}</style>

                  <Document
                    key={`${documentId}-${documentUrl}-${refreshKey}`} // Force complete re-render when document, URL, or refresh changes
                    file={documentUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    options={PDF_OPTIONS}
                    loading={<PDFLoadingSkeleton />}
                  >
                    <PDFPageWithSignatures
                      pageNumber={pageNumber}
                      scale={scale}
                      signatures={signatures}
                      showOverlays={!isUsingMergedPdf && isFirstPageLoaded}
                      onPageLoad={(pageNumber, width, height) => {
                        // debug suppressed
                        if (pageNumber === 1 && !isFirstPageLoaded) {
                          onFirstPageLoaded()
                        }
                      }}
                    />
                  </Document>

                  {/* Signature Highlight Pulse */}
                  {highlightedSignature && highlightedSignature.page === pageNumber && (
                    <div
                      className="signature-highlight-pulse"
                      style={{
                        left: `${highlightedSignature.x * scale}px`,
                        top: `${highlightedSignature.y * scale}px`,
                        width: `${highlightedSignature.width * scale}px`,
                        height: `${highlightedSignature.height * scale}px`,
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Signatures sidebar */}
          {hasSignatures && showSignaturesPanel && (
            <div className="w-80 lg:w-80 md:w-72 border-l border-gray-200 bg-white flex flex-col shrink-0">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Edit3 className="h-4 w-4" />
                    Firmas del Documento
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSignaturesPanel(false)}
                    className="h-6 w-6 p-0 lg:hidden"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                
                {signatures.length > 0 && (
                  <div className="flex items-center justify-between mt-2">
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                      {signatures.length} firma{signatures.length !== 1 ? 's' : ''}
                    </span>
                    <span className="text-xs text-gray-500">
                      {sortedSignatures.filter(s => s.page === pageNumber).length > 0 
                        ? `${sortedSignatures.filter(s => s.page === pageNumber).length} en página actual`
                        : 'Ninguna en página actual'
                      }
                    </span>
                  </div>
                )}
              </div>
              
              <div className="flex-1 overflow-hidden p-4 flex flex-col">
                {isLoadingSignatures ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
                      <p className="text-sm text-gray-600">Cargando firmas...</p>
                    </div>
                  </div>
                ) : signatures.length > 0 ? (
                  <div className="relative flex-1 min-h-0">
                    {/* Scroll indicator for many signatures */}
                    {signatures.length > 5 && (
                      <div className="absolute top-0 right-0 z-10 bg-gradient-to-b from-white via-white to-transparent h-8 w-6 pointer-events-none"></div>
                    )}
                    
                    <div 
                      className="space-y-3 h-full overflow-y-auto pr-2"
                      style={{
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#d1d5db #f3f4f6'
                      }}
                    >
                      {sortedSignatures.map((signature, index) => (
                        <SignatureThumbnail
                          key={signature.id}
                          signature={signature}
                          index={index}
                          onGoToPage={goToPage}
                          isCurrentPage={signature.page === pageNumber}
                        />
                      ))}
                    </div>
                    
                    {/* Bottom scroll indicator */}
                    {signatures.length > 5 && (
                      <div className="absolute bottom-0 right-0 z-10 bg-gradient-to-t from-white via-white to-transparent h-8 w-6 pointer-events-none"></div>
                    )}
                    
                    {/* Scroll hint */}
                    {signatures.length > 5 && (
                      <div className="text-center mt-2 pt-2 border-t border-gray-100">
                        <p className="text-xs text-gray-400">
                          Scroll para ver más firmas ({signatures.length} total)
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Edit3 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No se encontraron firmas</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Las firmas aparecerán aquí cuando estén disponibles
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
