"use client"

import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { RotateCw, ChevronUp, ChevronDown } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Dynamic import for PDF components
let pdfjs: any

// Global document cache to share PDF documents across thumbnail instances
const documentCache = new Map<string, any>()
const documentLoadingPromises = new Map<string, Promise<any>>()

interface StablePdfThumbnailProps {
  pageId: string
  documentUrl: string
  pageNumber: number
  displayPosition?: number
  isSelected: boolean
  onSelect: () => void
  onRotate: () => void
  rotationAngle: number
  onMoveUp?: () => void
  onMoveDown?: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
  isDragMode?: boolean
  showReorderButtons?: boolean
  isOriginalDocument?: boolean
}

const StablePdfThumbnail = React.memo(function StablePdfThumbnail({
  pageId,
  documentUrl,
  pageNumber,
  displayPosition,
  isSelected,
  onSelect,
  onRotate,
  rotationAngle,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
  isDragMode = false,
  showReorderButtons = true,
  isOriginalDocument = true,
  ...props
}: StablePdfThumbnailProps & any) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [pageWidth, setPageWidth] = useState(120)
  const [pageHeight, setPageHeight] = useState(150)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pdfDocumentRef = useRef<any>(null)
  const pageRef = useRef<any>(null)
  const renderTaskRef = useRef<any>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: pageId || `page-${pageNumber}`,
    disabled: !isDragMode
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  // Load PDF.js dynamically once
  useEffect(() => {
    const loadPdfJs = async () => {
      if (!pdfjs) {
        try {
          const reactPdf = await import('react-pdf')
          pdfjs = reactPdf.pdfjs
          
          // Set up PDF.js worker
          pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        } catch (error) {
          console.error('Error loading PDF.js:', error)
          setLoadError(true)
          return
        }
      }
      
      loadAndRenderPage()
    }

    loadPdfJs()
  }, [documentUrl, pageNumber])

  // Load and render PDF page to canvas
  const loadAndRenderPage = async () => {
    if (!pdfjs || !canvasRef.current) return

    try {
      setLoadError(false)
      
      // Load PDF document from cache or load new one
      if (!pdfDocumentRef.current) {
        // Check if document is already cached
        if (documentCache.has(documentUrl)) {
          console.log(`Using cached PDF document for page ${pageNumber}`)
          pdfDocumentRef.current = documentCache.get(documentUrl)
        } else {
          // Check if document is currently being loaded
          if (documentLoadingPromises.has(documentUrl)) {
            console.log(`Waiting for PDF document to load for page ${pageNumber}`)
            pdfDocumentRef.current = await documentLoadingPromises.get(documentUrl)
          } else {
            // Load new document
            console.log(`Loading new PDF document for page ${pageNumber}`)
            const loadPromise = pdfjs.getDocument(documentUrl).promise
            documentLoadingPromises.set(documentUrl, loadPromise)
            
            pdfDocumentRef.current = await loadPromise
            documentCache.set(documentUrl, pdfDocumentRef.current)
            documentLoadingPromises.delete(documentUrl)
          }
        }
      }

      // Get the page
      if (!pageRef.current) {
        console.log(`Loading page ${pageNumber}`)
        pageRef.current = await pdfDocumentRef.current.getPage(pageNumber)
      }

      // Set up canvas
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      
      if (!context) {
        throw new Error('Could not get canvas context')
      }
      
      // Calculate viewport for thumbnail scale
      const viewport = pageRef.current.getViewport({ scale: 0.2, rotation: rotationAngle })
      
      // Set canvas size
      canvas.width = viewport.width
      canvas.height = viewport.height
      setPageWidth(viewport.width)
      setPageHeight(viewport.height)

      // Cancel any existing render task
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel()
      }

      // Render page to canvas
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      }

      renderTaskRef.current = pageRef.current.render(renderContext)
      await renderTaskRef.current.promise

      console.log(`Page ${pageNumber} rendered successfully`)
      setIsLoaded(true)
    } catch (error) {
      console.error(`Error rendering page ${pageNumber}:`, error)
      setLoadError(true)
    }
  }

  // Re-render when rotation changes
  useEffect(() => {
    if (isLoaded && pageRef.current && canvasRef.current) {
      console.log(`Re-rendering page ${pageNumber} with rotation ${rotationAngle}`)
      renderPage()
    }
  }, [rotationAngle])

  // Render page with current rotation
  const renderPage = async () => {
    if (!pageRef.current || !canvasRef.current) return

    try {
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      
      if (!context) {
        throw new Error('Could not get canvas context')
      }
      
      // Calculate viewport with rotation
      const viewport = pageRef.current.getViewport({ scale: 0.2, rotation: rotationAngle })
      
      // Set canvas size
      canvas.width = viewport.width
      canvas.height = viewport.height
      setPageWidth(viewport.width)
      setPageHeight(viewport.height)

      // Clear canvas
      context.clearRect(0, 0, canvas.width, canvas.height)

      // Cancel any existing render task
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel()
      }

      // Render page to canvas
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      }

      renderTaskRef.current = pageRef.current.render(renderContext)
      await renderTaskRef.current.promise
    } catch (error) {
      console.error(`Error re-rendering page ${pageNumber}:`, error)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel()
      }
    }
  }, [])

  if (loadError) {
    return (
      <div className="w-full h-32 flex items-center justify-center bg-red-50 border-2 border-red-200 rounded-lg">
        <div className="text-red-500 text-sm">Error cargando PDF</div>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-32 flex items-center justify-center bg-gray-100 border-2 border-gray-200 rounded-lg">
        <div className="text-gray-500 text-sm">Cargando...</div>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        width: Math.max(pageWidth, 120),
        height: Math.max(pageHeight, 150),
      }}
      className={`
        relative group border-2 rounded-lg overflow-hidden bg-white transition-all
        ${isSelected ? 'border-blue-500 shadow-lg' : 'border-gray-200 hover:border-gray-300'}
        ${isDragMode ? 'cursor-grab active:cursor-grabbing hover:shadow-md' : ''}
        ${isDragging ? 'shadow-2xl z-50 border-blue-500 scale-105 opacity-90' : ''}
      `}
      {...attributes}
      {...(isDragMode ? listeners : {})}
    >
      {/* Page number badge */}
      <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-2 py-1 rounded z-10">
        {displayPosition !== undefined ? displayPosition : pageNumber}
        {rotationAngle > 0 && (
          <span className="ml-1 text-yellow-300">↻{rotationAngle}°</span>
        )}
      </div>

      {/* Reorder buttons */}
      {showReorderButtons && !isDragMode && (
        <div className="absolute top-1 right-1 flex flex-col gap-1 z-10">
          <Button
            size="sm"
            variant="secondary"
            className="h-6 w-6 p-0"
            onClick={onMoveUp}
            disabled={!canMoveUp}
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-6 w-6 p-0"
            onClick={onMoveDown}
            disabled={!canMoveDown}
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Canvas for PDF rendering */}
      <div 
        className="flex items-center justify-center cursor-pointer p-2 h-full w-full"
        onClick={onSelect}
      >
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full object-contain"
          style={{ display: isLoaded ? 'block' : 'none' }}
        />
      </div>

      {/* Rotate button */}
      {onRotate && !isDragMode && (
        <div className="absolute bottom-1 right-1">
          <Button
            size="sm"
            variant="secondary"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation()
              onRotate()
            }}
          >
            <RotateCw className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Drag indicator */}
      {isDragMode && (
        <div className="absolute inset-0 border-2 border-blue-500 rounded-lg pointer-events-none" />
      )}
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  return (
    prevProps.pageId === nextProps.pageId &&
    prevProps.documentUrl === nextProps.documentUrl &&
    prevProps.pageNumber === nextProps.pageNumber &&
    prevProps.displayPosition === nextProps.displayPosition &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.rotationAngle === nextProps.rotationAngle &&
    prevProps.canMoveUp === nextProps.canMoveUp &&
    prevProps.canMoveDown === nextProps.canMoveDown &&
    prevProps.isDragMode === nextProps.isDragMode &&
    prevProps.showReorderButtons === nextProps.showReorderButtons &&
    prevProps.isOriginalDocument === nextProps.isOriginalDocument
  )
})

export default StablePdfThumbnail 