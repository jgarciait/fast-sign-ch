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
            console.log(`📄 Enhanced: Page changed from ${prevPageNumberRef.current} to ${pageNumber}, resetting properties`)
            prevPageNumberRef.current = pageNumber
            return null
        }
        return pdfLibProperties
    }, [pageNumber, pdfLibProperties])

    // Reset state when page changes
    useEffect(() => {
        if (prevPageNumberRef.current !== pageNumber) {
            setPdfLibProperties(null)
            setPageSize(null)
            setPageInfo(null)
            setIsLoadingProperties(true)
            onPageLoadCalledRef.current = null
        }
    }, [pageNumber])

    // Load PDF properties using pdf-lib exclusively
    useEffect(() => {
        if (!documentUrl || pdfLibProperties) return

        const fetchProperties = async () => {
            try {
                setIsLoadingProperties(true)
                console.log(`🔍 Enhanced: Loading PDF-LIB properties for page ${pageNumber}`)

                const properties = await getPagePropertiesFromURL(documentUrl, pageNumber)

                console.log(`✅ Enhanced: PDF-LIB properties loaded for page ${pageNumber}:`, {
                    width: properties.width,
                    height: properties.height,
                    rotate: properties.rotate,
                    orientation: properties.orientation,
                    aspectRatio: properties.aspectRatio.toFixed(3)
                })

                setPdfLibProperties(properties)
            } catch (error) {
                console.error(`❌ Enhanced: Failed to load PDF-LIB properties for page ${pageNumber}:`, error)
            } finally {
                setIsLoadingProperties(false)
            }
        }

        fetchProperties()
    }, [documentUrl, pageNumber, pdfLibProperties])

    // Calculate scaled dimensions using pdf-lib properties
    const scaledDimensions = useMemo(() => {
        if (!currentPageProperties || isLoadingProperties) {
            console.log(`⏳ Enhanced: Waiting for PDF-LIB properties for page ${pageNumber}`)
            return null
        }

        const dimensions = calculateDisplayDimensions(currentPageProperties, scale)

        console.log(`🔍 Enhanced: Calculated display dimensions for page ${pageNumber}:`, {
            pdfLibProperties: currentPageProperties,
            scale: scale,
            displayDimensions: dimensions,
            orientation: currentPageProperties.orientation
        })

        return dimensions
    }, [currentPageProperties, scale, pageNumber, isLoadingProperties])

    // Update page size and info using pdf-lib properties
    useEffect(() => {
        if (currentPageProperties && scaledDimensions) {
            console.log(`📏 Enhanced: Updating page info for page ${pageNumber} with PDF-LIB properties:`, {
                properties: currentPageProperties,
                scaledDimensions: scaledDimensions,
                orientation: currentPageProperties.orientation
            })

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

            console.log(`📐 Enhanced: PDF-LIB page info for page ${pageNumber}:`, {
                scaledDimensions: { width: scaledDimensions.width, height: scaledDimensions.height },
                originalDimensions: { width: currentPageProperties.width, height: currentPageProperties.height },
                orientation: currentPageProperties.orientation,
                aspectRatio: currentPageProperties.aspectRatio.toFixed(3),
                rotate: currentPageProperties.rotate
            })

            // Call onPageLoad callback with pdf-lib properties
            if (onPageLoad && onPageLoadCalledRef.current !== pageNumber) {
                console.log(`🔄 Enhanced: Calling onPageLoad for page ${pageNumber} with PDF-LIB properties`)
                onPageLoadCalledRef.current = pageNumber
                onPageLoad(pageNumber, pageInfoData)
            }
        }
    }, [currentPageProperties, scaledDimensions, scale, pageNumber, onPageLoad])

    // Handle React PDF page load (only for visualization)
    const handlePageLoadSuccess = useCallback((page: any) => {
        console.log(`📄 Enhanced: React PDF page ${pageNumber} loaded (visualization only):`, {
            reactPdfDimensions: { width: page.width, height: page.height },
            note: 'React PDF is used only for visualization, not for coordinates'
        })
    }, [pageNumber])

    // Handle click events using pdf-lib coordinate system
    const handleClick = useCallback((e: React.MouseEvent) => {
        console.log(`🔍 Enhanced: Click handling for page ${pageNumber}:`, {
            hasPageInfo: !!pageInfo,
            hasPageSize: !!pageSize,
            hasProperties: !!currentPageProperties,
            hasScaledDimensions: !!scaledDimensions
        })

        if (pageInfo && pageSize && currentPageProperties && scaledDimensions) {
            const rect = pdfPageRef.current?.getBoundingClientRect()
            if (!rect) {
                onClick(e, pageNumber, pageInfo)
                return
            }

            const x = e.clientX - rect.left
            const y = e.clientY - rect.top

            console.log(`🔍 Enhanced: Click coordinates using PDF-LIB properties:`, {
                clientX: e.clientX,
                clientY: e.clientY,
                rectLeft: rect.left,
                rectTop: rect.top,
                relativeX: x,
                relativeY: y,
                scale: scale,
                pdfLibProperties: currentPageProperties
            })

            // Convert screen coordinates to PDF coordinates using pdf-lib system
            const screenCoords: ScreenCoordinates = { x, y, width: 0, height: 0 }
            const pdfCoords = screenToPDFSignature(screenCoords, currentPageProperties, scale, pageNumber)

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

            console.log(`🖱️ Enhanced: Click processed with PDF-LIB coordinates:`, {
                clickCoords: { x: boundedX, y: boundedY },
                pdfCoords: { x: pdfCoords.x, y: pdfCoords.y },
                relativeCoords: { x: pdfCoords.relativeX, y: pdfCoords.relativeY },
                pageGeometry: {
                    displaySize: { width: scaledDimensions.width, height: scaledDimensions.height },
                    originalSize: { width: currentPageProperties.width, height: currentPageProperties.height },
                    scale: scale,
                    rotate: currentPageProperties.rotate
                },
                orientation: currentPageProperties.orientation
            })

            onClick(e, pageNumber, enhancedPageInfo)
        } else {
            // Fallback to basic click handling
            console.log(`⚠️ Enhanced: Falling back to basic click handling for page ${pageNumber}`)
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

            console.log(`👆 Enhanced: Touch processed with PDF-LIB coordinates:`, {
                touchCoords: { x: boundedX, y: boundedY },
                pdfCoords: { x: pdfCoords.x, y: pdfCoords.y },
                pageGeometry: {
                    displaySize: { width: scaledDimensions.width, height: scaledDimensions.height },
                    originalSize: { width: currentPageProperties.width, height: currentPageProperties.height },
                    scale: scale,
                    rotate: currentPageProperties.rotate
                }
            })

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
                transform: currentPageProperties.rotate !== 0 ? `rotate(${currentPageProperties.rotate}deg)` : undefined,
                transformOrigin: 'center'
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
