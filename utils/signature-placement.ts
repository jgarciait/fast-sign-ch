/**
 * SIGNATURE PLACEMENT - SINGLE SOURCE OF TRUTH
 * 
 * One math path only. Eliminates all legacy flows and coordinate system confusion.
 * Ensures on-screen overlay and pdf-lib merge land in exactly the same visual spot.
 */

export interface PageInfo {
  /** Page number (1-based) */
  pageNumber: number
  /** Original (unrotated) page size in points */
  original: { W: number; H: number }
  /** Page rotation in degrees clockwise (will be normalized to 0/90/180/270) */
  rotation: number
}

export interface RelativeBox {
  /** Relative coordinates in [0..1] */
  rx: number
  ry: number
  rw: number
  rh: number
}

export interface StampConfig {
  /** Stamp sizing strategy */
  strategy: "fixed" | "relative"
  /** Fixed size (when strategy="fixed") */
  fixedSize?: { w: number; h: number }
}

export interface OverlayResult {
  /** Overlay viewport size in points */
  overlay: { Wv: number; Hv: number }
  /** Overlay coordinates in points */
  x_v: number
  y_v: number
  w_v: number
  h_v: number
}

export interface MergeResult {
  /** Center coordinates for pdf-lib center-rotation CTM */
  cx: number
  cy: number
  /** Bottom-left coordinates (derived from center for logging) */
  x: number
  y: number
  w: number
  h: number
}

/**
 * Calculate overlay viewport dimensions based on page rotation
 */
function calculateOverlaySize(original: { W: number; H: number }, rotation: number): { Wv: number; Hv: number } {
  if (rotation === 0 || rotation === 180) {
    return { Wv: original.W, Hv: original.H }
  } else {
    return { Wv: original.H, Hv: original.W }
  }
}

/**
 * Convert overlay top-left coordinates to pdf-lib bottom-left coordinates
 * 
 * ASCII diagrams for rotation transformations:
 * 
 * 0°: No rotation
 *   overlay(x_v,y_v) → pdf(x_v, H-(y_v+h))
 * 
 * 90°: Rotated left (CCW)
 *   overlay(x_v,y_v) → pdf(W-y_v-h, H-(x_v+h))
 * 
 * 180°: Upside down
 *   overlay(x_v,y_v) → pdf(W-x_v-w, y_v)
 * 
 * 270°: Rotated right (CW) 
 *   overlay(x_v,y_v) → pdf(y_v, x_v)
 *   Note: Compact form already includes top-left→bottom-left conversion
 */
/**
 * Transform overlay coordinates to PDF coordinates using CENTER mapping
 * This approach maps the overlay center to the PDF center, which works correctly
 * with center-rotation CTM transforms.
 */
function transformCoordinatesCenter(
  overlayCoords: { x_v: number; y_v: number },
  stampSize: { w: number; h: number },
  original: { W: number; H: number },
  rotation: number
): { cx: number; cy: number; w: number; h: number } {
  const { x_v, y_v } = overlayCoords
  const { w, h } = stampSize
  const { W, H } = original

  // Calculate overlay center
  const c_v_x = x_v + w / 2
  const c_v_y = y_v + h / 2

  // Map overlay center to original bottom-left center based on rotation
  let cx: number, cy: number

  switch (rotation) {
    case 0:
      cx = c_v_x
      cy = H - c_v_y
      break

    case 90:
      cx = W - c_v_y
      cy = H - c_v_x
      break

    case 180:
      cx = W - c_v_x
      cy = c_v_y
      break

    case 270:
      cx = W - c_v_y
      cy = H - c_v_x
      break

    default:
      throw new Error(`Unsupported rotation: ${rotation}`)
  }

  return { cx, cy, w, h }
}

/**
 * Normalize rotation to valid values and handle edge cases
 */
function normalizeRotation(rotation: number): 0 | 90 | 180 | 270 {
  const normalized = ((rotation % 360) + 360) % 360
  if (normalized === 0 || normalized === 90 || normalized === 180 || normalized === 270) {
    return normalized as 0 | 90 | 180 | 270
  }
  console.warn(`Invalid rotation ${rotation}, defaulting to 0°`)
  return 0
}

/**
 * Clamp signature to page bounds for safety
 */
function clampSignatureToBounds(x: number, y: number, w: number, h: number, pageW: number, pageH: number) {
  return {
    x: Math.max(0, Math.min(x, pageW - w)),
    y: Math.max(0, Math.min(y, pageH - h)),
    w: Math.min(w, pageW),
    h: Math.min(h, pageH)
  }
}

/**
 * MAIN FUNCTION: Place signature with single source of truth
 * 
 * This is the only function that should be used for signature placement.
 * It handles both overlay positioning and pdf-lib merge coordinates.
 */
export function placeSignature(
  pageInfo: PageInfo,
  relativeBox: RelativeBox,
  stampConfig: StampConfig
): {
  overlay: OverlayResult
  merge: MergeResult
  log: string
} {
  const { pageNumber, original } = pageInfo
  const { rx, ry, rw, rh } = relativeBox

  // Normalize rotation and use original page dimensions with precision rounding
  const rotation = normalizeRotation(pageInfo.rotation)
  const W = Math.round(original.W)  // Kill float jitter like 611.99998
  const H = Math.round(original.H)  // Kill float jitter like 791.99978
  const normalizedOriginal = { W, H }

  // Calculate overlay viewport size based on normalized rotation
  const overlay = calculateOverlaySize(normalizedOriginal, rotation)
  
  // Convert relative to overlay coordinates
  const x_v = rx * overlay.Wv
  const y_v = ry * overlay.Hv
  const w_v = rw * overlay.Wv
  const h_v = rh * overlay.Hv

  // Determine stamp size
  let stampSize: { w: number; h: number }
  if (stampConfig.strategy === "fixed") {
    if (!stampConfig.fixedSize) {
      throw new Error("Fixed stamp size not provided")
    }
    stampSize = stampConfig.fixedSize
  } else {
    stampSize = { w: w_v, h: h_v }
  }

  // Transform to pdf-lib center coordinates
  const centerResult = transformCoordinatesCenter(
    { x_v, y_v },
    stampSize,
    normalizedOriginal,
    rotation
  )

  // Derive bottom-left coordinates from center for logging and bounds checking
  const x = centerResult.cx - stampSize.w / 2
  const y = centerResult.cy - stampSize.h / 2

  // Apply bounds clamping for safety
  const clamped = clampSignatureToBounds(x, y, stampSize.w, stampSize.h, W, H)
  
  // Recalculate center from clamped bottom-left
  const clampedCx = clamped.x + clamped.w / 2
  const clampedCy = clamped.y + clamped.h / 2

  const merge: MergeResult = {
    cx: clampedCx,
    cy: clampedCy,
    x: clamped.x,
    y: clamped.y,
    w: clamped.w,
    h: clamped.h
  }

  // Generate standardized log with center coordinates
  const log = `MERGE v3 | page=${pageNumber} rot=${rotation} | W=${W} H=${H} | Wv=${overlay.Wv} Hv=${overlay.Hv} | x_v=${x_v.toFixed(3)} y_v=${y_v.toFixed(3)} | center=(${merge.cx.toFixed(3)},${merge.cy.toFixed(3)}) | stamp=${stampSize.w}x${stampSize.h} | mode=center-rotate`

  return {
    overlay: {
      overlay,
      x_v,
      y_v,
      w_v,
      h_v
    },
    merge,
    log
  }
}

/**
 * Validate signature placement input
 */
export function validatePlacementInput(
  pageInfo: PageInfo,
  relativeBox: RelativeBox,
  stampConfig: StampConfig
): { valid: boolean; error?: string } {
  // Validate page info
  if (pageInfo.pageNumber < 1) {
    return { valid: false, error: "Page number must be >= 1" }
  }
  if (pageInfo.original.W <= 0 || pageInfo.original.H <= 0) {
    return { valid: false, error: "Page dimensions must be positive" }
  }
  if (![0, 90, 180, 270].includes(pageInfo.rotation)) {
    return { valid: false, error: "Rotation must be 0, 90, 180, or 270" }
  }

  // Validate relative box
  const { rx, ry, rw, rh } = relativeBox
  if (rx < 0 || rx > 1 || ry < 0 || ry > 1 || rw < 0 || rw > 1 || rh < 0 || rh > 1) {
    return { valid: false, error: "Relative coordinates must be in [0..1]" }
  }
  if (rx + rw > 1 || ry + rh > 1) {
    return { valid: false, error: "Relative box extends beyond page bounds" }
  }

  // Validate stamp config
  if (stampConfig.strategy === "fixed" && !stampConfig.fixedSize) {
    return { valid: false, error: "Fixed stamp size required when strategy is 'fixed'" }
  }
  if (stampConfig.strategy === "fixed" && stampConfig.fixedSize) {
    if (stampConfig.fixedSize.w <= 0 || stampConfig.fixedSize.h <= 0) {
      return { valid: false, error: "Fixed stamp size must be positive" }
    }
  }

  return { valid: true }
}
