// Utility functions for consistent signature dimension calculations

// Standard PDF page dimensions (US Letter at 72 DPI)
export const STANDARD_PAGE_WIDTH = 612
export const STANDARD_PAGE_HEIGHT = 792

// Default signature dimensions in pixels (for UI display)
export const DEFAULT_SIGNATURE_WIDTH = 200
export const DEFAULT_SIGNATURE_HEIGHT = 100

// Default relative dimensions based on standard page size
export const DEFAULT_RELATIVE_WIDTH = DEFAULT_SIGNATURE_WIDTH / STANDARD_PAGE_WIDTH  // ~0.327
export const DEFAULT_RELATIVE_HEIGHT = DEFAULT_SIGNATURE_HEIGHT / STANDARD_PAGE_HEIGHT // ~0.126

/**
 * Calculate relative dimensions from absolute dimensions
 * @param absoluteWidth Absolute width in pixels
 * @param absoluteHeight Absolute height in pixels
 * @param pageWidth Current page width in pixels
 * @param pageHeight Current page height in pixels
 * @returns Object with relativeWidth and relativeHeight (0-1 range)
 */
export function calculateRelativeDimensions(
  absoluteWidth: number,
  absoluteHeight: number,
  pageWidth: number,
  pageHeight: number
) {
  return {
    relativeWidth: absoluteWidth / pageWidth,
    relativeHeight: absoluteHeight / pageHeight
  }
}

/**
 * Calculate absolute dimensions from relative dimensions
 * @param relativeWidth Relative width (0-1 range)
 * @param relativeHeight Relative height (0-1 range)
 * @param pageWidth Current page width in pixels
 * @param pageHeight Current page height in pixels
 * @returns Object with absoluteWidth and absoluteHeight in pixels
 */
export function calculateAbsoluteDimensions(
  relativeWidth: number,
  relativeHeight: number,
  pageWidth: number,
  pageHeight: number
) {
  return {
    absoluteWidth: relativeWidth * pageWidth,
    absoluteHeight: relativeHeight * pageHeight
  }
}

/**
 * Normalize relative dimensions to ensure they're reasonable
 * This prevents signatures from being too large or too small
 * @param relativeWidth Relative width (0-1 range)
 * @param relativeHeight Relative height (0-1 range)
 * @returns Normalized relative dimensions
 */
export function normalizeRelativeDimensions(
  relativeWidth: number,
  relativeHeight: number
) {
  // Clamp dimensions to reasonable ranges
  const minRelativeWidth = 0.1  // 10% of page width minimum
  const maxRelativeWidth = 0.8  // 80% of page width maximum
  const minRelativeHeight = 0.05 // 5% of page height minimum
  const maxRelativeHeight = 0.4  // 40% of page height maximum

  return {
    relativeWidth: Math.max(minRelativeWidth, Math.min(maxRelativeWidth, relativeWidth)),
    relativeHeight: Math.max(minRelativeHeight, Math.min(maxRelativeHeight, relativeHeight))
  }
}

/**
 * Get default relative dimensions for a signature
 * Uses consistent defaults across the application
 * @returns Object with default relativeWidth and relativeHeight
 */
export function getDefaultRelativeDimensions() {
  return {
    relativeWidth: DEFAULT_RELATIVE_WIDTH,
    relativeHeight: DEFAULT_RELATIVE_HEIGHT
  }
}

/**
 * Ensure signature has valid relative dimensions
 * If missing, calculate from absolute dimensions or use defaults
 * @param signature Signature object with position data
 * @param pageWidth Current page width in pixels
 * @param pageHeight Current page height in pixels
 * @returns Signature with valid relative dimensions
 */
export function ensureValidRelativeDimensions(
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
      const calculated = calculateRelativeDimensions(
        signature.width,
        signature.height,
        pageWidth,
        pageHeight
      )
      relativeWidth = calculated.relativeWidth
      relativeHeight = calculated.relativeHeight
    } else {
      // Use defaults if no dimensions available
      const defaults = getDefaultRelativeDimensions()
      relativeWidth = defaults.relativeWidth
      relativeHeight = defaults.relativeHeight
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

  // Normalize dimensions to prevent extreme values
  const normalizedDimensions = normalizeRelativeDimensions(relativeWidth, relativeHeight)

  // Ensure positions are within bounds (0-1 range)
  const normalizedX = Math.max(0, Math.min(1, relativeX))
  const normalizedY = Math.max(0, Math.min(1, relativeY))

  return {
    ...signature,
    relativeX: normalizedX,
    relativeY: normalizedY,
    relativeWidth: normalizedDimensions.relativeWidth,
    relativeHeight: normalizedDimensions.relativeHeight
  }
}

/**
 * Convert legacy signature data to use consistent relative dimensions
 * @param signatures Array of signature objects
 * @param pageWidth Current page width in pixels
 * @param pageHeight Current page height in pixels
 * @returns Array of signatures with corrected relative dimensions
 */
export function convertLegacySignatureDimensions(
  signatures: any[],
  pageWidth: number,
  pageHeight: number
) {
  return signatures.map(signature => ensureValidRelativeDimensions(signature, pageWidth, pageHeight))
} 