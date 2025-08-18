"use client"

import React, { useState, useRef, useCallback, useEffect } from "react"
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Plus, X, Save, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

export interface SignatureField {
  id: string
  page: number
  x: number
  y: number
  width: number
  height: number
  relativeX: number
  relativeY: number
  relativeWidth: number
  relativeHeight: number
  label: string
}

interface SimpleDocumentViewerProps {
  documentId: string
  documentName: string
  documentUrl: string
  onBack: () => void
  onSave: (fields: SignatureField[]) => Promise<void>
  initialFields?: SignatureField[]
}

export default function SimpleDocumentViewer({
  documentId,
  documentName,
  documentUrl,
  onBack,
  onSave,
  initialFields = []
}: SimpleDocumentViewerProps) {
  const [signatureFields, setSignatureFields] = useState<SignatureField[]>(initialFields)
  const [isAddingField, setIsAddingField] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [scale, setScale] = useState(1.2)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [pdfLoaded, setPdfLoaded] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  // Try multiple URL formats to find one that works
  const tryUrls = [
    `/api/pdf/${documentId}`,
    documentUrl,
    documentUrl.replace('/storage/v1/object/public/', '/storage/v1/object/sign/'),
    documentUrl + '?t=' + Date.now() // Cache busting
  ]

  const [currentUrlIndex, setCurrentUrlIndex] = useState(0)
  const [currentUrl, setCurrentUrl] = useState(tryUrls[0])

  useEffect(() => {
    setCurrentUrl(tryUrls[currentUrlIndex])
  }, [currentUrlIndex])

  const handleIframeLoad = () => {
    setPdfLoaded(true)
    setPdfError(null)
    console.log(`PDF loaded successfully with URL: ${currentUrl}`)
  }

  const handleIframeError = () => {
    console.error(`Failed to load PDF with URL: ${currentUrl}`)
    
    if (currentUrlIndex < tryUrls.length - 1) {
      console.log(`Trying next URL...`)
      setCurrentUrlIndex(prev => prev + 1)
    } else {
      setPdfError("Unable to load PDF document. Please try refreshing the page or contact support.")
      setPdfLoaded(false)
    }
  }

  const handleContainerClick = (e: React.MouseEvent) => {
    if (!isAddingField || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Calculate relative position (assuming container represents the PDF page)
    const relativeX = x / rect.width
    const relativeY = y / rect.height

    const newField: SignatureField = {
      id: `field-${Date.now()}`,
      page: currentPage,
      x: x,
      y: y,
      width: 150,
      height: 50,
      relativeX: relativeX,
      relativeY: relativeY,
      relativeWidth: 150 / rect.width,
      relativeHeight: 50 / rect.height,
      label: `Signature ${signatureFields.length + 1}`
    }

    setSignatureFields(prev => [...prev, newField])
    setIsAddingField(false)
    
    toast({
      title: "Signature field added",
      description: "Click and drag to reposition, or click the X to remove.",
    })
  }

  const handleRemoveField = (fieldId: string) => {
    setSignatureFields(prev => prev.filter(f => f.id !== fieldId))
  }

  const handleSave = async () => {
    if (signatureFields.length === 0) {
      toast({
        title: "No signature fields",
        description: "Please add at least one signature field before saving.",
        variant: "destructive"
      })
      return
    }

    setIsSaving(true)
    try {
      await onSave(signatureFields)
      toast({
        title: "Signature mapping saved",
        description: `Saved ${signatureFields.length} signature fields.`,
      })
    } catch (error) {
      toast({
        title: "Error saving mapping",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 3))
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5))

  if (pdfError) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-white">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={onBack}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <h2 className="text-lg font-semibold">{documentName}</h2>
          </div>
        </div>

        {/* Error content */}
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center p-8">
            <div className="text-6xl mb-4">📄</div>
            <h3 className="text-lg font-semibold mb-2">Unable to Load Document</h3>
            <p className="text-gray-600 mb-4 max-w-md">{pdfError}</p>
            <div className="space-x-2">
              <Button onClick={() => {
                setCurrentUrlIndex(0)
                setPdfError(null)
              }}>
                Try Again
              </Button>
              <Button variant="outline" onClick={onBack}>
                Go Back
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h2 className="text-lg font-semibold">{documentName}</h2>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant={isAddingField ? "default" : "outline"}
            size="sm"
            onClick={() => setIsAddingField(!isAddingField)}
          >
            <Plus className="h-4 w-4 mr-1" />
            {isAddingField ? "Click on document" : "Add Field"}
          </Button>
          
          <div className="flex items-center space-x-1 border rounded">
            <Button variant="ghost" size="sm" onClick={zoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="px-2 text-sm">{Math.round(scale * 100)}%</span>
            <Button variant="ghost" size="sm" onClick={zoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
          
          <Button 
            onClick={handleSave} 
            disabled={isSaving || signatureFields.length === 0}
            size="sm"
          >
            <Save className="h-4 w-4 mr-1" />
            {isSaving ? "Saving..." : `Save (${signatureFields.length})`}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div 
          ref={containerRef}
          className="relative h-full cursor-pointer"
          onClick={handleContainerClick}
          style={{ 
            cursor: isAddingField ? 'crosshair' : 'default',
            transform: `scale(${scale})`,
            transformOrigin: 'top left'
          }}
        >
          {/* PDF Iframe */}
          <iframe
            ref={iframeRef}
            src={currentUrl}
            className="w-full h-full border-0"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            title={documentName}
          />
          
          {/* Loading overlay */}
          {!pdfLoaded && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Loading document...</p>
                {currentUrlIndex > 0 && (
                  <p className="text-xs text-gray-500 mt-1">Trying alternative URL...</p>
                )}
              </div>
            </div>
          )}

          {/* Signature Fields Overlay */}
          {signatureFields.map((field) => (
            <div
              key={field.id}
              className="absolute border-2 border-dashed border-blue-500 bg-blue-100 bg-opacity-30 flex items-center justify-center group"
              style={{
                left: `${field.relativeX * 100}%`,
                top: `${field.relativeY * 100}%`,
                width: `${field.relativeWidth * 100}%`,
                height: `${field.relativeHeight * 100}%`,
                transform: `scale(${1/scale})`,
                transformOrigin: 'top left'
              }}
            >
              <span className="text-xs text-blue-700 font-medium bg-white px-1 rounded">
                {field.label}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemoveField(field.id)
                }}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          {/* Add field instruction */}
          {isAddingField && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
              Click anywhere on the document to add a signature field
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {signatureFields.length} signature field{signatureFields.length !== 1 ? 's' : ''} mapped
          </div>
          
          {isAddingField && (
            <div className="text-sm text-blue-600 font-medium">
              Click on the document to place signature fields
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
