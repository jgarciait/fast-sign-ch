"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Download,
  Pen,
  Hand,
  Type,
  ImageIcon,
  Square,
  Highlighter,
  Eraser,
  Search,
  Printer,
  RotateCw,
} from "lucide-react"
import { Logo } from "@/components/logo"

interface EnhancedPdfViewerProps {
  documentUrl: string
  documentName: string
  onSign?: () => void
  onBack?: () => void
  showSignButton?: boolean
  showBackButton?: boolean
}

export default function EnhancedPdfViewer({
  documentUrl,
  documentName,
  onSign,
  onBack,
  showSignButton = false,
  showBackButton = false,
}: EnhancedPdfViewerProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [scale, setScale] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [currentTool, setCurrentTool] = useState<string>("hand")
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [rotation, setRotation] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Reset loading state when document URL changes
    setIsLoading(true)

    // This will be enhanced later with actual PDF.js integration
    // For now, we'll simulate loading completion
    const timer = setTimeout(() => {
      setIsLoading(false)
      // Simulate detecting total pages
      setTotalPages(Math.floor(Math.random() * 10) + 1)
    }, 1500)

    return () => clearTimeout(timer)
  }, [documentUrl])

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const zoomIn = () => {
    setScale(Math.min(scale + 0.1, 2))
  }

  const zoomOut = () => {
    setScale(Math.max(scale - 0.1, 0.5))
  }

  const rotateDocument = () => {
    setRotation((rotation + 90) % 360)
  }

  const handleToolChange = (tool: string) => {
    setCurrentTool(tool)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // Implement search functionality here
    console.log("Searching for:", searchQuery)
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#F8F9FB' }}>
      {/* Main toolbar */}
      <div 
        className="border-b border-border py-1 px-2 flex items-center space-x-2" 
        style={{ 
          backgroundColor: '#FFFFFF'
        }}
      >
        <div className="flex items-center space-x-1 mr-2">
          {showBackButton && (
            <button onClick={onBack} className="p-1 rounded text-foreground hover:bg-muted" title="Atrás">
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <Logo className="h-6 w-6" color="#0d2340" />
          <span className="text-sm font-medium text-foreground truncate max-w-[150px]">{documentName}</span>
        </div>

        <div className="h-5 border-l border-border mx-1"></div>

        {/* Drawing tools */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => handleToolChange("hand")}
            className={`p-1 rounded transition-colors ${
              currentTool === "hand" 
                ? "bg-primary text-primary-foreground" 
                : "text-foreground hover:bg-muted"
            }`}
            title="Hand Tool"
          >
            <Hand className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleToolChange("text")}
            className={`p-1 rounded transition-colors ${
              currentTool === "text" 
                ? "bg-primary text-primary-foreground" 
                : "text-foreground hover:bg-muted"
            }`}
            title="Text Tool"
          >
            <Type className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleToolChange("draw")}
            className={`p-1 rounded transition-colors ${
              currentTool === "draw" 
                ? "bg-primary text-primary-foreground" 
                : "text-foreground hover:bg-muted"
            }`}
            title="Draw Tool"
          >
            <Pen className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleToolChange("highlight")}
            className={`p-1 rounded transition-colors ${
              currentTool === "highlight" 
                ? "bg-primary text-primary-foreground" 
                : "text-foreground hover:bg-muted"
            }`}
            title="Highlight Tool"
          >
            <Highlighter className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleToolChange("shape")}
            className={`p-1 rounded transition-colors ${
              currentTool === "shape" 
                ? "bg-primary text-primary-foreground" 
                : "text-foreground hover:bg-muted"
            }`}
            title="Shape Tool"
          >
            <Square className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleToolChange("eraser")}
            className={`p-1 rounded transition-colors ${
              currentTool === "eraser" 
                ? "bg-primary text-primary-foreground" 
                : "text-foreground hover:bg-muted"
            }`}
            title="Eraser Tool"
          >
            <Eraser className="h-4 w-4" />
          </button>
        </div>

        <div className="h-5 border-l border-border mx-1"></div>

        {/* Page navigation */}
        <div className="flex items-center space-x-1">
          <button
            onClick={prevPage}
            disabled={currentPage <= 1}
            className="p-1 rounded text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
            title="Previous Page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center bg-background border border-border rounded px-2 py-0.5">
            <input
              type="number"
              value={currentPage}
              onChange={(e) => {
                const page = Number.parseInt(e.target.value)
                if (page > 0 && page <= totalPages) {
                  setCurrentPage(page)
                }
              }}
              className="w-8 text-center text-sm bg-transparent text-foreground focus:outline-none"
            />
            <span className="text-sm text-muted-foreground">/ {totalPages}</span>
          </div>
          <button
            onClick={nextPage}
            disabled={currentPage >= totalPages}
            className="p-1 rounded text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
            title="Next Page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="h-5 border-l border-border mx-1"></div>

        {/* Zoom controls */}
        <div className="flex items-center space-x-1">
          <button onClick={zoomOut} className="p-1 rounded text-foreground hover:bg-muted transition-colors" title="Zoom Out">
            <ZoomOut className="h-4 w-4" />
          </button>
          <div className="bg-background border border-border rounded px-2 py-0.5">
            <span className="text-sm text-foreground">{Math.round(scale * 100)}%</span>
          </div>
          <button onClick={zoomIn} className="p-1 rounded text-foreground hover:bg-muted transition-colors" title="Zoom In">
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>

        <div className="h-5 border-l border-border mx-1"></div>

        {/* Additional tools */}
        <div className="flex items-center space-x-1">
          <button onClick={rotateDocument} className="p-1 rounded text-foreground hover:bg-muted transition-colors" title="Rotate Document">
            <RotateCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-1 rounded transition-colors ${
              showSearch 
                ? "bg-primary text-primary-foreground" 
                : "text-foreground hover:bg-muted"
            }`}
            title="Buscar"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            onClick={() => window.open(documentUrl, "_blank")}
            className="p-1 rounded text-foreground hover:bg-muted transition-colors"
            title="Descargar"
          >
            <Download className="h-4 w-4" />
          </button>
          <button className="p-1 rounded text-foreground hover:bg-muted transition-colors" title="Imprimir">
            <Printer className="h-4 w-4" />
          </button>
          <button className="p-1 rounded text-foreground hover:bg-muted transition-colors" title="Image">
            <ImageIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-grow"></div>

        {/* Sign button */}
        {showSignButton && onSign && (
          <button
            onClick={onSign}
            className="flex items-center bg-success text-success-foreground px-3 py-1 rounded hover:bg-success/80 text-sm transition-colors"
          >
            <Pen className="h-3 w-3 mr-1" />
            Sign Document
          </button>
        )}
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="bg-muted border-b border-border p-2">
          <form onSubmit={handleSearch} className="flex items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in document..."
              className="flex-grow border border-input rounded-l px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button type="submit" className="bg-primary text-primary-foreground px-3 py-1 rounded-r text-sm hover:bg-primary/80">
              Search
            </button>
          </form>
        </div>
      )}

      {/* Document viewer */}
      <div className="flex-1 overflow-auto flex justify-center" style={{ backgroundColor: '#F8F9FB' }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div
            ref={containerRef}
            className="my-4 bg-white shadow-lg transition-all duration-200 ease-in-out"
            style={{
              width: `${8.5 * scale}in`,
              height: `${11 * scale}in`,
              maxHeight: "100%",
              transform: `rotate(${rotation}deg)`,
            }}
          >
            {/* Use object tag instead of iframe for better PDF compatibility */}
            <object data={documentUrl} type="application/pdf" className="w-full h-full" title={documentName}>
              <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                <p className="text-gray-700 mb-4">
                  Unable to display PDF directly. Please use one of the options below:
                </p>
                <a
                  href={documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mb-2"
                >
                  Open PDF in new tab
                </a>
                <a
                  href={documentUrl}
                  download={documentName}
                  className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
                >
                  Download PDF
                </a>
              </div>
            </object>
          </div>
        )}
      </div>
    </div>
  )
}
