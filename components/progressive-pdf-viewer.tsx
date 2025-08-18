"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Loader2, RotateCw } from 'lucide-react'
import { createSimplePDFLoader } from '@/utils/simple-pdf-loader'

// Dynamic import for PDF components
let Document: any, Page: any, pdfjs: any

interface ProgressivePdfViewerProps {
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

export default function ProgressivePdfViewer({
  documentUrl,
  currentPage,
  totalPages,
  onPageChange,
  onRotateAllPages,
  onRotateCurrentPage,
  rotationAngle = 0,
  onLoadSuccess,
  className = ''
}: ProgressivePdfViewerProps) {
  const [scale, setScale] = useState(1.0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [currentPageData, setCurrentPageData] = useState<any>(null)
  const [isPdfLoaded, setIsPdfLoaded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const progressiveLoaderRef = useRef<any>(null)
  const [loadingProgress, setLoadingProgress] = useState(0)

  // Load PDF.js dynamically
  useEffect(() => {
    const loadPdfJs = async () => {
      try {
        const reactPdf = await import('react-pdf')
        Document = reactPdf.Document
        Page = reactPdf.Page
        pdfjs = reactPdf.pdfjs
        
        const { configurePdfJsWithFallback } = await import('@/utils/pdf-config')
        await configurePdfJsWithFallback()
        
        setIsPdfLoaded(true)
      } catch (error) {
        console.error('Error loading PDF.js:', error)
        setError('Error loading PDF viewer')
      }
    }

    loadPdfJs()
  }, [])

  // Initialize progressive loader
  useEffect(() => {
    if (!isPdfLoaded || !documentUrl) return

    const initializeProgressiveLoader = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        console.log('🚀 Initializing Progressive PDF Viewer with Range Requests...')
        
        // Create simple loader
        progressiveLoaderRef.current = createSimplePDFLoader(documentUrl)
        
        // Get file size (very fast)
        const fileSize = await progressiveLoaderRef.current.getFileSize()
        const estimatedPageCount = Math.ceil(fileSize / (1024 * 1024)) // Rough estimate
        
        console.log(`📄 File size loaded! ${estimatedPageCount} estimated pages.`)
        
        // Notify parent of page count (use totalPages prop for now)
        if (onLoadSuccess) {
          onLoadSuccess({ numPages: totalPages })
        }
        
        setIsLoading(false)
        
      } catch (err) {
        console.error('Error initializing progressive loader:', err)
        setError('Error loading document structure')
        setIsLoading(false)
      }
    }

    initializeProgressiveLoader()
  }, [isPdfLoaded, documentUrl, onLoadSuccess])

  // Load current page using Range Requests
  useEffect(() => {
    if (!progressiveLoaderRef.current || !currentPage || isLoading) return

    const loadCurrentPage = async () => {
      try {
        console.log(`📥 Loading page ${currentPage} with Range Request...`)
        
        // Load page chunk using Range Request
        const pageData = await progressiveLoaderRef.current.loadPageChunk(currentPage)
        
        // Create PDF document from page data
        const pageDoc = await pdfjs.getDocument({
          data: pageData,
          verbosity: 0
        }).promise
        
        setCurrentPageData(pageDoc)
        console.log(`✅ Page ${currentPage} loaded successfully with Range Request`)
        
      } catch (error) {
        console.error(`Error loading page ${currentPage}:`, error)
        setError(`Error loading page ${currentPage}`)
      }
    }

    loadCurrentPage()
  }, [currentPage, isLoading])

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
          <div className="text-lg font-semibold mb-2">Loading Document Structure...</div>
          <div className="text-sm text-gray-600">Using Range Requests for faster loading</div>
          {loadingProgress > 0 && (
            <div className="mt-4">
              <div className="w-64 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">{loadingProgress}%</div>
            </div>
          )}
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
          {currentPageData ? (
            <div className="bg-white shadow-lg">
              <Document
                file={currentPageData}
                loading={
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    Loading page...
                  </div>
                }
                error={
                  <div className="flex items-center justify-center p-8 text-red-500">
                    Error loading page
                  </div>
                }
              >
                <Page
                  pageNumber={1}
                  scale={scale}
                  rotate={rotationAngle}
                  loading={
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      Rendering page...
                    </div>
                  }
                />
              </Document>
            </div>
          ) : (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading page {currentPage}...
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 