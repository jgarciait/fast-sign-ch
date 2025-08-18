/**
 * EMERGENCY DIMENSION CORRECTION UTILITY
 * Forces correct PDF dimensions when React PDF reports wrong values
 */

export interface CorrectedDimensions {
  width: number
  height: number
  wasCorreted: boolean
  originalWidth?: number
  originalHeight?: number
}

/**
 * UNIVERSAL FORCE CORRECTION for problematic PDF dimensions
 * Detects and corrects various patterns of incorrect dimension reporting
 */
export function forceCorrectDimensions(width: number, height: number): CorrectedDimensions {
  // PATTERN 1: Exact US Letter case (792x612 → 612x792)
  if (width === 792 && height === 612) {
    console.warn(`🚨 EMERGENCY CORRECTION: US Letter ${width}x${height} (LANDSCAPE) → 612x792 (PORTRAIT)`)
    return {
      width: 612,
      height: 792,
      wasCorreted: true,
      originalWidth: width,
      originalHeight: height
    }
  }
  
  // PATTERN 2: Close to US Letter with slight variations (common in scanned docs)
  if (isCloseToUSLetter(width, height) && width > height) {
    console.warn(`🚨 EMERGENCY CORRECTION: Near US Letter ${width}x${height} (LANDSCAPE) → 612x792 (PORTRAIT)`)
    return {
      width: 612,
      height: 792,
      wasCorreted: true,
      originalWidth: width,
      originalHeight: height
    }
  }
  
  // PATTERN 3: A4 dimensions incorrectly as landscape (595x842 → 595x842 is correct, but 842x595 → 595x842)
  if (width === 842 && height === 595) {
    console.warn(`🚨 EMERGENCY CORRECTION: A4 ${width}x${height} (LANDSCAPE) → 595x842 (PORTRAIT)`)
    return {
      width: 595,
      height: 842,
      wasCorreted: true,
      originalWidth: width,
      originalHeight: height
    }
  }
  
  // PATTERN 4: Close to A4 with variations (common in scanned docs)
  if (isCloseToA4(width, height) && width > height) {
    console.warn(`🚨 EMERGENCY CORRECTION: Near A4 ${width}x${height} (LANDSCAPE) → 595x842 (PORTRAIT)`)
    return {
      width: 595,
      height: 842,
      wasCorreted: true,
      originalWidth: width,
      originalHeight: height
    }
  }
  
  // PATTERN 5: Legal size (612x1008 correct, but 1008x612 → 612x1008)
  if (width === 1008 && height === 612) {
    console.warn(`🚨 EMERGENCY CORRECTION: Legal ${width}x${height} (LANDSCAPE) → 612x1008 (PORTRAIT)`)
    return {
      width: 612,
      height: 1008,
      wasCorreted: true,
      originalWidth: width,
      originalHeight: height
    }
  }
  
  // PATTERN 6: Generic check - if any standard page size is detected as landscape
  if (isStandardPageSizeLandscape(width, height)) {
    const corrected = flipToPortrait(width, height)
    console.warn(`🚨 EMERGENCY CORRECTION: Standard page ${width}x${height} (LANDSCAPE) → ${corrected.width}x${corrected.height} (PORTRAIT)`)
    return {
      width: corrected.width,
      height: corrected.height,
      wasCorreted: true,
      originalWidth: width,
      originalHeight: height
    }
  }
  
  // No correction needed
  return {
    width,
    height,
    wasCorreted: false
  }
}

/**
 * Check if dimensions are close to US Letter (allowing for scanning variations)
 */
function isCloseToUSLetter(width: number, height: number): boolean {
  const tolerance = 20 // Allow 20 point tolerance for scanning variations
  return (
    Math.abs(width - 792) <= tolerance && Math.abs(height - 612) <= tolerance
  ) || (
    Math.abs(width - 612) <= tolerance && Math.abs(height - 792) <= tolerance
  )
}

/**
 * Check if dimensions are close to A4 (allowing for scanning variations)
 */
function isCloseToA4(width: number, height: number): boolean {
  const tolerance = 20 // Allow 20 point tolerance for scanning variations
  return (
    Math.abs(width - 842) <= tolerance && Math.abs(height - 595) <= tolerance
  ) || (
    Math.abs(width - 595) <= tolerance && Math.abs(height - 842) <= tolerance
  )
}

/**
 * Check if this looks like a standard page size that's incorrectly landscape
 */
function isStandardPageSizeLandscape(width: number, height: number): boolean {
  const standardSizes = [
    { w: 612, h: 792 },   // US Letter
    { w: 595, h: 842 },   // A4
    { w: 612, h: 1008 },  // US Legal
    { w: 420, h: 595 },   // A5
    { w: 612, h: 936 },   // US Executive
  ]
  
  const tolerance = 30
  
  for (const size of standardSizes) {
    // Check if current dimensions are this standard size but flipped to landscape
    if (
      Math.abs(width - size.h) <= tolerance && 
      Math.abs(height - size.w) <= tolerance &&
      width > height // Currently landscape
    ) {
      return true
    }
  }
  
  return false
}

/**
 * Flip dimensions from landscape to portrait
 */
function flipToPortrait(width: number, height: number): { width: number; height: number } {
  return { width: height, height: width }
}

/**
 * Apply dimension correction to pageInfo objects
 * UPDATED: Now uses intelligent scanned document detection instead of hardcoded rules
 */
export function correctPageInfo(pageInfo: any): any {
  if (!pageInfo) return pageInfo
  
  const originalWidth = pageInfo.originalWidth || pageInfo.width
  const originalHeight = pageInfo.originalHeight || pageInfo.height
  
  if (!originalWidth || !originalHeight) return pageInfo
  
  // 🎯 UNIFIED PROCESSING: Use normalized PDF-lib properties for ALL documents
  if (pageInfo.pdfLibProperties) {
    const pdfLibProps = pageInfo.pdfLibProperties
    
    // Use the normalized dimensions from pdf-lib-dimensions.ts (same for all documents)
    return {
      ...pageInfo,
      width: pdfLibProps.width,        // Normalized width (same logic for all docs)
      height: pdfLibProps.height,      // Normalized height (same logic for all docs)
      originalWidth: pdfLibProps.originalWidth,
      originalHeight: pdfLibProps.originalHeight,
      correctionApplied: pdfLibProps.scannedOrientationCorrectionApplied || false,
      correctionType: 'pdf-lib-normalization',
      originalDimensions: { width: originalWidth, height: originalHeight }
    }
  }
  
  // 🔧 FALLBACK: Use old hardcoded correction system for non-scanned documents
  const correction = forceCorrectDimensions(originalWidth, originalHeight)
  
  if (correction.wasCorreted) {
    return {
      ...pageInfo,
      originalWidth: correction.width,
      originalHeight: correction.height,
      width: correction.width * (pageInfo.scale || 1),
      height: correction.height * (pageInfo.scale || 1),
      correctionApplied: true,
      originalDimensions: {
        width: correction.originalWidth,
        height: correction.originalHeight
      }
    }
  }
  
  return pageInfo
}

/**
 * Global interceptor for React PDF page load events
 */
export function interceptReactPdfPageLoad(originalHandler: (page: any) => void) {
  return (page: any) => {
    const correction = forceCorrectDimensions(page.width, page.height)
    
    if (correction.wasCorreted) {
      const correctedPage = {
        ...page,
        width: correction.width,
        height: correction.height,
        originalReactPdfDimensions: {
          width: correction.originalWidth,
          height: correction.originalHeight
        },
        correctionApplied: true
      }
      
      console.log(`🚨 INTERCEPTED React PDF page load and applied correction:`, {
        original: { width: correction.originalWidth, height: correction.originalHeight },
        corrected: { width: correction.width, height: correction.height }
      })
      
      return originalHandler(correctedPage)
    }
    
    return originalHandler(page)
  }
}

/**
 * Detect if dimensions look like they need correction
 */
export function needsDimensionCorrection(width: number, height: number): boolean {
  return width === 792 && height === 612
}

/**
 * Get orientation string from dimensions
 */
export function getOrientation(width: number, height: number): 'PORTRAIT' | 'LANDSCAPE' {
  return width > height ? 'LANDSCAPE' : 'PORTRAIT'
}

/**
 * Validate if dimensions are reasonable for US Letter
 */
export function isUSLetterSize(width: number, height: number): boolean {
  return (width === 612 && height === 792) || (width === 792 && height === 612)
}

/**
 * CRITICAL: Intercept PDF page.getSize() dimensions and apply corrections
 * Use this wherever you get dimensions from page.getSize() in merge/print operations
 */
export function correctPdfPageDimensions(pageWidth: number, pageHeight: number): {
  width: number
  height: number
  wasCorreted: boolean
  originalWidth?: number
  originalHeight?: number
} {
  const correction = forceCorrectDimensions(pageWidth, pageHeight)
  
  if (correction.wasCorreted) {
    console.warn(`🚨 PDF PAGE DIMENSION CORRECTION: page.getSize() returned ${pageWidth}x${pageHeight}, corrected to ${correction.width}x${correction.height}`)
  }
  
  return correction
}

/**
 * Enhanced ensureValidRelativeDimensions that applies dimension corrections
 * Drop-in replacement for the original function
 */
export function ensureValidRelativeDimensionsWithCorrection(
  signature: any,
  pageWidth: number,
  pageHeight: number
) {
  // FIRST: Apply dimension correction to the page dimensions
  const correctedDimensions = correctPdfPageDimensions(pageWidth, pageHeight)
  
  // THEN: Use corrected dimensions for calculations
  return ensureValidRelativeDimensionsOriginal(
    signature, 
    correctedDimensions.width, 
    correctedDimensions.height
  )
}

/**
 * Original ensureValidRelativeDimensions logic (to avoid circular imports)
 */
function ensureValidRelativeDimensionsOriginal(
  signature: any,
  pageWidth: number,
  pageHeight: number
) {
  let relativeWidth = signature.relativeWidth
  let relativeHeight = signature.relativeHeight
  let relativeX = signature.relativeX
  let relativeY = signature.relativeY

  // If relative dimensions are missing or invalid, calculate from absolute
  if (!relativeWidth || !relativeHeight || relativeWidth <= 0 || relativeHeight <= 0) {
    if (signature.width && signature.height && pageWidth && pageHeight) {
      relativeWidth = signature.width / pageWidth
      relativeHeight = signature.height / pageHeight
    } else {
      // Use defaults if no dimensions available
      relativeWidth = 0.2  // 20% of page width
      relativeHeight = 0.1 // 10% of page height
    }
  }

  // If relative positions are missing or invalid, calculate from absolute
  if (relativeX === undefined || relativeY === undefined || relativeX < 0 || relativeY < 0) {
    if (signature.x !== undefined && signature.y !== undefined && pageWidth && pageHeight) {
      relativeX = signature.x / pageWidth
      relativeY = signature.y / pageHeight
    } else {
      // Use reasonable defaults if no position available
      relativeX = 0.1  // 10% from left edge
      relativeY = 0.1  // 10% from top edge
    }
  }

  // Ensure positions are within bounds (0-1 range)
  const normalizedX = Math.max(0, Math.min(1, relativeX))
  const normalizedY = Math.max(0, Math.min(1, relativeY))
  
  // Ensure dimensions are reasonable (0-1 range)
  const normalizedWidth = Math.max(0.01, Math.min(1, relativeWidth))  // Min 1%, Max 100%
  const normalizedHeight = Math.max(0.01, Math.min(1, relativeHeight)) // Min 1%, Max 100%

  return {
    ...signature,
    relativeX: normalizedX,
    relativeY: normalizedY,
    relativeWidth: normalizedWidth,
    relativeHeight: normalizedHeight
  }
}
