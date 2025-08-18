"use client"

import React, { useState, useRef, useEffect, useMemo, memo } from 'react'
import { FixedSizeList as List } from 'react-window'
import { Loader2 } from 'lucide-react'
import dynamic from 'next/dynamic'

// Dynamic import to avoid SSR issues
const ReactPdfThumbnail = dynamic(() => import('@/components/react-pdf-thumbnail'), {
  ssr: false,
  loading: () => (
    <div className="w-[120px] h-[150px] flex items-center justify-center bg-gray-100 border-2 border-gray-200 rounded-lg">
      <div className="text-center">
        <Loader2 className="h-4 w-4 animate-spin text-gray-400 mb-1" />
        <span className="text-xs text-gray-500">Loading...</span>
      </div>
    </div>
  )
})

interface PageData {
  id: string
  pageNumber: number
  displayPosition: number
  documentIndex: number
  rotation: number
}

interface OptimizedPdfThumbnailGridProps {
  documentUrl: string
  pages: PageData[]
  currentPage: number
  onPageSelect: (page: number) => void
  onRotate: (pageNumber: number) => void
  hasMultipleDocuments?: boolean
  className?: string
}

interface ThumbnailProps {
  page: PageData
  documentUrl: string
  isSelected: boolean
  onSelect: () => void
  onRotate: () => void
  hasMultipleDocuments: boolean
  style?: React.CSSProperties
}

// Simple optimized thumbnail with lazy loading
const OptimizedThumbnail = memo(({ 
  page, 
  documentUrl, 
  isSelected, 
  onSelect, 
  onRotate, 
  hasMultipleDocuments,
  style 
}: ThumbnailProps) => {
  const [isVisible, setIsVisible] = useState(false)
  const [mounted, setMounted] = useState(false)
  const elementRef = useRef<HTMLDivElement>(null)

  // Ensure component is mounted (client-side only)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Intersection observer for lazy loading
  useEffect(() => {
    if (!mounted || typeof window === 'undefined' || !window.IntersectionObserver) {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { 
        rootMargin: '100px',
        threshold: 0.1 
      }
    )

    if (elementRef.current) {
      observer.observe(elementRef.current)
    }

    return () => observer.disconnect()
  }, [mounted])

  // Show placeholder until visible and mounted
  if (!mounted || !isVisible) {
    return (
      <div 
        ref={elementRef}
        style={style}
        className="flex items-center justify-center bg-gray-50 border-2 border-gray-200 rounded-lg w-[120px] h-[150px]"
      >
        <div className="text-center">
          <div className="text-xs text-gray-400 mb-1">Página</div>
          <div className="text-sm font-medium text-gray-600">{page.displayPosition}</div>
        </div>
      </div>
    )
  }

  // Show the actual thumbnail when visible and mounted
  return (
    <div style={style} className="relative">
      {hasMultipleDocuments && (
        <div 
          className={`absolute -top-1 -left-1 w-4 h-4 rounded-full z-20 ${
            page.documentIndex === 0 ? 'bg-blue-500' : 'bg-green-500'
          }`}
          title={`Documento ${page.documentIndex + 1}`}
        />
      )}
      <ReactPdfThumbnail
        pageId={page.id}
        documentUrl={documentUrl}
        pageNumber={page.pageNumber}
        displayPosition={page.displayPosition}
        isSelected={isSelected}
        onSelect={onSelect}
      />
    </div>
  )
})

OptimizedThumbnail.displayName = 'OptimizedThumbnail'

// Virtual list row component - renders 3 thumbnails per row
const VirtualRow = memo(({ index, style, data }: any) => {
  const { pages, documentUrl, currentPage, onPageSelect, onRotate, hasMultipleDocuments } = data
  const startIndex = index * 3
  const rowPages = pages.slice(startIndex, startIndex + 3)

  return (
    <div style={style} className="flex justify-center gap-2 px-2 py-1">
      {rowPages.map((page: PageData) => (
        <OptimizedThumbnail
          key={page.id}
          page={page}
          documentUrl={documentUrl}
          isSelected={currentPage === page.displayPosition}
          onSelect={() => onPageSelect(page.displayPosition)}
          onRotate={() => onRotate(page.pageNumber)}
          hasMultipleDocuments={hasMultipleDocuments}
        />
      ))}
    </div>
  )
})

VirtualRow.displayName = 'VirtualRow'

// Main optimized thumbnail grid component
export default function OptimizedPdfThumbnailGrid({
  documentUrl,
  pages,
  currentPage,
  onPageSelect,
  onRotate,
  hasMultipleDocuments = false,
  className = ''
}: OptimizedPdfThumbnailGridProps) {
  const [containerHeight, setContainerHeight] = useState(500)
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Ensure component is mounted (client-side only)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Calculate container height
  useEffect(() => {
    if (!mounted) return

    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const availableHeight = window.innerHeight - rect.top - 100
        setContainerHeight(Math.max(300, Math.min(availableHeight, 600)))
      }
    }

    updateHeight()
    window.addEventListener('resize', updateHeight)
    return () => window.removeEventListener('resize', updateHeight)
  }, [mounted])

  // Memoize virtual list data
  const itemData = useMemo(() => ({
    pages,
    documentUrl,
    currentPage,
    onPageSelect,
    onRotate,
    hasMultipleDocuments
  }), [pages, documentUrl, currentPage, onPageSelect, onRotate, hasMultipleDocuments])

  // Show loading state if not mounted or no pages
  if (!mounted || pages.length === 0) {
    return (
      <div ref={containerRef} className={`${className}`}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500 mr-2" />
          <span className="text-sm text-gray-600">
            {!mounted ? 'Inicializando...' : 'Cargando páginas...'}
          </span>
        </div>
      </div>
    )
  }

  // For small number of pages, use regular grid
  if (pages.length <= 15) {
    return (
      <div ref={containerRef} className={`${className}`}>
        <div className="grid grid-cols-3 gap-2 justify-items-center">
          {pages.map((page) => (
            <OptimizedThumbnail
              key={page.id}
              page={page}
              documentUrl={documentUrl}
              isSelected={currentPage === page.displayPosition}
              onSelect={() => onPageSelect(page.displayPosition)}
              onRotate={() => onRotate(page.pageNumber)}
              hasMultipleDocuments={hasMultipleDocuments}
            />
          ))}
        </div>
      </div>
    )
  }

  // For large number of pages, use virtual scrolling
  const rowCount = Math.ceil(pages.length / 3)
  const itemHeight = 170

  return (
    <div ref={containerRef} className={`${className}`}>
      <div className="mb-2 text-xs text-gray-500 text-center">
        {pages.length} páginas • Carga optimizada para mejor rendimiento
      </div>
      
      <List
        height={containerHeight}
        width="100%"
        itemCount={rowCount}
        itemSize={itemHeight}
        itemData={itemData}
        overscanCount={2}
        className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
      >
        {VirtualRow}
      </List>
    </div>
  )
} 