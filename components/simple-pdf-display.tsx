"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2, AlertCircle } from "lucide-react"

interface SimplePdfDisplayProps {
  documentUrl: string
  currentPage: number
  totalPages: number
  pageRotations: { [pageNumber: number]: number }
  onPageChange: (pageNumber: number) => void
  className?: string
}

export default function SimplePdfDisplay({
  documentUrl,
  currentPage,
  totalPages,
  pageRotations,
  onPageChange,
  className = ""
}: SimplePdfDisplayProps) {
  const [scale, setScale] = useState(1.0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    
    // Simulate loading time
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 1000)
    
    return () => clearTimeout(timer)
  }, [documentUrl])

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

  const handleZoomIn = () => {
    setScale(prevScale => Math.min(prevScale + 0.2, 3.0))
  }

  const handleZoomOut = () => {
    setScale(prevScale => Math.max(prevScale - 0.2, 0.5))
  }

  const currentPageRotation = pageRotations[currentPage] || 0

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg h-full ${className}`}>
        <div className="text-center text-gray-500">
          <AlertCircle className="h-12 w-12 mx-auto mb-4" />
          <p className="text-lg font-medium">Error al cargar el documento</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Controls */}
      <div className="flex items-center justify-between p-4 bg-white border-b">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <span className="text-sm font-medium min-w-0">
            Página {currentPage} de {totalPages}
          </span>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          
          <span className="text-sm font-medium min-w-0">
            {Math.round(scale * 100)}%
          </span>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomIn}
            disabled={scale >= 3.0}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 overflow-auto bg-gray-100 p-4">
        <div className="flex justify-center">
          {isLoading ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Cargando documento...</p>
              </div>
            </div>
          ) : (
            <div className="bg-white shadow-lg p-4 rounded">
              <div className="text-center">
                <div 
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 mb-4"
                  style={{ 
                    transform: `rotate(${currentPageRotation}deg) scale(${scale})`,
                    transition: 'transform 0.3s ease',
                    width: '400px',
                    height: '500px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <div className="text-center">
                    <div className="text-4xl mb-4">📄</div>
                    <p className="text-lg font-medium">Página {currentPage}</p>
                    <p className="text-sm text-gray-600">Rotación: {currentPageRotation}°</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Zoom: {Math.round(scale * 100)}%
                    </p>
                  </div>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Documento cargado:</strong> {documentUrl.startsWith('data:') ? 'Data URL' : 'Archivo'}<br/>
                    <strong>Tamaño:</strong> {documentUrl.length} caracteres<br/>
                    <strong>Tipo:</strong> PDF
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 