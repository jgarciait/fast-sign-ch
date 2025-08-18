"use client"

import type React from "react"
import { useRef, useEffect } from "react"

interface SignatureCanvasProps {
  width?: number
  height?: number
}

const SignatureCanvas: React.FC<SignatureCanvasProps> = ({ width = 400, height = 200 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const lastX = useRef(0)
  const lastY = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d", { alpha: false })
    if (!ctx) return

    ctx.fillStyle = "white"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.strokeStyle = "black"
    ctx.lineWidth = 2
    ctx.lineJoin = "round"
    ctx.lineCap = "round"

    const handleMouseDown = (e: MouseEvent) => {
      isDrawing.current = true
      lastX.current = e.offsetX
      lastY.current = e.offsetY
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDrawing.current) return
      draw(ctx, e.offsetX, e.offsetY)
    }

    const handleMouseUp = () => {
      isDrawing.current = false
    }

    const handleMouseOut = () => {
      isDrawing.current = false
    }

    canvas.addEventListener("mousedown", handleMouseDown)
    canvas.addEventListener("mousemove", handleMouseMove)
    canvas.addEventListener("mouseup", handleMouseUp)
    canvas.addEventListener("mouseout", handleMouseOut)

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown)
      canvas.removeEventListener("mousemove", handleMouseMove)
      canvas.removeEventListener("mouseup", handleMouseUp)
      canvas.removeEventListener("mouseout", handleMouseOut)
    }
  }, [])

  const draw = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.beginPath()
    ctx.moveTo(lastX.current, lastY.current)
    ctx.lineTo(x, y)
    ctx.stroke()
    lastX.current = x
    lastY.current = y
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="border border-gray-300 rounded shadow-md bg-white"
      style={{ backgroundColor: "white" }}
    />
  )
}

export default SignatureCanvas
