/**
 * PDF MERGE AND SIGNATURE PLACEMENT UTILITY
 * 
 * This utility handles PDF merging and signature placement using pdf-lib exclusively.
 * It ensures consistent handling of dimensions, rotation, and signature positioning.
 */

import { PDFDocument, PDFPage, degrees } from 'pdf-lib'
import { 
  SignatureCoordinates, 
  createSignatureFromRelative,
  validateSignatureCoordinates,
  constrainSignatureToPage,
  formatSignatureForMerge
} from './signature-coordinates'
import { 
  calculateCenteredSignaturePlacement, 
  getEmbeddedImageDimensions, 
  validateSignaturePlacement,
  applyMinimumSizeConstraints,
  type SignatureBox 
} from '@/utils/signature-aspect-ratio'
import { calculateWacomSignatureDimensions } from '@/utils/wacom-signature-processor'
import { flattenAndSignPDF, needsPageFlattening } from './pdf-page-flattening'
import { logSignatureCoordinateDebug } from './debug-signature-coordinates'

export interface MergeSignature {
  /** Signature image data (base64 or data URL) */
  imageData: string
  /** Signature coordinates */
  coordinates: SignatureCoordinates
  /** Signature source (canvas, wacom, etc.) */
  source?: string
  /** Unique signature identifier */
  id?: string
}

export interface MergeOptions {
  /** Whether to compress the output PDF */
  compress?: boolean
  /** Quality for JPEG compression (0-1) */
  jpegQuality?: number
  /** Whether to preserve form fields */
  preserveForms?: boolean
}

export interface MergeResult {
  /** Success status */
  success: boolean
  /** Merged PDF as ArrayBuffer */
  pdfData?: ArrayBuffer
  /** Base64 encoded PDF */
  base64Data?: string
  /** Data URL for immediate use */
  dataUrl?: string
  /** Error message if failed */
  error?: string
  /** Processing statistics */
  stats?: {
    originalSize: number
    finalSize: number
    compressionRatio: number
    signaturesApplied: number
    pagesProcessed: number
  }
}

/**
 * Merge signatures into a PDF document using unified flattening approach
 * This eliminates scanned PDF coordinate issues by normalizing all pages to rotation=0°
 */
export async function mergePDFWithSignatures(
  pdfData: ArrayBuffer | Uint8Array | string,
  signatures: MergeSignature[],
  options: MergeOptions = {}
): Promise<MergeResult> {
  try {
    console.log('🚀 Starting unified PDF merge with signatures...')
    
    // Convert pdfData to ArrayBuffer if needed
    let arrayBuffer: ArrayBuffer
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

    const originalSize = arrayBuffer.byteLength
    
    // Check if PDF needs flattening
    const pdfDoc = await PDFDocument.load(arrayBuffer)
    const needsFlattening = needsPageFlattening(pdfDoc)
    
    console.log('📄 PDF Merge Analysis:', {
      totalPages: pdfDoc.getPageCount(),
      needsFlattening,
      signaturesCount: signatures.length,
      strategy: needsFlattening ? 'FLATTEN_AND_MERGE' : 'DIRECT_MERGE'
    })

    let finalPdfBytes: Uint8Array
    let signaturesApplied = signatures.length
    
    if (needsFlattening) {
      // Use flattening approach for PDFs with rotation metadata
      console.log('🔄 Using page flattening approach for merge...')
      
      const flattenSignatures = signatures.map(sig => ({
        page: sig.coordinates.page,
        x: sig.coordinates.x,
        y: sig.coordinates.y,
        width: sig.coordinates.width,
        height: sig.coordinates.height,
        imageData: sig.imageData,
        source: sig.source || 'canvas'  // Include source information for Wacom handling
      }))
      
      const result = await flattenAndSignPDF(arrayBuffer, flattenSignatures)
      finalPdfBytes = result.signedPdfBytes
      
      console.log('✅ Flattened merge complete:', {
        wasFlattened: result.wasFlattened,
        pagesProcessed: result.pagesProcessed,
        signaturesApplied
      })
      
    } else {
      // Direct merge for PDFs without rotation issues
      console.log('📝 Using direct merge approach...')
      
      for (const signature of signatures) {
        try {
          await applySignatureDirectly(pdfDoc, signature)
        } catch (error) {
          console.error(`❌ Failed to apply signature ${signature.id || 'unknown'}:`, error)
          signaturesApplied--
        }
      }
      
      finalPdfBytes = await pdfDoc.save()
      console.log('✅ Direct merge complete')
    }

    const finalSize = finalPdfBytes.length
    const compressionRatio = originalSize > 0 ? finalSize / originalSize : 1

    // Convert to different formats
    const base64Data = Buffer.from(finalPdfBytes).toString('base64')
    const dataUrl = `data:application/pdf;base64,${base64Data}`

    return {
      success: true,
      pdfData: finalPdfBytes.buffer instanceof ArrayBuffer ? finalPdfBytes.buffer : new ArrayBuffer(finalPdfBytes.byteLength),
      base64Data,
      dataUrl,
      stats: {
        originalSize,
        finalSize,
        compressionRatio,
        signaturesApplied,
        pagesProcessed: pdfDoc.getPageCount()
      }
    }
  } catch (error) {
    console.error(`❌ PDF-LIB MERGE: Merge failed:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown merge error'
    }
  }
}

/**
 * Apply signature directly to a PDF without flattening (for non-rotated PDFs)
 */
async function applySignatureDirectly(
  pdfDoc: PDFDocument,
  signature: MergeSignature
): Promise<void> {
  const pageIndex = signature.coordinates.page - 1
  if (pageIndex < 0 || pageIndex >= pdfDoc.getPageCount()) {
    throw new Error(`Page ${signature.coordinates.page} does not exist`)
  }

  const page = pdfDoc.getPage(pageIndex)
  const { width: pageWidth, height: pageHeight } = page.getSize()
  
  console.log('📍 Direct signature application:', {
    page: signature.coordinates.page,
    pageSize: `${pageWidth}x${pageHeight}`,
    coordinates: signature.coordinates,
    approach: 'DIRECT - No rotation metadata'
  })

  // Simple coordinate transformation: UI top-left to PDF bottom-left
  const pdfX = signature.coordinates.x
  const pdfY = pageHeight - signature.coordinates.y - signature.coordinates.height

  // Extract and embed image
  const base64 = signature.imageData.split(",")[1]
  if (!base64) throw new Error('Invalid image data')

  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
  const img = signature.imageData.includes('image/png') 
    ? await pdfDoc.embedPng(bytes) 
    : await pdfDoc.embedJpg(bytes)

  // Apply enhanced aspect ratio preservation with special Wacom handling
  const imageInfo = getEmbeddedImageDimensions(img)
  let targetBox: SignatureBox = {
    x: pdfX,
    y: pdfY,
    width: signature.coordinates.width,
    height: signature.coordinates.height
  }
  
  // Special handling for Wacom signatures in direct merge
  const isWacomSignature = signature.source === 'wacom'
  if (isWacomSignature) {
    console.log(`🖊️ Direct merge: Applying enhanced Wacom signature handling`)
    
    const { width: adjustedWidth, height: adjustedHeight, adjusted } = calculateWacomSignatureDimensions(
      imageInfo.width,
      imageInfo.height,
      signature.coordinates.width,
      signature.coordinates.height,
      pageWidth,
      pageHeight,
      signature.coordinates.x,
      signature.coordinates.y
    )
    
    if (adjusted) {
      // Center the adjusted Wacom signature within the original box
      const xOffset = (signature.coordinates.width - adjustedWidth) / 2
      const yOffset = (signature.coordinates.height - adjustedHeight) / 2
      
      targetBox = {
        x: pdfX + xOffset,
        y: pdfY + yOffset,
        width: adjustedWidth,
        height: adjustedHeight
      }
      
      console.log(`🖊️ Wacom signature adjusted and centered in direct merge:`, {
        originalBox: { width: signature.coordinates.width, height: signature.coordinates.height },
        adjustedBox: { width: adjustedWidth, height: adjustedHeight },
        centering: { xOffset, yOffset }
      })
    }
  }
  
  const centeredPlacement = calculateCenteredSignaturePlacement(
    imageInfo.width,
    imageInfo.height,
    targetBox
  )
  const finalPlacement = applyMinimumSizeConstraints(centeredPlacement, 20, 10)
  
  if (!validateSignaturePlacement(finalPlacement)) {
    throw new Error('Invalid signature placement')
  }

  // Draw signature with no rotation
  page.drawImage(img, {
    x: finalPlacement.x,
    y: finalPlacement.y,
    width: finalPlacement.width,
    height: finalPlacement.height,
    rotate: degrees(0)
  })

  console.log(`✅ Direct signature applied at (${finalPlacement.x},${finalPlacement.y})`)
}



/**
 * Create a merge signature from legacy signature data - UNIFIED VERSION
 */
export function createMergeSignatureFromLegacy(
  legacySignature: any
): MergeSignature | null {
  try {
    // Use absolute coordinates directly - flattening handles coordinate issues
    const coordinates = {
      x: legacySignature.x || 0,
      y: legacySignature.y || 0,
      width: legacySignature.width || 150,
      height: legacySignature.height || 75,
      page: legacySignature.page || 1,
      relativeX: legacySignature.relativeX || 0,
      relativeY: legacySignature.relativeY || 0,
      relativeWidth: legacySignature.relativeWidth || 0,
      relativeHeight: legacySignature.relativeHeight || 0
    }
    
    return {
      imageData: legacySignature.imageData || legacySignature.dataUrl,
      coordinates,
      source: legacySignature.source || legacySignature.signatureSource || 'canvas',
      id: legacySignature.id
    }
  } catch (error) {
    console.error(`❌ Error creating merge signature from legacy data:`, error)
    return null
  }
}

/**
 * Create a merge signature from relative coordinates - UNIFIED VERSION
 */
export function createMergeSignatureFromRelative(
  imageData: string,
  relativeX: number,
  relativeY: number,
  relativeWidth: number,
  relativeHeight: number,
  pageNumber: number,
  pageWidth: number,
  pageHeight: number,
  source?: string,
  id?: string
): MergeSignature {
  // Convert relative coordinates to absolute coordinates
  const coordinates = {
    x: relativeX * pageWidth,
    y: relativeY * pageHeight,
    width: relativeWidth * pageWidth,
    height: relativeHeight * pageHeight,
    page: pageNumber,
    relativeX,
    relativeY,
    relativeWidth,
    relativeHeight
  }

  return {
    imageData,
    coordinates,
    source,
    id
  }
}

/**
 * Batch process multiple PDFs with signatures
 */
export async function batchMergePDFsWithSignatures(
  pdfs: Array<{ pdfData: ArrayBuffer | Uint8Array | string; signatures: MergeSignature[] }>,
  options: MergeOptions = {}
): Promise<MergeResult[]> {
  const results: MergeResult[] = []
  
  for (let i = 0; i < pdfs.length; i++) {
    const pdf = pdfs[i]

    
    const result = await mergePDFWithSignatures(pdf.pdfData, pdf.signatures, options)
    results.push(result)
    
    if (!result.success) {
      console.error(`❌ PDF-LIB BATCH: Failed to process PDF ${i + 1}: ${result.error}`)
    }
  }
  

  
  return results
}

/**
 * Validate a list of signatures before merging - UNIFIED VERSION
 */
export function validateSignaturesForMerge(
  signatures: MergeSignature[],
  totalPages: number
): { valid: MergeSignature[]; invalid: Array<{ signature: MergeSignature; reason: string }> } {
  const valid: MergeSignature[] = []
  const invalid: Array<{ signature: MergeSignature; reason: string }> = []
  
  for (const signature of signatures) {
    // Check if page exists
    if (signature.coordinates.page < 1 || signature.coordinates.page > totalPages) {
      invalid.push({ signature, reason: `Page ${signature.coordinates.page} does not exist` })
      continue
    }
    
    // Check if coordinates are valid
    if (!validateSignatureCoordinates(signature.coordinates)) {
      invalid.push({ signature, reason: 'Invalid coordinates' })
      continue
    }
    
    // Check if image data exists
    if (!signature.imageData) {
      invalid.push({ signature, reason: 'Missing image data' })
      continue
    }
    
    valid.push(signature)
  }
  
  return { valid, invalid }
}

/**
 * Create a simple test signature for development - UNIFIED VERSION
 */
export function createTestSignature(
  pageNumber: number,
  pageWidth: number,
  pageHeight: number
): MergeSignature {
  // Create a simple signature in the center of the page
  const coordinates = {
    x: pageWidth * 0.4,      // 40% from left
    y: pageHeight * 0.4,     // 40% from top
    width: pageWidth * 0.2,  // 20% width
    height: pageHeight * 0.1, // 10% height
    page: pageNumber,
    relativeX: 0.4,
    relativeY: 0.4,
    relativeWidth: 0.2,
    relativeHeight: 0.1
  }
  
  // Create a simple test image (1x1 pixel PNG)
  const testImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
  
  return {
    imageData: testImageData,
    coordinates,
    source: 'test',
    id: `test-signature-page-${pageNumber}`
  }
}
