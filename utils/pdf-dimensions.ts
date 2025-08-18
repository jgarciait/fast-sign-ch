/**
 * Unified PDF page dimensions utility
 * Ensures consistent coordinate calculations across all PDF viewers and print APIs
 */

interface PDFPageDimensions {
  width: number
  height: number
  originalWidth: number
  originalHeight: number
  scale: number
}

/**
 * Get consistent PDF page dimensions for coordinate calculations
 * This should be used by both the editor and viewer to ensure coordinates match exactly
 */
export function getUnifiedPageDimensions(
  pageInfo: any, 
  scale: number = 1.0
): PDFPageDimensions {
  // Always use the actual PDF page dimensions, not scaled display dimensions
  // This matches what the print API uses with page.getSize()
  let actualWidth = pageInfo.originalWidth || pageInfo.width
  let actualHeight = pageInfo.originalHeight || pageInfo.height
  
  // BRUTAL EMERGENCY FIX: Force correct US Letter dimensions if React PDF is wrong
  if (actualWidth === 792 && actualHeight === 612) {
    console.warn(`🚨 UTILS: FORCING US Letter PORTRAIT correction from ${actualWidth}x${actualHeight} to 612x792`)
    actualWidth = 612   // Force correct portrait width
    actualHeight = 792  // Force correct portrait height
  }
  
  return {
    width: actualWidth,
    height: actualHeight,
    originalWidth: actualWidth,
    originalHeight: actualHeight,
    scale: scale
  }
}

/**
 * Convert relative coordinates (0-1) to absolute coordinates using unified dimensions
 */
export function convertRelativeToAbsolute(
  relativeX: number,
  relativeY: number,
  relativeWidth: number,
  relativeHeight: number,
  pageDimensions: PDFPageDimensions
): { x: number; y: number; width: number; height: number } {
  return {
    x: relativeX * pageDimensions.originalWidth,
    y: relativeY * pageDimensions.originalHeight,
    width: relativeWidth * pageDimensions.originalWidth,
    height: relativeHeight * pageDimensions.originalHeight
  }
}

/**
 * Convert absolute coordinates to relative coordinates (0-1) using unified dimensions
 */
export function convertAbsoluteToRelative(
  absoluteX: number,
  absoluteY: number,
  absoluteWidth: number,
  absoluteHeight: number,
  pageDimensions: PDFPageDimensions
): { relativeX: number; relativeY: number; relativeWidth: number; relativeHeight: number } {
  return {
    relativeX: absoluteX / pageDimensions.originalWidth,
    relativeY: absoluteY / pageDimensions.originalHeight,
    relativeWidth: absoluteWidth / pageDimensions.originalWidth,
    relativeHeight: absoluteHeight / pageDimensions.originalHeight
  }
}