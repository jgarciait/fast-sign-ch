"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Grip, X } from "lucide-react"

interface DraggableElementProps {
  id: string
  initialX?: number
  initialY?: number
  initialWidth?: number
  initialHeight?: number
  minWidth?: number
  minHeight?: number
  children: React.ReactNode
  onDelete?: () => void
  onPositionChange?: (x: number, y: number) => void
  onSizeChange?: (width: number, height: number) => void
}

export default function DraggableElement({
  id,
  initialX = 100,
  initialY = 100,
  initialWidth = 200,
  initialHeight = 100,
  minWidth = 100,
  minHeight = 50,
  children,
  onDelete,
  onPositionChange,
  onSizeChange,
}: DraggableElementProps) {
  const [position, setPosition] = useState({ x: initialX, y: initialY })
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDirection, setResizeDirection] = useState<string | null>(null)
  const elementRef = useRef<HTMLDivElement>(null)
  const dragStartPos = useRef({ x: 0, y: 0 })
  const resizeStartSize = useRef({ width: 0, height: 0 })
  const resizeStartPos = useRef({ x: 0, y: 0 })

  // Handle dragging
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
    dragStartPos.current = { x: e.clientX, y: e.clientY }
  }

  // Handle resizing
  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>, direction: string) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    setResizeDirection(direction)
    resizeStartSize.current = { width: size.width, height: size.height }
    resizeStartPos.current = { x: e.clientX, y: e.clientY }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - dragStartPos.current.x
        const dy = e.clientY - dragStartPos.current.y
        const newPosition = {
          x: position.x + dx,
          y: position.y + dy,
        }
        setPosition(newPosition)
        dragStartPos.current = { x: e.clientX, y: e.clientY }

        if (onPositionChange) {
          onPositionChange(newPosition.x, newPosition.y)
        }
      } else if (isResizing && resizeDirection) {
        const dx = e.clientX - resizeStartPos.current.x
        const dy = e.clientY - resizeStartPos.current.y

        let newWidth = resizeStartSize.current.width
        let newHeight = resizeStartSize.current.height

        if (resizeDirection.includes("e")) {
          newWidth = Math.max(minWidth, resizeStartSize.current.width + dx)
        }
        if (resizeDirection.includes("s")) {
          newHeight = Math.max(minHeight, resizeStartSize.current.height + dy)
        }

        setSize({ width: newWidth, height: newHeight })

        if (onSizeChange) {
          onSizeChange(newWidth, newHeight)
        }
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setIsResizing(false)
      setResizeDirection(null)
    }

    if (isDragging || isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, isResizing, position, size, resizeDirection, minWidth, minHeight, onPositionChange, onSizeChange])

  return (
    <div
      ref={elementRef}
      id={id}
      className="absolute border-2 border-blue-400 bg-white rounded-md shadow-md overflow-hidden"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        cursor: isDragging ? "grabbing" : "grab",
        zIndex: isDragging || isResizing ? 10 : 1,
      }}
    >
      {/* Drag handle */}
      <div
        className="absolute top-0 left-0 right-0 h-6 bg-blue-400 flex items-center px-2 cursor-grab"
        onMouseDown={handleMouseDown}
      >
        <Grip className="h-4 w-4 text-white" />
        {onDelete && (
          <button onClick={onDelete} className="absolute right-1 top-1 text-white hover:text-red-100" title="Eliminar">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-2 pt-8 w-full h-full overflow-auto">{children}</div>

      {/* Resize handles */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
        onMouseDown={(e) => handleResizeStart(e, "se")}
      />
    </div>
  )
}
