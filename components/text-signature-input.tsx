"use client"

import { useState, useEffect } from "react"
import { Check, X } from "lucide-react"

interface TextSignatureInputProps {
  onComplete: (dataUrl: string) => void
  onCancel: () => void
}

export default function TextSignatureInput({ onComplete, onCancel }: TextSignatureInputProps) {
  const [name, setName] = useState("")
  const [font, setFont] = useState("'Dancing Script', cursive")
  const [size, setSize] = useState(40)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Generate preview when name, font or size changes
  useEffect(() => {
    if (name.trim()) {
      generateSignatureImage(name, font, size).then(setPreviewUrl)
    } else {
      setPreviewUrl(null)
    }
  }, [name, font, size])

  // Function to generate signature image
  const generateSignatureImage = async (text: string, fontFamily: string, fontSize: number): Promise<string> => {
    // SSR safety check for document.createElement
    if (typeof document === 'undefined') {
      return ""
    }
    
    // Create a canvas element
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (!ctx) return ""

    // Set canvas size
    canvas.width = Math.max(500, text.length * fontSize)
    canvas.height = fontSize * 2.5

    // Set background to white (for preview only)
    ctx.fillStyle = "#FFFFFF"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Set text properties
    ctx.font = `${fontSize}px ${fontFamily}`
    ctx.fillStyle = "#000000"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"

    // Draw text
    ctx.fillText(text, canvas.width / 2, canvas.height / 2)

    // Convert white pixels to transparent for the final image
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      if (r > 240 && g > 240 && b > 240) {
        data[i + 3] = 0 // Set alpha to 0
      }
    }
    ctx.putImageData(imageData, 0, 0)

    // Return data URL
    return canvas.toDataURL("image/png")
  }

  const handleComplete = async () => {
    if (!name.trim()) return
    const dataUrl = await generateSignatureImage(name, font, size)
    onComplete(dataUrl)
  }

  return (
    <div className="flex flex-col items-center space-y-6 p-4 bg-white rounded-lg">
      <h3 className="text-lg font-medium">Type Your Signature</h3>

      <div className="w-full">
        <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
          Your Name
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder="Type your name"
          autoFocus
        />
      </div>

      <div className="w-full">
        <label htmlFor="font" className="block text-sm font-medium text-foreground mb-1">
          Signature Style
        </label>
        <select
          id="font"
          value={font}
          onChange={(e) => setFont(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="'Dancing Script', cursive">Handwritten</option>
          <option value="'Pacifico', cursive">Elegant</option>
          <option value="'Caveat', cursive">Casual</option>
          <option value="'Satisfy', cursive">Flowing</option>
          <option value="'Permanent Marker', cursive">Bold</option>
        </select>
      </div>

      <div className="w-full">
        <label htmlFor="size" className="block text-sm font-medium text-foreground mb-1">
          Size: {size}px
        </label>
        <input
          type="range"
          id="size"
          min="20"
          max="60"
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          className="w-full"
        />
      </div>

      {previewUrl && (
        <div className="border border-border rounded-md p-4 bg-muted w-full">
          <p className="text-sm text-muted-foreground mb-2">Preview:</p>
          <div className="flex justify-center">
            <img src={previewUrl || "/placeholder.svg"} alt="Signature preview" className="max-h-24" />
          </div>
        </div>
      )}

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
          onClick={handleComplete}
          disabled={!name.trim()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/80 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 flex items-center"
        >
          <Check className="h-4 w-4 mr-1" />
          Apply Signature
        </button>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Dancing+Script&family=Pacifico&family=Caveat&family=Satisfy&family=Permanent+Marker&display=swap');
      `}</style>
    </div>
  )
}
