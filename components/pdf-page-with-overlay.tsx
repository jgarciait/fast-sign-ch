'use client'

import { Page } from 'react-pdf'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import type { Annotation } from './pdf-annotation-editor'
import { forceCorrectDimensions } from '../utils/force-correct-pdf-dimensions'

interface Props {
  pageNumber: number
  scale: number
  annotations: Annotation[]
  onClick: (e: React.MouseEvent<Element>, pageNumber: number, pageInfo?: any) => void
  onTouch?: (e: React.TouchEvent<Element>, pageNumber: number, pageInfo?: any) => void
  onPageLoad?: (pageNumber: number, pageInfo: any) => void
  children?: React.ReactNode
}

export default function PdfPageWithOverlay({
  pageNumber,
  scale,
  annotations,
  onClick,
  onTouch,
  onPageLoad,
  children
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pdfPageRef = useRef<HTMLDivElement>(null)
  const [pageInfo, setPageInfo] = useState<any>(null)
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null)
  const [originalDimensions, setOriginalDimensions] = useState<{ width: number; height: number } | null>(null)
  const [dimensionsLocked, setDimensionsLocked] = useState(false) // Replaced dimensionsSetRef with state

  const prevPageNumberRef = useRef<number>(pageNumber)
  const prevScaleRef = useRef<number>(scale)
  const onPageLoadCalledRef = useRef<number | null>(null) // Track which page we called onPageLoad for

  // Synchronous reset of dimensions when page number changes
  const currentPageDimensions = useMemo(() => {
    if (prevPageNumberRef.current !== pageNumber) {
      console.log(`📄 Page changed from ${prevPageNumberRef.current} to ${pageNumber}, resetting dimensions IMMEDIATELY`)
      prevPageNumberRef.current = pageNumber
      return null // Reset dimensions immediately
    }
    // CRITICAL: Use original dimensions from THIS specific page, not global map
    return originalDimensions
  }, [pageNumber, originalDimensions])

  // Update state when dimensions are reset
  useEffect(() => {
    if (prevPageNumberRef.current !== pageNumber) {
      setDimensionsLocked(false)
      setOriginalDimensions(null)
      setPageSize(null)
      setPageInfo(null)
      onPageLoadCalledRef.current = null // Reset callback tracking
    }
  }, [pageNumber])

  // Memoize the scaled dimensions
  const scaledDimensions = useMemo(() => {
    if (!currentPageDimensions || !dimensionsLocked) {
      console.log(`⏳ Waiting for actual PDF dimensions for page ${pageNumber}, locked: ${dimensionsLocked}, hasDimensions: ${!!currentPageDimensions}`)
      return null
    }
    const scaledWidth = currentPageDimensions.width * scale
    const scaledHeight = currentPageDimensions.height * scale

    console.log(`🔍 Calculating scaled dimensions for page ${pageNumber}:`, {
      original: currentPageDimensions,
      scale: scale,
      scaled: { width: scaledWidth, height: scaledHeight },
      scaleChanged: prevScaleRef.current !== scale,
      dimensionsLocked: dimensionsLocked
    })
    prevScaleRef.current = scale // Update previous scale reference

    return { width: scaledWidth, height: scaledHeight }
  }, [currentPageDimensions, scale, pageNumber, dimensionsLocked])

  // Update page size and info when scale changes or dimensions are calculated
  useEffect(() => {
    if (currentPageDimensions && scaledDimensions && dimensionsLocked) {
      console.log(`📏 Updating page size for page ${pageNumber} with scale ${scale}:`, {
        original: currentPageDimensions,
        scaled: scaledDimensions,
        isNewPage: prevPageNumberRef.current !== pageNumber,
        dimensionsLocked: dimensionsLocked
      })

      setPageSize(scaledDimensions)
      const pageInfoData = {
        width: scaledDimensions.width,
        height: scaledDimensions.height,
        originalWidth: currentPageDimensions.width,
        originalHeight: currentPageDimensions.height,
        scale: scale
      }
      setPageInfo(pageInfoData)

      console.log(`📐 PAGE INFO DATA SENT TO EDITOR for page ${pageNumber}:`, {
        scaledDimensions: { width: scaledDimensions.width, height: scaledDimensions.height },
        originalDimensions: { width: currentPageDimensions.width, height: currentPageDimensions.height },
        orientation: currentPageDimensions.width > currentPageDimensions.height ? 'LANDSCAPE' : 'PORTRAIT',
        aspectRatio: (currentPageDimensions.width / currentPageDimensions.height).toFixed(2),
        scale: scale,
        note: 'These dimensions go to the main editor for coordinate calculations'
      })

      // Call the onPageLoad callback when page info is ready (only once per page)
      if (onPageLoad && onPageLoadCalledRef.current !== pageNumber) {
        console.log(`🔄 Calling onPageLoad for page ${pageNumber} with EXACT dimensions`)
        onPageLoadCalledRef.current = pageNumber
        onPageLoad(pageNumber, pageInfoData)
      }
    }
  }, [currentPageDimensions, scaledDimensions, scale, pageNumber, dimensionsLocked])

  const handlePageLoadSuccess = useCallback((page: any) => {
    const { width, height } = page
    
    // APPLY EMERGENCY DIMENSION CORRECTION
    const correction = forceCorrectDimensions(width, height)
    
    // CRITICAL: Use CORRECTED dimensions, not React-PDF raw dimensions
    if (!dimensionsLocked) {
      if (correction.wasCorreted) {
        console.warn(`🚨 ORIGINAL OVERLAY: EMERGENCY CORRECTION APPLIED:`, {
          originalReactPDF: { width, height, orientation: width > height ? 'LANDSCAPE' : 'PORTRAIT' },
          correctedDimensions: { width: correction.width, height: correction.height },
          correctedOrientation: correction.width > correction.height ? 'LANDSCAPE' : 'PORTRAIT',
          note: 'EMERGENCY FIX applied to correct React-PDF dimension inversion'
        })
      }
      
      console.log(`📄 PDF page ${pageNumber} loaded - FINAL DIMENSIONS:`, {
        finalDimensions: { width: correction.width, height: correction.height },
        orientation: correction.width > correction.height ? 'LANDSCAPE' : 'PORTRAIT',
        aspectRatio: (correction.width / correction.height).toFixed(2),
        currentScale: scale,
        correctionApplied: correction.wasCorreted
      })
      setOriginalDimensions({ width: correction.width, height: correction.height })
      setDimensionsLocked(true)
    } else {
      console.log(`📄 Page ${pageNumber} dimensions ALREADY LOCKED - IGNORING subsequent call:`, {
        lockedOriginal: originalDimensions, 
        ignoredDimensions: { width, height },
        note: 'Dimensions locked to prevent changes'
      })
      return // Don't update dimensions
    }
  }, [pageNumber, scale, originalDimensions, dimensionsLocked])

  const handleClick = useCallback((e: React.MouseEvent) => {
    console.log(`🔍 DEBUG: PdfPageWithOverlay handleClick conditions:`, {
      hasPageInfo: !!pageInfo,
      hasPageSize: !!pageSize,
      hasCurrentPageDimensions: !!currentPageDimensions,
      pageInfo: pageInfo,
      pageSize: pageSize,
      currentPageDimensions: currentPageDimensions
    })

    if (pageInfo && pageSize && currentPageDimensions) { // Ensure all necessary info is available
      // Use the PDF page container, not the outer centering container
      const rect = pdfPageRef.current?.getBoundingClientRect()
      if (!rect) { onClick(e, pageNumber, pageInfo); return }

      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      
      // RESTORE BOUNDARIES WITH DETAILED LOGGING FOR DIAGNOSIS
      console.log(`🔍 BOUNDARY DEBUG - Raw click coordinates:`, {
        clientX: e.clientX,
        clientY: e.clientY,
        rectLeft: rect.left,
        rectTop: rect.top,
        relativeX: x,
        relativeY: y,
        scale: scale
      })
      
      // Convert click coordinates to original document coordinate system
      const originalX = (x / scale)
      const originalY = (y / scale)
      
      // Get page dimensions for boundaries
      const originalPageWidth = currentPageDimensions?.width || pageSize.width / scale
      const originalPageHeight = currentPageDimensions?.height || pageSize.height / scale
      
      console.log(`🔍 BOUNDARY DEBUG - Page dimensions:`, {
        currentPageDimensions: currentPageDimensions,
        pageSize: pageSize,
        scale: scale,
        calculatedOriginalDimensions: {
          width: originalPageWidth,
          height: originalPageHeight,
          orientation: originalPageWidth > originalPageHeight ? 'LANDSCAPE' : 'PORTRAIT'
        },
        originalClick: { x: originalX, y: originalY }
      })
      
      // Apply bounds using ORIGINAL page dimensions
      const boundedOriginalX = Math.max(0, Math.min(originalX, originalPageWidth))
      const boundedOriginalY = Math.max(0, Math.min(originalY, originalPageHeight))
      
      // Convert back to scaled coordinates for display
      const boundedX = boundedOriginalX * scale
      const boundedY = boundedOriginalY * scale
      
      console.log(`🔍 BOUNDARY DEBUG - Final coordinates:`, {
        originalBounded: { x: boundedOriginalX, y: boundedOriginalY },
        scaledBounded: { x: boundedX, y: boundedY },
        wasConstrained: {
          x: originalX !== boundedOriginalX,
          y: originalY !== boundedOriginalY
        }
      })

      const enhancedPageInfo = {
        ...pageInfo,
        clickX: boundedX,
        clickY: boundedY,
        pdfX: boundedX / pageSize.width,
        pdfY: boundedY / pageSize.height,
        originalClickX: boundedOriginalX, // Click position in original page coordinates (already calculated)
        originalClickY: boundedOriginalY,
        originalWidth: currentPageDimensions.width,
        originalHeight: currentPageDimensions.height,
        width: pageSize.width,
        height: pageSize.height,
        scale: scale
      }
      console.log(`🖱️ PdfPageWithOverlay click debug for page ${pageNumber}:`, {
        mouseEvent: { clientX: e.clientX, clientY: e.clientY },
        containerRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        clickInContainer: { x: x, y: y },
        finalClick: { x: boundedX, y: boundedY },
        pageGeometry: {
          displaySize: pageSize,
          originalSize: currentPageDimensions,
          scale: scale
        },
        note: "NO BOUNDARIES APPLIED - users can click anywhere",
        relativeCoords: { x: boundedX / pageSize.width, y: boundedY / pageSize.height }
      })
      onClick(e, pageNumber, enhancedPageInfo)
    } else {
      // FALLBACK: Calculate coordinates even when page dimensions aren't fully loaded yet
      console.log(`⚠️ Page ${pageNumber} dimensions not ready, using fallback coordinate calculation`)
      const rect = pdfPageRef.current?.getBoundingClientRect()
      if (rect) {
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        // Use the actual rendered size of the PDF page element
        const renderedWidth = rect.width
        const renderedHeight = rect.height

        const boundedX = Math.max(0, Math.min(x, renderedWidth))
        const boundedY = Math.max(0, Math.min(y, renderedHeight))

        // Calculate original coordinates using the current scale
        const originalClickX = boundedX / scale
        const originalClickY = boundedY / scale

        const fallbackPageInfo = {
          ...pageInfo,
          clickX: boundedX,
          clickY: boundedY,
          originalClickX: originalClickX,
          originalClickY: originalClickY,
          width: renderedWidth,
          height: renderedHeight,
          originalWidth: renderedWidth / scale,
          originalHeight: renderedHeight / scale,
          scale: scale
        }

        console.log(`🔧 FALLBACK coordinate calculation for page ${pageNumber}:`, {
          mouseEvent: { clientX: e.clientX, clientY: e.clientY },
          containerRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
          clickInContainer: { x: x, y: y },
          boundedClick: { x: boundedX, y: boundedY },
          calculatedOriginalCoords: { x: originalClickX, y: originalClickY },
          scale: scale,
          note: 'Using fallback calculation - page dimensions not fully loaded'
        })

        onClick(e, pageNumber, fallbackPageInfo)
      } else {
        onClick(e, pageNumber, pageInfo)
      }
    }
  }, [onClick, pageNumber, pageInfo, pageSize, currentPageDimensions, scale])

  const handleTouch = useCallback((e: React.TouchEvent) => {
    if (onTouch && pageInfo && pageSize && currentPageDimensions) { // Ensure all necessary info is available
      // Use the PDF page container, not the outer centering container
      const rect = pdfPageRef.current?.getBoundingClientRect()
      if (!rect) { onTouch(e, pageNumber, pageInfo); return }
      const touch = e.touches[0] || e.changedTouches[0]
      if (!touch) { onTouch(e, pageNumber, pageInfo); return }

      const x = touch.clientX - rect.left
      const y = touch.clientY - rect.top
      const boundedX = Math.max(0, Math.min(x, pageSize.width))
      const boundedY = Math.max(0, Math.min(y, pageSize.height))

      const enhancedPageInfo = {
        ...pageInfo,
        clickX: boundedX,
        clickY: boundedY,
        pdfX: boundedX / pageSize.width,
        pdfY: boundedY / pageSize.height,
        originalClickX: (boundedX / scale), // CRITICAL: Touch position in original page coordinates
        originalClickY: (boundedY / scale),
        originalWidth: currentPageDimensions.width,
        originalHeight: currentPageDimensions.height,
        width: pageSize.width,
        height: pageSize.height,
        scale: scale
      }
      console.log(`👆 Enhanced touch on page ${pageNumber}:`, { touchCoords: { x: boundedX, y: boundedY }, originalCoords: { x: boundedX / scale, y: boundedY / scale }, pageSize: pageSize, originalSize: currentPageDimensions, scale: scale })
      onTouch(e, pageNumber, enhancedPageInfo)
    } else if (onTouch) { onTouch(e, pageNumber, pageInfo) }
  }, [onTouch, pageNumber, pageInfo, pageSize, currentPageDimensions, scale])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center"
      style={{
        minHeight: pageSize?.height || 'auto',
        minWidth: pageSize?.width || 'auto'
      }}
      onClick={handleClick}
      onTouchEnd={handleTouch}

    >
      <div ref={pdfPageRef} className="relative">
        <Page
          key={`page-${pageNumber}-scale-${scale}`}
          pageNumber={pageNumber}
          scale={scale}
          renderAnnotationLayer={false}
          renderTextLayer={false}
          onLoadSuccess={handlePageLoadSuccess}
          className="w-full h-full border border-gray-300 shadow-lg rounded-sm bg-white"
        />
        <div
          className="absolute top-0 left-0 pointer-events-none"
          style={{
            width: currentPageDimensions?.width || 'auto',
            height: currentPageDimensions?.height || 'auto',
            transform: `scale(${scale})`,
            transformOrigin: 'top left'
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
