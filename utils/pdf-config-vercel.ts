import { pdfjs } from 'react-pdf'

// Production-specific PDF.js configuration for Vercel
export const VERCEL_PDF_CONFIG = {
  workerSrc: '/pdf.worker.min.mjs',
  workerSrcFallback: '/pdf.worker.mjs',
  apiRoutes: [
    '/api/worker/pdf.worker.min.mjs',
    '/api/worker/pdf.worker.mjs'
  ],
  cdnFallback: 'https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs',
  cMapUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/standard_fonts/',
  enableXfa: false,
  disableAutoFetch: false,
  disableStream: false,
} as const

// Detect if running on Vercel
const isVercel = () => {
  return typeof window !== 'undefined' && (
    window.location.hostname.includes('vercel.app') ||
    process.env.VERCEL === '1' ||
    process.env.NODE_ENV === 'production'
  )
}

// Vercel-optimized worker configuration
export const configureVercelPdfWorker = async (): Promise<void> => {
  if (typeof window === 'undefined') {
    return // Skip server-side
  }

  try {
    // Skip if already configured and not on Vercel
    if (pdfjs.GlobalWorkerOptions.workerSrc && !isVercel()) {
      return
    }

    console.log('🚀 Configuring PDF.js worker for Vercel...')

    const baseUrl = window.location.origin
    const allWorkerPaths = [
      VERCEL_PDF_CONFIG.workerSrc,
      VERCEL_PDF_CONFIG.workerSrcFallback,
      ...VERCEL_PDF_CONFIG.apiRoutes
    ]

    // Try each worker path in sequence
    for (const workerPath of allWorkerPaths) {
      try {
        const fullUrl = workerPath.startsWith('http') ? workerPath : `${baseUrl}${workerPath}`
        console.log(`🔍 Testing worker: ${fullUrl}`)

        // Test with both HEAD and GET to ensure compatibility
        const headResponse = await fetch(fullUrl, { 
          method: 'HEAD',
          mode: 'cors',
          credentials: 'omit'
        })
        
        if (headResponse.ok) {
          // Verify it's actually JavaScript content
          const contentType = headResponse.headers.get('content-type')
          if (contentType && (contentType.includes('javascript') || contentType.includes('application/javascript'))) {
            pdfjs.GlobalWorkerOptions.workerSrc = fullUrl
            console.log(`✅ PDF.js worker configured successfully: ${fullUrl}`)
            return
          } else {
            console.warn(`⚠️ Worker ${fullUrl} returned wrong content-type: ${contentType}`)
          }
        } else {
          console.warn(`⚠️ Worker ${fullUrl} returned status: ${headResponse.status}`)
        }
      } catch (error) {
        console.warn(`❌ Failed to test worker ${workerPath}:`, error)
      }
    }

    // If all local workers fail, use CDN
    console.log('🌐 All local workers failed, using CDN fallback')
    try {
      const cdnResponse = await fetch(VERCEL_PDF_CONFIG.cdnFallback, { 
        method: 'HEAD',
        mode: 'cors'
      })
      
      if (cdnResponse.ok) {
        pdfjs.GlobalWorkerOptions.workerSrc = VERCEL_PDF_CONFIG.cdnFallback
        console.log(`✅ PDF.js worker configured with CDN: ${VERCEL_PDF_CONFIG.cdnFallback}`)
      } else {
        throw new Error(`CDN worker returned status: ${cdnResponse.status}`)
      }
    } catch (error) {
      console.error('❌ CDN worker also failed:', error)
      
      // Last resort: set worker anyway and hope for the best
      pdfjs.GlobalWorkerOptions.workerSrc = `${baseUrl}${VERCEL_PDF_CONFIG.workerSrc}`
      console.warn(`⚠️ Set worker as last resort: ${pdfjs.GlobalWorkerOptions.workerSrc}`)
    }

  } catch (error) {
    console.error('❌ Fatal error configuring PDF.js worker:', error)
    
    // Emergency fallback
    pdfjs.GlobalWorkerOptions.workerSrc = VERCEL_PDF_CONFIG.cdnFallback
    console.warn('🆘 Emergency fallback to CDN worker')
  }
}

// Force reconfiguration (useful for debugging)
export const forceReconfigureWorker = async (): Promise<void> => {
  if (typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = ''
    await configureVercelPdfWorker()
  }
}

// Auto-configure on import for production environments (client-side only)
if (typeof window !== 'undefined') {
  // Delay auto-configuration to avoid build issues
  setTimeout(() => {
    if (isVercel()) {
      configureVercelPdfWorker().catch(error => {
        console.error('Failed to auto-configure PDF worker on Vercel:', error)
      })
    }
  }, 100)
}

export default VERCEL_PDF_CONFIG
