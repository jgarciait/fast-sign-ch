"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Loader2, RotateCw } from 'lucide-react'

// Dynamic import for PDF components
let Document: any, Page: any, pdfjs: any

interface OptimizedPdfViewerProps {
  documentUrl: string
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  onRotateAllPages: () => void
  onRotateCurrentPage?: () => void
  rotationAngle?: number
  onLoadSuccess?: (pdf: any) => void
  className?: string
}

export default function OptimizedPdfViewer({
  documentUrl,
  currentPage,
  totalPages,
  onPageChange,
  onRotateAllPages,
  onRotateCurrentPage,
  rotationAngle = 0,
  onLoadSuccess,
  className = ''
}: OptimizedPdfViewerProps) {
  const [scale, setScale] = useState(1.0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [isPdfLoaded, setIsPdfLoaded] = useState(false)
  const [pdfDocument, setPdfDocument] = useState<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pageRenderRef = useRef<{ [key: number]: boolean }>({})

  // Load PDF.js dynamically
  useEffect(() => {
    const loadPdfJs = async () => {
      try {
        const reactPdf = await import('react-pdf')
        Document = reactPdf.Document
        Page = reactPdf.Page
        pdfjs = reactPdf.pdfjs
        
        // Set up PDF.js worker only if not already set
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        }
        
        setIsPdfLoaded(true)
      } catch (error) {
        console.error('Error loading PDF.js:', error)
        setError('Error loading PDF.js')
      }
    }

    loadPdfJs()
  }, [])

  // Monitor container width for responsive scaling
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth)
      }
    }
    
    const timeoutId = setTimeout(handleResize, 100)
    window.addEventListener('resize', handleResize)
    
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // Calculate optimal scale based on container width
  const calculateOptimalScale = useCallback(() => {
    if (containerWidth === 0) return 1.0
    
    if (containerWidth > 1400) {
      return 1.5
    } else if (containerWidth > 1200) {
      return 1.3
    } else if (containerWidth > 900) {
      return 1.1
    } else if (containerWidth > 600) {
      return 0.9
    } else if (containerWidth > 400) {
      return 0.7
    } else {
      return 0.5
    }
  }, [containerWidth])

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.2, 3.0))
  }

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.2, 0.3))
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

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      handlePrevPage()
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      handleNextPage()
    } else if (e.key === '=' || e.key === '+') {
      e.preventDefault()
      handleZoomIn()
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault()
      handleZoomOut()
    } else if (e.key === '0') {
      e.preventDefault()
      handleFitToWidth()
    }
  }, [currentPage, totalPages])

  // Keyboard navigation
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Auto-adjust scale when container width changes
  useEffect(() => {
    if (containerWidth > 0) {
      const optimalScale = calculateOptimalScale()
      if (Math.abs(scale - optimalScale) > 0.1) {
        setScale(optimalScale)
      }
    }
  }, [containerWidth, calculateOptimalScale])

  // Handle PDF document load
  const handleDocumentLoadSuccess = useCallback((pdf: any) => {
    console.log('PDF loaded successfully:', pdf.numPages, 'pages')
    setPdfDocument(pdf)
    setIsLoading(false)
    setError(null)
    if (onLoadSuccess) {
      onLoadSuccess(pdf)
    }
  }, [onLoadSuccess])

  const handleDocumentLoadError = useCallback((loadError: any) => {
    console.error('PDF load error:', loadError)
    setError(loadError.message || 'Error loading PDF')
    setIsLoading(false)
  }, [])

  // Memoize PDF options to prevent unnecessary reloads
  const pdfOptions = useMemo(() => ({
    workerSrc: '/pdf.worker.min.mjs',
    disableAutoFetch: true,
    disableStream: totalPages > 1000, // Disable streaming for large documents
  }), [totalPages])

  // Preload adjacent pages for smoother navigation
  useEffect(() => {
    if (!pdfDocument || !isPdfLoaded) return

    const preloadPages = async () => {
      const pagesToPreload = []
      
      // Preload current page and adjacent pages
      for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
        if (!pageRenderRef.current[i]) {
          pagesToPreload.push(i)
        }
      }

      // Preload pages in background
      pagesToPreload.forEach(async (pageNum) => {
        try {
          await pdfDocument.getPage(pageNum)
          pageRenderRef.current[pageNum] = true
        } catch (error) {
          console.warn(`Failed to preload page ${pageNum}:`, error)
        }
      })
    }

    const timeoutId = setTimeout(preloadPages, 100)
    return () => clearTimeout(timeoutId)
  }, [currentPage, pdfDocument, totalPages, isPdfLoaded])

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full bg-red-50 ${className}`}>
        <div className="text-center">
          <div className="text-red-500 mb-2">Error cargando PDF</div>
          <div className="text-sm text-red-400">{error}</div>
        </div>
      </div>
    )
  }

  if (!isPdfLoaded) {
    return (
      <div className={`flex items-center justify-center h-full bg-gray-100 ${className}`}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-2" />
          <div className="text-gray-500">Cargando PDF.js...</div>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`flex flex-col h-full bg-gray-50 ${className}`}>
      {/* Controls */}
      <div className="flex items-center justify-between p-3 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            title="Página anterior (←)"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <div className="text-sm text-gray-600 px-3 min-w-[120px] text-center">
            Página {currentPage} de {totalPages.toLocaleString()}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages}
            title="Página siguiente (→)"
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
              <span className="hidden sm:inline">Rotar Página</span>
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
            <span className="hidden sm:inline">Rotar Todas</span>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomOut}
            disabled={scale <= 0.3}
            title="Zoom out (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleFitToWidth}
            className="text-xs px-2"
            title="Ajustar al ancho (0)"
          >
            <span className="hidden sm:inline">Ajustar</span>
            <span className="sm:hidden">Fit</span>
          </Button>
          
          <div className="text-sm text-gray-600 min-w-[70px] text-center px-2">
            {Math.round(scale * 100)}%
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomIn}
            disabled={scale >= 3.0}
            title="Zoom in (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Document Viewer */}
      <div className="flex-1 overflow-auto">
        <div className="flex justify-center items-center min-h-full p-4">
          <div className="bg-white shadow-xl max-w-full max-h-full">
            {/* PDF Document */}
            {isPdfLoaded && (
              <Document
                file={documentUrl}
                onLoadSuccess={handleDocumentLoadSuccess}
                onLoadError={handleDocumentLoadError}
                loading={
                  <div className="flex items-center justify-center w-full h-96 bg-gray-50">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
                      <span className="text-gray-600">Cargando documento...</span>
                    </div>
                  </div>
                }
                error={
                  <div className="flex items-center justify-center w-full h-96 bg-red-50 text-red-500">
                    <div className="text-center">
                      <div className="text-lg font-semibold mb-2">Error al cargar el documento</div>
                      <div className="text-sm">Verifica que el archivo PDF sea válido</div>
                    </div>
                  </div>
                }
                options={pdfOptions}
              >
                {!isLoading && pdfDocument && (
                  <Page
                    key={`page-${currentPage}-${rotationAngle}`}
                    pageNumber={currentPage}
                    scale={scale}
                    rotate={rotationAngle}
                    loading={
                      <div className="flex items-center justify-center w-full h-96 bg-gray-50">
                        <div className="text-center">
                          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
                          <span className="text-gray-600">Renderizando página {currentPage}...</span>
                        </div>
                      </div>
                    }
                    error={
                      <div className="flex items-center justify-center w-full h-96 bg-red-50 text-red-500">
                        <div className="text-center">
                          <div className="text-lg font-semibold mb-2">Error al renderizar la página</div>
                          <div className="text-sm">Página {currentPage} no pudo ser mostrada</div>
                        </div>
                      </div>
                    }
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    className="shadow-sm"
                  />
                )}
              </Document>
            )}
          </div>
        </div>
      </div>

      {/* Keyboard shortcuts info */}
      <div className="flex-shrink-0 px-3 py-1 bg-gray-100 border-t border-gray-200">
        <div className="text-xs text-gray-500 text-center">
          <span className="hidden sm:inline">Teclas: ←→ (navegación), +/- (zoom), 0 (ajustar) | </span>
          {totalPages > 1000 && (
            <span className="text-orange-600 font-medium">
              Documento grande detectado - Renderizado optimizado activado
            </span>
          )}
        </div>
      </div>
    </div>
  )
} 