"use client"

import type React from "react"

import { useRef, useState, useEffect } from "react"
import { X } from "lucide-react"

interface SignatureCanvasProps {
  onComplete: (dataUrl: string) => void
  width?: number
  height?: number
}

export default function SignatureCanvas({ onComplete, width = 400, height = 200 }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null)

  // Initialize canvas context
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext("2d")
    if (!context) return

    // Initialize canvas with transparent background
    // Removed white background to maintain transparency

    // Set line style
    context.lineWidth = 2
    context.lineCap = "round"
    context.lineJoin = "round"
    context.strokeStyle = "#000000"

    setCtx(context)
  }, [])

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

    ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height)
    setHasSignature(false)
  }

  const saveSignature = () => {
    if (!canvasRef.current) return

    // Create a temporary canvas for transparent background processing
    const canvas = canvasRef.current
    const tempCanvas = document.createElement("canvas")
    tempCanvas.width = canvas.width
    tempCanvas.height = canvas.height
    const tempCtx = tempCanvas.getContext("2d", { alpha: true })
    
    if (!tempCtx) {
      // Fallback to original method if processing fails
      const dataUrl = canvas.toDataURL("image/png")
      onComplete(dataUrl)
      return
    }

    // Copy the signature to the temporary canvas
    tempCtx.drawImage(canvas, 0, 0)

    // Get image data and make white/light pixels transparent
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height)
    const data = imageData.data
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      
      // If pixel is white or very light, make it transparent
      if (r > 240 && g > 240 && b > 240) {
        data[i + 3] = 0 // Set alpha to 0
      }
    }
    
    tempCtx.putImageData(imageData, 0, 0)
    
    const dataUrl = tempCanvas.toDataURL("image/png")
    onComplete(dataUrl)
  }

  const cancelSignature = () => {
    onComplete("")
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative border border-gray-300 rounded-md mb-4">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="touch-none"
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
            className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-sm border border-gray-200"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Clear signature</span>
          </button>
        )}
      </div>
      <div className="flex space-x-4">
        <button
          type="button"
          onClick={cancelSignature}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={clearSignature}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={saveSignature}
          disabled={!hasSignature}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  )
}
