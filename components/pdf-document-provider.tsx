"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useRef } from 'react'

// Dynamic import for PDF components
let Document: any, pdfjs: any

interface PdfDocumentContextType {
  document: any
  isLoaded: boolean
  error: boolean
}

const PdfDocumentContext = createContext<PdfDocumentContextType | null>(null)

interface PdfDocumentProviderProps {
  documentUrl: string
  children: ReactNode
}

export const PdfDocumentProvider: React.FC<PdfDocumentProviderProps> = ({ documentUrl, children }) => {
  const [document, setDocument] = useState<any>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [pdfJsLoaded, setPdfJsLoaded] = useState(false)
  const currentUrlRef = useRef<string>('')

  // Load PDF.js dynamically once
  useEffect(() => {
    const loadPdfJs = async () => {
      try {
        const reactPdf = await import('react-pdf')
        Document = reactPdf.Document
        pdfjs = reactPdf.pdfjs
        
        // Set up PDF.js worker
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        
        setPdfJsLoaded(true)
      } catch (error) {
        console.error('Error loading PDF.js:', error)
        setError(true)
      }
    }

    loadPdfJs()
  }, [])

  // Reset document when URL changes
  useEffect(() => {
    if (documentUrl && pdfJsLoaded && documentUrl !== currentUrlRef.current) {
      console.log('PDF URL changed, loading new document:', documentUrl.substring(0, 50) + '...')
      console.log('Previous URL:', currentUrlRef.current.substring(0, 50) + '...')
      currentUrlRef.current = documentUrl
      setDocument(null)
      setIsLoaded(false)
      setError(false)
    }
  }, [documentUrl, pdfJsLoaded])

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    document,
    isLoaded,
    error
  }), [document, isLoaded, error])

  if (!pdfJsLoaded) {
    return (
      <div className="w-full h-32 flex items-center justify-center bg-gray-100 border-2 border-gray-200 rounded-lg">
        <div className="text-gray-500 text-sm">Cargando PDF.js...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full h-32 flex items-center justify-center bg-red-50 border-2 border-red-200 rounded-lg">
        <div className="text-red-500 text-sm">Error cargando PDF</div>
      </div>
    )
  }

  return (
    <PdfDocumentContext.Provider value={contextValue}>
      <Document
        key={documentUrl} // Stable key to prevent unnecessary re-mounts
        file={documentUrl}
        loading={
          <div className="w-full h-32 flex items-center justify-center bg-gray-100">
            <div className="text-gray-500 text-sm">Cargando documento...</div>
          </div>
        }
        error={
          <div className="w-full h-32 flex items-center justify-center bg-red-50">
            <div className="text-red-500 text-sm">Error al cargar documento</div>
          </div>
        }
        onLoadSuccess={(doc: any) => {
          console.log('PDF document loaded successfully for:', documentUrl.substring(0, 50) + '...')
          setDocument(doc)
          setIsLoaded(true)
          setError(false)
        }}
        onLoadError={(error: any) => {
          console.error('Error loading PDF document:', error)
          setError(true)
        }}
      >
        {children}
      </Document>
    </PdfDocumentContext.Provider>
  )
}

export const usePdfDocument = () => {
  const context = useContext(PdfDocumentContext)
  if (!context) {
    throw new Error('usePdfDocument must be used within a PdfDocumentProvider')
  }
  return context
} 