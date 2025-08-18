# Signature Placement System - Final Implementation

## Solution: Use Existing JSON as Single Source of Truth

**DO NOT change the stored schema.** The existing JSON contains all necessary coordinate information and the overlay system already works perfectly with this data.

## Stored JSON Format (Keep Unchanged)
```json
{"signatures":[
  {
    "x": 54.760416666666686,
    "y": 95,
    "id": "signature-1754852437526-0.9224870401599923",
    "page": 4,
    "width": 150,
    "height": 75,
    "source": "mapping",
    "relativeX": 0.08918634636264933,
    "relativeY": 0.11964735516372796,
    "timestamp": "2025-08-10T19:00:37.526Z",
    "relativeWidth": 0.24429967426710097,
    "relativeHeight": 0.09445843828715365
  }
]}
```

## Merge Input (Only Addition: Image Data)

At merge time, use the saved object **plus** image data. Do not rename keys.

```json
{
  "documentId": "<doc-id>",
  "page": { 
    "index": 4, 
    "rotation": 0|90|180|270, 
    "boxSize": {"W": 612, "H": 792} 
  },
  "signature": {
    "id": "signature-1754852437526-0.9224870401599923",
    "relativeX": 0.08918634636264933,
    "relativeY": 0.11964735516372796,
    "relativeWidth": 0.24429967426710097,
    "relativeHeight": 0.09445843828715365,
    "width": 150,
    "height": 75,
    "image": { "mime": "image/png", "data": "<BASE64>" }
  }
}
```

## Placement Rules (Center-Rotation Mode)

### Step 1: Extract Coordinates
```typescript
// Use relative coordinates only (ignore absolute x,y - they are legacy)
const relativeX = signature.coordinates.relativeX
const relativeY = signature.coordinates.relativeY  
const relativeWidth = signature.coordinates.relativeWidth
const relativeHeight = signature.coordinates.relativeHeight
const width = signature.coordinates.width || 150
const height = signature.coordinates.height || 75
```

### Step 2: Get Page Properties
```typescript
const rotation = pageProperties.actualRotate || 0
const W = pageProperties.originalWidth || 612  // PDF box width
const H = pageProperties.originalHeight || 792  // PDF box height

// Normalize rotation to 0/90/180/270
const normalizedRotation = ((rotation % 360) + 360) % 360
```

### Step 3: Calculate Overlay Dimensions
```typescript
// Overlay sizes: Wv=W, Hv=H for 0°/180°; Wv=H, Hv=W for 90°/270°
let Wv, Hv
if (normalizedRotation === 90 || normalizedRotation === 270) {
  Wv = H  // Swapped for 90°/270°
  Hv = W
} else {
  Wv = W  // Normal for 0°/180°
  Hv = H
}
```

### Step 4: Compute Overlay Position
```typescript
// Compute overlay top-left: x_v = relativeX * Wv, y_v = relativeY * Hv
const x_v = relativeX * Wv
const y_v = relativeY * Hv

// Center on overlay: cx_v = x_v + width/2, cy_v = y_v + height/2
const cx_v = x_v + width / 2
const cy_v = y_v + height / 2
```

### Step 5: Map Center to PDF
```typescript
// Map center to PDF (center-rotation mode)
let cx, cy
switch (normalizedRotation) {
  case 0:
    cx = ox + cx_v
    cy = oy + (H - cy_v)
    break
  case 90:
    cx = ox + (W - cy_v)
    cy = oy + (H - cx_v)
    break
  case 180:
    cx = ox + (W - cx_v)
    cy = oy + cy_v
    break
  case 270:
    cx = ox + cy_v
    cy = oy + cx_v
    break
  default:
    cx = ox + cx_v
    cy = oy + (H - cy_v)
}
```

### Step 6: Draw with CTM (with Image Content Flip)
```typescript
// Draw with CTM: T(cx,cy) · R(-rotation + 180) · T(-width/2, -height/2)  
// Add 180° to counter the clockwise rotation of the signature image
const rotationRadians = ((-normalizedRotation + 180) * Math.PI) / 180
const cos = Math.cos(rotationRadians)
const sin = Math.sin(rotationRadians)

const tx = cx - (cos * (width / 2) - sin * (height / 2))
const ty = cy - (sin * (width / 2) + cos * (height / 2))

page.pushOperators(
  pushGraphicsState(),
  concatTransformationMatrix(cos, sin, -sin, cos, tx, ty)
)

// Apply additional flip transformation to flip the image content only
// This flips the image without affecting the coordinate positioning
page.pushOperators(
  concatTransformationMatrix(-1, 0, 0, -1, width, height)
)

page.drawImage(image, { x: 0, y: 0, width: width, height: height })

page.pushOperators(popGraphicsState())
```

## Key Principles

1. **Keep storage JSON unchanged** - Don't modify the proven working data structure
2. **Use relative coordinates only** - Ignore legacy absolute x,y values
3. **Center-rotation mode** - Rotate image around its center using CTM
4. **No coordinate clamping** - Allow signatures at page edges
5. **Single source of truth** - Use existing JSON as authoritative coordinate source

## Why This Works

- **Uses proven working coordinate data** from existing JSON
- **Matches overlay calculation** with proper rotation handling
- **180° rotation and separate image content flip** to remove mirroring without affecting positioning
- **Only adds image data** at merge time
- **No schema changes** required
- **Perfect alignment** between overlay and merge systems

## Image Rotation and Mirroring Fix

**Problem:** Signature images were appearing rotated 180° clockwise and mirrored both horizontally and vertically.

**Solution:** 
1. Added +180° to the CTM rotation calculation to counter clockwise rotation
2. Applied a separate image content flip transformation that doesn't affect positioning

```typescript
// Counter the clockwise rotation of signature images
const rotationRadians = ((-normalizedRotation + 180) * Math.PI) / 180

// Step 1: Position and rotate correctly
concatTransformationMatrix(cos, sin, -sin, cos, tx, ty)

// Step 2: Flip image content only (scale -1,-1 with compensation)
concatTransformationMatrix(-1, 0, 0, -1, width, height)
```

This approach separates positioning (which works correctly) from image orientation (which needs flipping), ensuring signatures appear in the exact same position and orientation as shown in the overlay.
