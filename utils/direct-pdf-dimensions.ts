/**
 * Direct PDF.js dimension detection utility
 * Provides more reliable PDF dimension detection than React PDF wrapper
 */

import { getDocument, PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'

interface PDFPageDimensions {
  width: number
  height: number
  orientation: 'PORTRAIT' | 'LANDSCAPE'
  aspectRatio: number
  rotation: number
}

interface PDFDocumentInfo {
  numPages: number
  pages: Map<number, PDFPageDimensions>
}

/**
 * Get PDF page dimensions directly from PDF.js without React PDF wrapper
 * This provides more accurate dimension detection
 */
export async function getDirectPDFDimensions(
  pdfUrl: string, 
  pageNumber: number = 1
): Promise<PDFPageDimensions> {
  try {
    console.log(`🔍 DIRECT PDF.js: Loading PDF from ${pdfUrl} to get dimensions for page ${pageNumber}`)
    
    const loadingTask = getDocument({
      url: pdfUrl,
      cMapUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/standard_fonts/',
    })
    
    const pdf: PDFDocumentProxy = await loadingTask.promise
    console.log(`📄 DIRECT PDF.js: PDF loaded successfully, total pages: ${pdf.numPages}`)
    
    if (pageNumber > pdf.numPages) {
      throw new Error(`Page ${pageNumber} does not exist. PDF has ${pdf.numPages} pages.`)
    }
    
    const page: PDFPageProxy = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 1.0 })
    
    // Get the true dimensions from the viewport
    const width = viewport.width
    const height = viewport.height
    const rotation = viewport.rotation
    
    // Determine orientation based on actual dimensions
    const orientation = width > height ? 'LANDSCAPE' : 'PORTRAIT'
    const aspectRatio = width / height
    
    console.log(`📐 DIRECT PDF.js: Page ${pageNumber} dimensions detected:`, {
      width,
      height,
      orientation,
      aspectRatio: aspectRatio.toFixed(2),
      rotation,
      note: 'These are the TRUE PDF dimensions from PDF.js directly'
    })
    
    // Clean up
    await pdf.destroy()
    
    return {
      width,
      height,
      orientation,
      aspectRatio,
      rotation
    }
    
  } catch (error) {
    console.error('🚨 DIRECT PDF.js: Error getting PDF dimensions:', error)
    throw error
  }
}

/**
 * Get dimensions for all pages in a PDF document
 */
export async function getAllPDFPageDimensions(pdfUrl: string): Promise<PDFDocumentInfo> {
  try {
    console.log(`🔍 DIRECT PDF.js: Loading all page dimensions from ${pdfUrl}`)
    
    const loadingTask = getDocument({
      url: pdfUrl,
      cMapUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/standard_fonts/',
    })
    
    const pdf: PDFDocumentProxy = await loadingTask.promise
    const numPages = pdf.numPages
    const pages = new Map<number, PDFPageDimensions>()
    
    console.log(`📄 DIRECT PDF.js: Processing ${numPages} pages for dimension detection`)
    
    // Get dimensions for each page
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page: PDFPageProxy = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale: 1.0 })
      
      const width = viewport.width
      const height = viewport.height
      const rotation = viewport.rotation
      const orientation = width > height ? 'LANDSCAPE' : 'PORTRAIT'
      const aspectRatio = width / height
      
      pages.set(pageNum, {
        width,
        height,
        orientation,
        aspectRatio,
        rotation
      })
      
      console.log(`📐 DIRECT PDF.js: Page ${pageNum} - ${width}x${height} (${orientation})`)
    }
    
    // Clean up
    await pdf.destroy()
    
    return {
      numPages,
      pages
    }
    
  } catch (error) {
    console.error('🚨 DIRECT PDF.js: Error getting all PDF page dimensions:', error)
    throw error
  }
}

/**
 * Compare React PDF vs Direct PDF.js dimensions for debugging
 */
export async function compareDimensionMethods(
  pdfUrl: string, 
  pageNumber: number = 1,
  reactPdfDimensions?: { width: number; height: number }
): Promise<{
  directPdf: PDFPageDimensions
  reactPdf?: { width: number; height: number; orientation: string }
  match: boolean
  recommendation: string
}> {
  try {
    const directDimensions = await getDirectPDFDimensions(pdfUrl, pageNumber)
    
    const result = {
      directPdf: directDimensions,
      reactPdf: reactPdfDimensions ? {
        width: reactPdfDimensions.width,
        height: reactPdfDimensions.height,
        orientation: reactPdfDimensions.width > reactPdfDimensions.height ? 'LANDSCAPE' : 'PORTRAIT'
      } : undefined,
      match: false,
      recommendation: ''
    }
    
    if (reactPdfDimensions) {
      result.match = (
        Math.abs(directDimensions.width - reactPdfDimensions.width) < 1 &&
        Math.abs(directDimensions.height - reactPdfDimensions.height) < 1
      )
      
      if (!result.match) {
        result.recommendation = `React PDF detected ${reactPdfDimensions.width}x${reactPdfDimensions.height} but direct PDF.js detected ${directDimensions.width}x${directDimensions.height}. Use direct PDF.js dimensions for accurate positioning.`
      } else {
        result.recommendation = 'Dimensions match - both methods are giving consistent results.'
      }
    } else {
      result.recommendation = 'Use direct PDF.js dimensions for most accurate results.'
    }
    
    console.log(`🔬 DIMENSION COMPARISON for page ${pageNumber}:`, result)
    
    return result
    
  } catch (error) {
    console.error('🚨 Error comparing dimension methods:', error)
    throw error
  }
}

/**
 * Validate if a PDF has consistent page dimensions (all pages same size)
 */
export async function validatePDFConsistency(pdfUrl: string): Promise<{
  isConsistent: boolean
  dimensions: PDFPageDimensions | null
  variations: Array<{ page: number; dimensions: PDFPageDimensions }>
}> {
  try {
    const docInfo = await getAllPDFPageDimensions(pdfUrl)
    
    if (docInfo.pages.size === 0) {
      return { isConsistent: false, dimensions: null, variations: [] }
    }
    
    const firstPageDimensions = docInfo.pages.get(1)!
    let isConsistent = true
    const variations: Array<{ page: number; dimensions: PDFPageDimensions }> = []
    
    for (const [pageNum, dimensions] of docInfo.pages) {
      if (
        Math.abs(dimensions.width - firstPageDimensions.width) > 1 ||
        Math.abs(dimensions.height - firstPageDimensions.height) > 1 ||
        dimensions.orientation !== firstPageDimensions.orientation
      ) {
        isConsistent = false
        variations.push({ page: pageNum, dimensions })
      }
    }
    
    console.log(`📊 PDF CONSISTENCY CHECK:`, {
      totalPages: docInfo.numPages,
      isConsistent,
      standardDimensions: firstPageDimensions,
      variationsFound: variations.length
    })
    
    return {
      isConsistent,
      dimensions: firstPageDimensions,
      variations
    }
    
  } catch (error) {
    console.error('🚨 Error validating PDF consistency:', error)
    throw error
  }
}
