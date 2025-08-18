"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { X } from "lucide-react"

interface TextBoxProps {
  id: string
  initialX: number
  initialY: number
  initialWidth: number
  initialHeight: number
  initialContent: string
  onPositionChange: (x: number, y: number) => void
  onSizeChange: (width: number, height: number) => void
  onContentChange: (content: string) => void
  onDelete: () => void
}

export default function TextBox({
  id,
  initialX,
  initialY,
  initialWidth,
  initialHeight,
  initialContent,
  onPositionChange,
  onSizeChange,
  onContentChange,
  onDelete,
}: TextBoxProps) {
  const [position, setPosition] = useState({ x: initialX, y: initialY })
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight })
  const [content, setContent] = useState(initialContent)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const elementRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dragStartPos = useRef({ x: 0, y: 0 })
  const resizeStartSize = useRef({ width: 0, height: 0 })
  const resizeStartPos = useRef({ x: 0, y: 0 })

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isEditing])

  // Handle dragging
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isEditing) return

    e.preventDefault()
    setIsDragging(true)
    dragStartPos.current = { x: e.clientX, y: e.clientY }
  }

  // Handle resizing
  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    resizeStartSize.current = { width: size.width, height: size.height }
    resizeStartPos.current = { x: e.clientX, y: e.clientY }
  }

  // Handle mouse events for drag and resize
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
        onPositionChange(newPosition.x, newPosition.y)
      } else if (isResizing) {
        const dx = e.clientX - resizeStartPos.current.x
        const dy = e.clientY - resizeStartPos.current.y

        const newWidth = Math.max(100, resizeStartSize.current.width + dx)
        const newHeight = Math.max(50, resizeStartSize.current.height + dy)

        setSize({ width: newWidth, height: newHeight })
        onSizeChange(newWidth, newHeight)
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setIsResizing(false)
    }

    if (isDragging || isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, isResizing, position, size, onPositionChange, onSizeChange])

  // Handle content change
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    setContent(newContent)
    onContentChange(newContent)
  }

  // Handle double click to edit
  const handleDoubleClick = () => {
    if (!isEditing) {
      setIsEditing(true)
    }
  }

  // Handle blur to exit editing mode
  const handleBlur = () => {
    setIsEditing(false)
  }

  return (
    <div
      ref={elementRef}
      className={`absolute border-2 ${isEditing ? "border-green-400" : "border-blue-400"} bg-white rounded-md shadow-md overflow-hidden`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        cursor: isDragging ? "grabbing" : "grab",
        zIndex: isDragging || isResizing || isEditing ? 10 : 1,
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {/* Delete button */}
      <button
        className="absolute top-1 right-1 z-10 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
        onClick={onDelete}
      >
        <X className="h-3 w-3" />
      </button>

      {/* Content */}
      <div className="p-2 w-full h-full">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            onBlur={handleBlur}
            className="w-full h-full resize-none border-none focus:outline-none focus:ring-0 p-0"
            placeholder="Type here..."
          />
        ) : (
          <div className="w-full h-full overflow-auto">{content || "Double-click to edit"}</div>
        )}
      </div>

      {/* Resize handle */}
      <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize" onMouseDown={handleResizeStart} />
    </div>
  )
}
