/**
 * Adding Signatures to PDFs of Any Orientation/Size using pdf-lib
 * Full compliance with specification
 */

import { PDFDocument, degrees } from 'pdf-lib'

interface SignatureImage {
  type: "png" | "jpg"
  data: Uint8Array
}

interface SignaturePlacement {
  pageIndex: number
  absolute?: { x: number, y: number, width?: number, height?: number }
  relative?: { x: number, y: number, width?: number, height?: number }
  topLeftUI?: { x: number, y: number, width?: number, height?: number }
  fitBoxPct?: number // e.g., 0.2 = 20% of page width
}

/**
 * Add signatures to PDF following exact specification
 */
export async function addSignaturesToPDF(
  pdfBytes: ArrayBuffer | Uint8Array,
  signatureImage: SignatureImage,
  placements: SignaturePlacement[]
): Promise<Uint8Array> {
  // 1) Load & embed image
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const img = signatureImage.type === "png" 
    ? await pdfDoc.embedPng(signatureImage.data)
    : await pdfDoc.embedJpg(signatureImage.data)

  // Process each placement
  for (const placement of placements) {
    // 2) Gather page geometry
    const page = pdfDoc.getPages()[placement.pageIndex]
    const width = page.getWidth()
    const height = page.getHeight()
    const rotation = page.getRotation().angle || 0 // degrees; 0/90/180/270

    // Log 1: PAGE
    console.log("PAGE", { pageIndex: placement.pageIndex, width, height, rotation })

    // 3) Compute target rectangle
    let x: number, y: number, targetWidth: number, targetHeight: number
    let mode: string

    if (placement.absolute) {
      // Absolute coordinates (bottom-left origin)
      x = placement.absolute.x
      y = placement.absolute.y
      targetWidth = placement.absolute.width || 0
      targetHeight = placement.absolute.height || 0
      mode = "absolute"
    } else if (placement.relative) {
      // Relative coordinates (0..1 of page)
      x = placement.relative.x * width
      y = placement.relative.y * height
      targetWidth = (placement.relative.width || 0) * width
      targetHeight = (placement.relative.height || 0) * height
      mode = "relative"
    } else if (placement.topLeftUI) {
      // Top-left UI coordinates - need rotation-aware conversion
      const angle = rotation % 360
      const vw = (angle % 180 === 0) ? width : height  // viewer width
      const vh = (angle % 180 === 0) ? height : width  // viewer height
      
      // Convert top-left viewer coords to bottom-left viewer coords
      const xV = placement.topLeftUI.x
      const yV = vh - placement.topLeftUI.y - (placement.topLeftUI.height || 0)
      
      // Map viewer (rotated) to PDF (unrotated)
      switch (angle) {
        case 0:
          x = xV
          y = yV
          targetWidth = placement.topLeftUI.width || 0
          targetHeight = placement.topLeftUI.height || 0
          break
        case 90:
          x = height - yV - (placement.topLeftUI.height || 0)
          y = xV
          targetWidth = placement.topLeftUI.height || 0
          targetHeight = placement.topLeftUI.width || 0
          break
        case 180:
          x = width - xV - (placement.topLeftUI.width || 0)
          y = height - yV - (placement.topLeftUI.height || 0)
          targetWidth = placement.topLeftUI.width || 0
          targetHeight = placement.topLeftUI.height || 0
          break
        case 270:
          x = yV
          y = width - xV - (placement.topLeftUI.width || 0)
          targetWidth = placement.topLeftUI.height || 0
          targetHeight = placement.topLeftUI.width || 0
          break
        default:
          x = xV
          y = yV
          targetWidth = placement.topLeftUI.width || 0
          targetHeight = placement.topLeftUI.height || 0
      }
      mode = "topLeftUI"
    } else {
      // Default using fitBoxPct
      const fitPct = placement.fitBoxPct || 0.2
      targetWidth = width * fitPct
      targetHeight = 0 // Will be computed by aspect ratio
      x = 0
      y = 0
      mode = "computed"
    }

    // Size rules - preserve aspect ratio
    if (targetWidth > 0 && targetHeight === 0) {
      // Only width provided, derive height by aspect ratio
      targetHeight = targetWidth * (img.height / img.width)
    } else if (targetHeight > 0 && targetWidth === 0) {
      // Only height provided, derive width by aspect ratio
      targetWidth = targetHeight * (img.width / img.height)
    } else if (targetWidth === 0 && targetHeight === 0) {
      // Neither given, use fitBoxPct for width then derive height
      const fitPct = placement.fitBoxPct || 0.2
      targetWidth = width * fitPct
      targetHeight = targetWidth * (img.height / img.width)
    }

    // Log 2: TARGET_RECT
    console.log("TARGET_RECT", { x, y, width: targetWidth, height: targetHeight, mode })

    // 5) Bounds safety
    x = Math.max(0, Math.min(x, width - targetWidth))
    y = Math.max(0, Math.min(y, height - targetHeight))
    targetWidth = Math.min(targetWidth, width)
    targetHeight = Math.min(targetHeight, height)

    // 4) Compensate for page rotation to keep signature visually horizontal
    page.drawImage(img, {
      x,
      y,
      width: targetWidth,
      height: targetHeight,
      rotate: degrees(-rotation), // Counter page rotation to keep signature upright
      opacity: 1
    })

    // Log 3: PLACED
    console.log("PLACED", { pageIndex: placement.pageIndex, x, y, width: targetWidth, height: targetHeight })
  }

  // 7) Save
  const out = await pdfDoc.save()
  return out
}
