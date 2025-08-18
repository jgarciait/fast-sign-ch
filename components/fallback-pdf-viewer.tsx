"use client"

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Loader2, RotateCw } from 'lucide-react'
import dynamic from 'next/dynamic'

// Import react-pdf components with SSR disabled
const Document = dynamic(
  () => import('react-pdf').then((mod) => mod.Document),
  { ssr: false }
)

const Page = dynamic(
  () => import('react-pdf').then((mod) => mod.Page),
  { ssr: false }
)

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  import('react-pdf').then((reactPdf) => {
    if (reactPdf.pdfjs && reactPdf.pdfjs.GlobalWorkerOptions) {
      reactPdf.pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
    }
  })
}

interface FallbackPdfViewerProps {
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

export default function FallbackPdfViewer({
  documentUrl,
  currentPage,
  totalPages,
  onPageChange,
  onRotateAllPages,
  onRotateCurrentPage,
  rotationAngle = 0,
  onLoadSuccess,
  className = ''
}: FallbackPdfViewerProps) {
  const [scale, setScale] = useState(1.0)
  const [containerWidth, setContainerWidth] = useState(0)
  const [numPages, setNumPages] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // PDF.js options for progressive loading - MUST be before any conditional returns
  const pdfOptions = useMemo(() => ({
    verbosity: 0,
    disableAutoFetch: false,
    disableStream: false,
    disableRange: false,
    enableXfa: false,
    isEvalSupported: false,
    maxImageSize: 2 * 1024 * 1024,
    cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/standard_fonts/'
  }), [])

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

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 1.75))
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.25))
  const handleFitToWidth = () => {
    if (containerWidth > 0) {
      setScale((containerWidth - 40) / 612) // Standard PDF width with padding
    }
  }

  // Handle PDF load success
  const handleLoadSuccess = (pdf: any) => {
    console.log(`✅ PDF loaded: ${pdf.numPages} pages`)
    setNumPages(pdf.numPages)
    setIsLoading(false)
    setLoadError(null)
    
    if (onLoadSuccess) {
      onLoadSuccess(pdf)
    }
  }

  // Handle PDF load error
  const handleLoadError = (error: any) => {
    console.error('PDF load error:', error)
    setIsLoading(false)
    setLoadError(error instanceof Error ? error.message : 'Failed to load PDF')
  }

  // Simple check for no document
  if (!documentUrl) {
    return (
      <div className={`flex items-center justify-center h-full bg-gray-50 ${className}`}>
        <div className="text-center p-8">
          <div className="text-gray-500 text-lg mb-2">No document available</div>
          <div className="text-gray-400 text-sm">Please upload a PDF document to continue</div>
        </div>
      </div>
    )
  }

  // Error state for component loading
  if (loadError) {
    return (
      <div className={`flex items-center justify-center h-full bg-gray-50 ${className}`}>
        <div className="text-center p-8">
          <div className="text-red-500 text-lg mb-2">Error loading PDF viewer</div>
          <div className="text-red-400 text-sm mb-4">{loadError}</div>
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline"
            size="sm"
          >
            Retry
          </Button>
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
            Page {currentPage} of {totalPages || numPages}
          </span>
          
          <Button
            onClick={handleNextPage}
            disabled={currentPage >= (totalPages || numPages)}
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
          <div className="bg-white shadow-lg">
            {Document && Page && (
              <Document
                file={documentUrl}
                onLoadSuccess={handleLoadSuccess}
                onLoadError={handleLoadError}
                loading={
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    Loading document...
                  </div>
                }
                error={
                  <div className="flex items-center justify-center p-8 text-red-500">
                    <div className="text-center">
                      <div className="text-lg font-semibold mb-2">Error loading document</div>
                      <div className="text-sm">Please check the document URL or try again</div>
                    </div>
                  </div>
                }
                options={pdfOptions}
              >
                <Page
                  pageNumber={currentPage}
                  scale={scale}
                  rotate={rotationAngle}
                  loading={
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      Loading page {currentPage}...
                    </div>
                  }
                  error={
                    <div className="flex items-center justify-center p-8 text-red-500">
                      <div className="text-center">
                        <div className="text-lg font-semibold mb-2">Error loading page</div>
                        <div className="text-sm">Page {currentPage} could not be loaded</div>
                      </div>
                    </div>
                  }
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                />
              </Document>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 