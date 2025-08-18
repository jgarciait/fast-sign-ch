import { PDFDocument, degrees } from 'pdf-lib';
import { 
  calculateCenteredSignaturePlacement, 
  getEmbeddedImageDimensions, 
  validateSignaturePlacement,
  applyMinimumSizeConstraints,
  type SignatureBox 
} from './signature-aspect-ratio';
import { flattenAndSignPDF, needsPageFlattening } from './pdf-page-flattening';
import { calculateWacomSignatureDimensions } from './wacom-signature-processor';
import { logSignatureCoordinateDebug } from './debug-signature-coordinates';

/**
 * OFFICIAL PDF-LIB IMPLEMENTATION
 * Based on: https://pdf-lib.js.org/docs/api/classes/pdfpage#drawimage
 * 
 * This follows the exact pattern from pdf-lib documentation for handling
 * rotated pages and signature placement WITH ASPECT RATIO PRESERVATION.
 */

export interface SignatureData {
  id: string;
  page: number;
  x: number;           // UI coordinates (top-left origin)
  y: number;           // UI coordinates (top-left origin)
  width: number;       // Signature width in UI
  height: number;      // Signature height in UI
  imageData: string;   // Base64 data URL
  source: string;      // 'canvas' | 'wacom'
  content?: string;    // Signature index number (e.g., "1", "2", "3")
}

/**
 * UNIFIED PDF SIGNATURE PLACEMENT USING PAGE FLATTENING
 * 
 * This implementation fixes scanned PDF signature placement by using page flattening,
 * the proven industry-standard solution. All PDFs are normalized to have rotation=0°
 * before signature placement, eliminating coordinate transformation issues.
 * 
 * No conditional logic - works identically for both normal and scanned PDFs.
 */
export async function applySignaturesToPDF(
  existingPdfBytes: ArrayBuffer,
  signatures: SignatureData[]
): Promise<Uint8Array> {
  
  console.log('🚀 Starting unified PDF signature placement...')
  
  // Check if PDF needs flattening (has rotation metadata)
  const pdfDoc = await PDFDocument.load(existingPdfBytes)
  const needsFlattening = needsPageFlattening(pdfDoc)
  
  console.log('📄 PDF Analysis:', {
    totalPages: pdfDoc.getPageCount(),
    needsFlattening,
    signaturesCount: signatures.length,
    strategy: needsFlattening ? 'FLATTEN_AND_SIGN' : 'DIRECT_SIGN'
  })
  
  if (needsFlattening) {
    // Use flattening approach for PDFs with rotation metadata (fixes scanned PDFs)
    console.log('🔄 Using page flattening approach - normalizing rotation metadata...')
    
    const result = await flattenAndSignPDF(existingPdfBytes, signatures.map(sig => ({
      page: sig.page,
      x: sig.x,
      y: sig.y,
      width: sig.width,
      height: sig.height,
      imageData: sig.imageData,
      source: sig.source || 'canvas'  // Include source information for Wacom handling
    })))
    
    console.log('✅ Page flattening complete:', {
      wasFlattened: result.wasFlattened,
      pagesProcessed: result.pagesProcessed,
      approach: 'UNIFIED - All pages normalized to rotation=0°'
    })
    
    return result.signedPdfBytes
  } else {
    // Direct approach for PDFs without rotation issues (normal PDFs)
    console.log('📝 Using direct approach - PDF has no rotation metadata issues...')
    
    for (const signature of signatures) {
      try {
        const page = pdfDoc.getPage(signature.page - 1)
        const { width: pageWidth, height: pageHeight } = page.getSize()
        
        console.log('📍 Processing signature:', {
          id: signature.id,
          page: signature.page,
          pageSize: `${pageWidth}x${pageHeight}`,
          coordinates: { x: signature.x, y: signature.y, width: signature.width, height: signature.height },
          approach: 'DIRECT - No rotation to handle'
        })
        
        // Simple coordinate transformation: UI top-left to PDF bottom-left
        const pdfX = signature.x
        const pdfY = pageHeight - signature.y - signature.height
        
        console.log(`📍 Coordinate transform: UI(${signature.x},${signature.y}) → PDF(${pdfX},${pdfY})`)
        
        // Embed signature image
        const base64Data = signature.imageData.split(',')[1]
        const signatureBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
        const sigImage = signature.imageData.includes('image/png') 
          ? await pdfDoc.embedPng(signatureBytes)
          : await pdfDoc.embedJpg(signatureBytes)
        
        // Apply enhanced aspect ratio preservation with special Wacom handling
        const imageInfo = getEmbeddedImageDimensions(sigImage)
        let targetBox: SignatureBox = {
          x: pdfX,
          y: pdfY,
          width: signature.width,
          height: signature.height
        }
        
        // Special handling for Wacom signatures in direct approach
        const isWacomSignature = signature.source === 'wacom'
        if (isWacomSignature) {
          console.log(`🖊️ Direct approach: Applying enhanced Wacom signature handling`)
          
          // Use the existing Wacom dimension calculation for consistency
          const { width: adjustedWidth, height: adjustedHeight, adjusted } = calculateWacomSignatureDimensions(
            imageInfo.width,
            imageInfo.height,
            signature.width,
            signature.height,
            pageWidth,
            pageHeight,
            signature.x,
            signature.y
          )
          
          if (adjusted) {
            // Center the adjusted Wacom signature within the original box
            const xOffset = (signature.width - adjustedWidth) / 2
            const yOffset = (signature.height - adjustedHeight) / 2
            
            targetBox = {
              x: pdfX + xOffset,
              y: pdfY + yOffset,
              width: adjustedWidth,
              height: adjustedHeight
            }
            
            console.log(`🖊️ Wacom signature adjusted and centered in direct approach:`, {
              originalBox: { width: signature.width, height: signature.height },
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
          console.error(`❌ Invalid signature placement for ${signature.id}:`, finalPlacement)
          continue
        }
        
        // Draw signature with no rotation (page already has rotation=0°)
        page.drawImage(sigImage, {
          x: finalPlacement.x,
          y: finalPlacement.y,
          width: finalPlacement.width,
          height: finalPlacement.height,
          rotate: degrees(0) // Always 0° for non-rotated pages
        })
        
        console.log(`✅ Signature applied: ${signature.id} at (${finalPlacement.x},${finalPlacement.y})`)
        
      } catch (error) {
        console.error(`❌ Error placing signature ${signature.id}:`, error)
      }
    }
    
    console.log('✅ Direct signature placement complete')
    return await pdfDoc.save()
  }
}

/**
 * Extract signature data from frontend state when user clicks "guardar documento"
 */
export function extractSignatureDataFromState(signatures: any[]): SignatureData[] {
  return signatures.map(sig => ({
    id: sig.id,
    page: sig.page || 1,
    x: sig.x || 0,
    y: sig.y || 0,
    width: sig.width || 150,
    height: sig.height || 75,
    imageData: sig.imageData || sig.dataUrl || '',
    source: sig.source || sig.signatureSource || 'canvas',
    content: sig.content // Include content field for signature indexing
  }));
}
