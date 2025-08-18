"use client"

import { useState, useEffect } from "react"

interface SimplePdfWrapperProps {
  documentUrl: string
  onLoadSuccess?: (pdf: any) => void
  children?: React.ReactNode
}

export default function SimplePdfWrapper({ documentUrl, onLoadSuccess, children }: SimplePdfWrapperProps) {
  const [pdfModule, setPdfModule] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const loadPdfModule = async () => {
      try {
        // Configure Promise.withResolvers polyfill if needed
        if (typeof (Promise as any).withResolvers !== "function") {
          const polyfill = function withResolvers<T = any>() {
            let resolveFn: (value: T | PromiseLike<T>) => void
            let rejectFn: (reason?: any) => void
            const promise = new Promise<T>((res, rej) => {
              resolveFn = res
              rejectFn = rej
            })
            return { promise, resolve: resolveFn!, reject: rejectFn! }
          }
          Object.defineProperty(Promise, "withResolvers", {
            value: polyfill,
            writable: true,
            configurable: true,
          })
        }

        // Import react-pdf
        const reactPdf = await import("react-pdf")
        
        // Configure worker
        if (reactPdf.pdfjs.GlobalWorkerOptions) {
          reactPdf.pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        }

        if (mounted) {
          setPdfModule(reactPdf)
          setLoading(false)
        }
      } catch (err) {
        console.error("Failed to load PDF module:", err)
        if (mounted) {
          setError("Failed to load PDF viewer")
          setLoading(false)
        }
      }
    }

    loadPdfModule()

    return () => {
      mounted = false
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading PDF viewer...</p>
        </div>
      </div>
    )
  }

  if (error || !pdfModule) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="h-12 w-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-gray-600 mb-4">{error || "PDF viewer failed to load"}</p>
          <a
            href={documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Open PDF in new tab
          </a>
        </div>
      </div>
    )
  }

  const { Document } = pdfModule

  return (
    <Document
      file={documentUrl}
      onLoadSuccess={onLoadSuccess}
      onLoadError={(error: any) => {
        console.error("PDF load error:", error)
        setError("Failed to load PDF document")
      }}
      options={{
        cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/standard_fonts/'
      }}
    >
      {children}
    </Document>
  )
}
