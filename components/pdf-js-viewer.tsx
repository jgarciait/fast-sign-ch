"use client"

import { useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, RotateCw, Printer } from "lucide-react"
import { Logo } from "@/components/logo"

// Set up the worker for PDF.js - use a public URL that's accessible
// This is a more reliable approach than using CDN
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"

interface PdfJsViewerProps {
  documentUrl: string
  documentName: string
  onBack?: () => void
  onSign?: () => void
  showBackButton?: boolean
  showSignButton?: boolean
}

export default function PdfJsViewer({
  documentUrl,
  documentName,
  onBack,
  onSign,
  showBackButton = false,
  showSignButton = false,
}: PdfJsViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [rotation, setRotation] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<Error | null>(null)

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

  // Fallback to simpler viewer if PDF.js fails
  if (loadError) {
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

          <div className="flex-grow"></div>

          <div className="flex items-center space-x-2">
            <a
              href={documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Open in New Tab
            </a>
            <a
              href={documentUrl}
              download={documentName}
              className="flex items-center px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              <Download className="h-4 w-4 mr-1" />
              Download
            </a>
            {showSignButton && onSign && (
              <button
                onClick={onSign}
                className="flex items-center bg-[#0d2340] text-white px-3 py-1 rounded hover:bg-[#1a3a5f]"
              >
                <span className="mr-1">✍️</span>
                Sign Document
              </button>
            )}
          </div>
        </div>

        {/* Simple iframe fallback */}
        <div className="flex-1 overflow-auto flex justify-center items-center p-4">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md text-center">
            <h3 className="text-lg font-medium text-red-600 mb-4">Unable to display PDF with advanced viewer</h3>
            <p className="mb-6 text-gray-700">
              We encountered an error loading the PDF viewer. Please use one of the options below:
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
                className="mt-4 flex items-center justify-center w-full px-4 py-2 bg-[#0d2340] text-white rounded hover:bg-[#1a3a5f]"
              >
                <span className="mr-2">✍️</span>
                Continue to Sign Document
              </button>
            )}
          </div>
        </div>
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

      {/* Document viewer */}
      <div className="flex-1 overflow-auto flex justify-center items-center">
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
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              rotate={rotation}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="shadow-lg"
            />
          </Document>
        </div>
      </div>
    </div>
  )
}
