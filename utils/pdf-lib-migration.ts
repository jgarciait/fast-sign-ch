/**
 * MIGRATION UTILITY FOR PDF-LIB EXCLUSIVE SYSTEM
 * 
 * This utility helps migrate existing signature operations and coordinate systems
 * to use the new pdf-lib exclusive approach.
 */

import { 
  loadPDFPropertiesFromURL, 
  PDFPageProperties 
} from './pdf-lib-dimensions'
import { 
  SignatureCoordinates, 
  createSignatureFromRelative,
  formatSignatureForStorage
} from './signature-coordinates'
import { 
  MergeSignature, 
  createMergeSignatureFromLegacy,
  mergePDFWithSignatures
} from './pdf-lib-merge'

export interface LegacySignature {
  id?: string
  x?: number
  y?: number
  width?: number
  height?: number
  relativeX?: number
  relativeY?: number
  relativeWidth?: number
  relativeHeight?: number
  page?: number
  imageData?: string
  dataUrl?: string
  source?: string
  signatureSource?: string
  timestamp?: string | Date
}

export interface MigrationResult {
  success: boolean
  migratedSignatures: SignatureCoordinates[]
  failedSignatures: Array<{ signature: LegacySignature; reason: string }>
  stats: {
    total: number
    migrated: number
    failed: number
  }
}

/**
 * Migrate a collection of legacy signatures to use pdf-lib coordinates
 */
export async function migrateLegacySignatures(
  legacySignatures: LegacySignature[],
  documentUrl: string
): Promise<MigrationResult> {
  console.log(`🔄 PDF-LIB MIGRATION: Starting migration of ${legacySignatures.length} signatures`)
  
  const migratedSignatures: SignatureCoordinates[] = []
  const failedSignatures: Array<{ signature: LegacySignature; reason: string }> = []
  
  try {
    // Load document properties once
    const docProperties = await loadPDFPropertiesFromURL(documentUrl)
    console.log(`📄 PDF-LIB MIGRATION: Document properties loaded for ${docProperties.totalPages} pages`)
    
    for (const legacySignature of legacySignatures) {
      try {
        const pageNumber = legacySignature.page || 1
        const pageProperties = docProperties.pages.get(pageNumber)
        
        if (!pageProperties) {
          failedSignatures.push({
            signature: legacySignature,
            reason: `Page ${pageNumber} not found in document`
          })
          continue
        }
        
        // Use unified placement system for migration
        try {
          // Extract relative coordinates
          let relativeX, relativeY, relativeWidth, relativeHeight

          if (
            legacySignature.relativeX !== undefined &&
            legacySignature.relativeY !== undefined &&
            legacySignature.relativeWidth !== undefined &&
            legacySignature.relativeHeight !== undefined
          ) {
            // Use existing relative coordinates
            relativeX = legacySignature.relativeX
            relativeY = legacySignature.relativeY
            relativeWidth = legacySignature.relativeWidth
            relativeHeight = legacySignature.relativeHeight
          } else if (
            legacySignature.x !== undefined &&
            legacySignature.y !== undefined &&
            legacySignature.width !== undefined &&
            legacySignature.height !== undefined
          ) {
            // Calculate relative from absolute
            relativeX = legacySignature.x / pageProperties.width
            relativeY = legacySignature.y / pageProperties.height
            relativeWidth = legacySignature.width / pageProperties.width
            relativeHeight = legacySignature.height / pageProperties.height
          } else {
            throw new Error('Insufficient coordinate data')
          }

          // Use unified placement system
          const { placeSignature } = require('./signature-placement')
          
          const result = placeSignature(
            {
              pageNumber,
              original: { 
                W: pageProperties.originalWidth || pageProperties.width, 
                H: pageProperties.originalHeight || pageProperties.height 
              },
              rotation: pageProperties.actualRotate || 0
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

          const migratedCoords = {
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

          migratedSignatures.push(migratedCoords)
          console.log(`✅ PDF-LIB MIGRATION: Migrated signature for page ${pageNumber}`)
          console.log(result.log)
        } catch (error) {
          failedSignatures.push({
            signature: legacySignature,
            reason: `Migration error: ${error.message}`
          })
        }
      } catch (error) {
        failedSignatures.push({
          signature: legacySignature,
          reason: error instanceof Error ? error.message : 'Unknown migration error'
        })
      }
    }
    
    console.log(`✅ PDF-LIB MIGRATION: Migration completed`, {
      total: legacySignatures.length,
      migrated: migratedSignatures.length,
      failed: failedSignatures.length
    })
    
    return {
      success: true,
      migratedSignatures,
      failedSignatures,
      stats: {
        total: legacySignatures.length,
        migrated: migratedSignatures.length,
        failed: failedSignatures.length
      }
    }
  } catch (error) {
    console.error(`❌ PDF-LIB MIGRATION: Migration failed:`, error)
    
    return {
      success: false,
      migratedSignatures: [],
      failedSignatures: legacySignatures.map(sig => ({
        signature: sig,
        reason: error instanceof Error ? error.message : 'Unknown migration error'
      })),
      stats: {
        total: legacySignatures.length,
        migrated: 0,
        failed: legacySignatures.length
      }
    }
  }
}

/**
 * Convert legacy merge operation to use pdf-lib exclusively
 */
export async function migrateLegacyMergeOperation(
  pdfData: ArrayBuffer | string,
  legacySignatures: LegacySignature[],
  documentUrl?: string
): Promise<{ success: boolean; pdfData?: ArrayBuffer; error?: string }> {
  try {
    console.log(`🔄 PDF-LIB MIGRATION: Converting legacy merge operation`)
    
    // Load document properties
    let docProperties
    if (documentUrl) {
      docProperties = await loadPDFPropertiesFromURL(documentUrl)
    } else {
      // Load from PDF data directly
      const { loadPDFProperties } = await import('./pdf-lib-dimensions')
      docProperties = await loadPDFProperties(pdfData)
    }
    
    // Convert legacy signatures to merge signatures
    const mergeSignatures: MergeSignature[] = []
    
    for (const legacySignature of legacySignatures) {
      const pageNumber = legacySignature.page || 1
      const pageProperties = docProperties.pages.get(pageNumber)
      
      if (!pageProperties) {
        console.warn(`⚠️ PDF-LIB MIGRATION: Skipping signature for non-existent page ${pageNumber}`)
        continue
      }
      
      const mergeSignature = createMergeSignatureFromLegacy(legacySignature, pageProperties)
      if (mergeSignature) {
        mergeSignatures.push(mergeSignature)
      }
    }
    
    console.log(`🔄 PDF-LIB MIGRATION: Created ${mergeSignatures.length} merge signatures`)
    
    // Perform the merge using pdf-lib
    const mergeResult = await mergePDFWithSignatures(pdfData, mergeSignatures)
    
    if (mergeResult.success && mergeResult.pdfData) {
      console.log(`✅ PDF-LIB MIGRATION: Legacy merge operation completed successfully`)
      return {
        success: true,
        pdfData: mergeResult.pdfData
      }
    } else {
      return {
        success: false,
        error: mergeResult.error || 'Unknown merge error'
      }
    }
  } catch (error) {
    console.error(`❌ PDF-LIB MIGRATION: Legacy merge operation failed:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown migration error'
    }
  }
}

/**
 * Update a legacy annotation editor's signature handling
 */
export function migrateLegacyAnnotationEditor(
  legacyPageInfo: any,
  documentUrl: string
): {
  shouldMigrate: boolean
  migratedPageInfo?: any
  migrationNotes: string[]
} {
  const migrationNotes: string[] = []
  
  // Check if this is using legacy dimension correction
  if (legacyPageInfo?.source === 'force-corrected' || 
      legacyPageInfo?.correctionApplied ||
      legacyPageInfo?.originalReactPdfDimensions) {
    
    migrationNotes.push('Page info uses legacy dimension correction system')
    migrationNotes.push('Should migrate to pdf-lib exclusive system for accurate coordinates')
    
    return {
      shouldMigrate: true,
      migrationNotes
    }
  }
  
  // Check if this is already using pdf-lib
  if (legacyPageInfo?.source === 'pdf-lib-exclusive' || 
      legacyPageInfo?.pdfLibProperties) {
    
    migrationNotes.push('Page info already uses pdf-lib system')
    
    return {
      shouldMigrate: false,
      migrationNotes
    }
  }
  
  // Check for hardcoded dimensions
  if (legacyPageInfo?.originalWidth === 612 && legacyPageInfo?.originalHeight === 792) {
    migrationNotes.push('Page info may be using hardcoded US Letter dimensions')
    migrationNotes.push('Should verify with actual pdf-lib dimensions')
    
    return {
      shouldMigrate: true,
      migrationNotes
    }
  }
  
  migrationNotes.push('Cannot determine if migration is needed - recommend using pdf-lib system')
  
  return {
    shouldMigrate: true,
    migrationNotes
  }
}

/**
 * Generate a migration report for a document
 */
export async function generateMigrationReport(
  documentUrl: string,
  legacySignatures?: LegacySignature[]
): Promise<{
  documentInfo: {
    totalPages: number
    hasConsistentDimensions: boolean
    pages: Array<{
      pageNumber: number
      width: number
      height: number
      rotate: number
      orientation: string
    }>
  }
  migrationNeeded: boolean
  recommendations: string[]
}> {
  try {
    console.log(`📊 PDF-LIB MIGRATION: Generating migration report for ${documentUrl}`)
    
    // Load document properties
    const docProperties = await loadPDFPropertiesFromURL(documentUrl)
    const { validateDocumentConsistency } = await import('./pdf-lib-dimensions')
    const consistency = validateDocumentConsistency(docProperties)
    
    const documentInfo = {
      totalPages: docProperties.totalPages,
      hasConsistentDimensions: consistency.isConsistent,
      pages: Array.from(docProperties.pages.entries()).map(([pageNumber, properties]) => ({
        pageNumber,
        width: properties.width,
        height: properties.height,
        rotate: properties.rotate,
        orientation: properties.orientation
      }))
    }
    
    const recommendations: string[] = []
    let migrationNeeded = false
    
    // Check for rotation
    const rotatedPages = documentInfo.pages.filter(p => p.rotate !== 0)
    if (rotatedPages.length > 0) {
      recommendations.push(`Document has ${rotatedPages.length} rotated pages that require special handling`)
      migrationNeeded = true
    }
    
    // Check for dimension inconsistencies
    if (!consistency.isConsistent) {
      recommendations.push('Document has inconsistent page dimensions across pages')
      recommendations.push('Each page should be handled individually with its own pdf-lib properties')
      migrationNeeded = true
    }
    
    // Check legacy signatures
    if (legacySignatures && legacySignatures.length > 0) {
      const signaturesWithoutRelativeCoords = legacySignatures.filter(sig => 
        sig.relativeX === undefined || sig.relativeY === undefined
      )
      
      if (signaturesWithoutRelativeCoords.length > 0) {
        recommendations.push(`${signaturesWithoutRelativeCoords.length} signatures lack relative coordinates`)
        migrationNeeded = true
      }
      
      const signaturesWithHardcodedDimensions = legacySignatures.filter(sig =>
        (sig.x !== undefined && sig.y !== undefined) && 
        (sig.relativeX === undefined || sig.relativeY === undefined)
      )
      
      if (signaturesWithHardcodedDimensions.length > 0) {
        recommendations.push(`${signaturesWithHardcodedDimensions.length} signatures use hardcoded coordinates`)
        migrationNeeded = true
      }
    }
    
    // Standard recommendations
    recommendations.push('Use enhanced-pdf-page-with-overlay component for visualization')
    recommendations.push('Use pdf-lib-merge utility for signature placement')
    recommendations.push('Use signature-coordinates utility for coordinate management')
    
    if (!migrationNeeded) {
      recommendations.push('Document appears ready for pdf-lib exclusive system')
    }
    
    console.log(`📊 PDF-LIB MIGRATION: Report generated - Migration needed: ${migrationNeeded}`)
    
    return {
      documentInfo,
      migrationNeeded,
      recommendations
    }
  } catch (error) {
    console.error(`❌ PDF-LIB MIGRATION: Failed to generate migration report:`, error)
    throw error
  }
}
