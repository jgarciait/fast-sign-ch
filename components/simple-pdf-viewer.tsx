"use client"

import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Loader2, RotateCw } from 'lucide-react'
import { createDirectPDFLoader } from '@/utils/direct-pdf-loader'

// Dynamic import for PDF components
let Document: any, Page: any, pdfjs: any

interface SimplePdfViewerProps {
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

export default function SimplePdfViewer({
  documentUrl,
  currentPage,
  totalPages,
  onPageChange,
  onRotateAllPages,
  onRotateCurrentPage,
  rotationAngle = 0,
  onLoadSuccess,
  className = ''
}: SimplePdfViewerProps) {
  const [scale, setScale] = useState(1.0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [pdfDocument, setPdfDocument] = useState<any>(null)
  const [isPdfLoaded, setIsPdfLoaded] = useState(false)
  const [isFirstPageLoaded, setIsFirstPageLoaded] = useState(false)
  const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)
  const simpleLoaderRef = useRef<any>(null)

  // Preload PDF.js worker early - prioritize .mjs
  useEffect(() => {
    // Try to preload .mjs worker first
    const mjsScript = document.createElement('script')
    mjsScript.src = '/pdf.worker.mjs'
    mjsScript.async = true
    mjsScript.type = 'module'
    
    // Fallback to .min.js if .mjs fails
    const minScript = document.createElement('script')
    minScript.src = '/pdf.worker.min.mjs'
    minScript.async = true
    
    // Add .mjs first (higher priority)
    document.head.appendChild(mjsScript)
    
    // Add .min.js as fallback
    mjsScript.onerror = () => {
      console.warn('MJS worker failed to load, using min.js fallback')
      document.head.appendChild(minScript)
    }
    
    return () => {
      if (document.head.contains(mjsScript)) {
        document.head.removeChild(mjsScript)
      }
      if (document.head.contains(minScript)) {
        document.head.removeChild(minScript)
      }
    }
  }, [])

  // Load PDF.js dynamically
  useEffect(() => {
    const loadPdfJs = async () => {
      try {
        const reactPdf = await import('react-pdf')
        Document = reactPdf.Document
        Page = reactPdf.Page
        pdfjs = reactPdf.pdfjs

        // Use centralized worker configuration
        const { setupPdfWorker } = await import('@/utils/pdf-config')
        setupPdfWorker(pdfjs)

        setIsPdfLoaded(true)
      } catch (error) {
        console.error('Error loading PDF.js:', error)
        setError('Failed to load PDF viewer')
      }
    }

    loadPdfJs()
  }, [])

  // Initialize and load first chunk
  useEffect(() => {
    if (!isPdfLoaded || !documentUrl) return

    const initializeAndLoad = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        console.log('🚀 Starting Simple PDF Viewer with Range Requests...')
        
        // Create direct loader
        simpleLoaderRef.current = createDirectPDFLoader(documentUrl)
        
        // Use smart loading - tries Range Request first, falls back to full download
        console.log('📥 Starting smart PDF loading...')
        const firstChunk = await simpleLoaderRef.current.smartLoad(1024 * 1024)
        
        // Create PDF document from first chunk
        console.log('🔧 Creating PDF document from first chunk...')
        const pdfDoc = await pdfjs.getDocument({
          data: firstChunk,
          verbosity: 0
        }).promise
        
        setPdfDocument(pdfDoc)
        setIsLoading(false)
        
        console.log(`✅ PDF loaded successfully! Pages: ${pdfDoc.numPages}`)
        
        // Notify parent
        if (onLoadSuccess) {
          onLoadSuccess({ numPages: pdfDoc.numPages })
        }
        
      } catch (err) {
        console.error('Error loading PDF:', err)
        setError('Error loading document')
        setIsLoading(false)
      }
    }

    initializeAndLoad()
  }, [isPdfLoaded, documentUrl, onLoadSuccess])

  // Handle container resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth)
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Navigation handlers
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

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 3))
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.25))
  const handleFitToWidth = () => {
    if (containerWidth > 0) {
      setScale(containerWidth / 612) // Assuming standard PDF page width
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrevPage()
      if (e.key === 'ArrowRight') handleNextPage()
      if (e.key === '+') handleZoomIn()
      if (e.key === '-') handleZoomOut()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentPage, totalPages])

  const handleDocumentLoadSuccess = (pdf: any) => {
    console.log(`Document loaded: ${pdf.numPages} pages`)
    setPdfDocument(pdf)
    setIsLoading(false)
    setError(null)
    
    // Store PDF document globally for thumbnails
    if (typeof window !== 'undefined') {
      (window as any).__currentPdfDocument = pdf
    }
    
    // Don't wait for all pages, just notify success
    if (onLoadSuccess) {
      onLoadSuccess(pdf)
    }
  }

  const handleDocumentLoadError = (error: any) => {
    console.error('Error loading document:', error)
    setError(error.message || 'Failed to load document')
    setIsLoading(false)
  }

  const handlePageLoadSuccess = () => {
    // Mark current page as loaded
    setLoadedPages(prev => new Set(prev).add(currentPage))
    
    // If this is the first page, update loading state immediately
    if (currentPage === 1 && !isFirstPageLoaded) {
      setIsFirstPageLoaded(true)
      setIsLoading(false)
    }
  }

  const renderScale = Math.min(scale, 2)
  const pageWidth = Math.max(300, Math.min(containerWidth * renderScale, 1200))

  // Calculate rotation including any passed rotation angle
  const totalRotation = ((rotationAngle % 360) + 360) % 360

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center h-full bg-gray-50 ${className}`}>
        <div className="text-center p-8">
          <div className="text-red-500 text-lg font-semibold mb-2">Error Loading Document</div>
          <div className="text-gray-600 mb-4">{error}</div>
          <Button onClick={() => window.location.reload()} variant="outline">
            Reload Page
          </Button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={`flex flex-col items-center justify-center h-full bg-gray-50 ${className}`}>
        <div className="text-center p-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
          <div className="text-lg font-semibold mb-2">Loading PDF with Range Requests...</div>
          <div className="text-sm text-gray-600">Loading first chunk for faster startup</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-full bg-white ${className}`} ref={containerRef}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <Button
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            variant="outline"
            size="sm"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <span className="text-sm font-medium">
            Page {currentPage} of {totalPages}
          </span>
          
          <Button
            onClick={handleNextPage}
            disabled={currentPage >= totalPages}
            variant="outline"
            size="sm"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleZoomOut} variant="outline" size="sm">
            <ZoomOut className="h-4 w-4" />
          </Button>
          
          <span className="text-sm font-medium min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          
          <Button onClick={handleZoomIn} variant="outline" size="sm">
            <ZoomIn className="h-4 w-4" />
          </Button>
          
          <Button onClick={handleFitToWidth} variant="outline" size="sm">
            Fit Width
          </Button>
          
          {onRotateCurrentPage && (
            <Button onClick={onRotateCurrentPage} variant="outline" size="sm">
              <RotateCw className="h-4 w-4" />
            </Button>
          )}
          
          <Button onClick={onRotateAllPages} variant="outline" size="sm">
            Rotate All
          </Button>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 overflow-auto bg-gray-100 p-4">
        <div className="flex justify-center">
          {!isPdfLoaded ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p className="text-gray-500">Cargando visor de PDF...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-red-500">
                <p className="font-medium">Error al cargar el documento</p>
                <p className="text-sm mt-2">{error}</p>
              </div>
            </div>
          ) : (
            <>
              {isLoading && !isFirstPageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 z-10">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                    <p className="text-gray-500">Cargando documento...</p>
                  </div>
                </div>
              )}
              <Document
                file={documentUrl}
                onLoadSuccess={handleDocumentLoadSuccess}
                onLoadError={handleDocumentLoadError}
                loading={null}
                options={{
                  cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
                  cMapPacked: true,
                  enableXfa: false,
                  disableAutoFetch: false,
                  disableStream: false,
                }}
              >
                <div className="flex justify-center">
                  <Page
                    pageNumber={currentPage}
                    width={pageWidth}
                    scale={renderScale}
                    rotate={totalRotation}
                    onLoadSuccess={handlePageLoadSuccess}
                    loading={
                      <div className="flex items-center justify-center" style={{ width: pageWidth, height: pageWidth * 1.5 }}>
                        <Loader2 className="h-8 w-8 animate-spin" />
                      </div>
                    }
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                </div>
              </Document>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
