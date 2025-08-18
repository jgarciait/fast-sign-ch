"use client"

import type React from "react"

import { useRef, useState, useEffect } from "react"
import { Check, X } from "lucide-react"

interface Point {
  x: number
  y: number
}

interface SvgSignaturePadProps {
  onComplete: (dataUrl: string) => void
  onCancel: () => void
}

export default function SvgSignaturePad({ onComplete, onCancel }: SvgSignaturePadProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [points, setPoints] = useState<Point[]>([])
  const [paths, setPaths] = useState<Point[][]>([])
  const [hasSignature, setHasSignature] = useState(false)

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      // Force redraw if needed
      if (svgRef.current) {
        const temp = svgRef.current.style.display
        svgRef.current.style.display = "none"
        setTimeout(() => {
          if (svgRef.current) {
            svgRef.current.style.display = temp
          }
        }, 0)
      }
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const getCoordinates = (event: React.MouseEvent | React.TouchEvent): Point | null => {
    if (!svgRef.current) return null

    const svg = svgRef.current
    const rect = svg.getBoundingClientRect()

    if ("touches" in event) {
      // Touch event
      return {
        x: event.touches[0].clientX - rect.left,
        y: event.touches[0].clientY - rect.top,
      }
    } else {
      // Mouse event
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }
    }
  }

  const startDrawing = (event: React.MouseEvent | React.TouchEvent) => {
    const point = getCoordinates(event)
    if (point) {
      setIsDrawing(true)
      setPoints([point])
      setHasSignature(true)
    }
  }

  const draw = (event: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return

    const point = getCoordinates(event)
    if (point) {
      setPoints((prevPoints) => [...prevPoints, point])
    }
  }

  const stopDrawing = () => {
    if (isDrawing) {
      setPaths((prevPaths) => [...prevPaths, points])
      setPoints([])
      setIsDrawing(false)
    }
  }

  const clearSignature = () => {
    setPaths([])
    setPoints([])
    setHasSignature(false)
  }

  const createPathData = (points: Point[]): string => {
    if (points.length < 2) return ""

    let data = `M ${points[0].x} ${points[0].y}`
    for (let i = 1; i < points.length; i++) {
      data += ` L ${points[i].x} ${points[i].y}`
    }
    return data
  }

  const saveSignature = () => {
    if (!hasSignature || !svgRef.current) return

    // Create a canvas to convert SVG to image
    const canvas = document.createElement("canvas")
    const svg = svgRef.current
    const rect = svg.getBoundingClientRect()

    // Use higher resolution to avoid pixelation
    const scale = 2
    canvas.width = rect.width * scale
    canvas.height = rect.height * scale

    const ctx = canvas.getContext("2d", { alpha: true })
    if (!ctx) return

    // Scale the context to maintain proportions
    ctx.scale(scale, scale)

    // Convert SVG to image
    const data = new XMLSerializer().serializeToString(svg)
    const img = new Image()

    // Use a data URL with base64 encoding
    const svgBlob = new Blob([data], { type: "image/svg+xml" })
    const url = URL.createObjectURL(svgBlob)

    img.onload = () => {
      // Draw the image on the canvas
      ctx.drawImage(img, 0, 0)

      // Get the image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data

      // Make white pixels transparent
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) {
          data[i + 3] = 0
        }
      }

      ctx.putImageData(imageData, 0, 0)

      // Get the data URL
      const dataUrl = canvas.toDataURL("image/png")
      onComplete(dataUrl)

      // Clean up
      URL.revokeObjectURL(url)
    }

    img.src = url
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative w-full bg-white border border-gray-300 rounded-md">
        <svg
          ref={svgRef}
          width="400"
          height="200"
          className="w-full touch-none"
          style={{ backgroundColor: "white" }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        >
          {/* Background rectangle */}
          <rect x="0" y="0" width="100%" height="100%" fill="white" />

          {/* Completed paths - BLUE COLOR */}
          {paths.map((pathPoints, index) => {
            const pathData = createPathData(pathPoints)
            return pathData ? (
              <path
                key={index}
                d={pathData}
                stroke="#1e40af"
                strokeWidth="2"
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{ stroke: "#1e40af !important" }}
              />
            ) : null
          })}

          {/* Current path - BLUE COLOR */}
          {points.length > 1 && (() => {
            const pathData = createPathData(points)
            return pathData ? (
              <path
                d={pathData}
                stroke="#1e40af"
                strokeWidth="2"
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{ stroke: "#1e40af !important" }}
              />
            ) : null
          })()}
        </svg>
      </div>

      <div className="flex space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-input rounded-md text-sm font-medium text-foreground bg-background hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <X className="h-4 w-4 inline mr-1" />
          Cancel
        </button>
        <button
          type="button"
          onClick={clearSignature}
          className="px-4 py-2 border border-input rounded-md text-sm font-medium text-foreground bg-background hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={saveSignature}
          disabled={!hasSignature}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/80 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 flex items-center"
        >
          <Check className="h-4 w-4 mr-1" />
          Apply Signature
        </button>
      </div>
    </div>
  )
}
