"use client"

import "@/utils/polyfills"
import { useState, useEffect, useRef } from "react"
import { Loader2, AlertCircle } from "lucide-react"
import { getCachedPdfDocument, loadPdfDocument } from "@/utils/pdf-singleton"

interface SimplePdfPreviewProps {
  documentUrl: string
  pageNumber?: number
  rotation: number
  className?: string
  maxHeight?: number
}

export default function SimplePdfPreview({
  documentUrl,
  pageNumber = 1,
  rotation,
  className = "",
  maxHeight = 400
}: SimplePdfPreviewProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  // Load and render the specific page
  useEffect(() => {
    let isMounted = true

    const renderPage = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Try to get cached document first
        let pdfDoc = getCachedPdfDocument(documentUrl)
        
        if (!pdfDoc) {
          // Load document if not cached
          pdfDoc = await loadPdfDocument(documentUrl)
        }

        if (!isMounted) return

        // Get the specific page
        const page = await pdfDoc.getPage(pageNumber)
        
        // Calculate viewport with rotation
        const viewport = page.getViewport({ 
          scale: 0.3, // Smaller scale for preview
          rotation: rotation
        })

        // Create a new canvas for each render to avoid conflicts
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        if (!context) return

        // Set canvas size
        canvas.width = viewport.width
        canvas.height = viewport.height

        // Clear canvas
        context.clearRect(0, 0, canvas.width, canvas.height)

        // Render page
        const renderContext = {
          canvasContext: context,
          viewport: viewport
        }

        await page.render(renderContext).promise

        // Convert to data URL
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        
        if (isMounted) {
          setImageUrl(dataUrl)
          setIsLoading(false)
        }

      } catch (err) {
        console.error('Error rendering preview:', err)
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Error al cargar preview'))
          setIsLoading(false)
        }
      }
    }

    renderPage()

    return () => {
      isMounted = false
    }
  }, [documentUrl, pageNumber, rotation])

  if (error) {
    return (
      <div className={`flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg ${className}`} style={{ height: maxHeight }}>
        <div className="text-center text-gray-500">
          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">Error al cargar preview</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      className={`flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 ${className}`}
      style={{ height: maxHeight }}
    >
      {isLoading ? (
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span className="text-sm text-gray-600">Cargando preview...</span>
        </div>
      ) : imageUrl ? (
        <div className="flex items-center justify-center">
          <img 
            src={imageUrl} 
            alt={`Preview página ${pageNumber}`}
            className="max-w-full max-h-full object-contain shadow-sm"
            style={{ 
              transform: `rotate(${rotation}deg)`,
              transition: 'transform 0.3s ease'
            }}
          />
        </div>
      ) : (
        <div className="text-center text-gray-500">
          <p className="text-sm">No se pudo generar preview</p>
        </div>
      )}
      
      {/* No hidden canvas needed - we create new canvas for each render */}
    </div>
  )
} 