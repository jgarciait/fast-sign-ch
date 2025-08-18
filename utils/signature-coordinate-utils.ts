/**
 * UNIFIED SIGNATURE COORDINATE SYSTEM
 * 
 * Este archivo contiene la lógica EXACTA que usa el sistema de mapeo de firmas.
 * TODOS los sistemas de merge PDF DEBEN usar estas funciones para garantizar
 * que las firmas se coloquen en la misma posición que fueron mapeadas.
 * 
 * REGLA CRÍTICA: Las coordenadas se capturan en sistema top-left (frontend),
 * pero se convierten a bottom-left para PDF-lib (backend).
 */

export interface SignaturePosition {
  x: number
  y: number
  width: number
  height: number
  page: number
  relativeX: number
  relativeY: number
  relativeWidth: number
  relativeHeight: number
}

export interface PDFPageDimensions {
  width: number
  height: number
}

/**
 * Obtiene las dimensiones RAW del PDF directamente usando pdf-lib
 * SIN aplicar correcciones automáticas ni transformaciones
 * Esta es la fuente de verdad para ambos mapeo y merge
 */
export async function getRawPDFPageDimensions(
  pdfData: ArrayBuffer,
  pageNumber: number = 1
): Promise<PDFPageDimensions> {
  const { PDFDocument } = await import('pdf-lib')
  
  const pdfDoc = await PDFDocument.load(pdfData)
  const pageIndex = Math.max(0, Math.min(pageNumber - 1, pdfDoc.getPageCount() - 1))
  const page = pdfDoc.getPage(pageIndex)
  
  // Obtener dimensiones RAW sin ninguna transformación
  const { width, height } = page.getSize()
  
  console.log(`📐 RAW PDF dimensions for page ${pageNumber}:`, {
    width,
    height,
    orientation: width > height ? 'LANDSCAPE' : 'PORTRAIT',
    note: 'These are the TRUE dimensions that pdf-lib uses - no corrections applied'
  })
  
  return { width, height }
}

/**
 * Convierte las coordenadas relativas de una firma a coordenadas absolutas para PDF-lib
 * EXACTAMENTE como lo hace el sistema de mapeo de firmas.
 * 
 * NOTA: Esta función calcula las coordenadas básicas sin aplicar transformaciones de rotación.
 * La rotación se maneja ahora en el momento de dibujar la firma con pdf-lib.
 */
export function calculateSignaturePosition(
  signature: SignaturePosition,
  pageDimensions: PDFPageDimensions,
  pageRotation: number = 0
): { x: number; y: number; width: number; height: number } {
  
  // LÓGICA EXACTA DEL SISTEMA DE MAPEO:
  // Use relative coordinates if available (preferred), otherwise fallback to absolute
  const x = signature.relativeX !== undefined 
    ? signature.relativeX * pageDimensions.width 
    : (signature.x || 100)
    
  const topLeftY = signature.relativeY !== undefined 
    ? signature.relativeY * pageDimensions.height 
    : (signature.y || 100)
    
  const width = signature.relativeWidth !== undefined 
    ? signature.relativeWidth * pageDimensions.width 
    : (signature.width || 200)
    
  const height = signature.relativeHeight !== undefined 
    ? signature.relativeHeight * pageDimensions.height 
    : (signature.height || 100)

  // 🚨 CRITICAL Y-COORDINATE CONVERSION: Frontend uses top-left (Y=0 at top)
  // but PDF-lib uses bottom-left (Y=0 at bottom). Convert Y coordinate:
  const y = pageDimensions.height - topLeftY - height

  // Las coordenadas calculadas aquí son las básicas.
  // La rotación se maneja en pdf-lib-merge.ts usando degrees(-rotation)

  

  
  return { x, y, width, height }
}

/**
 * Valida que una firma tenga las coordenadas necesarias para ser procesada
 */
export function validateSignatureCoordinates(signature: any): signature is SignaturePosition {
  // Require either absolute coordinates or relative coordinates
  const hasAbsoluteCoords = typeof signature.x === 'number' && typeof signature.y === 'number'
  const hasRelativeCoords = typeof signature.relativeX === 'number' && typeof signature.relativeY === 'number'
  
  return hasAbsoluteCoords || hasRelativeCoords
}

/**
 * Convierte coordenadas de pantalla (del editor) a coordenadas relativas
 * Esta es la lógica EXACTA del sistema de mapeo de firmas
 */
export function screenToRelativeCoordinates(
  screenX: number,
  screenY: number, 
  screenWidth: number,
  screenHeight: number,
  originalPageWidth: number,
  originalPageHeight: number
): { relativeX: number; relativeY: number; relativeWidth: number; relativeHeight: number } {
  
  return {
    relativeX: screenX / originalPageWidth,
    relativeY: screenY / originalPageHeight,
    relativeWidth: screenWidth / originalPageWidth,
    relativeHeight: screenHeight / originalPageHeight
  }
}

/**
 * Debug function para comparar sistemas de coordenadas
 * La rotación se maneja ahora correctamente en pdf-lib-merge.ts
 */
export function debugCoordinateConversion(
  signature: SignaturePosition,
  pageDimensions: PDFPageDimensions,
  pageRotation: number = 0
) {
  const position = calculateSignaturePosition(signature, pageDimensions, pageRotation)
  
  console.log('🔍 SIGNATURE COORDINATE DEBUG (ROTATION IGNORED):', {
    input: {
      relativeCoords: {
        x: signature.relativeX,
        y: signature.relativeY,
        width: signature.relativeWidth,
        height: signature.relativeHeight
      },
      absoluteCoords: {
        x: signature.x,
        y: signature.y,
        width: signature.width,
        height: signature.height
      },
      page: signature.page
    },
    rawPageDimensions: pageDimensions,
    pageRotation: pageRotation,
    pageRotationHandled: 'in pdf-lib-merge.ts with degrees(-rotation)',
    calculatedPosition: position,
    coordinateSystem: 'converted from top-left (frontend) to bottom-left (PDF-lib)',
    orientation: pageDimensions.width > pageDimensions.height ? 'LANDSCAPE' : 'PORTRAIT',
    signatureOrientation: 'counter-rotated to appear horizontal',
    note: '✅ Page rotation is now properly handled with counter-rotation'
  })
  
  return position
}

/**
 * Función para validar que las dimensiones del mapeo y del merge coincidan
 */
export function validateDimensionConsistency(
  mappingDimensions: PDFPageDimensions,
  mergeDimensions: PDFPageDimensions,
  tolerance: number = 1
): { consistent: boolean; message: string } {
  
  const widthDiff = Math.abs(mappingDimensions.width - mergeDimensions.width)
  const heightDiff = Math.abs(mappingDimensions.height - mergeDimensions.height)
  
  const consistent = widthDiff <= tolerance && heightDiff <= tolerance
  
  const message = consistent 
    ? `✅ Dimensions are consistent within tolerance (${tolerance}px)`
    : `❌ DIMENSION MISMATCH! Mapping: ${mappingDimensions.width}x${mappingDimensions.height}, Merge: ${mergeDimensions.width}x${mergeDimensions.height}, Diff: ${widthDiff}x${heightDiff}`
  
  console.log('🔍 DIMENSION CONSISTENCY CHECK:', {
    mappingDimensions,
    mergeDimensions,
    differences: { width: widthDiff, height: heightDiff },
    tolerance,
    consistent,
    message
  })
  
  return { consistent, message }
}

/**
 * Función que detecta la rotación de una página PDF
 * La rotación se usa ahora para aplicar counter-rotation a las firmas
 */
export function getPageRotation(page: any): { 
  rotation: number; 
  handled: boolean; 
  message: string 
} {
  try {
    // Detectar rotación de la página usando pdf-lib
    const rotation = page.getRotation ? page.getRotation().angle : 0
    
    const message = rotation !== 0 
      ? `📐 Page has ${rotation}° rotation - will counter-rotate signatures by ${-rotation}°`
      : `✅ Page has no rotation - signatures will be drawn normally`
    
    console.log('🔍 PAGE ROTATION DETECTION:', {
      detectedRotation: rotation,
      willBeCounterRotated: rotation !== 0,
      counterRotation: -rotation,
      message
    })
    
    return {
      rotation,
      handled: true,
      message
    }
  } catch (error) {
    console.warn('Could not detect page rotation, assuming 0°:', error)
    return {
      rotation: 0,
      handled: true,
      message: '⚠️ Could not detect page rotation - assuming 0°'
    }
  }
}

/**
 * Detecta la rotación de una página PDF pero la IGNORA completamente
 * Esta función es usada para logging pero NO aplicamos transformaciones automáticas
 * Usado específicamente en el endpoint /send para mantener coordenadas RAW
 */
export function getPageRotationAndIgnoreIt(page: any): { rotation: number; message: string } {
  try {
    // Intentar obtener la rotación de la página
    const rotation = page.getRotation ? page.getRotation().angle : 0
    
    const message = rotation === 0 
      ? `Page has no rotation (${rotation}°) - using raw dimensions without corrections`
      : `Page has ${rotation}° rotation - IGNORING rotation and using raw dimensions`
    
    return {
      rotation,
      message
    }
  } catch (error) {
    // Si hay error obteniendo rotación, asumir 0 y continuar
    return {
      rotation: 0,
      message: 'Could not detect page rotation - assuming 0° and using raw dimensions'
    }
  }
}