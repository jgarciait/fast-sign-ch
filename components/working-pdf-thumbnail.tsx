"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { RotateCw, Loader2 } from "lucide-react"

interface WorkingPdfThumbnailProps {
  documentUrl: string
  pageNumber: number
  rotation: number
  onRotationChange: (pageNumber: number, rotation: number) => void
  isSelected: boolean
  onSelect: (pageNumber: number) => void
}

export default function WorkingPdfThumbnail({
  documentUrl,
  pageNumber,
  rotation,
  onRotationChange,
  isSelected,
  onSelect
}: WorkingPdfThumbnailProps) {
  const [isLoading, setIsLoading] = useState(true)

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
            <div 
              className="bg-white shadow-sm rounded overflow-hidden border border-gray-200"
              style={{ 
                transform: `rotate(${rotation}deg)`,
                transition: 'transform 0.3s ease',
                width: '120px',
                height: '160px'
              }}
            >
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 z-10">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}
              
              <iframe
                src={`${documentUrl}#page=${pageNumber}&zoom=25`}
                width="120"
                height="160"
                style={{
                  border: 'none',
                  display: 'block',
                  pointerEvents: 'none'
                }}
                title={`Thumbnail Página ${pageNumber}`}
                onLoad={() => setIsLoading(false)}
                onError={() => setIsLoading(false)}
              />
            </div>
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