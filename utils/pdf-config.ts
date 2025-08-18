"use client"

// Centralized PDF.js Configuration for Large Documents
let pdfjs: any = null
let pdfjsLoaded = false

export interface PDFConfig {
  disableAutoFetch: boolean
  disableStream: boolean
  maxImageSize: number
  cMapUrl: string
  cMapPacked: boolean
  standardFontDataUrl: string
  enableXfa: boolean
  isEvalSupported: boolean
  verbosity: number
}

// Optimized configuration for large documents
export const LARGE_DOCUMENT_CONFIG: PDFConfig = {
  disableAutoFetch: false,
  disableStream: false,
  maxImageSize: 1024 * 1024, // 1MB limit for images
  cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/standard_fonts/',
  enableXfa: false,
  isEvalSupported: false,
  verbosity: 0, // Reduce logging for performance
}

// Standard configuration for regular documents
export const STANDARD_CONFIG: PDFConfig = {
  disableAutoFetch: false,
  disableStream: false,
  maxImageSize: 2 * 1024 * 1024, // 2MB limit
  cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/standard_fonts/',
  enableXfa: false, // Disable XFA to prevent invariant errors
  isEvalSupported: false, // Disable eval for security
  verbosity: 0, // Reduce logging
}

// Load PDF.js with proper ESM handling
async function loadPdfjs() {
  if (pdfjsLoaded && pdfjs) return pdfjs
  
  try {
    // Import PDF.js with ESM support
    const pdfjsModule = await import('pdfjs-dist')
    
    // Handle different export structures for pdfjs-dist 3.11.174
    // This version has the main API as named exports
    pdfjs = pdfjsModule
    
    pdfjsLoaded = true
    return pdfjs
  } catch (error) {
    console.error('Failed to load PDF.js:', error)
    throw error
  }
}

// Configure PDF.js worker with fallback handling
export async function configurePdfJsWithFallback(pageCount?: number): Promise<void> {
  if (typeof window === 'undefined') return

  try {
    // Load PDF.js first
    const pdfLib = await loadPdfjs()
    
    // Configure worker source with fallback - prioritize .mjs
    if (pdfLib && pdfLib.GlobalWorkerOptions) {
      if (!pdfLib.GlobalWorkerOptions.workerSrc) {
        // Try .mjs worker first (modern ES modules)
        const mjsWorkerSrc = `${window.location.origin}/pdf.worker.mjs`
        
        try {
          const mjsResponse = await fetch(mjsWorkerSrc, { method: 'HEAD' })
          if (mjsResponse.ok) {
            pdfLib.GlobalWorkerOptions.workerSrc = mjsWorkerSrc
            console.log('PDF.js worker configured successfully (mjs):', mjsWorkerSrc)
            return
          }
        } catch (error) {
          console.warn('MJS worker not available, trying min.js fallback:', error)
        }
        
        // Fallback to .min.js worker
        const minWorkerSrc = `${window.location.origin}/pdf.worker.min.mjs`
        try {
          const minResponse = await fetch(minWorkerSrc, { method: 'HEAD' })
          if (minResponse.ok) {
            pdfLib.GlobalWorkerOptions.workerSrc = minWorkerSrc
            console.log('PDF.js worker configured successfully (min.js):', minWorkerSrc)
          } else {
            console.warn('Local PDF workers not found, using CDN fallback')
            // Final fallback to CDN worker
            pdfLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs'
          }
        } catch (error) {
          console.warn('Error testing PDF workers, using CDN fallback:', error)
          pdfLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs'
        }
      }
    }

    console.log('PDF.js configured successfully', {
      workerSrc: pdfLib.GlobalWorkerOptions?.workerSrc,
      pageCount
    })

  } catch (error) {
    console.error('Failed to configure PDF.js:', error)
  }
}

// Simple worker configuration function
export function setupPdfWorker(pdfjs: any): void {
  if (!pdfjs?.GlobalWorkerOptions?.workerSrc) {
    // Try .mjs first, then .min.js fallback
    const mjsWorker = '/pdf.worker.mjs'
    const minWorker = '/pdf.worker.min.mjs'
    
    // Check if .mjs is available
    fetch(mjsWorker, { method: 'HEAD' })
      .then(response => {
        if (response.ok) {
          pdfjs.GlobalWorkerOptions.workerSrc = mjsWorker
          console.log('Using PDF.js worker:', mjsWorker)
        } else {
          pdfjs.GlobalWorkerOptions.workerSrc = minWorker
          console.log('Using PDF.js worker fallback:', minWorker)
        }
      })
      .catch(() => {
        pdfjs.GlobalWorkerOptions.workerSrc = minWorker
        console.log('Using PDF.js worker fallback:', minWorker)
      })
  }
}

// Get configuration based on document size
export function getPDFConfig(pageCount?: number): PDFConfig {
  if (pageCount && pageCount > 200) {
    console.log(`Using large document configuration for ${pageCount} pages`)
    return LARGE_DOCUMENT_CONFIG
  }
  return STANDARD_CONFIG
}

// Initialize PDF.js with optimal settings
export async function initializePdfJs(pageCount?: number): Promise<boolean> {
  try {
    await configurePdfJsWithFallback(pageCount)
    return true
  } catch (error) {
    console.error('Failed to initialize PDF.js:', error)
    return false
  }
}

// Memory cleanup for large documents
export function cleanupPdfMemory(): void {
  if (typeof window !== 'undefined' && window.gc) {
    // Force garbage collection if available (Chrome with --enable-precise-memory-info)
    window.gc()
  }
}

// Performance monitoring
export function logPdfPerformance(operation: string, startTime: number, pageCount?: number): void {
  const duration = performance.now() - startTime
  const pageInfo = pageCount ? ` (${pageCount} pages)` : ''
  
  if (duration > 5000) {
    console.warn(`PDF operation '${operation}' took ${duration.toFixed(2)}ms${pageInfo} - consider optimization`)
  } else {
    console.log(`PDF operation '${operation}' completed in ${duration.toFixed(2)}ms${pageInfo}`)
  }
}

// Safe PDF loading options for data URLs
export function getSafeLoadOptions(documentUrl: string, pageCount?: number): any {
  const config = getPDFConfig(pageCount)
  
  const baseOptions = {
    verbosity: config.verbosity,
    disableAutoFetch: config.disableAutoFetch,
    disableStream: config.disableStream,
    maxImageSize: config.maxImageSize,
    enableXfa: config.enableXfa,
    isEvalSupported: config.isEvalSupported,
    cMapUrl: config.cMapUrl,
    cMapPacked: config.cMapPacked,
    standardFontDataUrl: config.standardFontDataUrl
  }

  if (documentUrl.startsWith('data:')) {
    // For data URLs, we need to convert to Uint8Array
    const base64Data = documentUrl.split(',')[1]
    if (!base64Data) {
      throw new Error('Invalid data URL format')
    }
    
    const binaryString = atob(base64Data)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    
    return {
      ...baseOptions,
      data: bytes
    }
  } else {
    return {
      ...baseOptions,
      url: documentUrl
    }
  }
} 