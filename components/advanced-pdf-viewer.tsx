"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, RotateCw, Printer, Search } from "lucide-react"
import { Logo } from "@/components/logo"

// Import centralized PDF configuration
import PDF_CONFIG, { configurePdfWorker } from '@/utils/pdf-config-centralized'

// Configure PDF.js worker on import
configurePdfWorker()

interface AdvancedPdfViewerProps {
  documentUrl: string
  documentName: string
  onBack?: () => void
  onSign?: () => void
  showBackButton?: boolean
  showSignButton?: boolean
}

export default function AdvancedPdfViewer({
  documentUrl,
  documentName,
  onBack,
  onSign,
  showBackButton = false,
  showSignButton = false,
}: AdvancedPdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [rotation, setRotation] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [fallbackMode, setFallbackMode] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [pdfInitialized, setPdfInitialized] = useState(false)

  // Initialize PDF.js with error handling
  useEffect(() => {
    const initializePdf = async () => {
      try {
        // Check if worker is available
        const workerResponse = await fetch("/api/pdf-worker", { method: "HEAD" })
        if (!workerResponse.ok) {
          console.error("PDF.js worker not available, falling back to simple viewer")
          setFallbackMode(true)
          return
        }

        setPdfInitialized(true)
      } catch (error) {
        console.error("Error initializing PDF.js:", error)
        setFallbackMode(true)
      }
    }

    initializePdf()
  }, [])

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages)
    setIsLoading(false)
    setLoadError(null)
  }

  const changePage = (offset: number) => {
    setPageNumber((prevPageNumber) => {
      const newPageNumber = prevPageNumber + offset
      return newPageNumber >= 1 && newPageNumber <= (numPages || 1) ? newPageNumber : prevPageNumber
    })
  }

  const previousPage = () => changePage(-1)
  const nextPage = () => changePage(1)

  const zoomIn = () => setScale((prevScale) => Math.min(prevScale + 0.1, 2.0))
  const zoomOut = () => setScale((prevScale) => Math.max(prevScale - 0.1, 0.5))
  const rotateDocument = () => setRotation((prevRotation) => (prevRotation + 90) % 360)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // Implement search functionality here
    console.log("Searching for:", searchQuery)
    // This would typically use PDF.js text layer search capabilities
  }

  // If we're in fallback mode or there's an error, show the simple viewer
  if (fallbackMode || loadError) {
    return (
      <div className="flex flex-col h-full bg-gray-100">
        {/* Toolbar */}
        <div className="bg-gray-200 border-b border-gray-300 py-1 px-2 flex items-center justify-between">
          <div className="flex items-center space-x-1">
            {showBackButton && (
              <button onClick={onBack} className="p-1 rounded hover:bg-gray-300" title="Back">
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <Logo className="h-6 w-6" color="#0d2340" />
            <span className="text-sm font-medium truncate max-w-[150px]">{documentName}</span>
          </div>

          <div className="flex items-center space-x-2">
            <a
              href={documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              Open in New Tab
            </a>
            <a
              href={documentUrl}
              download={documentName}
              className="flex items-center px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
            >
              <Download className="h-4 w-4 mr-1" />
              Download
            </a>
            {showSignButton && onSign && (
              <button
                onClick={onSign}
                className="flex items-center bg-[#0d2340] text-white px-3 py-1 rounded hover:bg-[#1a3a5f] text-sm"
              >
                <span className="mr-1">✍️</span>
                Sign Document
              </button>
            )}
          </div>
        </div>

        {/* Document viewer */}
        <div className="flex-1 overflow-auto flex justify-center items-center p-4">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden max-w-4xl w-full h-full flex flex-col">
            <div className="p-4 bg-gray-50 border-b">
              <h3 className="text-lg font-medium">Document Preview</h3>
            </div>

            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center">
                <p className="mb-6 text-gray-700">
                  {loadError
                    ? "We encountered an error loading the PDF viewer. Please use one of the options below:"
                    : "For security reasons, we're using a simplified viewer. Please use one of the options below to view the document:"}
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <a
                    href={documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Open PDF in New Tab
                  </a>
                  <a
                    href={documentUrl}
                    download={documentName}
                    className="flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </a>
                </div>
                {showSignButton && onSign && (
                  <button
                    onClick={onSign}
                    className="mt-6 flex items-center justify-center w-full sm:w-auto px-4 py-2 bg-[#0d2340] text-white rounded hover:bg-[#1a3a5f]"
                  >
                    <span className="mr-2">✍️</span>
                    Continue to Sign Document
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // If PDF.js is not initialized yet, show loading
  if (!pdfInitialized) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-100">
      {/* Toolbar */}
      <div className="bg-gray-200 border-b border-gray-300 py-1 px-2 flex items-center space-x-2">
        <div className="flex items-center space-x-1 mr-2">
          {showBackButton && (
            <button onClick={onBack} className="p-1 rounded hover:bg-gray-300" title="Atrás">
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <Logo className="h-6 w-6" color="#0d2340" />
          <span className="text-sm font-medium truncate max-w-[150px]">{documentName}</span>
        </div>

        <div className="h-5 border-l border-gray-400 mx-1"></div>

        {/* Page navigation */}
        <div className="flex items-center space-x-1">
          <button
            onClick={previousPage}
            disabled={pageNumber <= 1}
            className="p-1 rounded hover:bg-gray-300 disabled:opacity-50"
            title="Previous Page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center bg-white border border-gray-300 rounded px-2 py-0.5">
            <input
              type="number"
              value={pageNumber}
              onChange={(e) => {
                const page = Number.parseInt(e.target.value)
                if (page && page > 0 && page <= (numPages || 1)) {
                  setPageNumber(page)
                }
              }}
              className="w-8 text-center text-sm focus:outline-none"
            />
            <span className="text-sm text-gray-600">/ {numPages || "-"}</span>
          </div>
          <button
            onClick={nextPage}
            disabled={pageNumber >= (numPages || 1)}
            className="p-1 rounded hover:bg-gray-300 disabled:opacity-50"
            title="Next Page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="h-5 border-l border-gray-400 mx-1"></div>

        {/* Zoom controls */}
        <div className="flex items-center space-x-1">
          <button onClick={zoomOut} className="p-1 rounded hover:bg-gray-300" title="Zoom Out">
            <ZoomOut className="h-4 w-4" />
          </button>
          <div className="bg-white border border-gray-300 rounded px-2 py-0.5">
            <span className="text-sm">{Math.round(scale * 100)}%</span>
          </div>
          <button onClick={zoomIn} className="p-1 rounded hover:bg-gray-300" title="Zoom In">
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>

        <div className="h-5 border-l border-gray-400 mx-1"></div>

        {/* Additional tools */}
        <div className="flex items-center space-x-1">
          <button onClick={rotateDocument} className="p-1 rounded hover:bg-gray-300" title="Rotate Document">
            <RotateCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-1 rounded ${showSearch ? "bg-blue-100" : "hover:bg-gray-300"}`}
            title="Buscar"
          >
            <Search className="h-4 w-4" />
          </button>
          <a href={documentUrl} download={documentName} className="p-1 rounded hover:bg-gray-300" title="Descargar">
            <Download className="h-4 w-4" />
          </a>
          <button onClick={() => window.print()} className="p-1 rounded hover:bg-gray-300" title="Imprimir">
            <Printer className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-grow"></div>

        {/* Sign button */}
        {showSignButton && onSign && (
          <button
            onClick={onSign}
            className="flex items-center bg-[#0d2340] text-white px-3 py-1 rounded hover:bg-[#1a3a5f] text-sm"
          >
            <span className="mr-1">✍️</span>
            Sign Document
          </button>
        )}
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="bg-gray-100 border-b border-gray-300 p-2">
          <form onSubmit={handleSearch} className="flex items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in document..."
              className="flex-grow border border-gray-300 rounded-l px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button type="submit" className="bg-blue-500 text-white px-3 py-1 rounded-r text-sm hover:bg-blue-600">
              Search
            </button>
          </form>
        </div>
      )}

      {/* Document viewer */}
      <div className="flex-1 overflow-auto flex justify-center items-center" ref={containerRef}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 z-10">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}
        <div className="my-4">
          <Document
            file={documentUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={(error) => {
              console.error("Error loading PDF:", error)
              setLoadError(error)
            }}
            loading={
              <div className="flex items-center justify-center h-[11in] w-[8.5in]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            }
            error={
              <div className="flex flex-col items-center justify-center p-8 border border-red-300 rounded bg-red-50 text-red-700 h-[11in] w-[8.5in]">
                <p className="mb-4 font-medium">Failed to load PDF</p>
                <div className="flex space-x-4">
                  <a
                    href={documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  >
                    Open PDF in new tab
                  </a>
                  <a href={documentUrl} download className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">
                    Download PDF
                  </a>
                </div>
              </div>
            }
            options={{
                      cMapUrl: "https://unpkg.com/pdfjs-dist@3.11.174/cmaps/",
        cMapPacked: true,
        standardFontDataUrl: "https://unpkg.com/pdfjs-dist@3.11.174/standard_fonts/",
            }}
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              rotate={rotation}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="shadow-lg"
              error={
                <div className="flex flex-col items-center justify-center p-4 border border-red-300 rounded bg-red-50 text-red-700 h-[11in] w-[8.5in]">
                  <p>Error loading this page</p>
                </div>
              }
              loading={
                <div className="flex items-center justify-center h-[11in] w-[8.5in] bg-white">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              }
            />
          </Document>
        </div>
      </div>

      {/* Fallback options at the bottom */}
      <div className="bg-gray-100 border-t border-gray-300 p-2 flex justify-center">
        <div className="flex space-x-4">
          <a
            href={documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center text-sm text-blue-600 hover:text-blue-800"
          >
            Open PDF in new tab
          </a>
          <span className="text-gray-400">|</span>
          <a
            href={documentUrl}
            download={documentName}
            className="flex items-center text-sm text-blue-600 hover:text-blue-800"
          >
            <Download className="h-3 w-3 mr-1" />
            Download PDF
          </a>
        </div>
      </div>
    </div>
  )
}
