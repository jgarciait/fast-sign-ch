/**
 * SIGNATURE COORDINATE MANAGEMENT
 * 
 * This utility manages signature positioning using pdf-lib dimensions exclusively.
 * It ensures consistent coordinate handling across mapping, visualization, and merging.
 */

import { PDFPageProperties } from './pdf-lib-dimensions'

export interface SignatureCoordinates {
  /** Absolute X coordinate in PDF points (bottom-left origin) */
  x: number
  /** Absolute Y coordinate in PDF points (bottom-left origin) */
  y: number
  /** Signature width in PDF points */
  width: number
  /** Signature height in PDF points */
  height: number
  /** Page number (1-based) */
  page: number
  /** Relative X coordinate (0-1) */
  relativeX: number
  /** Relative Y coordinate (0-1) */
  relativeY: number
  /** Relative width (0-1) */
  relativeWidth: number
  /** Relative height (0-1) */
  relativeHeight: number
}

export interface ScreenCoordinates {
  /** Screen X coordinate (top-left origin) */
  x: number
  /** Screen Y coordinate (top-left origin) */
  y: number
  /** Display width in pixels */
  width: number
  /** Display height in pixels */
  height: number
}

// Rotation transformation functions removed - original system ignores rotation completely

/**
 * Convert screen coordinates (from user click/drag) to PDF signature coordinates
 * This is used when placing signatures via the UI
 */
export function screenToPDFSignature(
  screenCoords: ScreenCoordinates,
  pageProperties: PDFPageProperties,
  scale: number,
  pageNumber: number
): SignatureCoordinates {
  // Convert screen coordinates to relative coordinates in the overlay view space
  // 🎯 UNIFIED PROCESSING: All documents use same dimension logic
  // Scanned documents normalized by pdf-lib-dimensions.ts to behave like PC documents
  let overlayWidth = pageProperties.width
  let overlayHeight = pageProperties.height

  // Apply rotation-based dimension swapping if needed (same for all documents)
  if (pageProperties.actualRotate === 90 || pageProperties.actualRotate === 270) {
    overlayWidth = pageProperties.height
    overlayHeight = pageProperties.width
  }

  const relativeX = screenCoords.x / scale / overlayWidth
  const relativeY = screenCoords.y / scale / overlayHeight
  const relativeWidth = screenCoords.width / scale / overlayWidth
  const relativeHeight = screenCoords.height / scale / overlayHeight

  console.log(`🔍 COORDINATE DEBUG - screenToPDFSignature: page=${pageNumber}, rotation=${pageProperties.actualRotate}`)
  console.log(`🔍 Overlay dims: ${overlayWidth}x${overlayHeight}, Screen: ${screenCoords.x},${screenCoords.y},${screenCoords.width}x${screenCoords.height}`)
  console.log(`🔍 Calculated relatives: rx=${relativeX.toFixed(6)}, ry=${relativeY.toFixed(6)}, rw=${relativeWidth.toFixed(6)}, rh=${relativeHeight.toFixed(6)}`)

  // Use the unified signature placement system
  return createSignatureFromRelative(
    relativeX,
    relativeY,
    relativeWidth,
    relativeHeight,
    pageProperties,
    pageNumber
  )
}

/**
 * Convert PDF signature coordinates to screen coordinates for display
 * This is used when rendering signatures in the UI
 */
export function pdfToScreenSignature(
  signatureCoords: SignatureCoordinates,
  pageProperties: PDFPageProperties,
  scale: number
): ScreenCoordinates {
  // Convert PDF coordinates (bottom-left origin) to screen coordinates (top-left origin)
  const screenX = signatureCoords.x * scale
  const screenY = (pageProperties.height - (signatureCoords.y + signatureCoords.height)) * scale
  const screenWidth = signatureCoords.width * scale
  const screenHeight = signatureCoords.height * scale



  return {
    x: screenX,
    y: screenY,
    width: screenWidth,
    height: screenHeight
  }
}

/**
 * Create signature coordinates from relative values using unified placement system
 * This is used when loading existing signatures from the database
 */
export function createSignatureFromRelative(
  relativeX: number,
  relativeY: number,
  relativeWidth: number,
  relativeHeight: number,
  pageProperties: PDFPageProperties,
  pageNumber: number
): SignatureCoordinates {
  // Use the unified signature placement system
  const { placeSignature } = require('./signature-placement')
  
  const result = placeSignature(
    {
      pageNumber,
      original: { 
        W: pageProperties.originalWidth, 
        H: pageProperties.originalHeight 
      },
      rotation: pageProperties.actualRotate
    },
    {
      rx: relativeX,
      ry: relativeY,
      rw: relativeWidth,
      rh: relativeHeight
    },
    {
      strategy: "fixed",
      fixedSize: { w: 150, h: 75 }
    }
  )

  // Log using standardized format
  console.log(result.log)

  return {
    x: result.merge.x,
    y: result.merge.y,
    width: result.merge.w,
    height: result.merge.h,
    page: pageNumber,
    relativeX,
    relativeY,
    relativeWidth,
    relativeHeight
  }
}

/**
 * Validate signature coordinates
 */
export function validateSignatureCoordinates(coords: Partial<SignatureCoordinates>): boolean {
  if (!coords.page || coords.page < 1) return false
  if (coords.x === undefined || coords.y === undefined) return false
  if (coords.width === undefined || coords.height === undefined) return false
  if (coords.relativeX === undefined || coords.relativeY === undefined) return false
  if (coords.relativeWidth === undefined || coords.relativeHeight === undefined) return false

  // Check bounds
  if (coords.x < 0 || coords.y < 0 || coords.width <= 0 || coords.height <= 0) return false
  if (coords.relativeX < 0 || coords.relativeY < 0 || coords.relativeWidth <= 0 || coords.relativeHeight <= 0) return false
  if (coords.relativeX > 1 || coords.relativeY > 1 || coords.relativeWidth > 1 || coords.relativeHeight > 1) return false

  return true
}

/**
 * Adjust signature coordinates if they exceed page boundaries
 */
export function constrainSignatureToPage(
  coords: SignatureCoordinates,
  pageProperties: PDFPageProperties
): SignatureCoordinates {
  // 🚨 USE ORIGINAL DIMENSIONS for pdf-lib constraining
  // pdf-lib always works in original coordinate space
  const pageWidth = pageProperties.originalWidth || pageProperties.width
  const pageHeight = pageProperties.originalHeight || pageProperties.height
  
  // Ensure signature fits within page bounds (original space)
  const maxX = pageWidth - coords.width
  const maxY = pageHeight - coords.height

  const constrainedX = Math.max(0, Math.min(maxX, coords.x))
  const constrainedY = Math.max(0, Math.min(maxY, coords.y))

  // Recalculate relative coordinates (using original dimensions)
  const relativeX = constrainedX / pageWidth
  const relativeY = constrainedY / pageHeight
  const relativeWidth = coords.width / pageWidth
  const relativeHeight = coords.height / pageHeight

  const wasConstrained = constrainedX !== coords.x || constrainedY !== coords.y

  if (wasConstrained) {

  }

  return {
    ...coords,
    x: constrainedX,
    y: constrainedY,
    relativeX,
    relativeY,
    relativeWidth,
    relativeHeight
  }
}

/**
 * Calculate signature placement for centering on a click point
 */
export function centerSignatureOnPoint(
  clickX: number,
  clickY: number,
  signatureWidth: number,
  signatureHeight: number,
  pageProperties: PDFPageProperties,
  scale: number,
  pageNumber: number
): SignatureCoordinates {
  // Center the signature on the click point
  const screenCoords: ScreenCoordinates = {
    x: clickX - (signatureWidth / 2),
    y: clickY - (signatureHeight / 2),
    width: signatureWidth,
    height: signatureHeight
  }

  // Convert to PDF coordinates
  const pdfCoords = screenToPDFSignature(screenCoords, pageProperties, scale, pageNumber)

  // Ensure signature stays within page bounds
  return constrainSignatureToPage(pdfCoords, pageProperties)
}

// Legacy migration function removed - now using unified placement system directly

/**
 * Format signature coordinates for storage in database
 */
export function formatSignatureForStorage(coords: SignatureCoordinates): {
  page: number
  relativeX: number
  relativeY: number
  relativeWidth: number
  relativeHeight: number
  x: number
  y: number
  width: number
  height: number
} {
  return {
    page: coords.page,
    relativeX: coords.relativeX,
    relativeY: coords.relativeY,
    relativeWidth: coords.relativeWidth,
    relativeHeight: coords.relativeHeight,
    x: coords.x,
    y: coords.y,
    width: coords.width,
    height: coords.height
  }
}

/**
 * Format signature coordinates for pdf-lib merge operations
 */
export function formatSignatureForMerge(coords: SignatureCoordinates): {
  x: number
  y: number
  width: number
  height: number
  page: number
} {
  return {
    x: coords.x,
    y: coords.y,
    width: coords.width,
    height: coords.height,
    page: coords.page
  }
}
