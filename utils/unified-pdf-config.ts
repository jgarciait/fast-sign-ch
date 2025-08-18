"use client"

import { pdfjs } from 'react-pdf'

// Configuration constants with API route fallbacks
const WORKER_PATHS = [
  '/pdf.worker.min.mjs',
  '/pdf.worker.mjs',
  '/api/worker/pdf.worker.min.mjs', // API route fallback
  '/api/worker/pdf.worker.mjs',     // API route fallback
  '/pdf.worker.min.js',
  '/pdf.worker.js'
] as const

const CDN_FALLBACK = 'https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs'

// Unified PDF.js configuration
export const UNIFIED_PDF_OPTIONS = {
  cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/standard_fonts/',
  workerSrc: typeof window !== 'undefined' ? `${window.location.origin}/pdf.worker.min.mjs` : '/pdf.worker.min.mjs'
} as const

// Async function to verify worker availability
async function verifyWorkerAvailability(workerPath: string): Promise<boolean> {
  try {
    // Handle both relative paths and full URLs
    const url = workerPath.startsWith('http') ? workerPath : `${window.location.origin}${workerPath}`
    const response = await fetch(url, { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}

// Global initialization function with robust verification
export async function initializePDFWorker(): Promise<void> {
  // Only run on client side
  if (typeof window === 'undefined') return
  
  // Skip if already configured and working
  if (pdfjs.GlobalWorkerOptions.workerSrc) {
    console.log('📄 PDF.js worker already configured:', pdfjs.GlobalWorkerOptions.workerSrc)
    
    // Verify the current worker is still accessible
    try {
      const isAccessible = await verifyWorkerAvailability(pdfjs.GlobalWorkerOptions.workerSrc)
      if (isAccessible) {
        return // Worker is configured and accessible
      } else {
        console.warn('⚠️ Current worker not accessible, reconfiguring...')
        pdfjs.GlobalWorkerOptions.workerSrc = '' // Reset to force reconfiguration
      }
    } catch (error) {
      console.warn('⚠️ Worker accessibility check failed, reconfiguring...', error)
      pdfjs.GlobalWorkerOptions.workerSrc = '' // Reset to force reconfiguration
    }
  }

  console.log('📄 Initializing PDF.js worker...')

  // Try local workers first with proper verification
  for (const workerPath of WORKER_PATHS) {
    try {
      const fullPath = `${window.location.origin}${workerPath}`
      
      // Verify worker is actually available before setting it
      const isAvailable = await verifyWorkerAvailability(workerPath)
      
      if (isAvailable) {
        pdfjs.GlobalWorkerOptions.workerSrc = fullPath
        console.log('✅ PDF.js worker configured successfully:', fullPath)
        return
      } else {
        console.warn(`⚠️ Worker not available: ${workerPath}`)
      }
    } catch (error) {
      console.warn(`❌ Failed to verify PDF worker ${workerPath}:`, error)
    }
  }

  // Fallback to CDN if local workers fail
  console.log('🌐 Local workers not available, using CDN fallback')
  try {
    // Verify CDN fallback is accessible
    const isCdnAvailable = await verifyWorkerAvailability(CDN_FALLBACK)
    if (isCdnAvailable) {
      pdfjs.GlobalWorkerOptions.workerSrc = CDN_FALLBACK
      console.log('✅ PDF.js worker configured with CDN:', CDN_FALLBACK)
    } else {
      console.error('❌ CDN worker fallback not available')
      throw new Error('No PDF.js worker available')
    }
  } catch (error) {
    console.error('❌ Failed to configure PDF.js worker:', error)
    // Set the CDN fallback anyway as a last resort
    pdfjs.GlobalWorkerOptions.workerSrc = CDN_FALLBACK
  }
}

// Synchronous initialization for immediate use (fallback)
export function initializePDFWorkerSync(): void {
  // Only run on client side
  if (typeof window === 'undefined') return
  
  // Skip if already configured
  if (pdfjs.GlobalWorkerOptions.workerSrc) {
    return
  }

  // Set the most likely working worker immediately
  const primaryWorker = `${window.location.origin}/pdf.worker.min.mjs`
  pdfjs.GlobalWorkerOptions.workerSrc = primaryWorker
  console.log('📄 PDF.js worker set synchronously:', primaryWorker)
}

// Reset function for troubleshooting
export function resetPDFWorker(): void {
  if (typeof window === 'undefined') return
  
  pdfjs.GlobalWorkerOptions.workerSrc = ''
  console.log('🔄 PDF.js worker reset, re-initializing...')
  
  // Use sync version for immediate reset
  initializePDFWorkerSync()
  
  // Then try async verification in background
  initializePDFWorker().catch(console.error)
}

// Hook for React components with better error handling
export function usePDFWorker() {
  if (typeof window !== 'undefined') {
    // Initialize synchronously first for immediate use
    initializePDFWorkerSync()
    
    // Then verify asynchronously in background
    initializePDFWorker().catch(error => {
      console.error('Failed to initialize PDF worker asynchronously:', error)
    })
  }
  
  return {
    isConfigured: Boolean(pdfjs.GlobalWorkerOptions.workerSrc),
    workerSrc: pdfjs.GlobalWorkerOptions.workerSrc,
    reset: resetPDFWorker,
    initializeAsync: initializePDFWorker
  }
}

// Auto-initialize when module loads (client-side only)
if (typeof window !== 'undefined') {
  // Initialize synchronously for immediate availability
  initializePDFWorkerSync()
  
  // Then verify asynchronously in background
  initializePDFWorker().catch(error => {
    console.warn('Background PDF worker verification failed:', error)
  })
}
