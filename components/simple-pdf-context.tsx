"use client"

import React, { useState, useEffect, createContext, useContext, useRef } from 'react'
import { loadPdfDocument, getCachedPdfDocument, clearPdfCache } from '@/utils/pdf-singleton'

interface PdfContextType {
  pdfDocument: any
  totalPages: number
  isLoading: boolean
  error: string | null
  documentUrl: string
  reload: () => void
}

const PdfContext = createContext<PdfContextType | null>(null)

interface SimplePdfProviderProps {
  documentUrl: string
  currentPage: number
  children: React.ReactNode
}

export function SimplePdfProvider({ documentUrl, currentPage, children }: SimplePdfProviderProps) {
  const [pdfDocument, setPdfDocument] = useState<any>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadingRef = useRef<boolean>(false)
  const currentDocumentUrl = useRef<string>('')

  // Reload function
  const reload = async () => {
    if (currentDocumentUrl.current) {
      clearPdfCache(currentDocumentUrl.current)
      setIsLoading(true)
      setError(null)
      setPdfDocument(null)
      setTotalPages(0)
      await loadDocument(currentDocumentUrl.current)
    }
  }

  // Load PDF document using singleton
  const loadDocument = async (url: string) => {
    if (loadingRef.current || !url) return

    try {
      loadingRef.current = true
      setIsLoading(true)
      setError(null)
      currentDocumentUrl.current = url
      
      // Check if we already have this PDF cached
      const cached = getCachedPdfDocument(url)
      if (cached) {
        console.log(`📦 Using cached PDF: ${url.substring(0, 50)}...`)
        setPdfDocument(cached)
        setTotalPages(cached.numPages)
        setIsLoading(false)
        loadingRef.current = false
        return
      }
      
      console.log(`📥 Loading PDF with singleton: ${url.substring(0, 50)}...`)
      
      // Load using singleton (will be cached for other components)
      const pdfDoc = await loadPdfDocument(url)
      
      // Only update state if we're still loading the same document
      if (currentDocumentUrl.current === url) {
        console.log(`✅ PDF loaded via singleton! Pages: ${pdfDoc.numPages}`)
        setPdfDocument(pdfDoc)
        setTotalPages(pdfDoc.numPages)
        setIsLoading(false)
        console.log(`✅ Context updated with PDF document`)
      }
      
    } catch (err) {
      console.error('Error loading PDF document:', err)
      // Only update error state if we're still loading the same document
      if (currentDocumentUrl.current === url) {
        setError(err instanceof Error ? err.message : 'Failed to load PDF document')
        setIsLoading(false)
      }
    } finally {
      loadingRef.current = false
    }
  }

  // Load PDF document when documentUrl changes
  useEffect(() => {
    if (documentUrl && documentUrl !== currentDocumentUrl.current) {
      loadDocument(documentUrl)
    }
  }, [documentUrl])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      loadingRef.current = false
    }
  }, [])

  const contextValue: PdfContextType = {
    pdfDocument,
    totalPages,
    isLoading,
    error,
    documentUrl,
    reload
  }

  return (
    <PdfContext.Provider value={contextValue}>
      {children}
    </PdfContext.Provider>
  )
}

export function usePdfContext(): PdfContextType {
  const context = useContext(PdfContext)
  if (!context) {
    throw new Error('usePdfContext must be used within a SimplePdfProvider')
  }
  return context
}

// Simple wrapper component for backward compatibility
export function SharedPdfDocument({ documentUrl, currentPage, children }: SimplePdfProviderProps) {
  return (
    <SimplePdfProvider documentUrl={documentUrl} currentPage={currentPage}>
      {children}
    </SimplePdfProvider>
  )
} 