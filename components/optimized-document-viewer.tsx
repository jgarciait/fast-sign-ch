"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { 
  ZoomIn, 
  ZoomOut, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  RotateCw, 
  Maximize2,
  Minimize2,
  RefreshCw
} from 'lucide-react'
import pdfCacheManager from '@/utils/pdf-cache-manager'

interface OptimizedDocumentViewerProps {
  documentUrl: string
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  onRotateAllPages: () => void
  onRotateCurrentPage?: () => void
  className?: string
  preloadCount?: number
}

interface PageItem {
  pageNumber: number
  top: number
  height: number
  isVisible: boolean
  isLoaded: boolean
}

interface ViewerState {
  scale: number
  scrollTop: number
  containerHeight: number
  pageHeight: number
  isFullscreen: boolean
  isLoading: boolean
  loadingProgress: number
  error: string | null
}

const OptimizedDocumentViewer: React.FC<OptimizedDocumentViewerProps> = ({
  documentUrl,
  currentPage,
  totalPages,
  onPageChange,
  onRotateAllPages,
  onRotateCurrentPage,
  className = '',
  preloadCount = 20
}) => {
  const [viewerState, setViewerState] = useState<ViewerState>({
    scale: 1.0,
    scrollTop: 0,
    containerHeight: 0,
    pageHeight: 800, // Default page height
    isFullscreen: false,
    isLoading: true,
    loadingProgress: 0,
    error: null
  })

  const [pages, setPages] = useState<Map<number, string>>(new Map())
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set())
  const [pageRotations, setPageRotations] = useState<Map<number, number>>(new Map())
  
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const isInitialized = useRef(false)
  const preloadingRef = useRef(false)

  // Calculate visible pages based on scroll position
  const calculateVisiblePages = useCallback((scrollTop: number, containerHeight: number) => {
    const { scale, pageHeight } = viewerState
    const scaledPageHeight = pageHeight * scale
    const pageGap = 16
    const totalPageHeight = scaledPageHeight + pageGap

    const startIndex = Math.max(0, Math.floor(scrollTop / totalPageHeight) - 1)
    const endIndex = Math.min(totalPages - 1, startIndex + Math.ceil(containerHeight / totalPageHeight) + 2)

    const newVisiblePages = new Set<number>()
    for (let i = startIndex; i <= endIndex; i++) {
      newVisiblePages.add(i + 1) // Page numbers are 1-indexed
    }

    return newVisiblePages
  }, [viewerState, totalPages])

  // Initialize document
  useEffect(() => {
    const initializeDocument = async () => {
      if (!documentUrl || isInitialized.current) return

      try {
        setViewerState(prev => ({ ...prev, isLoading: true, error: null }))

        // Load document
        const pdfDocument = await pdfCacheManager.loadDocument(documentUrl)
        
        // Get first page to calculate dimensions
        const firstPage = await pdfDocument.getPage(1)
        const viewport = firstPage.getViewport({ scale: 1.0 })
        
        setViewerState(prev => ({
          ...prev,
          pageHeight: viewport.height,
          isLoading: false,
          loadingProgress: 100
        }))

        isInitialized.current = true

        // Initial preload
        preloadVisiblePages()
      } catch (error) {
        console.error('Failed to initialize document:', error)
        setViewerState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to load document',
          isLoading: false
        }))
      }
    }

    initializeDocument()
  }, [documentUrl])

  // Update container size
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setViewerState(prev => ({
          ...prev,
          containerHeight: containerRef.current!.clientHeight
        }))
      }
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  // Preload visible pages
  const preloadVisiblePages = useCallback(async () => {
    if (preloadingRef.current) return

    preloadingRef.current = true

    try {
      const newVisiblePages = calculateVisiblePages(viewerState.scrollTop, viewerState.containerHeight)
      setVisiblePages(newVisiblePages)

      // Load visible pages
      const loadPromises = Array.from(newVisiblePages).map(async (pageNumber) => {
        if (!pages.has(pageNumber)) {
          try {
            const pageUrl = await pdfCacheManager.getPage(documentUrl, pageNumber, viewerState.scale)
            setPages(prev => new Map(prev).set(pageNumber, pageUrl))
          } catch (error) {
            console.warn(`Failed to load page ${pageNumber}:`, error)
          }
        }
      })

      await Promise.all(loadPromises)

      // Preload additional pages
      const additionalPages = []
      const centerPage = Math.floor((Math.min(...newVisiblePages) + Math.max(...newVisiblePages)) / 2)
      
      for (let i = 1; i <= preloadCount; i++) {
        const nextPage = centerPage + i
        const prevPage = centerPage - i
        
        if (nextPage <= totalPages && !pages.has(nextPage)) {
          additionalPages.push(nextPage)
        }
        if (prevPage >= 1 && !pages.has(prevPage)) {
          additionalPages.push(prevPage)
        }
      }

      // Preload in background
      if (additionalPages.length > 0) {
        pdfCacheManager.preloadPages(documentUrl, additionalPages, viewerState.scale)
          .catch(error => console.warn('Background preload failed:', error))
      }

    } finally {
      preloadingRef.current = false
    }
  }, [documentUrl, viewerState, calculateVisiblePages, pages, preloadCount, totalPages])

  // Handle scroll
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = event.currentTarget.scrollTop
    setViewerState(prev => ({ ...prev, scrollTop }))

    // Update current page based on scroll position
    const { scale, pageHeight } = viewerState
    const scaledPageHeight = pageHeight * scale
    const pageGap = 16
    const totalPageHeight = scaledPageHeight + pageGap
    
    const newCurrentPage = Math.max(1, Math.min(totalPages, Math.floor(scrollTop / totalPageHeight) + 1))
    if (newCurrentPage !== currentPage) {
      onPageChange(newCurrentPage)
    }

    // Trigger preload
    preloadVisiblePages()
  }, [viewerState, currentPage, totalPages, onPageChange, preloadVisiblePages])

  // Navigation handlers
  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      const newPage = currentPage - 1
      onPageChange(newPage)
      scrollToPage(newPage)
    }
  }, [currentPage, onPageChange])

  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      const newPage = currentPage + 1
      onPageChange(newPage)
      scrollToPage(newPage)
    }
  }, [currentPage, totalPages, onPageChange])

  const scrollToPage = useCallback((pageNumber: number) => {
    if (!scrollAreaRef.current) return

    const { scale, pageHeight } = viewerState
    const scaledPageHeight = pageHeight * scale
    const pageGap = 16
    const totalPageHeight = scaledPageHeight + pageGap
    const targetScrollTop = (pageNumber - 1) * totalPageHeight

    scrollAreaRef.current.scrollTop = targetScrollTop
  }, [viewerState])

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setViewerState(prev => ({ ...prev, scale: Math.min(prev.scale + 0.25, 3) }))
    setPages(new Map()) // Clear pages to force reload at new scale
  }, [])

  const handleZoomOut = useCallback(() => {
    setViewerState(prev => ({ ...prev, scale: Math.max(prev.scale - 0.25, 0.25) }))
    setPages(new Map()) // Clear pages to force reload at new scale
  }, [])

  const handleFitToWidth = useCallback(() => {
    if (containerRef.current && viewerState.pageHeight > 0) {
      const containerWidth = containerRef.current.clientWidth
      const pageWidth = viewerState.pageHeight * (8.5 / 11) // Assume standard page ratio
      const newScale = (containerWidth - 40) / pageWidth
      setViewerState(prev => ({ ...prev, scale: newScale }))
      setPages(new Map()) // Clear pages to force reload at new scale
    }
  }, [viewerState.pageHeight])

  const handleRotateCurrentPage = useCallback(() => {
    if (onRotateCurrentPage) {
      onRotateCurrentPage()
      const currentRotation = pageRotations.get(currentPage) || 0
      const newRotation = (currentRotation + 90) % 360
      setPageRotations(prev => new Map(prev).set(currentPage, newRotation))
      
      // Remove cached page to force reload
      setPages(prev => {
        const newPages = new Map(prev)
        newPages.delete(currentPage)
        return newPages
      })
    }
  }, [currentPage, onRotateCurrentPage, pageRotations])

  const handleToggleFullscreen = useCallback(() => {
    setViewerState(prev => ({ ...prev, isFullscreen: !prev.isFullscreen }))
  }, [])

  const handleRefresh = useCallback(() => {
    setPages(new Map())
    pdfCacheManager.clearDocument(documentUrl)
    isInitialized.current = false
    preloadVisiblePages()
  }, [documentUrl, preloadVisiblePages])

  // Calculate total height for virtualization
  const totalHeight = useMemo(() => {
    const { scale, pageHeight } = viewerState
    const scaledPageHeight = pageHeight * scale
    const pageGap = 16
    return totalPages * (scaledPageHeight + pageGap) + 40 // Extra padding
  }, [totalPages, viewerState])

  // Render pages
  const renderPages = useMemo(() => {
    if (!isInitialized.current) return null

    const { scale, pageHeight } = viewerState
    const scaledPageHeight = pageHeight * scale
    const pageGap = 16
    const totalPageHeight = scaledPageHeight + pageGap

    const pageElements = []

    for (let i = 0; i < totalPages; i++) {
      const pageNumber = i + 1
      const top = i * totalPageHeight + 20
      const isVisible = visiblePages.has(pageNumber)
      const pageUrl = pages.get(pageNumber)
      const rotation = pageRotations.get(pageNumber) || 0

      pageElements.push(
        <div
          key={pageNumber}
          className={`absolute left-1/2 transform -translate-x-1/2 bg-white shadow-lg border border-gray-200 ${
            pageNumber === currentPage ? 'ring-2 ring-blue-500' : ''
          }`}
          style={{
            top,
            width: (viewerState.pageHeight * (8.5 / 11)) * scale, // Standard page ratio
            height: scaledPageHeight,
            transform: `translateX(-50%) rotate(${rotation}deg)`
          }}
        >
          {isVisible && pageUrl ? (
            <img
              src={pageUrl}
              alt={`Page ${pageNumber}`}
              className="w-full h-full object-contain"
              style={{ imageRendering: 'crisp-edges' }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <div className="text-center">
                <div className="text-sm text-gray-500 mb-2">Page {pageNumber}</div>
                {isVisible && (
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                )}
              </div>
            </div>
          )}
        </div>
      )
    }

    return pageElements
  }, [isInitialized.current, totalPages, viewerState, visiblePages, pages, pageRotations, currentPage])

  if (viewerState.error) {
    return (
      <div className={`flex items-center justify-center h-full bg-gray-50 ${className}`}>
        <div className="text-center p-8">
          <div className="text-red-500 text-lg mb-2">Error loading document</div>
          <div className="text-red-400 text-sm mb-4">{viewerState.error}</div>
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
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
          <Button onClick={handlePrevPage} disabled={currentPage <= 1} variant="outline" size="sm">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <span className="text-sm font-medium min-w-[120px] text-center">
            Page {currentPage} of {totalPages}
          </span>
          
          <Button onClick={handleNextPage} disabled={currentPage >= totalPages} variant="outline" size="sm">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleZoomOut} variant="outline" size="sm">
            <ZoomOut className="h-4 w-4" />
          </Button>
          
          <span className="text-sm font-medium min-w-[60px] text-center">
            {Math.round(viewerState.scale * 100)}%
          </span>
          
          <Button onClick={handleZoomIn} variant="outline" size="sm">
            <ZoomIn className="h-4 w-4" />
          </Button>
          
          <Button onClick={handleFitToWidth} variant="outline" size="sm">
            Fit Width
          </Button>
          
          {onRotateCurrentPage && (
            <Button onClick={handleRotateCurrentPage} variant="outline" size="sm">
              <RotateCw className="h-4 w-4" />
            </Button>
          )}
          
          <Button onClick={onRotateAllPages} variant="outline" size="sm">
            Rotate All
          </Button>

          <Button onClick={handleToggleFullscreen} variant="outline" size="sm">
            {viewerState.isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Loading Progress */}
      {viewerState.isLoading && (
        <div className="p-4 bg-blue-50 border-b">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading document...</span>
          </div>
          <Progress value={viewerState.loadingProgress} className="h-2" />
        </div>
      )}

      {/* Document View */}
      <ScrollArea 
        className="flex-1 bg-gray-100" 
        onScroll={handleScroll}
        ref={scrollAreaRef}
      >
        <div className="relative w-full" style={{ height: totalHeight }}>
          {renderPages}
        </div>
      </ScrollArea>

      {/* Status Bar */}
      <div className="flex items-center justify-between p-2 border-t bg-gray-50 text-xs text-gray-600">
        <div>
          Cache: {pdfCacheManager.getStats().hitRate.toFixed(1)}% hit rate • 
          {pages.size} pages loaded • 
          {Math.round(pdfCacheManager.getStats().totalMemoryUsage / 1024 / 1024)}MB memory
        </div>
        <div>
          Visible: {visiblePages.size} pages
        </div>
      </div>
    </div>
  )
}

export default OptimizedDocumentViewer 