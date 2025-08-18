/**
 * DEBUG UTILITY FOR SIGNATURE COORDINATE ISSUES
 * 
 * This utility helps debug coordinate mismatches between frontend and backend
 * for scanned documents in the fast-sign system.
 */

export interface DebugCoordinateData {
  documentType: 'scanned' | 'pc-created'
  stage: 'frontend-drop' | 'backend-merge' | 'coordinate-conversion'
  pageProperties: {
    width: number
    height: number
    orientation: 'portrait' | 'landscape'
    isScannedDocument: boolean
    correctionApplied: boolean
  }
  coordinates: {
    screen?: { x: number; y: number }
    absolute?: { x: number; y: number; width: number; height: number }
    relative?: { x: number; y: number; width: number; height: number }
  }
  metadata?: any
}

/**
 * Debug logger specifically for signature coordinate issues
 */
export function logSignatureCoordinateDebug(data: DebugCoordinateData): void {
  const emoji = data.documentType === 'scanned' ? '📄' : '💻'
  const stage = data.stage.toUpperCase()
  
  console.group(`${emoji} SIGNATURE DEBUG - ${stage}`)
  
  console.log('📐 Page Properties:', {
    dimensions: `${data.pageProperties.width}x${data.pageProperties.height}`,
    orientation: data.pageProperties.orientation,
    isScanned: data.pageProperties.isScannedDocument,
    correctionApplied: data.pageProperties.correctionApplied,
    aspectRatio: (data.pageProperties.width / data.pageProperties.height).toFixed(3)
  })
  
  console.log('📍 Coordinates:', data.coordinates)
  
  if (data.metadata) {
    console.log('🔧 Additional Data:', data.metadata)
  }
  
  // Highlight potential issues
  const issues: string[] = []
  
  if (data.pageProperties.isScannedDocument && !data.pageProperties.correctionApplied) {
    issues.push('⚠️ Scanned document but no correction applied')
  }
  
  if (data.pageProperties.width > data.pageProperties.height && data.pageProperties.orientation === 'portrait') {
    issues.push('⚠️ Width > Height but orientation is portrait')
  }
  
  if (data.pageProperties.width < data.pageProperties.height && data.pageProperties.orientation === 'landscape') {
    issues.push('⚠️ Height > Width but orientation is landscape')
  }
  
  if (issues.length > 0) {
    console.warn('🚨 POTENTIAL ISSUES DETECTED:')
    issues.forEach(issue => console.warn(issue))
  }
  
  console.groupEnd()
}

/**
 * Compare coordinate data between different stages
 */
export function compareCoordinateData(
  frontendData: DebugCoordinateData,
  backendData: DebugCoordinateData
): void {
  console.group('🔍 COORDINATE COMPARISON - Frontend vs Backend')
  
  // Compare page dimensions
  const frontendDims = frontendData.pageProperties
  const backendDims = backendData.pageProperties
  
  console.log('📐 DIMENSION COMPARISON:', {
    frontend: {
      size: `${frontendDims.width}x${frontendDims.height}`,
      orientation: frontendDims.orientation,
      correctionApplied: frontendDims.correctionApplied
    },
    backend: {
      size: `${backendDims.width}x${backendDims.height}`,
      orientation: backendDims.orientation,  
      correctionApplied: backendDims.correctionApplied
    },
    match: {
      dimensions: frontendDims.width === backendDims.width && frontendDims.height === backendDims.height,
      orientation: frontendDims.orientation === backendDims.orientation,
      correctionStatus: frontendDims.correctionApplied === backendDims.correctionApplied
    }
  })
  
  // Compare coordinate systems if both have coordinates
  if (frontendData.coordinates.relative && backendData.coordinates.relative) {
    console.log('📍 COORDINATE COMPARISON:', {
      frontend: frontendData.coordinates.relative,
      backend: backendData.coordinates.relative,
      difference: {
        x: Math.abs(frontendData.coordinates.relative.x - backendData.coordinates.relative.x),
        y: Math.abs(frontendData.coordinates.relative.y - backendData.coordinates.relative.y)
      }
    })
  }
  
  console.groupEnd()
}

/**
 * Quick debug function for browser console
 */
export function debugSignatureIssue(message: string, data: any): void {
  console.group(`🐛 SIGNATURE DEBUG: ${message}`)
  console.log(data)
  console.groupEnd()
}

/**
 * Log the complete signature flow from drop to merge
 */
export function logSignatureFlow(stages: DebugCoordinateData[]): void {
  console.group('🔄 COMPLETE SIGNATURE FLOW')
  
  stages.forEach((stage, index) => {
    console.log(`${index + 1}. ${stage.stage}:`, {
      dimensions: `${stage.pageProperties.width}x${stage.pageProperties.height}`,
      orientation: stage.pageProperties.orientation,
      coords: stage.coordinates,
      isScanned: stage.pageProperties.isScannedDocument
    })
  })
  
  // Check for consistency issues across stages
  const firstStage = stages[0]
  const inconsistencies = stages.filter(stage => 
    stage.pageProperties.width !== firstStage.pageProperties.width ||
    stage.pageProperties.height !== firstStage.pageProperties.height ||
    stage.pageProperties.orientation !== firstStage.pageProperties.orientation
  )
  
  if (inconsistencies.length > 0) {
    console.error('🚨 INCONSISTENCIES DETECTED across stages!')
    inconsistencies.forEach(stage => {
      console.error(`- ${stage.stage} has different properties than initial stage`)
    })
  } else {
    console.log('✅ All stages use consistent page properties')
  }
  
  console.groupEnd()
}
