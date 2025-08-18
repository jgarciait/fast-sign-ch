"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Loader2, RotateCw } from 'lucide-react'

// Dynamic import for PDF components
let Document: any, Page: any, pdfjs: any

interface ReactPdfViewerProps {
  documentUrl: string
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  onRotateAllPages: () => void
  onRotateCurrentPage?: () => void
  rotationAngle?: number
  onLoadSuccess?: (pdf: any) => void
}

export default function ReactPdfViewer({
  documentUrl,
  currentPage,
  totalPages,
  onPageChange,
  onRotateAllPages,
  onRotateCurrentPage,
  rotationAngle = 0,
  onLoadSuccess
}: ReactPdfViewerProps) {
  const [scale, setScale] = useState(1.0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [isPdfLoaded, setIsPdfLoaded] = useState(false)
  const [pdfLoadError, setPdfLoadError] = useState(false)

  // Load PDF.js dynamically
  useEffect(() => {
    const loadPdfJs = async () => {
      try {
        const reactPdf = await import('react-pdf')
        Document = reactPdf.Document
        Page = reactPdf.Page
        pdfjs = reactPdf.pdfjs
        
        // Set up PDF.js worker
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        
        setIsPdfLoaded(true)
      } catch (error) {
        console.error('Error loading PDF.js:', error)
        setPdfLoadError(true)
      }
    }

    loadPdfJs()
  }, [])

  // Monitor container width for responsive scaling
  useEffect(() => {
    const handleResize = () => {
      const container = document.querySelector('.pdf-viewer-container')
      if (container) {
        setContainerWidth(container.clientWidth)
      }
    }
    
    handleResize()
    window.addEventListener('resize', handleResize)
    
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Calculate optimal scale based on container width
  const calculateOptimalScale = () => {
    if (containerWidth === 0) return 1.0
    
    // Base scale calculation for different container widths
    if (containerWidth > 1200) {
      return 1.4 // Very large screens - bigger scale
    } else if (containerWidth > 900) {
      return 1.2 // Large screens
    } else if (containerWidth > 600) {
      return 1.0 // Medium screens
    } else if (containerWidth > 400) {
      return 0.8 // Small screens
    } else {
      return 0.6 // Very small screens
    }
  }

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 1.75))
  }

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5))
  }

  const handleFitToWidth = () => {
    const optimalScale = calculateOptimalScale()
    setScale(optimalScale)
  }

  const handlePrevPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1)
    }
  }

  // Auto-adjust scale when container width changes
  useEffect(() => {
    if (containerWidth > 0) {
      const optimalScale = calculateOptimalScale()
      setScale(optimalScale)
    }
  }, [containerWidth])

  if (pdfLoadError) {
    return (
      <div className="flex items-center justify-center h-full bg-red-50">
        <div className="text-red-500">Error cargando PDF</div>
      </div>
    )
  }

  if (!isPdfLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <div className="text-gray-500">Cargando PDF...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 pdf-viewer-container">
      {/* Controls */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <span className="text-sm text-gray-600 px-2">
            Página {currentPage} de {totalPages}
          </span>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Rotate Buttons */}
        <div className="flex items-center gap-2">
          {onRotateCurrentPage && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRotateCurrentPage}
              className="flex items-center gap-2"
              title="Rotar página actual 90°"
            >
              <RotateCw className="w-4 h-4" />
              Rotar Página
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onRotateAllPages}
            className="flex items-center gap-2"
            title="Rotar todas las páginas 90°"
          >
            <RotateCw className="w-4 h-4" />
            Rotar Todas
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleFitToWidth}
            className="text-xs px-2"
            title="Ajustar al ancho"
          >
            Ajustar
          </Button>
          
          <span className="text-sm text-gray-600 min-w-[70px] text-center px-2">
            {Math.round(scale * 100)}%
          </span>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomIn}
            disabled={scale >= 3.0}
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Document Viewer */}
      <div className="flex-1 overflow-auto">
        <div className="flex justify-center items-center min-h-full p-4">
          <div className="bg-white shadow-lg max-w-full max-h-full">
            {/* Loading indicator */}
            {isLoading && (
              <div className="flex items-center justify-center w-full h-96 bg-gray-50">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="flex items-center justify-center w-full h-96 bg-red-50 text-red-500">
                Error al cargar el documento
              </div>
            )}

            {/* PDF Document */}
            {isPdfLoaded && (
              <Document
                file={documentUrl}
                onLoadSuccess={(pdf: any) => {
                  setIsLoading(false)
                  if (onLoadSuccess) {
                    onLoadSuccess(pdf)
                  }
                }}
                onLoadError={(error: any) => {
                  setError(error.message)
                  setIsLoading(false)
                }}
                loading=""
                error=""
              >
                <Page
                  pageNumber={currentPage}
                  scale={scale}
                  rotate={rotationAngle}
                  loading=""
                  error=""
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  onRenderSuccess={() => setIsLoading(false)}
                  onRenderError={(error: any) => {
                    setError(error.message)
                    setIsLoading(false)
                  }}
                />
              </Document>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 