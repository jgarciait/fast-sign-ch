"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import { Logo } from "@/components/logo"

// Import centralized PDF configuration
import PDF_CONFIG, { configurePdfWorker } from '@/utils/pdf-config-centralized'

// Configure PDF.js worker properly
configurePdfWorker()

interface SignDocumentViewerProps {
  documentId: string
  documentName: string
  token?: string
  requestId?: string
  onSign?: () => void
  onBack?: () => void
  showSignButton?: boolean
  showBackButton?: boolean
}

export default function SignDocumentViewer({
  documentId,
  documentName,
  token,
  requestId,
  onSign,
  onBack,
  showSignButton = false,
  showBackButton = false,
}: SignDocumentViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.0)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [documentUrl, setDocumentUrl] = useState<string>("")
  const [error, setError] = useState<string>("")

  // Generate the document URL when component mounts
  useEffect(() => {
    if (documentId) {
      setIsLoading(true)
      setError("")
      
      // For signed documents with token and requestId, use the signed document print API
      if (token && requestId) {
        // This is a signed document - use print API to get merged PDF
        const url = `/api/documents/${documentId}/print?token=${encodeURIComponent(token)}&requestId=${encodeURIComponent(requestId)}`
        setDocumentUrl(url)
        setIsLoading(false)
      } else if (token) {
        // For signing documents with token, use the PDF proxy
        const url = `/api/pdf/${documentId}`
        console.log("Setting document URL for signing:", url)
        setDocumentUrl(url)
        setIsLoading(false)
      } else {
        // Check if this is a fast-sign document or case file document
        // We'll try the fast-sign print endpoint first, then fallback to regular PDF
        checkDocumentTypeAndSetUrl()
      }
    }
  }, [documentId, token, requestId])

  const checkDocumentTypeAndSetUrl = async () => {
    try {
      // First, get document info from database to determine type
      const docResponse = await fetch(`/api/pdf/${documentId}`, { method: 'HEAD' })
      
      if (docResponse.ok) {
        // Check if this document has signatures by trying the fast-sign print endpoint
        const fastSignResponse = await fetch(`/api/fast-sign/${documentId}/print`, { method: 'HEAD' })
        
        if (fastSignResponse.ok) {
          // This document has signatures - use fast-sign print endpoint for merged PDF
          console.log('Document has signatures - using fast-sign print endpoint')
          setDocumentUrl(`/api/fast-sign/${documentId}/print`)
        } else {
          // No signatures or not a fast-sign document - use regular PDF
          console.log('Document has no signatures - using regular PDF endpoint')
          setDocumentUrl(`/api/pdf/${documentId}`)
        }
      } else {
        // Document not found in regular endpoint, might be a different type
        console.log('Document not found in regular endpoint')
        setError("Document not found")
      }
    } catch (error) {
      console.error('Error determining document type:', error)
      setError("Error loading document")
    } finally {
      setIsLoading(false)
    }
  }

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    console.log("PDF loaded successfully:", { numPages, documentUrl })
    setNumPages(numPages)
    setPageNumber(1)
    setIsLoading(false)
  }

  const onDocumentLoadError = (error: any) => {
    console.error("Error loading PDF:", error)
    console.error("Document URL:", documentUrl)
    setError(`Failed to load document: ${error?.message || 'Unknown error'}`)
    setIsLoading(false)
  }

  const goToPrevPage = () => {
    setPageNumber(prev => Math.max(prev - 1, 1))
  }

  const goToNextPage = () => {
    setPageNumber(prev => Math.min(prev + 1, numPages))
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

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {showBackButton && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBack}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Atrás
              </Button>
            )}
            <div className="flex items-center space-x-2">
              <Logo className="h-6 w-6" color="#0d2340" />
              <h1 className="text-lg font-semibold truncate max-w-md">
                {documentName}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={isLoading || !!error}
            >
              <Download className="h-4 w-4 mr-1" />
              Descargar
            </Button>
            {showSignButton && (
              <Button
                onClick={onSign}
                disabled={isLoading || !!error}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Firmar Documento
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3 border-b bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Page navigation */}
          <Button
            variant="outline"
            size="sm"
            onClick={goToPrevPage}
            disabled={pageNumber <= 1 || isLoading}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[100px] text-center">
            {isLoading ? "..." : `${pageNumber} de ${numPages}`}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextPage}
            disabled={pageNumber >= numPages || isLoading}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={zoomOut}
            disabled={scale <= 0.5 || isLoading}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={zoomIn}
            disabled={scale >= 1.75 || isLoading}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Document viewer */}
      <div className="flex-1 overflow-auto bg-gray-100 p-4">
        <div className="flex justify-center">
          {isLoading ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p className="text-sm text-gray-600">Cargando documento...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <p className="text-red-600 mb-2">{error}</p>
                <Button onClick={() => window.location.reload()}>
                  Reintentar
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-white shadow-lg">
              <Document
                file={documentUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                options={{
                  cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
                  cMapPacked: true,
                  standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/standard_fonts/'
                }}
                loading={
                  <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Cargando documento...</p>
                    </div>
                  </div>
                }
                error={
                  <div className="flex items-center justify-center h-96 bg-red-50 border-2 border-red-200">
                    <div className="text-center p-4">
                      <div className="text-red-500 text-3xl mb-4">❌</div>
                      <h3 className="text-lg font-semibold text-red-900 mb-2">Error al cargar PDF</h3>
                      <p className="text-red-700 text-sm mb-4">No se pudo cargar el documento</p>
                      <button
                        onClick={() => window.location.reload()}
                        className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                      >
                        Reintentar
                      </button>
                    </div>
                  </div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  loading={
                    <div className="flex items-center justify-center h-96">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  }
                />
              </Document>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
