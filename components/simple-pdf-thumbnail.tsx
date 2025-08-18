"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { RotateCw } from "lucide-react"

interface SimplePdfThumbnailProps {
  documentUrl: string
  pageNumber: number
  rotation: number
  onRotationChange: (pageNumber: number, rotation: number) => void
  isSelected: boolean
  onSelect: (pageNumber: number) => void
}

export default function SimplePdfThumbnail({
  documentUrl,
  pageNumber,
  rotation,
  onRotationChange,
  isSelected,
  onSelect
}: SimplePdfThumbnailProps) {
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
              className="bg-white shadow-sm rounded overflow-hidden border-2 border-gray-200 w-24 h-32 flex items-center justify-center"
              style={{ 
                transform: `rotate(${rotation}deg)`,
                transition: 'transform 0.3s ease'
              }}
            >
              <div className="text-center">
                <div className="text-2xl mb-1">📄</div>
                <div className="text-xs text-gray-600">PDF</div>
              </div>
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