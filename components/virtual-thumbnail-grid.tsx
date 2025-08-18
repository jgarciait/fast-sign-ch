"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Loader2, AlertCircle, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import pdfCacheManager from '@/utils/pdf-cache-manager'

interface VirtualThumbnailGridProps {
  documentUrl: string
  totalPages: number
  selectedPages: Set<number>
  onPageSelect: (pageNumber: number) => void
  onPageRotate: (pageNumber: number) => void
  className?: string
  thumbnailWidth?: number
  thumbnailHeight?: number
  preloadCount?: number
}

interface ThumbnailItemProps {
  pageNumber: number
  documentUrl: string
  isSelected: boolean
  isVisible: boolean
  onSelect: () => void
  onRotate: () => void
  width: number
  height: number
}

const ThumbnailItem = React.memo(function ThumbnailItem({
  pageNumber,
  documentUrl,
  isSelected,
  isVisible,
  onSelect,
  onRotate,
  width,
  height
}: ThumbnailItemProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rotation, setRotation] = useState(0)
  const mountedRef = useRef(true)

  const loadThumbnail = useCallback(async () => {
    if (!isVisible || thumbnailUrl) return

    setIsLoading(true)
    setError(null)

    try {
      const url = await pdfCacheManager.getThumbnail(documentUrl, pageNumber)
      
      if (mountedRef.current) {
        setThumbnailUrl(url)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load thumbnail')
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [documentUrl, pageNumber, isVisible, thumbnailUrl])

  useEffect(() => {
    if (isVisible) {
      loadThumbnail()
    }
  }, [isVisible, loadThumbnail])

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const handleRotate = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const newRotation = (rotation + 90) % 360
    setRotation(newRotation)
    onRotate()
  }, [rotation, onRotate])

  if (!isVisible) {
    return (
      <div
        className="bg-gray-100 border border-gray-200 rounded-lg flex items-center justify-center"
        style={{ width, height }}
      >
        <div className="text-xs text-gray-400">Page {pageNumber}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="bg-red-50 border border-red-200 rounded-lg flex flex-col items-center justify-center p-2 cursor-pointer hover:bg-red-100"
        style={{ width, height }}
        onClick={onSelect}
      >
        <AlertCircle className="h-4 w-4 text-red-500 mb-1" />
        <span className="text-xs text-red-600 text-center">Error</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRotate}
          className="mt-1 p-1 h-6 w-6"
        >
          <RotateCw className="h-3 w-3" />
        </Button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div
        className="bg-gray-100 border border-gray-200 rounded-lg flex flex-col items-center justify-center p-2"
        style={{ width, height }}
      >
        <Loader2 className="h-4 w-4 animate-spin text-gray-400 mb-1" />
        <span className="text-xs text-gray-500">Loading...</span>
      </div>
    )
  }

  return (
    <div
      className={`
        relative group border-2 rounded-lg overflow-hidden bg-white transition-all cursor-pointer
        ${isSelected ? 'border-blue-500 shadow-lg ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300 hover:shadow-md'}
      `}
      style={{ width, height }}
      onClick={onSelect}
    >
      {/* Page number badge */}
      <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-2 py-1 rounded z-10">
        {pageNumber}
      </div>

      {/* Rotate button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleRotate}
        className="absolute top-1 right-1 p-1 h-6 w-6 bg-black/70 text-white hover:bg-black/90 opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        <RotateCw className="h-3 w-3" />
      </Button>

      {/* Thumbnail image */}
      <div className="flex items-center justify-center p-2 h-full w-full overflow-hidden">
        {thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt={`Page ${pageNumber}`}
            className="max-w-full max-h-full object-contain"
            style={{
              transform: `rotate(${rotation}deg)`,
              imageRendering: 'crisp-edges'
            }}
          />
        )}
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute inset-0 bg-blue-500/10 border-2 border-blue-500 rounded-lg pointer-events-none" />
      )}
    </div>
  )
})

export default function VirtualThumbnailGrid({
  documentUrl,
  totalPages,
  selectedPages,
  onPageSelect,
  onPageRotate,
  className = '',
  thumbnailWidth = 120,
  thumbnailHeight = 150,
  preloadCount = 20
}: VirtualThumbnailGridProps) {
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)
  const [isInitialized, setIsInitialized] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Calculate grid dimensions
  const { itemsPerRow, visibleRange, totalHeight } = useMemo(() => {
    if (!containerRef.current) {
      return { itemsPerRow: 1, visibleRange: { start: 0, end: 0 }, totalHeight: 0 }
    }

    const containerWidth = containerRef.current.clientWidth
    const padding = 16
    const gap = 8
    const availableWidth = containerWidth - padding * 2

    const itemsPerRow = Math.max(1, Math.floor((availableWidth + gap) / (thumbnailWidth + gap)))
    const totalRows = Math.ceil(totalPages / itemsPerRow)
    const rowHeight = thumbnailHeight + gap
    const totalHeight = totalRows * rowHeight + padding * 2

    // Calculate visible range with buffer
    const visibleRows = Math.ceil(containerHeight / rowHeight)
    const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - 2) // 2 rows buffer
    const endRow = Math.min(totalRows - 1, startRow + visibleRows + 4) // 4 rows buffer

    const startIndex = startRow * itemsPerRow
    const endIndex = Math.min(totalPages - 1, (endRow + 1) * itemsPerRow - 1)

    return {
      itemsPerRow,
      visibleRange: { start: startIndex, end: endIndex },
      totalHeight
    }
  }, [totalPages, thumbnailWidth, thumbnailHeight, containerHeight, scrollTop])

  // Initialize container size
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight)
        setIsInitialized(true)
      }
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  // Preload thumbnails
  useEffect(() => {
    if (!isInitialized || !documentUrl) return

    const preloadPages = async () => {
      const { start, end } = visibleRange
      const pagesToPreload = []

      // Add visible pages
      for (let i = start; i <= end; i++) {
        pagesToPreload.push(i + 1) // Page numbers are 1-indexed
      }

      // Add additional pages for preloading
      const additionalPages = Math.min(preloadCount, totalPages - end - 1)
      for (let i = 1; i <= additionalPages; i++) {
        const pageNum = end + i + 1
        if (pageNum <= totalPages) {
          pagesToPreload.push(pageNum)
        }
      }

      // Preload in background
      pdfCacheManager.preloadPages(documentUrl, pagesToPreload, 0.2).catch(error => {
        console.warn('Failed to preload pages:', error)
      })
    }

    preloadPages()
  }, [documentUrl, visibleRange, totalPages, preloadCount, isInitialized])

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop)
  }, [])

  const renderThumbnails = useMemo(() => {
    if (!isInitialized) return null

    const { start, end } = visibleRange
    const thumbnails = []
    const gap = 8
    const padding = 16

    for (let i = 0; i < totalPages; i++) {
      const pageNumber = i + 1
      const row = Math.floor(i / itemsPerRow)
      const col = i % itemsPerRow
      const top = row * (thumbnailHeight + gap) + padding
      const left = col * (thumbnailWidth + gap) + padding

      const isVisible = i >= start && i <= end
      const isSelected = selectedPages.has(pageNumber)

      thumbnails.push(
        <div
          key={pageNumber}
          className="absolute"
          style={{
            top,
            left,
            width: thumbnailWidth,
            height: thumbnailHeight
          }}
        >
          <ThumbnailItem
            pageNumber={pageNumber}
            documentUrl={documentUrl}
            isSelected={isSelected}
            isVisible={isVisible}
            onSelect={() => onPageSelect(pageNumber)}
            onRotate={() => onPageRotate(pageNumber)}
            width={thumbnailWidth}
            height={thumbnailHeight}
          />
        </div>
      )
    }

    return thumbnails
  }, [
    isInitialized,
    totalPages,
    visibleRange,
    itemsPerRow,
    thumbnailWidth,
    thumbnailHeight,
    selectedPages,
    documentUrl,
    onPageSelect,
    onPageRotate
  ])

  if (!isInitialized) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <div className="text-sm text-gray-600">Initializing thumbnail grid...</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="text-sm font-medium">
          {totalPages} pages • {selectedPages.size} selected
        </div>
        <div className="text-xs text-gray-500">
          Cache: {Math.round(pdfCacheManager.getStats().hitRate)}% hit rate
        </div>
      </div>

      {/* Virtual Grid */}
      <ScrollArea className="flex-1" onScroll={handleScroll}>
        <div
          ref={containerRef}
          className="relative w-full"
          style={{ height: totalHeight }}
        >
          {renderThumbnails}
        </div>
      </ScrollArea>
    </div>
  )
} 