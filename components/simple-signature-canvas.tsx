"use client"

import { useRef, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { X, RotateCcw } from "lucide-react"

interface SimpleSignatureCanvasProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (signatureDataUrl: string) => void
}

export default function SimpleSignatureCanvas({ 
  isOpen, 
  onClose, 
  onComplete 
}: SimpleSignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)

  // Auto-configure canvas when it's ready and visible
  useEffect(() => {

    
    if (isOpen) {
      // Use a timeout to ensure the canvas is fully rendered
      const timer = setTimeout(() => {
        const canvas = canvasRef.current

        
        if (canvas) {
          const ctx = canvas.getContext("2d")

          
          if (ctx) {
            // Apply the same configuration that works in clearCanvas
            ctx.strokeStyle = "#1e40af"
            ctx.lineWidth = 2.5
            ctx.lineCap = "round"
            ctx.lineJoin = "round"
            ctx.imageSmoothingEnabled = true

          }
        }
      }, 300) // Aumentar timeout
      
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")
      if (ctx) {
        // Get the actual displayed size
        const rect = canvas.getBoundingClientRect()
        
        // Set canvas internal resolution to match display size
        canvas.width = rect.width
        canvas.height = rect.height
        
        // Configure drawing style - Blue pen signature with smooth settings
        ctx.strokeStyle = "#1e40af" // Classic blue pen color
        ctx.lineWidth = 2.5 // Slightly thicker for pen effect
        ctx.lineCap = "round"
        ctx.lineJoin = "round"
        ctx.imageSmoothingEnabled = true
        
            // Clear canvas with transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
  }, [isOpen])

  const getCanvasCoordinates = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    }
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    setHasSignature(true)
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const { x, y } = getCanvasCoordinates(e.clientX, e.clientY)

    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const { x, y } = getCanvasCoordinates(e.clientX, e.clientY)

    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  // Touch events for mobile
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const touch = e.touches[0]
    if (!touch) return

    setIsDrawing(true)
    setHasSignature(true)
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const { x, y } = getCanvasCoordinates(touch.clientX, touch.clientY)

    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (!isDrawing) return

    const touch = e.touches[0]
    if (!touch) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const { x, y } = getCanvasCoordinates(touch.clientX, touch.clientY)

    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    stopDrawing()
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas with transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Reconfigure drawing style after clearing - Blue pen signature
    ctx.strokeStyle = "#1e40af"
    ctx.lineWidth = 2.5
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.imageSmoothingEnabled = true
    
    setHasSignature(false)
  }

  const saveSignature = () => {
    const canvas = canvasRef.current
    if (!canvas || !hasSignature) return

    // Create a temporary canvas for transparent background processing
    const tempCanvas = document.createElement("canvas")
    tempCanvas.width = canvas.width
    tempCanvas.height = canvas.height
    const tempCtx = tempCanvas.getContext("2d", { alpha: true })
    
    if (!tempCtx) {
      // Fallback to original method if processing fails
    const dataUrl = canvas.toDataURL("image/png")
      onComplete(dataUrl)
      onClose()
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
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="!max-w-none !w-auto p-3 sm:p-6 flex flex-col rounded-[20px] border-0"
        style={{ 
          width: 'fit-content !important',
          minWidth: '320px',
          maxWidth: 'min(calc(100vw - 1rem), 700px)',
          maxHeight: '90vh'
        }}
      >
        <DialogHeader className="pb-3">
          <DialogTitle>Agregar Firma</DialogTitle>
          <DialogDescription className="sr-only">
            Dibuja tu firma usando el ratón o toque
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col space-y-3">
          <div className="text-sm text-gray-600 text-center">
            Dibuja tu firma en el área de abajo
          </div>

          <div className="flex justify-center items-center">
            <div 
              className="mx-auto"
              style={{ 
                width: '600px',
                maxWidth: '100%',
                minWidth: '300px'
              }}
            >
              <div 
                className="border-2 border-gray-300 rounded-lg overflow-hidden relative p-1 sm:p-2 bg-white"
                style={{ 
                  width: '600px',
                  height: '300px',
                  maxWidth: '100%',
                  aspectRatio: '2 / 1'
                }}
              >
                <canvas
                  ref={canvasRef}
                  className="cursor-crosshair touch-none absolute block rounded bg-white"
                  style={{
                    width: 'calc(100% - 8px)',
                    height: 'calc(100% - 8px)',
                    top: '4px',
                    left: '4px'
                  }}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-center pt-2">
            <Button
              variant="outline"
              onClick={clearCanvas}
              size="sm"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Limpiar
            </Button>
            <Button
              onClick={saveSignature}
              disabled={!hasSignature}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              Agregar Firma
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
