"use client"

import { useRef, useEffect, useState } from "react"
import { X, Palette } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface EnhancedSignatureCanvasProps {
  onComplete: (dataUrl: string) => void
  width?: number
  height?: number
}

const SIGNATURE_COLORS = [
  { name: "Blue", value: "#1e40af", default: true },
  { name: "Black", value: "#000000" },
  { name: "Navy", value: "#1e3a8a" },
  { name: "Green", value: "#16a34a" },
  { name: "Red", value: "#dc2626" },
  { name: "Purple", value: "#9333ea" },
  { name: "Brown", value: "#a3662b" },
  { name: "Gray", value: "#6b7280" },
]

export default function EnhancedSignatureCanvas({ 
  onComplete, 
  width = 400, 
  height = 200 
}: EnhancedSignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null)
  const [selectedColor, setSelectedColor] = useState(SIGNATURE_COLORS[0].value) // Default to blue
  const [lineWidth, setLineWidth] = useState(2)

  // Initialize canvas context
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext("2d")
    if (!context) return

    // Set canvas background to white
    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, canvas.width, canvas.height)

    // Set initial line style
    context.lineWidth = lineWidth
    context.lineCap = "round"
    context.lineJoin = "round"
    context.strokeStyle = selectedColor

    setCtx(context)
  }, [])

  // Update stroke color when selected color changes
  useEffect(() => {
    if (ctx) {
      ctx.strokeStyle = selectedColor
    }
  }, [selectedColor, ctx])

  // Update line width when it changes
  useEffect(() => {
    if (ctx) {
      ctx.lineWidth = lineWidth
    }
  }, [lineWidth, ctx])

  // Handle mouse events
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!ctx) return

    setIsDrawing(true)
    setHasSignature(true)

    const rect = canvasRef.current!.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !ctx) return

    const rect = canvasRef.current!.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const endDrawing = () => {
    if (!isDrawing || !ctx) return

    ctx.closePath()
    setIsDrawing(false)
  }

  // Handle touch events
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!ctx) return
    e.preventDefault()

    setIsDrawing(true)
    setHasSignature(true)

    const rect = canvasRef.current!.getBoundingClientRect()
    const x = e.touches[0].clientX - rect.left
    const y = e.touches[0].clientY - rect.top

    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !ctx) return
    e.preventDefault()

    const rect = canvasRef.current!.getBoundingClientRect()
    const x = e.touches[0].clientX - rect.left
    const y = e.touches[0].clientY - rect.top

    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !ctx) return
    e.preventDefault()

    ctx.closePath()
    setIsDrawing(false)
  }

  const clearSignature = () => {
    if (!ctx) return

    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvasRef.current!.width, canvasRef.current!.height)
    setHasSignature(false)
  }

  const saveSignature = () => {
    if (!canvasRef.current) return

    const dataUrl = canvasRef.current.toDataURL("image/png")
    onComplete(dataUrl)
  }

  const cancelSignature = () => {
    onComplete("")
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Color and Line Width Controls */}
      <div className="flex items-center space-x-4 mb-2">
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

      {/* Canvas */}
      <div className="relative border border-gray-300 rounded-md">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="touch-none cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={endDrawing}
          onMouseLeave={endDrawing}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
        {hasSignature && (
          <button
            type="button"
            onClick={clearSignature}
            className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-sm border border-gray-200 hover:bg-gray-50"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Clear signature</span>
          </button>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-4">
        <Button
          type="button"
          variant="outline"
          onClick={cancelSignature}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={clearSignature}
        >
          Clear
        </Button>
        <Button
          type="button"
          onClick={saveSignature}
          disabled={!hasSignature}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Save Signature
        </Button>
      </div>
    </div>
  )
}
