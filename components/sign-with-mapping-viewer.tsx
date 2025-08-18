"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Download, Loader2, Check, Edit3, Menu } from "lucide-react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import { Logo } from "@/components/logo"
import { useToast } from "@/hooks/use-toast"
import { SignatureField } from "./simple-document-viewer"
import SimpleSignatureCanvas from "./simple-signature-canvas"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

// Import centralized PDF configuration
import PDF_CONFIG, { configurePdfWorker } from '@/utils/pdf-config-centralized'

// Configure PDF.js worker on import
configurePdfWorker()

// Use centralized PDF options
const PDF_OPTIONS = PDF_CONFIG

interface SignWithMappingViewerProps {
  documentId: string
  documentName: string
  documentUrl: string
  signatureFields: SignatureField[]
  token: string
  onComplete: () => void
  onBack?: () => void
}

interface CompletedSignature {
  fieldId: string
  signatureDataUrl: string
  signatureSource: 'canvas' | 'wacom'
}

export default function SignWithMappingViewer({
  documentId,
  documentName,
  documentUrl,
  signatureFields,
  token,
  onComplete,
  onBack
}: SignWithMappingViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.0)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [pdfLoadError, setPdfLoadError] = useState<Error | null>(null)
  const [pageSize, setPageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 })
  const [completedSignatures, setCompletedSignatures] = useState<CompletedSignature[]>([])
  const [showSignatureModal, setShowSignatureModal] = useState<boolean>(false)
  const [currentField, setCurrentField] = useState<SignatureField | null>(null)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [sharedSignature, setSharedSignature] = useState<{ dataUrl: string; source: 'canvas' | 'wacom' } | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false)
  const [existingSignatures, setExistingSignatures] = useState<any[]>([])
  
  // Preserve scroll position in the sidebar across re-renders
  const sidebarScrollRefDesktop = useRef<HTMLDivElement | null>(null)
  const sidebarScrollRefMobile = useRef<HTMLDivElement | null>(null)
  const sidebarScrollPositions = useRef<{ desktop: number; mobile: number }>({ desktop: 0, mobile: 0 })

  const { toast } = useToast()

  // Load existing signatures from all users (for display only)
  const loadExistingSignatures = async () => {
    try {
      const response = await fetch(`/api/annotations/${documentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        console.warn('Failed to load existing signatures')
        return
      }
      
      const data = await response.json()
      
      if (data.annotations && Array.isArray(data.annotations)) {
        const signatureAnnotations = data.annotations.filter((ann: any) => 
          ann.type === 'signature' && ann.imageData && ann.imageData.length > 0
        )
        
        setExistingSignatures(signatureAnnotations)
      } else {
        setExistingSignatures([])
      }
    } catch (error) {
      console.error('Error loading existing signatures:', error)
      setExistingSignatures([])
    }
  }

  // Ensure PDF.js worker is properly configured
  useEffect(() => {
    // Ensure PDF worker is configured (centralized configuration handles this)
    configurePdfWorker()
  }, [])

  // Load existing signatures on mount
  useEffect(() => {
    loadExistingSignatures()
  }, [documentId])

  // Force loading to false after timeout
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.warn("PDF loading timeout - setting loading to false")
        setIsLoading(false)
      }
    }, 10000) // 10 second timeout

    return () => clearTimeout(timeout)
  }, [documentUrl, isLoading])

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setPageNumber(1)
    setIsLoading(false)
    setPdfLoadError(null)
  }

  const onPageLoadSuccess = ({ width, height }: { width: number; height: number }) => {
    setPageSize({ width, height })
  }

  const goToPrevPage = () => {
    setPageNumber(prev => Math.max(prev - 1, 1))
  }

  const goToNextPage = () => {
    setPageNumber(prev => Math.min(prev + 1, numPages))
  }

  const handleFieldClick = (field: SignatureField) => {
    // Navigate to the page where the signature field is located
    if (field.page !== pageNumber) {
      setPageNumber(field.page)
    }
    
    setCurrentField(field)
    setShowSignatureModal(true)
    setIsDrawerOpen(false)
    // Preserve sidebar scroll positions when opening modal
    requestAnimationFrame(() => {
      if (sidebarScrollRefDesktop.current) {
        sidebarScrollPositions.current.desktop = sidebarScrollRefDesktop.current.scrollTop
      }
      if (sidebarScrollRefMobile.current) {
        sidebarScrollPositions.current.mobile = sidebarScrollRefMobile.current.scrollTop
      }
    })
  }

  const handleSignatureComplete = (signatureDataUrl: string) => {
    if (!currentField) return

    // Save the signature for this field
    const newSignature: CompletedSignature = {
      fieldId: currentField.id,
      signatureDataUrl: signatureDataUrl,
      signatureSource: 'canvas'
    }

    setCompletedSignatures(prev => {
      const filtered = prev.filter(sig => sig.fieldId !== currentField.id)
      return [...filtered, newSignature]
    })

    // Save as shared signature for easy reuse
    setSharedSignature({ dataUrl: signatureDataUrl, source: 'canvas' })

    setShowSignatureModal(false)
    setCurrentField(null)

    // Notification removed per UX request – avoid scroll jumps from re-renders

    // Restore sidebar scroll positions after state updates on next frame
    requestAnimationFrame(() => {
      if (sidebarScrollRefDesktop.current) {
        sidebarScrollRefDesktop.current.scrollTop = sidebarScrollPositions.current.desktop
      }
      if (sidebarScrollRefMobile.current) {
        sidebarScrollRefMobile.current.scrollTop = sidebarScrollPositions.current.mobile
      }
    })
  }

  const handleUseSharedSignature = (field: SignatureField) => {
    if (!sharedSignature) return

    const newSignature: CompletedSignature = {
      fieldId: field.id,
      signatureDataUrl: sharedSignature.dataUrl,
      signatureSource: sharedSignature.source
    }

    setCompletedSignatures(prev => {
      const filtered = prev.filter(sig => sig.fieldId !== field.id)
      return [...filtered, newSignature]
    })

    // Notification removed per UX request

    // Restore sidebar scroll positions after state updates on next frame
    requestAnimationFrame(() => {
      if (sidebarScrollRefDesktop.current) {
        sidebarScrollRefDesktop.current.scrollTop = sidebarScrollPositions.current.desktop
      }
      if (sidebarScrollRefMobile.current) {
        sidebarScrollRefMobile.current.scrollTop = sidebarScrollPositions.current.mobile
      }
    })
  }

  const handleSubmitSignatures = async () => {
    // Check against fields that actually need signing (excluding those with existing signatures)
    const fieldsNeedingSigning = signatureFields.filter((field) => {
      const hasExistingSignatureInSameLocation = existingSignatures.some(sig => 
        sig.page === field.page && 
        sig.imageData && 
        sig.imageData.length > 0 &&
        Math.abs(sig.relativeX - field.relativeX) < 0.05 && // Within 5% tolerance
        Math.abs(sig.relativeY - field.relativeY) < 0.05
      )
      return !hasExistingSignatureInSameLocation
    })
    
    if (completedSignatures.length !== fieldsNeedingSigning.length) {
      toast({
        title: "Firmas incompletas",
        description: "Debe completar todas las firmas requeridas antes de enviar",
        variant: "destructive"
      })
      return
    }

    setIsSubmitting(true)

    try {
      // 🔧 LANDSCAPE DETECTION: Use same logic as display - detect from actual page dimensions
      const isLandscapeDocument = pageSize.width > pageSize.height
      
      console.log('📐 Document orientation:', isLandscapeDocument ? 'LANDSCAPE' : 'PORTRAIT')

      // Build consolidated signatures payload (include image for merge, but DB will store only coords)
      const consolidatedSignatures = completedSignatures.map((sig) => {
        const field = signatureFields.find(f => f.id === sig.fieldId)
        if (!field) {
          console.warn(`Field not found for signature ${sig.fieldId}`)
          return null
        }

        // Validate signature data
        if (!sig.signatureDataUrl || sig.signatureDataUrl.length < 10) {
          console.warn(`Invalid signature data for field ${sig.fieldId}`)
          return null
        }
        
        // 🔧 LANDSCAPE FIX: Apply coordinate correction ONLY for landscape documents
        // Use the same detection as display logic (pageSize-based)
        let correctedRelativeX = field.relativeX
        let correctedRelativeY = field.relativeY
        let correctedRelativeWidth = field.relativeWidth
        let correctedRelativeHeight = field.relativeHeight
        
        if (isLandscapeDocument) {
          // Convert relative coords back to absolute using PORTRAIT dimensions (how they were saved)
          const portraitWidth = 612
          const portraitHeight = 792
          
          const absoluteXFromPortrait = field.relativeX * portraitWidth
          const absoluteYFromPortrait = field.relativeY * portraitHeight
          const absoluteWidthFromPortrait = field.relativeWidth * portraitWidth
          const absoluteHeightFromPortrait = field.relativeHeight * portraitHeight
          
          // Convert absolute coords to relative using LANDSCAPE dimensions (correct)
          correctedRelativeX = absoluteXFromPortrait / 792  // landscape width
          correctedRelativeY = absoluteYFromPortrait / 612  // landscape height
          correctedRelativeWidth = absoluteWidthFromPortrait / 792
          correctedRelativeHeight = absoluteHeightFromPortrait / 612
        }
        
        return {
          id: sig.fieldId,
          dataUrl: sig.signatureDataUrl,
          source: sig.signatureSource,
          // Use flat structure - no nested position object
          x: field.x,
          y: field.y,
          width: field.width,
          height: field.height,
          page: field.page,
          // Use corrected relative coordinates for landscape documents
          relativeX: correctedRelativeX,
          relativeY: correctedRelativeY,
          relativeWidth: correctedRelativeWidth,
          relativeHeight: correctedRelativeHeight,
          timestamp: new Date().toISOString(),
          // Include content field for signature indexing (match fast-sign format)
          content: `${completedSignatures.indexOf(sig) + 1}`,
        }
      }).filter(Boolean)

      // Validate we have valid signatures after filtering
      if (consolidatedSignatures.length === 0) {
        throw new Error("No valid signatures to send after validation")
      }

      // Send the document and mark as signed; provide consolidated signatures for merge

      const sendResponse = await fetch(`/api/documents/${documentId}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: token,
          updateStatus: true,
          consolidatedSignatureData: { signatures: consolidatedSignatures }
        }),
      })

      if (!sendResponse.ok) {
        let errorData
        try {
          errorData = await sendResponse.json()
          console.error('Server error:', errorData)
        } catch (parseError) {
          const responseText = await sendResponse.text()
          console.error('Raw server response:', responseText)
          errorData = { error: `Server error: ${sendResponse.status}` }
        }
        throw new Error(errorData.error || `Server error: ${sendResponse.status}`)
      }

      // Parse success response
      const responseData = await sendResponse.json()

      toast({
        title: "Documento firmado",
        description: "Todas las firmas han sido aplicadas y el documento enviado exitosamente",
      })

      onComplete()

    } catch (error) {
      console.error("Error submitting signatures:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al enviar las firmas",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
      // Restore sidebar scroll positions after state updates on next frame
      requestAnimationFrame(() => {
        if (sidebarScrollRefDesktop.current) {
          sidebarScrollRefDesktop.current.scrollTop = sidebarScrollPositions.current.desktop
        }
        if (sidebarScrollRefMobile.current) {
          sidebarScrollRefMobile.current.scrollTop = sidebarScrollPositions.current.mobile
        }
      })
    }
  }

  const goToFieldPage = (field: SignatureField) => {
    setPageNumber(field.page)
  }

  const isFieldCompleted = (fieldId: string) => {
    return completedSignatures.some(sig => sig.fieldId === fieldId)
  }

  const fieldsOnCurrentPage = signatureFields.filter(field => field.page === pageNumber)
  
  // Calculate fields that need to be signed (excluding those with existing signatures)
  const fieldsNeedingSigning = signatureFields.filter((field) => {
    const hasExistingSignatureInSameLocation = existingSignatures.some(sig => 
      sig.page === field.page && 
      sig.imageData && 
      sig.imageData.length > 0 &&
      Math.abs(sig.relativeX - field.relativeX) < 0.05 && // Within 5% tolerance
      Math.abs(sig.relativeY - field.relativeY) < 0.05
    )
    return !hasExistingSignatureInSameLocation
  })
  
  const completedCount = completedSignatures.length
  const totalCount = fieldsNeedingSigning.length

  // Reusable sidebar content component
  const SidebarContent = ({ onClose, scrollRef, onScroll }: { onClose?: () => void; scrollRef?: React.RefObject<HTMLDivElement>; onScroll?: (e: React.UIEvent<HTMLDivElement>) => void }) => (
    <>
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Firmas Requeridas</h2>
        <p className="text-sm text-gray-600 mt-1">
          {completedCount} de {totalCount} completadas
        </p>
      </div>

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-auto p-4 space-y-3">
        {fieldsNeedingSigning.map((field, index) => {
          const isCompleted = isFieldCompleted(field.id)
          
          return (
            <Card 
              key={field.id} 
              className={`cursor-pointer transition-all ${
                isCompleted ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-blue-300'
              }`}
              onClick={() => {
                goToFieldPage(field)
                onClose?.() // Close drawer on mobile when navigating
              }}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    {field.label}
                  </CardTitle>
                  {isCompleted && (
                    <div className="bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-gray-600 mb-2">
                  Página {field.page}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      goToFieldPage(field)
                      onClose?.() // Close drawer when navigating
                    }}
                    className="flex-1"
                  >
                    Ir a página
                  </Button>
                  <Button
                    size="sm"
                    variant={isCompleted ? "secondary" : "default"}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleFieldClick(field)
                      onClose?.() // Close drawer when opening signature modal
                    }}
                    className="flex-1"
                  >
                    <Edit3 className="h-3 w-3 mr-1" />
                    {isCompleted ? "Cambiar" : "Firmar"}
                  </Button>
                </div>
                {sharedSignature && !isCompleted && (
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleUseSharedSignature(field)
                      }}
                      className="w-full"
                    >
                      Usar firma anterior
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="p-4 border-t">
        <Button
          onClick={() => {
            handleSubmitSignatures()
            onClose?.() // Close drawer after submitting
          }}
          disabled={isSubmitting || completedCount !== totalCount}
          className="w-full bg-green-600 hover:bg-green-700 text-white"
        >
          {isSubmitting ? "Enviando..." : `Enviar Documento (${completedCount}/${totalCount})`}
        </Button>
      </div>
    </>
  )

  return (
    <div className="flex flex-col md:flex-row h-screen bg-white">
      {/* Main document viewer */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="px-3 md:px-6 py-3 md:py-4 border-b bg-gray-50 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 md:space-x-4 flex-1 min-w-0">
              {onBack && (
                <Button variant="outline" size="sm" onClick={onBack} className="shrink-0">
                  <ChevronLeft className="h-4 w-4 md:mr-1" />
                  <span className="hidden md:inline">Atrás</span>
                </Button>
              )}
            <div className="flex items-center space-x-2 min-w-0">
                <Logo className="h-5 w-5 md:h-6 md:w-6 shrink-0" color="#0d2340" />
                <h1 className="text-sm md:text-lg font-semibold truncate">
                  {documentName}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={completedCount === totalCount ? "default" : "secondary"} className="text-xs">
                {completedCount}/{totalCount}
              </Badge>
              {/* Apply to all button - appears after first signature exists */}
              {sharedSignature && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Preserve scroll positions before bulk apply
                    if (sidebarScrollRefDesktop.current) {
                      sidebarScrollPositions.current.desktop = sidebarScrollRefDesktop.current.scrollTop
                    }
                    if (sidebarScrollRefMobile.current) {
                      sidebarScrollPositions.current.mobile = sidebarScrollRefMobile.current.scrollTop
                    }
                    // Apply shared signature to all remaining fields
                    const signaturesToApply = signatureFields
                      .filter((field) => {
                        const alreadyCompleted = completedSignatures.some(sig => sig.fieldId === field.id)
                        const hasExistingSignature = existingSignatures.some(sig => 
                          sig.page === field.page && sig.imageData && sig.imageData.length > 0 &&
                          Math.abs(sig.relativeX - field.relativeX) < 0.05 &&
                          Math.abs(sig.relativeY - field.relativeY) < 0.05
                        )
                        return !alreadyCompleted && !hasExistingSignature
                      })
                      .map((field) => ({
                        fieldId: field.id,
                        signatureDataUrl: sharedSignature.dataUrl,
                        signatureSource: sharedSignature.source,
                      }))

                    if (signaturesToApply.length > 0) {
                      setCompletedSignatures(prev => {
                        // remove any duplicates and append new bulk ones
                        const filteredPrev = prev.filter(sig => signaturesToApply.every(ns => ns.fieldId !== sig.fieldId))
                        return [...filteredPrev, ...signaturesToApply]
                      })
                    }
                    // Restore scroll positions on next frame
                    requestAnimationFrame(() => {
                      if (sidebarScrollRefDesktop.current) {
                        sidebarScrollRefDesktop.current.scrollTop = sidebarScrollPositions.current.desktop
                      }
                      if (sidebarScrollRefMobile.current) {
                        sidebarScrollRefMobile.current.scrollTop = sidebarScrollPositions.current.mobile
                      }
                    })
                  }}
                  className="hidden md:inline-flex"
                >
                  Usar firma en todos
                </Button>
              )}
              {/* Mobile menu button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDrawerOpen(true)}
                className="md:hidden h-8 w-8 p-0"
              >
                <Menu className="h-4 w-4" />
              </Button>
              {/* Hide send button on mobile - it will be in the sidebar/drawer */}
              <Button
                onClick={handleSubmitSignatures}
                disabled={isSubmitting || completedCount !== totalCount}
                className="hidden md:flex bg-green-600 hover:bg-green-700 text-white"
              >
                {isSubmitting ? "Enviando..." : "Enviar Documento"}
              </Button>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-3 md:px-6 py-2 md:py-3 border-b bg-gray-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 md:gap-4">
            {/* Page navigation */}
            <div className="flex items-center gap-1 md:gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPrevPage}
                disabled={pageNumber <= 1 || isLoading}
                className="h-8 w-8 p-0 md:h-9 md:w-auto md:px-3"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs md:text-sm font-medium min-w-[80px] md:min-w-[100px] text-center">
                {isLoading ? "..." : `${pageNumber} de ${numPages}`}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextPage}
                disabled={pageNumber >= numPages || isLoading}
                className="h-8 w-8 p-0 md:h-9 md:w-auto md:px-3"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="text-xs md:text-sm text-gray-600 hidden sm:block">
            Haz clic en las áreas azules para firmar
          </div>
          {sharedSignature && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Same bulk-apply action for small screens
                if (sidebarScrollRefDesktop.current) {
                  sidebarScrollPositions.current.desktop = sidebarScrollRefDesktop.current.scrollTop
                }
                if (sidebarScrollRefMobile.current) {
                  sidebarScrollPositions.current.mobile = sidebarScrollRefMobile.current.scrollTop
                }
                const signaturesToApply = signatureFields
                  .filter((field) => {
                    const alreadyCompleted = completedSignatures.some(sig => sig.fieldId === field.id)
                    const hasExistingSignature = existingSignatures.some(sig => 
                      sig.page === field.page && sig.imageData && sig.imageData.length > 0 &&
                      Math.abs(sig.relativeX - field.relativeX) < 0.05 &&
                      Math.abs(sig.relativeY - field.relativeY) < 0.05
                    )
                    return !alreadyCompleted && !hasExistingSignature
                  })
                  .map((field) => ({
                    fieldId: field.id,
                    signatureDataUrl: sharedSignature.dataUrl,
                    signatureSource: sharedSignature.source,
                  }))
                if (signaturesToApply.length > 0) {
                  setCompletedSignatures(prev => {
                    const filteredPrev = prev.filter(sig => signaturesToApply.every(ns => ns.fieldId !== sig.fieldId))
                    return [...filteredPrev, ...signaturesToApply]
                  })
                }
                requestAnimationFrame(() => {
                  if (sidebarScrollRefDesktop.current) {
                    sidebarScrollRefDesktop.current.scrollTop = sidebarScrollPositions.current.desktop
                  }
                  if (sidebarScrollRefMobile.current) {
                    sidebarScrollRefMobile.current.scrollTop = sidebarScrollPositions.current.mobile
                  }
                })
              }}
              className="md:hidden"
            >
              Usar firma en todos
            </Button>
          )}
        </div>

        {/* Document viewer - Scrollable container */}
        <div className="flex-1 overflow-auto bg-gray-100 p-2 md:p-4 pb-20 md:pb-2 min-h-0">
          <div className="w-full min-h-full flex justify-center">
            <div className="bg-white shadow-lg relative max-w-full">
              <Document
                file={documentUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={(error) => {
                  console.error("Error loading PDF:", error)
                  setPdfLoadError(error)
                  setIsLoading(false)
                  setNumPages(1)
                  toast({
                    title: "Error al cargar PDF",
                    description: "Hubo un problema al cargar el documento. Algunas funciones pueden estar limitadas.",
                    variant: "destructive"
                  })
                }}
                options={PDF_OPTIONS}
                loading={
                  <div className="flex items-center justify-center min-h-[50vh] w-full max-w-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">Cargando documento PDF...</p>
                    </div>
                  </div>
                }
                error={
                  <div className="flex flex-col items-center justify-center min-h-[50vh] w-full max-w-full bg-gray-50 border-2 border-dashed border-gray-300">
                    <div className="text-center p-4 lg:p-8">
                      <div className="text-red-500 text-4xl lg:text-6xl mb-4">⚠️</div>
                      <h3 className="text-base lg:text-lg font-semibold text-gray-900 mb-2">Error al cargar PDF</h3>
                      <p className="text-sm lg:text-base text-gray-600 mb-4">
                        No se pudo cargar el documento PDF. Esto podría deberse a:
                      </p>
                      <ul className="text-xs lg:text-sm text-gray-500 text-left mb-6">
                        <li>• Problemas de conectividad de red</li>
                        <li>• Corrupción del archivo PDF</li>
                        <li>• Incompatibilidad del navegador</li>
                        <li>• PDF.js worker no disponible</li>
                      </ul>
                      <div className="flex flex-col sm:flex-row gap-2 justify-center">
                        <button
                          onClick={() => {
                            setIsLoading(true)
                            setPdfLoadError(null)
                            window.location.reload()
                          }}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                        >
                          Recargar Página
                        </button>
                      </div>
                    </div>
                  </div>
                }
              >

                {!isLoading && !pdfLoadError && numPages > 0 ? (
                  <>
                    <Page
                      pageNumber={pageNumber}
                      scale={scale}
                      onLoadSuccess={onPageLoadSuccess}
                      loading={
                        <div className="flex items-center justify-center h-96">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        </div>
                      }
                    />

                    {/* Render existing signatures (read-only) - only those with actual signature images */}
                    {existingSignatures
                      .filter(sig => sig.page === pageNumber && sig.imageData && sig.imageData.length > 0)
                      .map((signature) => (
                        <div
                          key={`existing-${signature.id}`}
                          className="absolute border-2 border-transparent hover:border-green-400 transition-all group cursor-default"
                          style={{
                            left: `${signature.relativeX * pageSize.width * scale}px`,
                            top: `${signature.relativeY * pageSize.height * scale}px`,
                            width: `${signature.relativeWidth * pageSize.width * scale}px`,
                            height: `${signature.relativeHeight * pageSize.height * scale}px`,
                          }}
                        >
                          <img
                            src={signature.imageData}
                            alt="Firma existente"
                            className="w-full h-full object-contain"
                          />
                          {/* Tooltip for existing signatures */}
                          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-green-600 text-white text-xs px-2 py-1 rounded shadow-lg z-40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                            Firmado con FastSign
                          </div>
                        </div>
                      ))}

                    {/* Render signature fields - exclude fields that have existing signatures in the same location */}
                    {fieldsOnCurrentPage
                      .filter((field) => {
                        // Check if there's an existing signature in roughly the same position
                        const hasExistingSignatureInSameLocation = existingSignatures.some(sig => 
                          sig.page === field.page && 
                          sig.imageData && 
                          sig.imageData.length > 0 &&
                          Math.abs(sig.relativeX - field.relativeX) < 0.05 && // Within 5% tolerance
                          Math.abs(sig.relativeY - field.relativeY) < 0.05
                        )
                        return !hasExistingSignatureInSameLocation
                      })
                      .map((field) => {
                      const isCompleted = isFieldCompleted(field.id)
                      const signature = completedSignatures.find(sig => sig.fieldId === field.id)
                      
                      // 🔧 LANDSCAPE FIX: Correct relative coordinates for landscape documents
                      // Problem: Editor saves relative coords using portrait dimensions (612x792)
                      // Solution: Convert back to absolute using portrait, then to relative using landscape
                      let correctedRelativeX = field.relativeX
                      let correctedRelativeY = field.relativeY
                      let correctedRelativeWidth = field.relativeWidth
                      let correctedRelativeHeight = field.relativeHeight
                      
                      const isLandscapeDocument = pageSize.width > pageSize.height
                      
                      if (isLandscapeDocument) {
                        // Convert relative coords back to absolute using PORTRAIT dimensions (how they were saved)
                        const portraitWidth = 612
                        const portraitHeight = 792
                        
                        const absoluteXFromPortrait = field.relativeX * portraitWidth
                        const absoluteYFromPortrait = field.relativeY * portraitHeight
                        const absoluteWidthFromPortrait = field.relativeWidth * portraitWidth
                        const absoluteHeightFromPortrait = field.relativeHeight * portraitHeight
                        
                        // Convert absolute coords to relative using LANDSCAPE dimensions (correct)
                        correctedRelativeX = absoluteXFromPortrait / pageSize.width
                        correctedRelativeY = absoluteYFromPortrait / pageSize.height
                        correctedRelativeWidth = absoluteWidthFromPortrait / pageSize.width
                        correctedRelativeHeight = absoluteHeightFromPortrait / pageSize.height
                      }
                      
                      const calculatedLeft = correctedRelativeX * pageSize.width * scale
                      const calculatedTop = correctedRelativeY * pageSize.height * scale

                      return (
                        <div
                          key={field.id}
                          className={`absolute cursor-pointer transition-all ${
                            isCompleted 
                              ? 'border-2 border-green-500 bg-green-100' 
                              : 'border-2 border-blue-500 bg-blue-100 hover:bg-blue-200'
                          } bg-opacity-50 flex items-center justify-center group`}
                          style={{
                            left: `${calculatedLeft}px`,
                            top: `${calculatedTop}px`,
                            width: `${correctedRelativeWidth * pageSize.width * scale}px`,
                            height: `${correctedRelativeHeight * pageSize.height * scale}px`,
                          }}
                          onClick={() => handleFieldClick(field)}
                        >
                          {isCompleted && signature ? (
                            <img
                              src={signature.signatureDataUrl}
                              alt="Firma"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <>
                              {/* Pulsing circle indicator */}
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="relative">
                                  <div className="w-8 h-8 bg-blue-500 rounded-full animate-ping opacity-75"></div>
                                  <div className="absolute inset-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                                    <Edit3 className="h-4 w-4 text-white" />
                                  </div>
                                </div>
                              </div>
                              {/* Field label */}
                              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white text-xs p-1 text-center">
                                {field.label}
                              </div>
                            </>
                          )}
                          
                          {isCompleted && (
                            <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                              <Check className="h-3 w-3" />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </>
                ) : isLoading ? (
                  <div className="flex items-center justify-center min-h-[50vh] w-full max-w-full bg-gray-50">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">Inicializando visor PDF...</p>
                    </div>
                  </div>
                ) : pdfLoadError ? (
                  <div className="flex items-center justify-center min-h-[50vh] w-full max-w-full bg-red-50 border-2 border-red-200">
                    <div className="text-center p-4 lg:p-6">
                      <div className="text-red-500 text-3xl lg:text-4xl mb-4">❌</div>
                      <h3 className="text-base lg:text-lg font-semibold text-red-900 mb-2">Error de PDF</h3>
                      <p className="text-red-700 text-xs lg:text-sm mb-4">
                        {pdfLoadError.message || "Error al cargar el documento PDF"}
                      </p>
                      <button
                        onClick={() => {
                          setIsLoading(true)
                          setPdfLoadError(null)
                          window.location.reload()
                        }}
                        className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                      >
                        Reintentar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center min-h-[50vh] w-full max-w-full bg-gray-50">
                    <div className="text-center">
                      <p className="text-gray-600">No hay páginas PDF disponibles</p>
                    </div>
                  </div>
                )}
              </Document>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar with signature fields - Desktop only */}
      <div className="hidden md:flex w-80 border-l bg-gray-50 flex-col">
        <SidebarContent
          scrollRef={sidebarScrollRefDesktop}
          onScroll={(e) => {
            sidebarScrollPositions.current.desktop = (e.currentTarget as HTMLDivElement).scrollTop
          }}
        />
      </div>

      {/* Mobile Drawer */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent side="right" className="w-[75vw] sm:w-80 p-0 bg-gray-50">
          <SheetHeader className="sr-only">
            <SheetTitle>Firmas Requeridas</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col h-full">
            <SidebarContent
              onClose={() => setIsDrawerOpen(false)}
              scrollRef={sidebarScrollRefMobile}
              onScroll={(e) => {
                sidebarScrollPositions.current.mobile = (e.currentTarget as HTMLDivElement).scrollTop
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Signature Modal */}
      {showSignatureModal && currentField && (
        <SimpleSignatureCanvas
          isOpen={showSignatureModal}
          onClose={() => setShowSignatureModal(false)}
          onComplete={handleSignatureComplete}
        />
      )}

      {/* Fixed Bottom Bar - Mobile only */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-white p-4 z-10">
        {completedCount === totalCount ? (
          <Button
            onClick={handleSubmitSignatures}
            disabled={isSubmitting}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
            size="lg"
          >
            {isSubmitting ? "Enviando..." : "Enviar Documento"}
          </Button>
        ) : (
          <Button
            onClick={() => setIsDrawerOpen(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3"
            size="lg"
          >
            Firmar el Documento ({completedCount}/{totalCount})
          </Button>
        )}
      </div>
    </div>
  )
}
