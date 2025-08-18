"use client"

import React, { useState, useEffect, memo } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import dynamic from 'next/dynamic'

// Import react-pdf components with SSR disabled
const Document = dynamic(
  () => import('react-pdf').then((mod) => mod.Document),
  { ssr: false }
)

const Page = dynamic(
  () => import('react-pdf').then((mod) => mod.Page),
  { ssr: false }
)

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  import('react-pdf').then((reactPdf) => {
    if (reactPdf.pdfjs && reactPdf.pdfjs.GlobalWorkerOptions) {
      reactPdf.pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
    }
  })
}

interface ReactPdfThumbnailProps {
  pageId: string
  documentUrl: string
  pageNumber: number
  displayPosition?: number
  isSelected: boolean
  onSelect: () => void
  className?: string
}

const ReactPdfThumbnail = memo(function ReactPdfThumbnail({
  pageId,
  documentUrl,
  pageNumber,
  displayPosition,
  isSelected,
  onSelect,
  className = ''
}: ReactPdfThumbnailProps) {
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pageLoaded, setPageLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setError(null)
  }

  const onDocumentLoadError = (error: Error) => {
    console.error('Document load error:', error)
    setError('Failed to load document')
    setIsLoading(false)
  }

  const onPageLoadSuccess = () => {
    setPageLoaded(true)
    setIsLoading(false)
    setError(null)
  }

  const onPageLoadError = (error: Error) => {
    console.error('Page load error:', error)
    setError('Failed to load page')
    setIsLoading(false)
  }

  useEffect(() => {
    setIsLoading(true)
    setPageLoaded(false)
    setError(null)
  }, [documentUrl, pageNumber])

  if (error) {
    return (
      <div 
        className={`w-[120px] h-[150px] flex items-center justify-center bg-red-50 border-2 border-red-200 rounded-lg ${className}`}
      >
        <div className="text-center">
          <AlertCircle className="h-4 w-4 text-red-500 mx-auto mb-1" />
          <span className="text-xs text-red-600">Error</span>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div 
        className={`w-[120px] h-[150px] flex items-center justify-center bg-gray-100 border-2 border-gray-200 rounded-lg ${className}`}
      >
        <div className="text-center">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400 mb-1" />
          <span className="text-xs text-gray-500">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`
        relative group border-2 rounded-lg overflow-hidden bg-white transition-all cursor-pointer
        ${isSelected ? 'border-blue-500 shadow-lg' : 'border-gray-200 hover:border-gray-300'}
        w-[120px] h-[150px] ${className}
      `}
      onClick={onSelect}
    >
      {/* Page number badge */}
      <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-2 py-1 rounded z-10">
        {displayPosition !== undefined ? displayPosition : pageNumber}
      </div>

      {/* Thumbnail content */}
      <div className="flex items-center justify-center p-2 h-full w-full">
        {Document && Page && (
          <Document
            file={documentUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={null}
            error={null}
            options={{
              verbosity: 0,
              disableAutoFetch: false,
              disableStream: false,
              maxImageSize: 1024 * 1024,
              enableXfa: false,
              isEvalSupported: false
            }}
          >
            <Page
              pageNumber={pageNumber}
              scale={0.2}
              onLoadSuccess={onPageLoadSuccess}
              onLoadError={onPageLoadError}
              loading={null}
              error={null}
              renderAnnotationLayer={false}
              renderTextLayer={false}
              className="max-w-full max-h-full"
            />
          </Document>
        )}
      </div>
    </div>
  )
})

export default ReactPdfThumbnail 