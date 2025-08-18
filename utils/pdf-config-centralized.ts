import { pdfjs } from 'react-pdf'

// Centralized PDF.js configuration for version 4.8.69
export const PDF_CONFIG = {
  workerSrc: '/pdf.worker.min.mjs',
  workerSrcFallback: '/pdf.worker.mjs',
  cMapUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/standard_fonts/',
  enableXfa: false,
  disableAutoFetch: false,
  disableStream: false,
} as const

// Configure PDF.js worker with fallback support
export const configurePdfWorker = async (): Promise<void> => {
  if (typeof window === 'undefined') {
    return // Skip server-side
  }

  try {
    // Prevent multiple configurations
    if (pdfjs.GlobalWorkerOptions.workerSrc) {
      return
    }

    // Use absolute URLs to prevent relative path issues on /sign routes
    const baseUrl = window.location.origin
    const primaryWorkerUrl = `${baseUrl}${PDF_CONFIG.workerSrc}`
    const fallbackWorkerUrl = `${baseUrl}${PDF_CONFIG.workerSrcFallback}`

    // Try primary worker first
    try {
      const response = await fetch(primaryWorkerUrl, { method: 'HEAD' })
      if (response.ok) {
        pdfjs.GlobalWorkerOptions.workerSrc = primaryWorkerUrl

        return
      }
    } catch (error) {

    }

    // Fallback to alternative worker
    try {
      const response = await fetch(fallbackWorkerUrl, { method: 'HEAD' })
      if (response.ok) {
        pdfjs.GlobalWorkerOptions.workerSrc = fallbackWorkerUrl

        return
      }
    } catch (error) {

    }

    // CDN fallback if local workers fail
    const cdnWorkerUrl = 'https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs'
    try {
      pdfjs.GlobalWorkerOptions.workerSrc = cdnWorkerUrl

      return
    } catch (error) {

    }

    // Last resort: set the primary absolute path anyway
    pdfjs.GlobalWorkerOptions.workerSrc = primaryWorkerUrl

    
  } catch (error) {

    // Ensure worker is set even if configuration fails
    pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}${PDF_CONFIG.workerSrc}`
  }
}

// Auto-configure on import (client-side only)
if (typeof window !== 'undefined') {
  configurePdfWorker()
}

export default PDF_CONFIG
