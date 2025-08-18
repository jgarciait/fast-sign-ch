"use client"

import type React from "react"
import { useRef, useState, useEffect } from "react"
import { X, Check, Palette } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface SignaturePadProps {
  onComplete: (dataUrl: string) => void
  width?: number
  height?: number
}

const SIGNATURE_COLORS = [
  { name: "Blue", value: "#1e40af", default: true },
  { name: "Black", value: "#000000" },
  { name: "Navy", value: "#0d2340" },
  { name: "Green", value: "#16a34a" },
  { name: "Red", value: "#dc2626" },
  { name: "Purple", value: "#9333ea" },
  { name: "Dark Gray", value: "#374151" },
  { name: "Gray", value: "#6b7280" },
]

export default function SignaturePad({ onComplete, width = 600, height = 300 }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [selectedColor, setSelectedColor] = useState(SIGNATURE_COLORS[0].value) // Default to blue
  const [lineWidth, setLineWidth] = useState(2)

  // Initialize canvas with white background
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Get the context without alpha: false
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas size
    canvas.width = width
    canvas.height = height

    // Initialize canvas with transparent background
    // Removed white background to maintain transparency

    // Set drawing style
    ctx.strokeStyle = selectedColor
    ctx.lineWidth = lineWidth
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
  }, [width, height, selectedColor, lineWidth])

  // Update canvas style when color or line width changes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.strokeStyle = selectedColor
    ctx.lineWidth = lineWidth
  }, [selectedColor, lineWidth])

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()

    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      }
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
    }
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    setIsDrawing(true)
    setHasSignature(true)

    const { x, y } = getCoordinates(e)
    ctx.beginPath()
    ctx.moveTo(x, y)

    if ("touches" in e) {
      e.preventDefault()
    }
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const { x, y } = getCoordinates(e)
    ctx.lineTo(x, y)
    ctx.stroke()

    if ("touches" in e) {
      e.preventDefault()
    }
  }

  const stopDrawing = (e?: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.closePath()
    setIsDrawing(false)

    if (e && "touches" in e) {
      e.preventDefault()
    }
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear with transparent background
    ctx.clearRect(0, 0, width, height)

    setHasSignature(false)
  }

  const saveSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Create a temporary canvas for transparent background
    const tempCanvas = document.createElement("canvas")
    tempCanvas.width = width
    tempCanvas.height = height
    const tempCtx = tempCanvas.getContext("2d", { alpha: true })

    if (!tempCtx) return

    // Get original image data
    const originalCtx = canvas.getContext("2d")
    if (!originalCtx) return

    const imageData = originalCtx.getImageData(0, 0, width, height)
    const data = imageData.data

    // Convert white pixels to transparent
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]

      // If pixel is white (or very close to white), make it transparent
      if (r > 250 && g > 250 && b > 250) {
        data[i + 3] = 0 // Set alpha to 0
      }
    }

    // Put modified data on temp canvas
    tempCtx.putImageData(imageData, 0, 0)

    // Get data URL and complete
    const dataUrl = tempCanvas.toDataURL("image/png")
    onComplete(dataUrl)
  }

  const cancelSignature = () => {
    onComplete("")
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Color and Line Width Controls */}
      <div className="flex items-center space-x-4 mb-4">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center space-x-2">
              <Palette className="h-4 w-4" />
              <div 
                className="w-4 h-4 rounded-full border border-gray-300" 
                style={{ backgroundColor: selectedColor }}
              />
              <span>Color</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3">
            <div className="grid grid-cols-4 gap-2">
              {SIGNATURE_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setSelectedColor(color.value)}
                  className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                    selectedColor === color.value 
                      ? "border-gray-400 ring-2 ring-blue-500 ring-offset-1" 
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">Thickness:</span>
          <input
            type="range"
            min="1"
            max="8"
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            className="w-20"
          />
          <span className="text-sm text-gray-500 w-6">{lineWidth}px</span>
        </div>
      </div>
      
      <div className="relative rounded-lg overflow-hidden p-1 mb-4" style={{ backgroundColor: '#F1F3F7', border: '1px solid #F1F3F7' }}>
        <canvas
          ref={canvasRef}
          className="touch-none border rounded-md relative z-10 cursor-crosshair"
          style={{
            backgroundColor: "#FFFFFF", // --surface
            touchAction: "none",
            width: `${width}px`,
            height: `${height}px`,
            borderColor: '#F1F3F7' // --sidebar
          }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {hasSignature && (
          <button
            type="button"
            onClick={clearSignature}
            className="absolute top-2 right-2 rounded-full p-1 shadow-lg border hover:opacity-80 transition-opacity"
            style={{ 
              backgroundColor: '#FFFFFF', // --surface
              borderColor: '#F1F3F7', // --sidebar
              color: '#282828' // --on-surface
            }}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex space-x-3">
        <button
          type="button"
          onClick={cancelSignature}
          className="px-4 py-2 border rounded-md text-sm font-medium hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-primary transition-all"
          style={{
            backgroundColor: '#FFFFFF', // --surface
            borderColor: '#F1F3F7', // --sidebar
            color: '#282828' // --on-surface
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={clearSignature}
          disabled={!hasSignature}
          className="px-4 py-2 border rounded-md text-sm font-medium hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 transition-all"
          style={{
            backgroundColor: '#FFFFFF', // --surface
            borderColor: '#F1F3F7', // --sidebar
            color: '#282828' // --on-surface
          }}
        >
          Clear
        </button>
        <button
          type="button"
          onClick={saveSignature}
          disabled={!hasSignature}
          className="px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 flex items-center space-x-1 transition-all"
          style={{
            backgroundColor: '#0d2340', // --primary
            color: '#FFFFFF' // --surface
          }}
        >
          <Check className="h-4 w-4" />
          <span>Apply Signature</span>
        </button>
      </div>
    </div>
  )
}
