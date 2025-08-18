'use client'

import { Page } from 'react-pdf'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import type { Annotation } from './pdf-annotation-editor'
import {
  getPagePropertiesFromURL,
  PDFPageProperties,
  calculateDisplayDimensions,
  pdfPropertiesCache
} from '../utils/pdf-lib-dimensions'
import {
  screenToPDFSignature,
  pdfToScreenSignature,
  centerSignatureOnPoint,
  ScreenCoordinates
} from '../utils/signature-coordinates'
import { logSignatureCoordinateDebug } from '../utils/debug-signature-coordinates'

interface Props {
  pageNumber: number
  scale: number
  annotations: Annotation[]
  onClick: (e: React.MouseEvent<Element>, pageNumber: number, pageInfo?: any) => void
  onTouch?: (e: React.TouchEvent<Element>, pageNumber: number, pageInfo?: any) => void
  onPageLoad?: (pageNumber: number, pageInfo: any) => void
  children?: React.ReactNode
  documentUrl: string
}

export default function EnhancedPdfPageWithOverlay({
  pageNumber,
  scale,
  annotations,
  onClick,
  onTouch,
  onPageLoad,
  children,
  documentUrl
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pdfPageRef = useRef<HTMLDivElement>(null)
  const [pageInfo, setPageInfo] = useState<any>(null)
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null)
  const [pdfLibProperties, setPdfLibProperties] = useState<PDFPageProperties | null>(null)
  const [isLoadingProperties, setIsLoadingProperties] = useState(false)

  const prevPageNumberRef = useRef<number>(pageNumber)
  const onPageLoadCalledRef = useRef<number | null>(null)

  // Reset properties when page changes
  const currentPageProperties = useMemo(() => {
    if (prevPageNumberRef.current !== pageNumber) {

      prevPageNumberRef.current = pageNumber
      return null
    }
    return pdfLibProperties
  }, [pageNumber, pdfLibProperties])

  // Optimized property loading that checks cache first
  useEffect(() => {
    if (!documentUrl) return

    const fetchProperties = async () => {
      try {


        // Use the cache that automatically checks for existing entries
        const documentProperties = await pdfPropertiesCache.get(documentUrl)
        const properties = documentProperties.pages.get(pageNumber)

        if (!properties) {
          throw new Error(`Page ${pageNumber} not found in document`)
        }



        setPdfLibProperties(properties)
        setIsLoadingProperties(false)
      } catch (error) {
        console.error(`❌ Enhanced: Failed to load PDF-LIB properties for page ${pageNumber}:`, error)
        setIsLoadingProperties(false)
      }
    }

    // Only fetch if we don't have properties yet
    if (!pdfLibProperties || pdfLibProperties.pageNumber !== pageNumber) {
      setIsLoadingProperties(true)
      fetchProperties()
    }
  }, [documentUrl, pageNumber, pdfLibProperties])

  // Reset only necessary state when page changes
  useEffect(() => {
    if (prevPageNumberRef.current !== pageNumber) {
      // Don't reset pdfLibProperties immediately - let the cache check happen first
      setPageSize(null)
      setPageInfo(null)
      onPageLoadCalledRef.current = null
      prevPageNumberRef.current = pageNumber
    }
  }, [pageNumber])

  // Calculate scaled dimensions using pdf-lib properties (optimized)
  const scaledDimensions = useMemo(() => {
    if (!currentPageProperties || isLoadingProperties) {
      return null
    }

    const dimensions = calculateDisplayDimensions(currentPageProperties, scale)



    return dimensions
  }, [currentPageProperties, scale, pageNumber])

  // Update page size and info using pdf-lib properties
  useEffect(() => {
    if (currentPageProperties && scaledDimensions) {


      setPageSize({ width: scaledDimensions.width, height: scaledDimensions.height })

      const pageInfoData = {
        width: scaledDimensions.width,
        height: scaledDimensions.height,
        originalWidth: currentPageProperties.width,
        originalHeight: currentPageProperties.height,
        scale: scale,
        orientation: currentPageProperties.orientation,
        aspectRatio: currentPageProperties.aspectRatio,
        rotate: currentPageProperties.rotate,
        source: 'pdf-lib-exclusive'
      }
      setPageInfo(pageInfoData)



      // Call onPageLoad callback with pdf-lib properties
      if (onPageLoad && onPageLoadCalledRef.current !== pageNumber) {

        onPageLoadCalledRef.current = pageNumber
        onPageLoad(pageNumber, pageInfoData)
      }
    }
  }, [currentPageProperties, scaledDimensions, scale, pageNumber, onPageLoad])

  // Handle React PDF page load (only for visualization)
  const handlePageLoadSuccess = useCallback((page: any) => {

  }, [pageNumber])

  // Handle click events using pdf-lib coordinate system
  const handleClick = useCallback((e: React.MouseEvent) => {


    if (pageInfo && pageSize && currentPageProperties && scaledDimensions) {
      const rect = pdfPageRef.current?.getBoundingClientRect()
      if (!rect) {
        onClick(e, pageNumber, pageInfo)
        return
      }

      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      // 🔍 DEBUG: Log signature drop details using organized debug utility
      logSignatureCoordinateDebug({
        documentType: currentPageProperties.isScannedDocument ? 'scanned' : 'pc-created',
        stage: 'frontend-drop',
        pageProperties: {
          width: currentPageProperties.width,
          height: currentPageProperties.height,
          orientation: currentPageProperties.orientation,
          isScannedDocument: currentPageProperties.isScannedDocument || false,
          correctionApplied: currentPageProperties.scannedOrientationCorrectionApplied || false
        },
        coordinates: {
          screen: { x, y }
        },
        metadata: {
          scale,
          scaledDimensions: { width: scaledDimensions.width, height: scaledDimensions.height },
          containerSize: { width: rect.width, height: rect.height },
          actualRotate: currentPageProperties.actualRotate
        }
      })

      // Convert screen coordinates to PDF coordinates using pdf-lib system
      const screenCoords: ScreenCoordinates = { x, y, width: 0, height: 0 }
      const pdfCoords = screenToPDFSignature(screenCoords, currentPageProperties, scale, pageNumber)

      // Log coordinate conversion results
      logSignatureCoordinateDebug({
        documentType: currentPageProperties.isScannedDocument ? 'scanned' : 'pc-created',
        stage: 'coordinate-conversion',
        pageProperties: {
          width: currentPageProperties.width,
          height: currentPageProperties.height,
          orientation: currentPageProperties.orientation,
          isScannedDocument: currentPageProperties.isScannedDocument || false,
          correctionApplied: currentPageProperties.scannedOrientationCorrectionApplied || false
        },
        coordinates: {
          screen: { x, y },
          absolute: { x: pdfCoords.x, y: pdfCoords.y, width: 0, height: 0 },
          relative: { x: pdfCoords.relativeX, y: pdfCoords.relativeY, width: 0, height: 0 }
        }
      })

      // Ensure coordinates are within bounds
      const boundedX = Math.max(0, Math.min(x, scaledDimensions.width))
      const boundedY = Math.max(0, Math.min(y, scaledDimensions.height))

      const enhancedPageInfo = {
        ...pageInfo,
        clickX: boundedX,
        clickY: boundedY,
        // Use PDF-LIB coordinate system
        pdfX: pdfCoords.relativeX,
        pdfY: pdfCoords.relativeY,
        originalClickX: pdfCoords.x,
        originalClickY: pdfCoords.y,
        // PDF-LIB properties
        originalWidth: currentPageProperties.width,
        originalHeight: currentPageProperties.height,
        width: scaledDimensions.width,
        height: scaledDimensions.height,
        scale: scale,
        orientation: currentPageProperties.orientation,
        aspectRatio: currentPageProperties.aspectRatio,
        rotate: currentPageProperties.rotate,
        source: 'pdf-lib-exclusive',
        // Pass PDF-LIB properties for accurate coordinate handling
        pdfLibProperties: currentPageProperties
      }



      onClick(e, pageNumber, enhancedPageInfo)
    } else {
      // Fallback to basic click handling

      onClick(e, pageNumber, pageInfo)
    }
  }, [onClick, pageNumber, pageInfo, pageSize, currentPageProperties, scaledDimensions, scale])

  // Handle touch events using pdf-lib coordinate system
  const handleTouch = useCallback((e: React.TouchEvent) => {
    if (onTouch && pageInfo && pageSize && currentPageProperties && scaledDimensions) {
      const rect = pdfPageRef.current?.getBoundingClientRect()
      if (!rect) {
        onTouch(e, pageNumber, pageInfo)
        return
      }

      const touch = e.touches[0] || e.changedTouches[0]
      if (!touch) {
        onTouch(e, pageNumber, pageInfo)
        return
      }

      const x = touch.clientX - rect.left
      const y = touch.clientY - rect.top

      // 🔍 DEBUG: Log signature touch details using organized debug utility
      logSignatureCoordinateDebug({
        documentType: currentPageProperties.isScannedDocument ? 'scanned' : 'pc-created',
        stage: 'frontend-drop',
        pageProperties: {
          width: currentPageProperties.width,
          height: currentPageProperties.height,
          orientation: currentPageProperties.orientation,
          isScannedDocument: currentPageProperties.isScannedDocument || false,
          correctionApplied: currentPageProperties.scannedOrientationCorrectionApplied || false
        },
        coordinates: {
          screen: { x, y }
        },
        metadata: {
          inputType: 'touch',
          scale,
          scaledDimensions: { width: scaledDimensions.width, height: scaledDimensions.height }
        }
      })

      // Convert to PDF coordinates
      const screenCoords: ScreenCoordinates = { x, y, width: 0, height: 0 }
      const pdfCoords = screenToPDFSignature(screenCoords, currentPageProperties, scale, pageNumber)

      const boundedX = Math.max(0, Math.min(x, scaledDimensions.width))
      const boundedY = Math.max(0, Math.min(y, scaledDimensions.height))

      const enhancedPageInfo = {
        ...pageInfo,
        clickX: boundedX,
        clickY: boundedY,
        pdfX: pdfCoords.relativeX,
        pdfY: pdfCoords.relativeY,
        originalClickX: pdfCoords.x,
        originalClickY: pdfCoords.y,
        originalWidth: currentPageProperties.width,
        originalHeight: currentPageProperties.height,
        width: scaledDimensions.width,
        height: scaledDimensions.height,
        scale: scale,
        orientation: currentPageProperties.orientation,
        aspectRatio: currentPageProperties.aspectRatio,
        rotate: currentPageProperties.rotate,
        source: 'pdf-lib-exclusive',
        pdfLibProperties: currentPageProperties
      }



      onTouch(e, pageNumber, enhancedPageInfo)
    } else if (onTouch) {
      onTouch(e, pageNumber, pageInfo)
    }
  }, [onTouch, pageNumber, pageInfo, pageSize, currentPageProperties, scaledDimensions, scale])

  // Show loading state while getting pdf-lib properties
  if (!currentPageProperties || isLoadingProperties) {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-gray-100 animate-pulse">
        <div className="text-gray-600">
          🔍 Loading PDF properties with pdf-lib...
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center"
      style={{
        minHeight: scaledDimensions?.height || 0,
        minWidth: scaledDimensions?.width || 0,
        // REMOVED CSS ROTATION - pdf-lib handles rotation internally
        // The PDF page dimensions already account for rotation
      }}
      onClick={handleClick}
      onTouchEnd={handleTouch}
    >
      {/* Display PDF-LIB properties for debugging */}
      {process.env.NODE_ENV === 'development' && currentPageProperties && (
        <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white text-xs p-2 rounded z-50">
          <div>📐 PDF-LIB: {currentPageProperties.width}×{currentPageProperties.height}</div>
          <div>🧭 {currentPageProperties.orientation}</div>
          <div>📊 Ratio: {currentPageProperties.aspectRatio.toFixed(3)}</div>
          <div>🔄 Rotate: {currentPageProperties.rotate}°</div>
        </div>
      )}

      <div ref={pdfPageRef} className="relative">
        <Page
          key={`enhanced-page-${pageNumber}-scale-${scale}`}
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
            width: scaledDimensions?.width || 0,
            height: scaledDimensions?.height || 0,
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
