'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Check } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'

interface SignatureField {
  id: string
  x: number
  y: number
  width: number
  height: number
  page: number
  relativeX: number
  relativeY: number
  relativeWidth: number
  relativeHeight: number
  label: string
}

interface SimpleDocumentLoaderProps {
  documentUrl: string
  documentName: string
  documentId: string
  signatureFields: SignatureField[]
  token: string
  onComplete: () => void
  onBack?: () => void
}

interface CompletedSignature {
  fieldId: string
  signatureDataUrl: string
}

export default function SimpleDocumentLoader({
  documentUrl,
  documentName,
  documentId,
  signatureFields,
  token,
  onComplete,
  onBack
}: SimpleDocumentLoaderProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [completedSignatures, setCompletedSignatures] = useState<CompletedSignature[]>([])
  const [showSignatureModal, setShowSignatureModal] = useState(false)
  const [currentField, setCurrentField] = useState<SignatureField | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pdfLoaded, setPdfLoaded] = useState(false)

  useEffect(() => {
    const loadPdf = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        const response = await fetch(documentUrl)
        if (!response.ok) {
          throw new Error('Failed to load document')
        }
        
        const maxPage = Math.max(...signatureFields.map(f => f.page), 1)
        setTotalPages(maxPage)
        setPdfLoaded(true)
        setIsLoading(false)
        
      } catch (err) {
        console.error('Error loading PDF:', err)
        setError('Failed to load document')
        setIsLoading(false)
      }
    }

    loadPdf()
  }, [documentUrl, signatureFields])

  const handleFieldClick = (field: SignatureField) => {
    setCurrentField(field)
    setShowSignatureModal(true)
  }

  const handleSignatureComplete = (dataUrl: string) => {
    if (!currentField) return

    const newSignature: CompletedSignature = {
      fieldId: currentField.id,
      signatureDataUrl: dataUrl
    }

    setCompletedSignatures(prev => {
      const filtered = prev.filter(sig => sig.fieldId !== currentField.id)
      return [...filtered, newSignature]
    })

    setShowSignatureModal(false)
    setCurrentField(null)

    toast({
      title: "Firma añadida",
      description: `Firma añadida al campo "${currentField.label}"`,
    })
  }

  const handleSubmitSignatures = async () => {
    if (completedSignatures.length !== signatureFields.length) {
      toast({
        title: "Firmas incompletas",
        description: "Debe completar todas las firmas requeridas antes de enviar",
        variant: "destructive"
      })
      return
    }

    // Show confirmation dialog
    const confirmed = window.confirm(
      "¿Está seguro de que desea enviar el documento firmado? Esta acción no se puede deshacer."
    )

    if (!confirmed) {
      return
    }

    setIsSubmitting(true)

    try {
      // First, save all signatures to document_signatures table
      console.log(`Saving ${completedSignatures.length} signatures to database...`)
      
      for (const signature of completedSignatures) {
        const field = signatureFields.find(f => f.id === signature.fieldId)
        if (!field) continue

        // Calculate relative width and height based on page dimensions
        // Default page dimensions for US Letter size (612x792 points)
        const defaultPageWidth = 612
        const defaultPageHeight = 792
        
        // Calculate relative dimensions if not already present
        const relativeWidth = field.relativeWidth || (field.width / defaultPageWidth)
        const relativeHeight = field.relativeHeight || (field.height / defaultPageHeight)

        const response = await fetch(`/api/documents/${documentId}/signature`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            signatureDataUrl: signature.signatureDataUrl,
            signatureSource: 'canvas',
            token: token,
            position: {
              x: field.x,
              y: field.y,
              width: field.width,
              height: field.height,
              page: field.page,
              relativeX: field.relativeX,
              relativeY: field.relativeY,
              relativeWidth: relativeWidth,
              relativeHeight: relativeHeight
            }
          }),
        })

        if (!response.ok) {
          throw new Error(`Failed to save signature for field ${field.label}`)
        }
      }

      // Now validate that all signatures were properly saved
      console.log(`Validating ${signatureFields.length} required signatures...`)
      
      const validateResponse = await fetch(`/api/documents/${documentId}/signatures/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: token,
          requiredSignatureCount: signatureFields.length
        }),
      })

      if (!validateResponse.ok) {
        throw new Error("Failed to validate signatures")
      }

      const { hasAllSignatures, signatureCount } = await validateResponse.json()
      
      if (!hasAllSignatures) {
        throw new Error(`Missing signatures. Expected ${signatureFields.length}, found ${signatureCount}`)
      }

      console.log(`All ${signatureCount} signatures validated successfully`)

      // Send the document and update statuses
      const sendResponse = await fetch(`/api/documents/${documentId}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: token,
          updateStatus: true // Flag to update document and signing_request status
        }),
      })

      if (!sendResponse.ok) {
        const errorData = await sendResponse.json()
        throw new Error(errorData.error || "Failed to send document")
      }

      const result = await sendResponse.json()

      toast({
        title: "Documento firmado exitosamente",
        description: "El documento ha sido firmado y enviado. Se ha actualizado el estado a 'signed'.",
      })

      // Redirect to completion page
      setTimeout(() => {
        onComplete()
      }, 2000)

    } catch (error) {
      console.error("Error submitting signatures:", error)
      toast({
        title: "Error al enviar documento",
        description: error instanceof Error ? error.message : "Error al enviar las firmas",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFieldCompleted = (fieldId: string) => {
    return completedSignatures.some(sig => sig.fieldId === fieldId)
  }

  const fieldsOnCurrentPage = signatureFields.filter(field => field.page === currentPage)
  const completedCount = completedSignatures.length
  const totalCount = signatureFields.length

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando documento...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Error al cargar PDF</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Recargar Página
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-white">
      <div className="flex-1 flex flex-col">
        <div className="px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {onBack && (
                <Button variant="outline" size="sm" onClick={onBack}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Atrás
                </Button>
              )}
              <h1 className="text-lg font-semibold">{documentName}</h1>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                Firmas: {completedCount}/{totalCount}
              </span>
              <Button
                onClick={handleSubmitSignatures}
                disabled={completedCount !== totalCount || isSubmitting}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? "Enviando..." : "Enviar Documento"}
              </Button>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 border-b bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex flex-col items-center">
                <span className="text-sm font-medium min-w-[100px] text-center">
                  {currentPage} de {totalPages}
                </span>
                {fieldsOnCurrentPage.length > 0 && (
                  <span className="text-xs text-blue-600 font-medium">
                    {fieldsOnCurrentPage.length} firma{fieldsOnCurrentPage.length !== 1 ? 's' : ''} en esta página
                  </span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setScale(prev => Math.max(prev - 0.2, 0.5))}
                disabled={scale <= 0.5}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[60px] text-center">
                {Math.round(scale * 100)}%
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setScale(prev => Math.min(prev + 0.2, 3.0))}
                disabled={scale >= 3.0}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              Haz clic en las áreas azules para firmar
            </div>
            
            {/* Quick page navigation for pages with signatures */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">Páginas con firmas:</span>
              {Array.from(new Set(signatureFields.map(f => f.page))).sort((a, b) => a - b).map(pageNum => (
                <Button
                  key={pageNum}
                  variant={pageNum === currentPage ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(pageNum)}
                  className="h-6 w-6 p-0 text-xs"
                >
                  {pageNum}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-gray-100 p-4">
          <div className="flex justify-center">
            <div className="bg-white shadow-lg relative" style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}>
              <iframe
                key={`pdf-${currentPage}`}
                src={`${documentUrl}#page=${currentPage}&toolbar=0&navpanes=0&scrollbar=0&zoom=page-fit&view=FitH`}
                width="800"
                height="1000"
                className="border-0"
                title={`${documentName} - Página ${currentPage}`}
                onLoad={() => setPdfLoaded(true)}
                style={{
                  pointerEvents: 'none'
                }}
              />

              {pdfLoaded && fieldsOnCurrentPage.map((field) => {
                const isCompleted = isFieldCompleted(field.id)
                const signature = completedSignatures.find(sig => sig.fieldId === field.id)

                return (
                  <div
                    key={field.id}
                    className={`absolute border-2 cursor-pointer transition-all ${
                      isCompleted 
                        ? 'border-green-500 bg-green-100' 
                        : 'border-blue-500 bg-blue-100 hover:bg-blue-200'
                    } bg-opacity-50 flex items-center justify-center group`}
                    style={{
                      left: `${field.relativeX * 800}px`,
                      top: `${field.relativeY * 1000}px`,
                      width: `${field.relativeWidth * 800}px`,
                      height: `${field.relativeHeight * 1000}px`,
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
                      <div className="text-xs font-medium text-blue-800 text-center px-1">
                        {field.label}
                      </div>
                    )}
                    
                    {isCompleted && (
                      <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="w-80 border-l bg-gray-50 p-4 overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">Firmas Requeridas</h3>
        
        {/* Current page signatures */}
        {fieldsOnCurrentPage.length > 0 && (
          <div className="mb-6">
            <h4 className="text-md font-medium mb-3 text-blue-600">Página {currentPage}</h4>
            <div className="space-y-2">
              {fieldsOnCurrentPage.map((field) => {
                const isCompleted = isFieldCompleted(field.id)
                return (
                  <div
                    key={field.id}
                    className={`p-3 rounded-lg border ${
                      isCompleted ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{field.label}</span>
                      {isCompleted && (
                        <Check className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={isCompleted ? "outline" : "default"}
                      onClick={() => {
                        if (!isCompleted) {
                          handleFieldClick(field)
                        }
                      }}
                      className="w-full"
                    >
                      {isCompleted ? "✓ Firmado" : "Firmar"}
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* All signatures overview */}
        <div>
          <h4 className="text-md font-medium mb-3 text-gray-700">Todas las Firmas</h4>
          <div className="space-y-2">
            {signatureFields.map((field) => {
              const isCompleted = isFieldCompleted(field.id)
              const isCurrentPage = field.page === currentPage
              return (
                <div
                  key={field.id}
                  className={`p-2 rounded border text-sm ${
                    isCurrentPage 
                      ? 'bg-blue-50 border-blue-200' 
                      : isCompleted 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{field.label}</span>
                      <p className="text-xs text-gray-600">Página {field.page}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {isCompleted && (
                        <Check className="h-3 w-3 text-green-600" />
                      )}
                      {isCurrentPage && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setCurrentPage(field.page)
                      setTimeout(() => {
                        if (!isCompleted) {
                          handleFieldClick(field)
                        }
                      }, 100)
                    }}
                    className="w-full mt-1 h-6 text-xs"
                  >
                    {isCurrentPage ? "En esta página" : `Ir a página ${field.page}`}
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {showSignatureModal && currentField && (
        <SignatureModal
          fieldLabel={currentField.label}
          onComplete={handleSignatureComplete}
          onCancel={() => {
            setShowSignatureModal(false)
            setCurrentField(null)
          }}
        />
      )}
    </div>
  )
}

interface SignatureModalProps {
  fieldLabel: string
  onComplete: (dataUrl: string) => void
  onCancel: () => void
}

function SignatureModal({ fieldLabel, onComplete, onCancel }: SignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    setIsDrawing(true)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const handleComplete = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dataUrl = canvas.toDataURL()
    onComplete(dataUrl)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">Firmar: {fieldLabel}</h3>
        <div className="border-2 border-gray-300 rounded-lg mb-4">
          <canvas
            ref={canvasRef}
            width="400"
            height="200"
            className="w-full cursor-crosshair"
            style={{ touchAction: 'none' }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={clearCanvas}>
            Limpiar
          </Button>
          <Button onClick={handleComplete} className="flex-1">
            Confirmar Firma
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  )
}
