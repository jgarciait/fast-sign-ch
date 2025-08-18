"use client"

import { useState, useEffect, useRef } from "react"

type DocumentViewerProps = {
  documentUrl: string
  documentName: string
  onSign?: () => void
}

export default function DocumentViewer({ documentUrl, documentName, onSign }: DocumentViewerProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [scale, setScale] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const iframeRef = useRef<HTMLIFrameElement>(null)

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

  return (
    <div className="flex flex-col h-full">
      {/* Document viewer */}
      <div className="flex-1 overflow-auto bg-gray-100 flex justify-center">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div
            className="relative my-4 bg-white shadow-lg transition-all duration-200 ease-in-out"
            style={{
              width: `${8.5 * scale}in`,
              height: `${11 * scale}in`,
              maxHeight: "100%",
            }}
          >
            <iframe ref={iframeRef} src={documentUrl} className="w-full h-full" title={documentName} />
          </div>
        )}
      </div>
    </div>
  )
}
