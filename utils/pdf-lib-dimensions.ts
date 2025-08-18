/**
 * PDF-LIB EXCLUSIVE DIMENSION AND ROTATION MANAGEMENT
 * 
 * This utility uses pdf-lib exclusively for all PDF dimension and rotation operations.
 * It provides the single source of truth for page properties across the entire system.
 * 
 * Key principles:
 * 1. pdf-lib provides: rotate, width, height for each page
 * 2. If rotate = 0 and width > height: display as landscape
 * 3. If rotate = 0 and height > width: display as portrait  
 * 4. If rotate ≠ 0: display rotated by the given degrees (regardless of aspect ratio)
 * 5. No hardcoded corrections or fallback logic
 */

import { PDFDocument, PDFPage } from 'pdf-lib'


export interface PDFPageProperties {
  /** Display width in points (what user sees) */
  width: number
  /** Display height in points (what user sees) */
  height: number
  /** Original PDF width before rotation */
  originalWidth: number
  /** Original PDF height before rotation */
  originalHeight: number
  /** Actual rotation angle in degrees (0, 90, 180, 270) */
  actualRotate: number
  /** Rotation angle in degrees (always 0 for compatibility) */
  rotate: number
  /** Page number (1-based) */
  pageNumber: number
  /** Calculated orientation based on width/height ratio when rotate = 0 */
  orientation: 'portrait' | 'landscape'
  /** Calculated aspect ratio */
  aspectRatio: number
  /** Whether this page was detected as part of a scanned document */
  isScannedDocument?: boolean
  /** Whether orientation correction was applied for scanned document */
  scannedOrientationCorrectionApplied?: boolean
}

export interface PDFDocumentProperties {
  /** Total number of pages */
  totalPages: number
  /** Properties for each page */
  pages: Map<number, PDFPageProperties>
}

/**
 * Load PDF document and extract page properties using pdf-lib exclusively
 */
export async function loadPDFProperties(pdfData: ArrayBuffer | Uint8Array | string): Promise<PDFDocumentProperties> {
  let arrayBuffer: ArrayBuffer

  // Convert input to ArrayBuffer
  if (typeof pdfData === 'string') {
    // Base64 string
    const binaryString = atob(pdfData.replace(/^data:application\/pdf;base64,/, ''))
    arrayBuffer = new ArrayBuffer(binaryString.length)
    const uint8Array = new Uint8Array(arrayBuffer)
    for (let i = 0; i < binaryString.length; i++) {
      uint8Array[i] = binaryString.charCodeAt(i)
    }
  } else if (pdfData instanceof Uint8Array) {
    arrayBuffer = pdfData.buffer instanceof ArrayBuffer 
      ? pdfData.buffer.slice(pdfData.byteOffset, pdfData.byteOffset + pdfData.byteLength)
      : new ArrayBuffer(pdfData.byteLength)
    if (!(pdfData.buffer instanceof ArrayBuffer)) {
      new Uint8Array(arrayBuffer).set(pdfData)
    }
  } else {
    arrayBuffer = pdfData
  }

  const pdfDoc = await PDFDocument.load(arrayBuffer)
  const totalPages = pdfDoc.getPageCount()
  const pages = new Map<number, PDFPageProperties>()

  // 🎯 UNIFIED APPROACH: Simple page processing without scanned document detection
  console.log('📄 Processing PDF with unified approach...')

  for (let i = 0; i < totalPages; i++) {
    const page = pdfDoc.getPage(i)
    const pageNumber = i + 1
    
    const properties = extractPageProperties(page, pageNumber)
    pages.set(pageNumber, properties)
  }

  return {
    totalPages,
    pages
  }
}

/**
 * Extract properties from a single PDF page using pdf-lib - UNIFIED VERSION
 */
export function extractPageProperties(page: PDFPage, pageNumber: number): PDFPageProperties {
  // Get raw dimensions and rotation from pdf-lib
  const { width: originalWidth, height: originalHeight } = page.getSize()
  const rotation = page.getRotation()
  const actualRotate = rotation.angle

  // 🚨 USE DISPLAY DIMENSIONS - Account for rotation to match what user sees
  let displayWidth: number, displayHeight: number
  
  if (actualRotate === 90 || actualRotate === 270) {
    // For 90° and 270° rotations, swap width and height to match display
    displayWidth = originalHeight
    displayHeight = originalWidth
  } else {
    // For 0° and 180° rotations, keep original dimensions
    displayWidth = originalWidth
    displayHeight = originalHeight
  }

  // 🎯 SIMPLIFIED APPROACH: Process all documents uniformly
  // Page flattening will handle any rotation issues at the application level
  const finalOrientation: 'portrait' | 'landscape' = displayWidth > displayHeight ? 'landscape' : 'portrait'
  const finalAspectRatio = displayWidth / displayHeight

  // 🎯 RETURN SIMPLIFIED PROPERTIES: All documents processed uniformly
  return {
    // DISPLAY VALUES: What the user sees
    width: displayWidth,
    height: displayHeight,
    actualRotate: actualRotate,
    orientation: finalOrientation,
    aspectRatio: finalAspectRatio,
    
    // ORIGINAL VALUES: From PDF-lib
    originalWidth,
    originalHeight,
    
    // COMPATIBILITY
    rotate: 0, // Keep as 0 for compatibility with old code
    pageNumber,
    
    // METADATA: Simplified
    isScannedDocument: false, // No longer detecting scanned documents
    scannedOrientationCorrectionApplied: false
  }
}

/**
 * Get properties for a specific page
 */
export async function getPageProperties(pdfData: ArrayBuffer | Uint8Array | string, pageNumber: number): Promise<PDFPageProperties> {
  const docProperties = await loadPDFProperties(pdfData)
  const pageProperties = docProperties.pages.get(pageNumber)
  
  if (!pageProperties) {
    throw new Error(`Page ${pageNumber} not found. Document has ${docProperties.totalPages} pages.`)
  }
  
  return pageProperties
}

/**
 * Load PDF from URL and extract properties
 */
export async function loadPDFPropertiesFromURL(url: string): Promise<PDFDocumentProperties> {

  
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`)
  }
  
  const arrayBuffer = await response.arrayBuffer()
  return loadPDFProperties(arrayBuffer)
}

/**
 * Get page properties from URL for a specific page
 */
export async function getPagePropertiesFromURL(url: string, pageNumber: number): Promise<PDFPageProperties> {
  const docProperties = await loadPDFPropertiesFromURL(url)
  const pageProperties = docProperties.pages.get(pageNumber)
  
  if (!pageProperties) {
    throw new Error(`Page ${pageNumber} not found. Document has ${docProperties.totalPages} pages.`)
  }
  
  return pageProperties
}

/**
 * Calculate display dimensions for a page at a given scale
 */
export function calculateDisplayDimensions(
  pageProperties: PDFPageProperties, 
  scale: number
): { width: number; height: number; rotate: number } {
  return {
    width: pageProperties.width * scale,
    height: pageProperties.height * scale,
    rotate: pageProperties.rotate
  }
}

/**
 * Convert screen coordinates to PDF coordinates
 * This handles the coordinate system transformation (screen top-left to PDF bottom-left)
 */
export function screenToPDFCoordinates(
  screenX: number,
  screenY: number,
  pageProperties: PDFPageProperties,
  scale: number
): { x: number; y: number } {
  // Convert from scaled screen coordinates to PDF coordinates
  const pdfX = screenX / scale
  const pdfY = pageProperties.height - (screenY / scale) // Flip Y coordinate
  
  return { x: pdfX, y: pdfY }
}

/**
 * Convert PDF coordinates to screen coordinates
 * This handles the coordinate system transformation (PDF bottom-left to screen top-left)
 */
export function pdfToScreenCoordinates(
  pdfX: number,
  pdfY: number,
  pageProperties: PDFPageProperties,
  scale: number
): { x: number; y: number } {
  // Convert from PDF coordinates to scaled screen coordinates
  const screenX = pdfX * scale
  const screenY = (pageProperties.height - pdfY) * scale // Flip Y coordinate
  
  return { x: screenX, y: screenY }
}

/**
 * Convert relative coordinates (0-1) to absolute PDF coordinates
 */
export function relativeToAbsoluteCoordinates(
  relativeX: number,
  relativeY: number,
  relativeWidth: number,
  relativeHeight: number,
  pageProperties: PDFPageProperties
): { x: number; y: number; width: number; height: number } {
  return {
    x: relativeX * pageProperties.width,
    y: relativeY * pageProperties.height,
    width: relativeWidth * pageProperties.width,
    height: relativeHeight * pageProperties.height
  }
}

/**
 * Convert absolute PDF coordinates to relative coordinates (0-1)
 */
export function absoluteToRelativeCoordinates(
  x: number,
  y: number,
  width: number,
  height: number,
  pageProperties: PDFPageProperties
): { relativeX: number; relativeY: number; relativeWidth: number; relativeHeight: number } {
  return {
    relativeX: x / pageProperties.width,
    relativeY: y / pageProperties.height,
    relativeWidth: width / pageProperties.width,
    relativeHeight: height / pageProperties.height
  }
}

/**
 * Validate if page properties are consistent across the document
 */
export function validateDocumentConsistency(docProperties: PDFDocumentProperties): {
  isConsistent: boolean
  variations: Array<{ pageNumber: number; properties: PDFPageProperties }>
} {
  if (docProperties.pages.size === 0) {
    return { isConsistent: true, variations: [] }
  }

  const firstPage = docProperties.pages.get(1)!
  const variations: Array<{ pageNumber: number; properties: PDFPageProperties }> = []
  let isConsistent = true

  for (const [pageNumber, properties] of docProperties.pages) {
    if (
      Math.abs(properties.width - firstPage.width) > 1 ||
      Math.abs(properties.height - firstPage.height) > 1 ||
      properties.rotate !== firstPage.rotate
    ) {
      isConsistent = false
      variations.push({ pageNumber, properties })
    }
  }

  return { isConsistent, variations }
}

/**
 * Create a cache for PDF properties to avoid re-parsing the same document
 */
class PDFPropertiesCache {
  private cache = new Map<string, PDFDocumentProperties>()
  
  private generateKey(url: string): string {
    return url
  }
  
  async get(url: string): Promise<PDFDocumentProperties> {
    const key = this.generateKey(url)
    
    if (this.cache.has(key)) {

      return this.cache.get(key)!
    }
    

    const properties = await loadPDFPropertiesFromURL(url)
    this.cache.set(key, properties)
    
    return properties
  }
  
  clear(): void {
    this.cache.clear()
  }
  
  delete(url: string): void {
    const key = this.generateKey(url)
    this.cache.delete(key)
  }
}

export const pdfPropertiesCache = new PDFPropertiesCache()
