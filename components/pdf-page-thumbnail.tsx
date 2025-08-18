"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { RotateCw, Loader2, AlertCircle } from "lucide-react"
import { Document, Page, pdfjs } from 'react-pdf'

// Configure PDF.js worker
if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.mjs`
}

interface PdfPageThumbnailProps {
  documentUrl: string
  pageNumber: number
  rotation: number
  onRotationChange: (pageNumber: number, rotation: number) => void
  isSelected: boolean
  onSelect: (pageNumber: number) => void
}

export default function PdfPageThumbnail({
  documentUrl,
  pageNumber,
  rotation,
  onRotationChange,
  isSelected,
  onSelect
}: PdfPageThumbnailProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const handleLoadSuccess = () => {
    setIsLoading(false)
    setError(null)
  }

  const handleLoadError = (error: Error) => {
    console.error(`Thumbnail load error for page ${pageNumber}:`, error)
    setError(error)
    setIsLoading(false)
  }

  const handleRotate = () => {
    const newRotation = (rotation + 90) % 360
    onRotationChange(pageNumber, newRotation)
  }

  const handleSelect = () => {
    onSelect(pageNumber)
  }

  return (
    <Card 
      className={`cursor-pointer transition-all duration-200 ${
        isSelected 
          ? 'ring-2 ring-blue-500 bg-blue-50' 
          : 'hover:bg-gray-50'
      }`}
      onClick={handleSelect}
    >
      <CardContent className="p-3">
        <div className="relative">
          {/* Thumbnail */}
          <div className="relative mb-2">
            {isLoading ? (
              <div className="flex items-center justify-center h-32 w-24 bg-gray-100 rounded">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-32 w-24 bg-red-50 border border-red-200 rounded">
                <AlertCircle className="h-4 w-4 text-red-500" />
              </div>
            ) : (
              <div 
                className="bg-white shadow-sm rounded overflow-hidden"
                style={{ 
                  transform: `rotate(${rotation}deg)`,
                  transition: 'transform 0.3s ease'
                }}
              >
                <Document
                  file={documentUrl}
                  onLoadSuccess={handleLoadSuccess}
                  onLoadError={handleLoadError}
                >
                  <Page
                    pageNumber={pageNumber}
                    scale={0.2}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                  />
                </Document>
              </div>
            )}
          </div>

          {/* Page info and controls */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">
              Página {pageNumber}
            </span>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                handleRotate()
              }}
              className="h-6 w-6 p-0"
            >
              <RotateCw className="h-3 w-3" />
            </Button>
          </div>

          {/* Rotation indicator */}
          {rotation > 0 && (
            <div className="absolute top-1 right-1 bg-blue-500 text-white text-xs px-1 py-0.5 rounded">
              {rotation}°
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
} 