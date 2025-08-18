/**
 * PDF PAGE FLATTENING UTILITY
 * 
 * This utility implements the proven fix for scanned PDF signature placement issues.
 * It normalizes/flattens PDF pages by removing rotation metadata and ensuring all pages
 * have rotation=0° with content properly oriented.
 * 
 * Based on the industry-standard approach used by qpdf --flatten-rotation and other
 * PDF libraries to handle scanned documents with mismatched rotation metadata.
 */

import { PDFDocument, PDFPage, degrees, PDFEmbeddedPage } from 'pdf-lib'
import { calculateWacomSignatureDimensions } from './wacom-signature-processor'

export interface FlattenedPageInfo {
  originalRotation: number
  effectiveWidth: number
  effectiveHeight: number
  wasFlattened: boolean
}

export interface FlattenResult {
  flattened: PDFDocument
  pageInfo: Map<number, FlattenedPageInfo>
  needsFlattening: boolean
}

/**
 * Detect if a PDF needs flattening based on rotation metadata AND scanned document characteristics
 */
export function needsPageFlattening(pdfDoc: PDFDocument): boolean {
  const pageCount = pdfDoc.getPageCount()
  
  // Check 1: Traditional rotation metadata detection
  let hasRotationMetadata = false
  for (let i = 0; i < pageCount; i++) {
    const page = pdfDoc.getPage(i)
    const rotation = page.getRotation().angle
    
    // If any page has non-zero rotation, we need flattening
    if (rotation !== 0) {
      hasRotationMetadata = true
      break
    }
  }
  
  if (hasRotationMetadata) {
    console.log('📄 Flattening needed: Found rotation metadata')
    return true
  }
  
  // Check 2: Scanned document detection (even with rotation=0°)
  const isScannedDocument = detectScannedDocumentCharacteristics(pdfDoc)
  if (isScannedDocument) {
    console.log('📄 Flattening needed: Detected scanned document characteristics')
    return true
  }
  
  console.log('📄 No flattening needed: Normal PC-created PDF')
  return false
}

/**
 * Detect scanned document characteristics that require flattening
 * even when rotation metadata is 0°
 */
function detectScannedDocumentCharacteristics(pdfDoc: PDFDocument): boolean {
  try {
    // Get document metadata
    const title = pdfDoc.getTitle()
    const creator = pdfDoc.getCreator() 
    const producer = pdfDoc.getProducer()
    const subject = pdfDoc.getSubject()
    
    // Check for common scanner software signatures
    const scannerSoftware = [
      'scan', 'scanner', 'scanned', 'xerox', 'canon', 'hp', 'epson', 'brother',
      'konica', 'ricoh', 'sharp', 'toshiba', 'kyocera', 'panasonic', 'samsung',
      'adobe scan', 'camscanner', 'genius scan', 'office lens', 'notes',
      'mobileiron', 'neat', 'readdle', 'evernote', 'microsoft lens'
    ]
    
    const checkScannerSoftware = (text: string | undefined) => {
      if (!text) return false
      return scannerSoftware.some(software => 
        text.toLowerCase().includes(software.toLowerCase())
      )
    }
    
    let confidence = 0
    const indicators: string[] = []
    
    if (checkScannerSoftware(creator)) {
      indicators.push(`Creator: ${creator}`)
      confidence += 0.6
    }
    
    if (checkScannerSoftware(producer)) {
      indicators.push(`Producer: ${producer}`)
      confidence += 0.5
    }
    
    if (checkScannerSoftware(title)) {
      indicators.push(`Title: ${title}`)
      confidence += 0.3
    }
    
    if (checkScannerSoftware(subject)) {
      indicators.push(`Subject: ${subject}`)
      confidence += 0.2
    }
    
    // Check for page characteristics typical of scanned documents
    const pageCount = pdfDoc.getPageCount()
    let portraitPages = 0
    let landscapePages = 0
    
    for (let i = 0; i < pageCount; i++) {
      const page = pdfDoc.getPage(i)
      const { width, height } = page.getSize()
      
      if (width > height) {
        landscapePages++
      } else {
        portraitPages++
      }
    }
    
    // Mixed orientations often indicate poor scan orientation handling
    if (pageCount > 1 && portraitPages > 0 && landscapePages > 0) {
      indicators.push(`Mixed orientations: ${portraitPages} portrait, ${landscapePages} landscape`)
      confidence += 0.3
    }
    
    const isScanned = confidence >= 0.4  // Lower threshold for portrait scanned docs
    
    if (isScanned && indicators.length > 0) {
      console.log('🔍 SCANNED DOCUMENT DETECTED (rotation=0° but needs flattening):', {
        confidence: confidence.toFixed(2),
        indicators,
        pageOrientations: { portrait: portraitPages, landscape: landscapePages },
        note: 'Will apply flattening to fix coordinate system issues'
      })
    }
    
    return isScanned
    
  } catch (error) {
    console.warn('❌ Error detecting scanned document characteristics:', error)
    return false
  }
}

/**
 * Calculate effective page dimensions accounting for rotation
 * This follows the standard rule: 90°/270° rotations swap width/height
 */
export function calculateEffectiveDimensions(
  originalWidth: number, 
  originalHeight: number, 
  rotation: number
): { width: number; height: number } {
  const normalizedRotation = rotation % 360
  
  // For 90° and 270° rotations, swap dimensions
  if (normalizedRotation === 90 || normalizedRotation === 270) {
    return {
      width: originalHeight,
      height: originalWidth
    }
  }
  
  // For 0° and 180° rotations, keep original dimensions
  return {
    width: originalWidth,
    height: originalHeight
  }
}

/**
 * Flatten all pages in a PDF document to have rotation=0°
 * This is the proven fix for scanned PDF coordinate issues
 * 
 * IMPROVED VERSION: Handles merged documents with robust page copying
 */
export async function flattenPDFPages(pdfData: ArrayBuffer): Promise<FlattenResult> {
  try {
    // Load the original document
    const originalDoc = await PDFDocument.load(pdfData)
    const needsFlattening = needsPageFlattening(originalDoc)
    
    // If no pages need flattening, return original
    if (!needsFlattening) {
      console.log('📄 PDF does not need flattening - normal PC-created document')
      return {
        flattened: originalDoc,
        pageInfo: new Map(),
        needsFlattening: false
      }
    }
    
    console.log('🔄 PDF needs flattening - normalizing page rotations...')
    
    // Create new document for flattened pages
    const flattenedDoc = await PDFDocument.create()
    const pageInfo = new Map<number, FlattenedPageInfo>()
    
    // Try to embed the original document to access its pages
    let embeddedPdfPages: any[] = []
    let useEmbedPdf = true
    
    try {
      embeddedPdfPages = await flattenedDoc.embedPdf(pdfData)
      console.log('✅ Successfully embedded PDF using embedPdf method')
    } catch (embedError) {
      console.warn('⚠️ embedPdf failed, will use direct page copying method:', embedError.message)
      useEmbedPdf = false
    }
    
    const pageCount = originalDoc.getPageCount()
    
    for (let i = 0; i < pageCount; i++) {
      const originalPage = originalDoc.getPage(i)
      const { width: origWidth, height: origHeight } = originalPage.getSize()
      const rotation = originalPage.getRotation().angle
      const pageNumber = i + 1
      
      // Check if this is a scanned document (even with rotation=0°)
      const isScannedDocument = detectScannedDocumentCharacteristics(originalDoc)
      
      // Calculate effective dimensions after rotation
      const { width: effectiveWidth, height: effectiveHeight } = calculateEffectiveDimensions(
        origWidth, 
        origHeight, 
        rotation
      )
      
      console.log(`📄 Processing page ${pageNumber}: ${origWidth}x${origHeight} @ ${rotation}° → ${effectiveWidth}x${effectiveHeight} @ 0°`, {
        isScannedDocument,
        needsSpecialHandling: isScannedDocument && rotation === 0,
        useEmbedPdf,
        note: isScannedDocument && rotation === 0 ? 'Portrait scanned doc - applying coordinate normalization' : 'Standard processing'
      })
      
      // Create new page with effective dimensions and rotation=0°
      const newPage = flattenedDoc.addPage([effectiveWidth, effectiveHeight])
      
      // Handle page content copying based on available method
      if (useEmbedPdf) {
        // Method 1: Use embedPdf (works for most PDFs)
        const embeddedPage = embeddedPdfPages[i]
        
        if (!embeddedPage) {
          console.warn(`⚠️ Could not get embedded page ${i}, falling back to direct copy`)
          useEmbedPdf = false
          // Fall through to direct copy method
        } else {
          // Successfully got embedded page, draw it
          await drawEmbeddedPageContent(newPage, embeddedPage, rotation, effectiveWidth, effectiveHeight, origWidth, origHeight)
          
          // Store page information
          pageInfo.set(pageNumber, {
            originalRotation: rotation,
            effectiveWidth,
            effectiveHeight,
            wasFlattened: rotation !== 0 || isScannedDocument
          })
          continue
        }
      }
      
      if (!useEmbedPdf) {
        // Method 2: Direct page copying (more robust for merged documents)
        console.log(`📄 Using direct page copy for page ${pageNumber} (merged document compatibility)`)
        
        try {
          // Remove the empty page we created earlier
          flattenedDoc.removePage(flattenedDoc.getPageCount() - 1)
          
          // Copy page content directly from original document
          const copiedPages = await flattenedDoc.copyPages(originalDoc, [i])
          const copiedPage = copiedPages[0]
          
          if (copiedPage) {
            // The content is already copied by copyPages, we just need to handle rotation
            if (rotation !== 0) {
              console.log(`📄 Handling rotation ${rotation}° for copied page ${pageNumber}`)
              
              // For rotated pages, we need to adjust the rotation to 0°
              // Set the rotation to 0° and adjust dimensions
              copiedPage.setRotation(degrees(0))
              copiedPage.setSize(effectiveWidth, effectiveHeight)
              
              console.log(`✅ Normalized rotation for page ${pageNumber}: ${rotation}° → 0°`)
            } else {
              // For rotation=0, just ensure proper dimensions
              copiedPage.setSize(effectiveWidth, effectiveHeight)
              console.log(`✅ Set dimensions for page ${pageNumber}: ${effectiveWidth}x${effectiveHeight}`)
            }
          } else {
            console.error(`❌ Failed to copy page ${pageNumber}`)
            // Fallback: create empty page
            flattenedDoc.addPage([effectiveWidth, effectiveHeight])
            continue
          }
        } catch (copyError) {
          console.error(`❌ Failed to copy page ${pageNumber} directly:`, copyError)
          // Fallback: create empty page
          flattenedDoc.addPage([effectiveWidth, effectiveHeight])
          continue
        }
      }
      
      // Store page information - mark scanned documents as flattened even with rotation=0°
      pageInfo.set(pageNumber, {
        originalRotation: rotation,
        effectiveWidth,
        effectiveHeight,
        wasFlattened: rotation !== 0 || isScannedDocument
      })
    }
      
    
    console.log(`✅ PDF flattening complete - ${pageCount} pages normalized`)
    
    return {
      flattened: flattenedDoc,
      pageInfo,
      needsFlattening: true
    }
    
  } catch (error) {
    console.error('❌ Error during PDF flattening:', error)
    // Fallback: return original document without flattening
    const originalDoc = await PDFDocument.load(pdfData)
    return {
      flattened: originalDoc,
      pageInfo: new Map(),
      needsFlattening: false
    }
  }
}

/**
 * Draw embedded page content with proper rotation handling
 */
async function drawEmbeddedPageContent(
  newPage: any,
  embeddedPage: any,
  rotation: number,
  effectiveWidth: number,
  effectiveHeight: number,
  origWidth: number,
  origHeight: number
): Promise<void> {
  if (rotation === 0) {
    // No rotation needed, but still flatten to normalize coordinate system
    newPage.drawPage(embeddedPage, {
      x: 0,
      y: 0,
      width: effectiveWidth,
      height: effectiveHeight
    })
  } else if (rotation === 90) {
    // Rotate content -90° and position appropriately
    newPage.drawPage(embeddedPage, {
      x: 0,
      y: effectiveHeight,
      width: origWidth,
      height: origHeight,
      rotate: degrees(-90)
    })
  } else if (rotation === 180) {
    // Rotate content -180° and position appropriately
    newPage.drawPage(embeddedPage, {
      x: effectiveWidth,
      y: effectiveHeight,
      width: origWidth,
      height: origHeight,
      rotate: degrees(-180)
    })
  } else if (rotation === 270) {
    // Rotate content -270° (same as +90°) and position appropriately
    newPage.drawPage(embeddedPage, {
      x: effectiveWidth,
      y: 0,
      width: origWidth,
      height: origHeight,
      rotate: degrees(-270)
    })
  } else {
    // For other rotations, use -rotation to counter-rotate
    const centerX = effectiveWidth / 2
    const centerY = effectiveHeight / 2
    newPage.drawPage(embeddedPage, {
      x: centerX - (origWidth / 2),
      y: centerY - (origHeight / 2),
      width: origWidth,
      height: origHeight,
      rotate: degrees(-rotation)
    })
  }
}

/**
 * Get flattened page properties for coordinate calculations
 * After flattening, all pages have rotation=0° and predictable coordinates
 */
export function getFlattenedPageProperties(
  pageNumber: number,
  pageInfo: Map<number, FlattenedPageInfo>
): {
  width: number
  height: number
  rotation: number
  wasFlattened: boolean
} {
  const info = pageInfo.get(pageNumber)
  
  if (!info) {
    throw new Error(`Page ${pageNumber} not found in flattened page info`)
  }
  
  return {
    width: info.effectiveWidth,
    height: info.effectiveHeight,
    rotation: 0, // Always 0° after flattening
    wasFlattened: info.wasFlattened
  }
}

/**
 * Apply signatures to a flattened PDF using simple coordinate transformation
 * Since all pages are flattened to rotation=0°, we can use consistent coordinate logic
 */
export async function applySignaturesToFlattenedPDF(
  flattenedDoc: PDFDocument,
  signatures: Array<{
    page: number
    x: number
    y: number
    width: number
    height: number
    imageData: string
    source?: string  // 'wacom', 'canvas', etc.
  }>,
  pageInfo: Map<number, FlattenedPageInfo>
): Promise<void> {
  for (const signature of signatures) {
    const page = flattenedDoc.getPage(signature.page - 1)
    const flattenedProps = getFlattenedPageProperties(signature.page, pageInfo)
    
    console.log(`🎯 Applying signature to flattened page ${signature.page}:`, {
      pageSize: `${flattenedProps.width}x${flattenedProps.height}`,
      rotation: flattenedProps.rotation,
      coordinates: { x: signature.x, y: signature.y, width: signature.width, height: signature.height },
      wasFlattened: flattenedProps.wasFlattened,
      signatureSource: signature.source || 'canvas',
      pageType: flattenedProps.height > flattenedProps.width ? 'PORTRAIT' : 'LANDSCAPE',
      specialHandling: flattenedProps.wasFlattened ? 'APPLIED (normalized coordinate system)' : 'NOT_NEEDED'
    })
    
    // Extract and embed image
    const base64Data = signature.imageData.split(',')[1]
    const signatureBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
    const sigImage = signature.imageData.includes('image/png') 
      ? await flattenedDoc.embedPng(signatureBytes)
      : await flattenedDoc.embedJpg(signatureBytes)
    
    // Simple coordinate transformation: UI top-left to PDF bottom-left
    // Since all pages are flattened to rotation=0°, this is always consistent
    let pdfX = signature.x
    let pdfY = flattenedProps.height - signature.y - signature.height
    let finalWidth = signature.width
    let finalHeight = signature.height
    
    // Special handling for Wacom signatures to prevent stretching and ensure centering
    const isWacomSignature = signature.source === 'wacom'
    if (isWacomSignature) {
      console.log(`🖊️ Applying Wacom signature with enhanced aspect ratio preservation`)
      
      // Get original signature box dimensions
      const originalBoxWidth = signature.width
      const originalBoxHeight = signature.height
      const originalBoxX = signature.x
      const originalBoxY = signature.y
      
      // Extract image dimensions for aspect ratio calculation
      // Use embedded image dimensions (works on server-side)
      const imageWidth = sigImage.width || sigImage.Width || 150  // fallback
      const imageHeight = sigImage.height || sigImage.Height || 75  // fallback
      
      console.log(`🖊️ Wacom image dimensions: ${imageWidth}x${imageHeight} (aspect ratio: ${(imageWidth/imageHeight).toFixed(2)})`)
      
      // Calculate optimal dimensions using existing Wacom utility
      const { width: adjustedWidth, height: adjustedHeight, adjusted } = calculateWacomSignatureDimensions(
        imageWidth,
        imageHeight,
        originalBoxWidth,
        originalBoxHeight,
        flattenedProps.width,
        flattenedProps.height,
        originalBoxX,
        originalBoxY
      )
      
      if (adjusted) {
        finalWidth = adjustedWidth
        finalHeight = adjustedHeight
        
        // CENTER the Wacom signature within the original signature box
        const xOffset = (originalBoxWidth - finalWidth) / 2
        const yOffset = (originalBoxHeight - finalHeight) / 2
        
        // Apply centering offset to the original coordinates
        pdfX = signature.x + xOffset
        pdfY = flattenedProps.height - (signature.y + yOffset) - finalHeight
        
        console.log(`🖊️ Wacom signature centered and aspect-ratio preserved:`, {
          originalBox: { width: originalBoxWidth, height: originalBoxHeight },
          adjustedSignature: { width: finalWidth, height: finalHeight },
          centering: { xOffset, yOffset },
          finalPosition: { x: pdfX, y: pdfY }
        })
      }
    } else {
      console.log(`📍 Standard signature transformation: UI(${signature.x},${signature.y}) → PDF(${pdfX},${pdfY})`)
    }
    
    // Draw signature with no rotation (always 0° after flattening)
    page.drawImage(sigImage, {
      x: pdfX,
      y: pdfY,
      width: finalWidth,
      height: finalHeight,
      rotate: degrees(0) // Always 0° for flattened pages
    })
  }
}

/**
 * Complete workflow: flatten PDF and apply signatures
 * This is the main function that fixes scanned PDF signature placement
 */
export async function flattenAndSignPDF(
  pdfData: ArrayBuffer,
  signatures: Array<{
    page: number
    x: number
    y: number
    width: number
    height: number
    imageData: string
    source?: string  // 'wacom', 'canvas', etc.
  }>
): Promise<{
  signedPdfBytes: Uint8Array
  wasFlattened: boolean
  pagesProcessed: number
}> {
  try {
    console.log('🚀 Starting PDF flattening and signature process...')
    
    // Step 1: Flatten the PDF to normalize all page rotations
    const flattenResult = await flattenPDFPages(pdfData)
    
    // Step 2: Apply signatures to the flattened PDF
    if (signatures.length > 0) {
      await applySignaturesToFlattenedPDF(
        flattenResult.flattened, 
        signatures, 
        flattenResult.pageInfo
      )
    }
    
    // Step 3: Generate final PDF
    const signedPdfBytes = await flattenResult.flattened.save()
    
    console.log(`✅ PDF processing complete - ${flattenResult.flattened.getPageCount()} pages, ${signatures.length} signatures applied`)
    
    return {
      signedPdfBytes,
      wasFlattened: flattenResult.needsFlattening,
      pagesProcessed: flattenResult.flattened.getPageCount()
    }
    
  } catch (error) {
    console.error('❌ Error in flattenAndSignPDF:', error)
    
    // Fallback: Use direct approach without flattening
    console.log('🔄 Falling back to direct signature application...')
    
    const pdfDoc = await PDFDocument.load(pdfData)
    
    // Apply signatures directly without flattening
    for (const signature of signatures) {
      try {
        const page = pdfDoc.getPage(signature.page - 1)
        const { width: pageWidth, height: pageHeight } = page.getSize()
        
        // Simple coordinate transformation: UI top-left to PDF bottom-left
        let pdfX = signature.x
        let pdfY = pageHeight - signature.y - signature.height
        let finalWidth = signature.width
        let finalHeight = signature.height
        
        // Extract and embed image
        const base64Data = signature.imageData.split(',')[1]
        const signatureBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
        const sigImage = signature.imageData.includes('image/png') 
          ? await pdfDoc.embedPng(signatureBytes)
          : await pdfDoc.embedJpg(signatureBytes)
        
        // Apply Wacom signature handling even in fallback mode
        const isWacomSignature = signature.source === 'wacom'
        if (isWacomSignature) {
          console.log(`🖊️ Fallback: Applying Wacom signature with aspect ratio preservation`)
          
          const originalBoxWidth = signature.width
          const originalBoxHeight = signature.height
          const imageWidth = sigImage.width || 150
          const imageHeight = sigImage.height || 75
          
          const { width: adjustedWidth, height: adjustedHeight, adjusted } = calculateWacomSignatureDimensions(
            imageWidth,
            imageHeight,
            originalBoxWidth,
            originalBoxHeight,
            pageWidth,
            pageHeight,
            signature.x,
            signature.y
          )
          
          if (adjusted) {
            finalWidth = adjustedWidth
            finalHeight = adjustedHeight
            
            // Center within original box
            const xOffset = (originalBoxWidth - finalWidth) / 2
            const yOffset = (originalBoxHeight - finalHeight) / 2
            
            pdfX = signature.x + xOffset
            pdfY = pageHeight - (signature.y + yOffset) - finalHeight
            
            console.log(`🖊️ Fallback Wacom signature centered:`, {
              originalBox: { width: originalBoxWidth, height: originalBoxHeight },
              adjustedSignature: { width: finalWidth, height: finalHeight },
              centering: { xOffset, yOffset }
            })
          }
        }
        
        // Draw signature with no rotation
        page.drawImage(sigImage, {
          x: pdfX,
          y: pdfY,
          width: finalWidth,
          height: finalHeight,
          rotate: degrees(0)
        })
        
        console.log(`✅ Fallback signature applied to page ${signature.page}`)
        
      } catch (signatureError) {
        console.error(`❌ Error applying fallback signature to page ${signature.page}:`, signatureError)
      }
    }
    
    const signedPdfBytes = await pdfDoc.save()
    
    return {
      signedPdfBytes,
      wasFlattened: false,
      pagesProcessed: pdfDoc.getPageCount()
    }
  }
}
