"use client"

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'

// Dynamic import for PDF.js
let pdfjs: any

interface PDFDocumentState {
  document: any | null
  isLoading: boolean
  error: string | null
  totalPages: number
}

interface GlobalPDFContextType {
  getDocument: (url: string) => Promise<any>
  getDocumentState: (url: string) => PDFDocumentState
  renderPageToDataUrl: (url: string, pageNumber: number, options?: { scale?: number, rotation?: number }) => Promise<string>
  preloadDocument: (url: string) => void
  clearCache: () => void
}

const GlobalPDFContext = createContext<GlobalPDFContextType | null>(null)

// Global PDF Document Manager - Singleton with better implementation
class GlobalPDFDocumentManager {
  private static instance: GlobalPDFDocumentManager
  private documents = new Map<string, any>()
  private documentStates = new Map<string, PDFDocumentState>()
  private loadingPromises = new Map<string, Promise<any>>()
  private pageCache = new Map<string, string>()
  private readonly maxCacheSize = 200
  private initialized = false

  static getInstance(): GlobalPDFDocumentManager {
    if (!GlobalPDFDocumentManager.instance) {
      GlobalPDFDocumentManager.instance = new GlobalPDFDocumentManager()
    }
    return GlobalPDFDocumentManager.instance
  }

  private async initializePdfJs() {
    if (this.initialized) return

    try {
      if (!pdfjs) {
        const reactPdf = await import('react-pdf')
        pdfjs = reactPdf.pdfjs

        // Set worker only once - use the same path as configured in layout
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs'
        }
      }
      this.initialized = true
    } catch (error) {
      console.error('Failed to initialize PDF.js:', error)
      throw error
    }
  }

  async getDocument(url: string): Promise<any> {
    // Return cached document if available
    if (this.documents.has(url)) {
      return this.documents.get(url)
    }

    // Return existing loading promise if document is being loaded
    if (this.loadingPromises.has(url)) {
      return this.loadingPromises.get(url)
    }

    // Start loading the document
    const loadPromise = this.loadDocument(url)
    this.loadingPromises.set(url, loadPromise)

    try {
      const document = await loadPromise
      this.documents.set(url, document)
      this.updateDocumentState(url, {
        document,
        isLoading: false,
        error: null,
        totalPages: document.numPages
      })
      this.loadingPromises.delete(url)
      return document
    } catch (error) {
      this.loadingPromises.delete(url)
      this.updateDocumentState(url, {
        document: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        totalPages: 0
      })
      throw error
    }
  }

  private async loadDocument(url: string): Promise<any> {
    await this.initializePdfJs()

    this.updateDocumentState(url, {
      document: null,
      isLoading: true,
      error: null,
      totalPages: 0
    })

    console.log(`Loading PDF document: ${url}`)

    const document = await pdfjs.getDocument({
      url,
      disableAutoFetch: false,
      disableStream: false,
    }).promise

    console.log(`PDF document loaded successfully: ${document.numPages} pages`)
    return document
  }

  getDocumentState(url: string): PDFDocumentState {
    return this.documentStates.get(url) || {
      document: null,
      isLoading: false,
      error: null,
      totalPages: 0
    }
  }

  private updateDocumentState(url: string, state: PDFDocumentState) {
    this.documentStates.set(url, state)
  }

  async renderPageToDataUrl(
    url: string, 
    pageNumber: number, 
    options: { scale?: number, rotation?: number } = {}
  ): Promise<string> {
    const { scale = 0.2, rotation = 0 } = options
    const cacheKey = `${url}-${pageNumber}-${scale}-${rotation}`

    if (this.pageCache.has(cacheKey)) {
      return this.pageCache.get(cacheKey)!
    }

    try {
      const document = await this.getDocument(url)
      const page = await document.getPage(pageNumber)
      
      const viewport = page.getViewport({ scale, rotation })
      
      // SSR safety check for document.createElement
      if (typeof window === 'undefined' || typeof window.document === 'undefined') {
        throw new Error('Canvas creation requires browser environment')
      }
      
      const canvas = window.document.createElement('canvas')
      const context = canvas.getContext('2d')

      if (!context) {
        throw new Error('Could not get canvas context')
      }

      canvas.width = viewport.width
      canvas.height = viewport.height

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise

      const dataUrl = canvas.toDataURL('image/jpeg', 0.8)

      // Manage cache size
      if (this.pageCache.size >= this.maxCacheSize) {
        const keys = Array.from(this.pageCache.keys())
        const keysToRemove = keys.slice(0, 50)
        keysToRemove.forEach(key => this.pageCache.delete(key))
      }

      this.pageCache.set(cacheKey, dataUrl)
      canvas.remove()

      return dataUrl
    } catch (error) {
      console.error(`Error rendering page ${pageNumber} for ${url}:`, error)
      throw error
    }
  }

  preloadDocument(url: string): void {
    if (!this.documents.has(url) && !this.loadingPromises.has(url)) {
      this.getDocument(url).catch(error => {
        console.warn(`Failed to preload document ${url}:`, error)
      })
    }
  }

  clearCache(): void {
    this.pageCache.clear()
    this.documents.clear()
    this.documentStates.clear()
    this.loadingPromises.clear()
  }
}

export function GlobalPDFDocumentProvider({ children }: { children: React.ReactNode }) {
  const managerRef = useRef<GlobalPDFDocumentManager | null>(null)
  const [updateTrigger, setUpdateTrigger] = useState(0)

  // Initialize manager
  if (!managerRef.current) {
    managerRef.current = GlobalPDFDocumentManager.getInstance()
  }

  const getDocument = useCallback(async (url: string) => {
    return managerRef.current!.getDocument(url)
  }, [])

  const getDocumentState = useCallback((url: string) => {
    return managerRef.current!.getDocumentState(url)
  }, [])

  const renderPageToDataUrl = useCallback(async (
    url: string, 
    pageNumber: number, 
    options?: { scale?: number, rotation?: number }
  ) => {
    return managerRef.current!.renderPageToDataUrl(url, pageNumber, options)
  }, [])

  const preloadDocument = useCallback((url: string) => {
    managerRef.current!.preloadDocument(url)
  }, [])

  const clearCache = useCallback(() => {
    managerRef.current!.clearCache()
    setUpdateTrigger(prev => prev + 1) // Force re-render to update states
  }, [])

  const contextValue: GlobalPDFContextType = {
    getDocument,
    getDocumentState,
    renderPageToDataUrl,
    preloadDocument,
    clearCache
  }

  return (
    <GlobalPDFContext.Provider value={contextValue}>
      {children}
    </GlobalPDFContext.Provider>
  )
}

export function useGlobalPDF() {
  const context = useContext(GlobalPDFContext)
  if (!context) {
    throw new Error('useGlobalPDF must be used within a GlobalPDFDocumentProvider')
  }
  return context
}

export default GlobalPDFDocumentProvider 