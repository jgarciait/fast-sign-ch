/**
 * PDF Singleton Loader - Ensures PDFs are loaded only once
 */

let pdfjs: any

interface PDFCache {
  [url: string]: {
    promise: Promise<any>
    document?: any
    error?: any
    timestamp: number
  }
}

const pdfCache: PDFCache = {}
const CACHE_TIMEOUT = 10 * 60 * 1000 // 10 minutes

/**
 * Load PDF.js if not already loaded
 */
async function ensurePdfJsLoaded() {
  // Only run on client side
  if (typeof window === 'undefined') {
    throw new Error('PDF.js can only be loaded on the client side')
  }

  if (!pdfjs) {
    try {
      // Import react-pdf which is already configured in the project
      const reactPdf = await import('react-pdf')
      pdfjs = reactPdf.pdfjs
      
      // Configure worker if not already configured
      if (typeof window !== 'undefined') {
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        }
      }
      
      console.log('PDF.js loaded via react-pdf')
    } catch (error) {
      console.error('Failed to load PDF.js via react-pdf:', error)
      throw error
    }
  }
  return pdfjs
}

/**
 * Clean expired cache entries
 */
function cleanExpiredCache() {
  const now = Date.now()
  Object.keys(pdfCache).forEach(url => {
    if (now - pdfCache[url].timestamp > CACHE_TIMEOUT) {
      delete pdfCache[url]
    }
  })
}

/**
 * Load a PDF document only once, cache the result
 */
export async function loadPdfDocument(documentUrl: string): Promise<any> {
  // Only run on client side
  if (typeof window === 'undefined') {
    throw new Error('PDF loading can only be done on the client side')
  }

  // Clean expired cache entries
  cleanExpiredCache()

  // Check if we already have this PDF in cache
  if (pdfCache[documentUrl]) {
    console.log(`📦 PDF cache hit for: ${documentUrl.substring(0, 50)}...`)
    return pdfCache[documentUrl].promise
  }

  console.log(`🚀 Loading PDF (SINGLETON): ${documentUrl.substring(0, 50)}...`)
  
  // Create the loading promise
  const loadingPromise = (async () => {
    try {
      // Ensure PDF.js is loaded
      const pdfjsLib = await ensurePdfJsLoaded()
      
      // Use simple, reliable loading options - similar to what was working before
      const loadOptions = {
        url: documentUrl,
        verbosity: 0,
        disableAutoFetch: false,
        disableStream: false,
        maxImageSize: 16 * 1024 * 1024, // 16MB
        enableXfa: false,
        isEvalSupported: false
      }
      
      console.log(`📄 Loading PDF with options:`, {
        url: documentUrl.substring(0, 50) + '...',
        maxImageSize: loadOptions.maxImageSize,
        verbosity: loadOptions.verbosity
      })
      
      // Load the PDF document
      const loadingTask = pdfjsLib.getDocument(loadOptions)
      const pdfDocument = await loadingTask.promise
      
      console.log(`✅ PDF loaded (SINGLETON) - ${pdfDocument.numPages} pages: ${documentUrl.substring(0, 50)}...`)
      
      // Cache the result
      pdfCache[documentUrl].document = pdfDocument
      
      return pdfDocument
      
    } catch (error) {
      console.error('❌ PDF loading failed (SINGLETON):', error)
      
      // Cache the error
      pdfCache[documentUrl].error = error
      
      throw error
    }
  })()

  // Cache the promise immediately
  pdfCache[documentUrl] = {
    promise: loadingPromise,
    timestamp: Date.now()
  }

  return loadingPromise
}

/**
 * Get cached PDF document if available
 */
export function getCachedPdfDocument(documentUrl: string): any | null {
  const cached = pdfCache[documentUrl]
  if (cached && cached.document) {
    // Check if cache is expired
    if (Date.now() - cached.timestamp > CACHE_TIMEOUT) {
      delete pdfCache[documentUrl]
      return null
    }
    return cached.document
  }
  return null
}

/**
 * Check if PDF is currently loading
 */
export function isPdfLoading(documentUrl: string): boolean {
  const cached = pdfCache[documentUrl]
  return cached && !cached.document && !cached.error
}

/**
 * Clear PDF cache for a specific URL
 */
export function clearPdfCache(documentUrl?: string) {
  if (documentUrl) {
    delete pdfCache[documentUrl]
    console.log(`🗑️ Cleared PDF cache for: ${documentUrl.substring(0, 50)}...`)
  } else {
    Object.keys(pdfCache).forEach(key => delete pdfCache[key])
    console.log('🗑️ Cleared all PDF cache')
  }
}

/**
 * Get cache stats
 */
export function getPdfCacheStats() {
  const urls = Object.keys(pdfCache)
  const loaded = urls.filter(url => pdfCache[url].document).length
  const loading = urls.filter(url => isPdfLoading(url)).length
  const errors = urls.filter(url => pdfCache[url].error).length
  
  return {
    total: urls.length,
    loaded,
    loading,
    errors,
    urls: urls.map(url => ({
      url: url.substring(0, 50) + '...',
      status: pdfCache[url].document ? 'loaded' : 
              pdfCache[url].error ? 'error' : 'loading',
      age: Date.now() - pdfCache[url].timestamp
    }))
  }
}

/**
 * Preload PDF document for better performance
 */
export async function preloadPdfDocument(documentUrl: string): Promise<void> {
  try {
    await loadPdfDocument(documentUrl)
  } catch (error) {
    console.warn('PDF preload failed:', error)
  }
} 