"use client"

import type React from "react"

import { useRef, useEffect, useState } from "react"
import { X, Check } from "lucide-react"

interface DirectSignaturePadProps {
  onComplete: (dataUrl: string) => void
  onCancel: () => void
}

export default function DirectSignaturePad({ onComplete, onCancel }: DirectSignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Force white background with inline style
    canvas.style.backgroundColor = "#FFFFFF"

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Force white background with fillRect
    ctx.fillStyle = "#FFFFFF"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Set drawing style
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = "#000000"
  }, [])

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    setIsDrawing(true)
    setHasSignature(true)

    // Get position
    const rect = canvas.getBoundingClientRect()
    let x, y

    if ("touches" in e) {
      // Touch event
      x = e.touches[0].clientX - rect.left
      y = e.touches[0].clientY - rect.top
    } else {
      // Mouse event
      x = e.clientX - rect.left
      y = e.clientY - rect.top
    }

    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Get position
    const rect = canvas.getBoundingClientRect()
    let x, y

    if ("touches" in e) {
      // Touch event
      x = e.touches[0].clientX - rect.left
      y = e.touches[0].clientY - rect.top
    } else {
      // Mouse event
      x = e.clientX - rect.left
      y = e.clientY - rect.top
    }

    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.fillStyle = "#FFFFFF"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  const saveSignature = () => {
    if (!hasSignature) return

    const canvas = canvasRef.current
    if (!canvas) return

    // Create a temporary canvas for transparent background
    const tempCanvas = document.createElement("canvas")
    tempCanvas.width = canvas.width
    tempCanvas.height = canvas.height

    const tempCtx = tempCanvas.getContext("2d", { alpha: true })
    if (!tempCtx) return

    // Copy the signature to the temporary canvas
    tempCtx.drawImage(canvas, 0, 0)

    // Make white pixels transparent
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height)
    const data = imageData.data
    for (let i = 0; i < data.length; i += 4) {
      // If pixel is white or nearly white
      if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) {
        // Make it transparent
        data[i + 3] = 0
      }
    }
    tempCtx.putImageData(imageData, 0, 0)

    // Get data URL with transparent background
    const dataUrl = tempCanvas.toDataURL("image/png")
    onComplete(dataUrl)
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative w-full">
        {/* White background wrapper */}
        <div className="bg-white p-1 rounded-md border border-gray-300">
          {/* Canvas with inline style forcing white background */}
          <canvas
            ref={canvasRef}
            width={400}
            height={200}
            className="w-full touch-none rounded-md"
            style={{ backgroundColor: "#FFFFFF" }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>
      </div>

      <div className="flex space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <X className="h-4 w-4 inline mr-1" />
          Cancel
        </button>
        <button
          type="button"
          onClick={clearCanvas}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={saveSignature}
          disabled={!hasSignature}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center"
        >
          <Check className="h-4 w-4 mr-1" />
          Apply Signature
        </button>
      </div>
    </div>
  )
}
