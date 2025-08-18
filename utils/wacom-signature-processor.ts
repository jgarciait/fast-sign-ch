/**
 * Wacom Signature Processor
 * Handles the processing of Wacom signatures to prevent distortion and maintain quality
 */

export interface WacomSignatureProcessingOptions {
  maxWidth?: number
  maxHeight?: number
  minWidth?: number
  minHeight?: number
  transparencyThreshold?: number
  quality?: number
}

export interface ProcessedSignatureResult {
  dataUrl: string
  width: number
  height: number
  aspectRatio: number
  originalDimensions: {
    width: number
    height: number
    aspectRatio: number
  }
}

/**
 * Process Wacom signature to prevent distortion and improve quality
 */
export const processWacomSignature = (
  imageDataUrl: string,
  options: WacomSignatureProcessingOptions = {}
): Promise<ProcessedSignatureResult> => {
  const {
    maxWidth = 600,
    maxHeight = 300,
    minWidth = 200,
    minHeight = 100,
    transparencyThreshold = 240,
    quality = 0.95
  } = options

  return new Promise((resolve, reject) => {
    const img = new Image()
    
    img.onload = () => {
      try {
        // Create a canvas to process the image
        const canvas = document.createElement('canvas')
        
        // Calculate proper dimensions maintaining aspect ratio
        let { width, height } = img
        const originalAspectRatio = width / height
        
        // Scale down if too large while maintaining aspect ratio
        if (width > maxWidth) {
          width = maxWidth
          height = width / originalAspectRatio
        }
        
        if (height > maxHeight) {
          height = maxHeight
          width = height * originalAspectRatio
        }
        
        // Ensure minimum dimensions
        width = Math.max(width, minWidth)
        height = Math.max(height, minHeight)
        
        // Final aspect ratio check
        const finalAspectRatio = width / height
        
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d', { alpha: true })
        
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        // Clear canvas with transparent background
        ctx.clearRect(0, 0, width, height)
        
        // Draw the image with proper scaling
        ctx.drawImage(img, 0, 0, width, height)
        
        // Get image data and make white/light pixels transparent
        const imageData = ctx.getImageData(0, 0, width, height)
        const data = imageData.data

        // Enhanced transparency processing for Wacom signatures
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]

          // More aggressive transparency for Wacom signatures
          // Convert white and very light pixels to transparent
          if (r > transparencyThreshold && g > transparencyThreshold && b > transparencyThreshold) {
            data[i + 3] = 0 // Set alpha to 0
          } else if (r > transparencyThreshold - 20 && g > transparencyThreshold - 20 && b > transparencyThreshold - 20) {
            // Make very light pixels semi-transparent
            data[i + 3] = Math.max(0, data[i + 3] - 100)
          }
        }

        // Put processed data back on canvas
        ctx.putImageData(imageData, 0, 0)
        
        // Return processed image as data URL with consistent format
        const dataUrl = canvas.toDataURL('image/png', quality)
        
        resolve({
          dataUrl,
          width,
          height,
          aspectRatio: finalAspectRatio,
          originalDimensions: {
            width: img.width,
            height: img.height,
            aspectRatio: originalAspectRatio
          }
        })
      } catch (error) {
        reject(error)
      }
    }
    
    // Handle image loading errors
    img.onerror = () => {
      reject(new Error('Failed to load Wacom signature image'))
    }
    
    img.src = imageDataUrl
  })
}

/**
 * Calculate optimal dimensions for Wacom signature in PDF
 */
export const calculateWacomSignatureDimensions = (
  originalWidth: number,
  originalHeight: number,
  targetWidth: number,
  targetHeight: number,
  pageWidth: number,
  pageHeight: number,
  x: number,
  y: number
): { width: number; height: number; adjusted: boolean } => {
  const originalAspectRatio = originalWidth / originalHeight
  const targetAspectRatio = targetWidth / targetHeight
  
  let width = targetWidth
  let height = targetHeight
  let adjusted = false
  
  // Check if aspect ratio differs significantly
  if (Math.abs(originalAspectRatio - targetAspectRatio) > 0.1) {
    adjusted = true
    
    // Maintain aspect ratio for Wacom signatures
    if (originalAspectRatio > targetAspectRatio) {
      // Original is wider, adjust height
      height = width / originalAspectRatio
    } else {
      // Original is taller, adjust width
      width = height * originalAspectRatio
    }
    
    // Ensure dimensions fit within page bounds
    if (width > pageWidth - x) {
      width = pageWidth - x
      height = width / originalAspectRatio
    }
    if (height > pageHeight - y) {
      height = pageHeight - y
      width = height * originalAspectRatio
    }
    
    // Ensure minimum dimensions
    width = Math.max(width, 10)
    height = Math.max(height, 10)
  }
  
  return { width, height, adjusted }
}

/**
 * Validate Wacom signature data
 */
export const validateWacomSignature = (imageDataUrl: string): boolean => {
  if (!imageDataUrl || typeof imageDataUrl !== 'string') {
    return false
  }
  
  // Check if it's a valid data URL
  if (!imageDataUrl.startsWith('data:image/')) {
    return false
  }
  
  // Check if it has base64 data
  const parts = imageDataUrl.split(',')
  if (parts.length !== 2 || !parts[1]) {
    return false
  }
  
  return true
} 