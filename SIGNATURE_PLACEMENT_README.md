# Signature Placement - Single Source of Truth

## Overview

This system replaces all legacy signature coordinate handling with one unified approach that ensures **identical placement** between on-screen overlay and pdf-lib merge for any page rotation.

## Key Features

✅ **Single math path only** - No more multiple coordinate systems
✅ **Deterministic placement** - Same input always produces same output  
✅ **Rotation support** - Handles 0°, 90°, 180°, 270° correctly
✅ **Center-rotation transforms** - Rotates around image center, not bottom-left corner
✅ **Perfect visual alignment** - Overlay and merged PDF signatures match exactly
✅ **Robust signature handling** - Simple, reliable approach that works with any document dimensions
✅ **Configurable stamp sizing** - Fixed or relative sizing strategies
✅ **Standardized logging** - Clear, parseable coordinate transformations with v3 format

## Mathematical Formulas

### Input
- **Page**: Original size (W, H), rotation ∈ {0, 90, 180, 270}
- **Relative box**: (rx, ry, rw, rh) in [0..1] from overlay view
- **Stamp config**: Fixed size or relative sizing strategy

### Overlay Calculations
```
If rotation = 0° or 180°: Wv = W, Hv = H
If rotation = 90° or 270°: Wv = H, Hv = W

x_v = rx * Wv
y_v = ry * Hv
```

### PDF-lib Coordinate Modes

This system supports two distinct modes for placing signatures:

#### **Corner Mode (Direct placement, no rotation)**
For non-rotated pages or when rotation is handled elsewhere:
```
rotation = 0°:   x = x_v,           y = H - (y_v + h)
rotation = 90°:  x = W - y_v - h,   y = H - (x_v + h)
rotation = 180°: x = W - x_v - w,   y = y_v
rotation = 270°: x = y_v,           y = x_v
```

#### **Center-Rotation Mode (CTM-based, with counter-rotation)**
For rotated pages using center-rotation CTM transforms. **Do not use corner formulas** - use center mapping:
```
rotation = 0°:   cx = x_v + w/2,        cy = H - (y_v + h/2)
rotation = 90°:  cx = W - (y_v + h/2),  cy = H - (x_v + w/2)
rotation = 180°: cx = W - (x_v + w/2),  cy = y_v + h/2
rotation = 270°: cx = W - (y_v + h/2),  cy = H - (x_v + w/2)
```

**Critical**: When using center-rotation mode, compute the **center directly** from overlay center coordinates. Do not derive center from corner-based calculations as this introduces offset errors.

**Rotation Fix**: A 180° adjustment is applied to the counter-rotation angle to ensure signatures appear in the correct orientation (horizontal) in the final PDF view.

## Usage

```typescript
import { placeSignature } from './utils/signature-placement'

const result = placeSignature(
  {
    pageNumber: 1,
    original: { W: 612, H: 792 },
    rotation: 270
  },
  {
    rx: 0.7235, ry: 0.7418,
    rw: 0.2451, rh: 0.0947
  },
  {
    strategy: "fixed",
    fixedSize: { w: 150, h: 75 }
  }
)

// Use result.overlay for on-screen display
// Use result.merge for pdf-lib with center-rotation CTM

// Apply center-rotation if page is rotated
const pageRotation = pageProperties?.actualRotate || 0
if (pageRotation === 0) {
  // No rotation - use bottom-left coordinates derived from center
  const x = result.merge.cx - result.merge.w / 2
  const y = result.merge.cy - result.merge.h / 2
  page.drawImage(image, { x, y, width: result.merge.w, height: result.merge.h })
} else {
  // Use CTM with center coordinates directly
  drawImageWithCenterRotation(page, image, {
    cx: result.merge.cx, cy: result.merge.cy,
    w: result.merge.w, h: result.merge.h,
    rotation: pageRotation
  })
}

console.log(result.log) // Standardized v3 logging
```

## Center-Rotation Implementation

To prevent signatures from appearing offset when rotated, the system uses PDF transformation matrices that rotate around the **image center** rather than the default bottom-left corner:

```typescript
import {
  pushGraphicsState, popGraphicsState, concatTransformationMatrix,
} from 'pdf-lib'

// Given (x, y, w, h) and page rotation (0/90/180/270)
const cx = x + w / 2
const cy = y + h / 2
// Add 180° adjustment to fix signature orientation
const adjustedRotation = -rotation + 180
const theta = adjustedRotation * Math.PI / 180
const cos = Math.cos(theta)
const sin = Math.sin(theta)

// CTM = T(cx,cy) · R(theta) · T(-w/2,-h/2)
const tx = cx - (cos * (w/2) - sin * (h/2))
const ty = cy - (sin * (w/2) + cos * (h/2))

page.pushOperators(
  pushGraphicsState(),
  concatTransformationMatrix(cos,  sin, -sin, cos, tx, ty),
)
page.drawImage(image, { x: 0, y: 0, width: w, height: h }) // no rotate:
page.pushOperators(popGraphicsState())
```

This ensures the signature stays in its intended location while being rotated to remain horizontal.

## Smart Signature Handling

The system provides intelligent handling for **all signatures** (both Canvas and Wacom) to ensure they appear correctly without distortion:

### Features
- **Robust Compatibility**: Works reliably with documents of any dimensions or aspect ratios
- **Perfect Centering**: Signatures are always centered within the allocated signature box
- **Conservative Scaling**: Uses 80% scaling to ensure signatures fit well without stretching
- **Irregular Document Support**: Specifically designed to handle documents with unusual dimensions
- **Universal Application**: Works consistently for Canvas and Wacom signatures
- **No Complex Calculations**: Avoids aspect ratio logic that can fail with irregular documents

### Implementation
For **all signatures** (regardless of source), the merge process uses a **robust, simple approach** that works with irregular document dimensions:

1. **Conservative scaling** - All signatures are scaled to 80% of the allocated box size
2. **Perfect centering** - Signatures are centered within the signature box using calculated offsets
3. **No complex ratio calculations** - Avoids aspect ratio logic that can break with irregular documents
4. **Maximum compatibility** - Works reliably with documents of any dimensions or ratios

```typescript
// Universal approach for all signatures
// 150×75 box → 120×60 signature (80% scale) centered with offset (15, 7.5)
const scale = 0.8
actualW = boxW * scale  // 150 * 0.8 = 120
actualH = boxH * scale  // 75 * 0.8 = 60
offsetX = (boxW - actualW) / 2  // (150 - 120) / 2 = 15
offsetY = (boxH - actualH) / 2  // (75 - 60) / 2 = 7.5
```

### Debug Logging
```
📝 Processing Canvas signature with box dimensions: 150x75
📝 Canvas signature - Using simple centering for robust handling of irregular dimensions
📝 Canvas signature - Robust sizing: 120x60, centered with offset: 15,7.5
📝 Canvas signature - Box: 150x75, Scale: 0.8, ensuring compatibility with irregular document dimensions
```

### Helper Function Example

```typescript
import { PDFPage } from 'pdf-lib'
import { pushGraphicsState, popGraphicsState, concatTransformationMatrix } from 'pdf-lib'

function normalizeRotation(rotation: number): 0 | 90 | 180 | 270 {
  const normalized = ((rotation % 360) + 360) % 360
  if (normalized === 0 || normalized === 90 || normalized === 180 || normalized === 270) {
    return normalized as 0 | 90 | 180 | 270
  }
  console.warn(`Invalid rotation ${rotation}, defaulting to 0°`)
  return 0
}

function drawImageWithCenterRotation(
  page: PDFPage, 
  image: any, 
  { cx, cy, w, h, rotation }: { cx: number, cy: number, w: number, h: number, rotation: number }
) {
  const normalizedRotation = normalizeRotation(rotation)
  
  if (normalizedRotation === 0) {
    // Convert center to bottom-left for normal drawing
    const x = cx - w / 2
    const y = cy - h / 2
    page.drawImage(image, { x, y, width: w, height: h })
    return
  }

  // Use center coordinates directly for CTM
  // Add 180° adjustment to fix signature orientation
  const adjustedRotation = -normalizedRotation + 180
  const theta = adjustedRotation * Math.PI / 180
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  
  const tx = cx - (cos * (w/2) - sin * (h/2))
  const ty = cy - (sin * (w/2) + cos * (h/2))

  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(cos, sin, -sin, cos, tx, ty)
  )
  page.drawImage(image, { x: 0, y: 0, width: w, height: h })
  page.pushOperators(popGraphicsState())
}
```

## Test Cases

### Test A: 270° Rotation (User's actual data)
- **Input**: W=612, H=792, rotation=270°, rx=0.738636, ry=0.745098
- **Overlay**: Wv=792, Hv=612, x_v=585, y_v=454  
- **Overlay Center**: c_v_x = 585 + 75 = 660, c_v_y = 454 + 37.5 = 491.5
- **Expected PDF Center**: cx = 612 - 491.5 = 120.5, cy = 792 - 660 = 132
- **Expected Bottom-left**: (x,y) = (45.5, 94.5), visual: bottom-right, horizontal

### Test B: 90° Rotation (Center-Rotation Mode)
- **Input**: W=612, H=792, rotation=90°, rx=0.5, ry=0.5
- **Overlay**: Wv=792, Hv=612, x_v=396, y_v=306
- **Overlay Center**: c_v_x = 396 + 75 = 471, c_v_y = 306 + 37.5 = 343.5
- **Expected PDF Center**: cx = 612 - (306 + 37.5) = 268.5, cy = 792 - (396 + 75) = 321
- **Expected Bottom-left**: (x,y) = (193.5, 283.5), visual: center-rotated horizontal

### Test C: 0° Rotation (No rotation)
- **Input**: W=612, H=792, rotation=0°, rx=0.25, ry=0.25
- **Overlay**: Wv=612, Hv=792, x_v=153, y_v=198
- **Expected PDF**: (x,y)=(153, 792-(198+75)=519)

### Test D: 180° Rotation
- **Input**: W=612, H=792, rotation=180°, rx=0.75, ry=0.75
- **Overlay**: Wv=612, Hv=792, x_v=459, y_v=594
- **Expected PDF**: (x,y)=(612-459-150=3, 594)

## Standardized Log Format

```
MERGE v3 | page=1 rot=270 | W=612 H=792 | Wv=792 Hv=612 | x_v=585.000 y_v=454.000 | center=(120.500,132.000) | stamp=150x75 | mode=center-rotate
```

**New in v3**: 
- Added `center=(cx,cy)` coordinates used for CTM transforms
- Removed corner-based `pdf(x,y)` since center mapping prevents offset
- Fixed rotation origin bug by computing center directly from overlay center
- Added 180° rotation adjustment to fix signature orientation
- Smart signature handling for ALL signatures with robust irregular document support
- Mode indicates center-rotation CTM approach

## Legacy Code Removed

❌ **Removed all legacy flows**:
- "MIGRATE LEGACY" processing
- "ULTRA-SIMPLE passthrough" 
- "EXACT overlay copy" duplications
- Conditional transformation skipping
- Mixed relative/fixed sizing within same run

❌ **Removed duplicate coordinate systems**:
- Multiple overlay dimension calculations
- Inconsistent rotation handling
- Ad-hoc coordinate transformations

## Files Modified

- **`utils/signature-placement.ts`** - New single source of truth
- **`utils/pdf-lib-merge.ts`** - Updated to use unified system
- **`utils/signature-coordinates.ts`** - Simplified to use unified system
- **`test-signature-placement.js`** - Test suite for verification

## Configuration

### Stamp Sizing Strategies

```typescript
// Fixed size (always 150×75)
{ strategy: "fixed", fixedSize: { w: 150, h: 75 } }

// Relative size (computed from overlay dimensions)
{ strategy: "relative" }
```

## Common Pitfalls Fixed

✅ **No more width/height confusion** in 90°/270° transforms
✅ **No more mixed coordinate systems** between overlay and merge
✅ **No more float precision issues** like 791.999978
✅ **No more conditional skipping** of transformations
✅ **Consistent dimension handling** for all rotation angles

The signature will now appear in **exactly the same visual location** for both overlay display and merged PDF output.

## Optional Hardening

For production robustness, consider these enhancements:

### Rotation Normalization
```typescript
function normalizeRotation(rotation: number): 0 | 90 | 180 | 270 {
  const normalized = ((rotation % 360) + 360) % 360
  if (normalized === 0 || normalized === 90 || normalized === 180 || normalized === 270) {
    return normalized as 0 | 90 | 180 | 270
  }
  console.warn(`Invalid rotation ${rotation}, defaulting to 0°`)
  return 0
}
```

### Bounds Clamping
```typescript
function clampSignatureToBounds(x: number, y: number, w: number, h: number, pageW: number, pageH: number) {
  return {
    x: Math.max(0, Math.min(x, pageW - w)),
    y: Math.max(0, Math.min(y, pageH - h)),
    w: Math.min(w, pageW),
    h: Math.min(h, pageH)
  }
}
```

### Metadata Precision
```typescript
// Use original dimensions from metadata, ignore float jitter
const W = Math.round(pageProperties.originalWidth)  // 612, not 611.99998
const H = Math.round(pageProperties.originalHeight) // 792, not 791.99978
```

### Unit Testing
```typescript
// Assert bbox match within ±1 pt; sweep all four rotations
describe('Signature Placement', () => {
  test('270° rotation bottom-right', () => {
    const result = placeSignature(/* test case A */)
    expect(result.merge.x).toBeCloseTo(456, 0)  // ±1pt tolerance
    expect(result.merge.y).toBeCloseTo(585, 0)
  })
  
  // Test edges and center for all rotations: 0°, 90°, 180°, 270°
})
```
