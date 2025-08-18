/**
 * Signature Aspect Ratio Preservation Utility
 * 
 * This utility ensures that signature images (from canvas or Wacom) are never
 * stretched and are properly centered within their designated areas.
 */

export interface SignatureImageDimensions {
  width: number;
  height: number;
  aspectRatio: number;
}

export interface SignatureBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CenteredSignaturePlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  offsetX: number; // How much the image was moved horizontally to center
  offsetY: number; // How much the image was moved vertically to center
}

/**
 * Calculate optimal signature dimensions that preserve aspect ratio
 * and center the signature within the available space
 */
export function calculateCenteredSignaturePlacement(
  imageWidth: number,
  imageHeight: number,
  targetBox: SignatureBox
): CenteredSignaturePlacement {
  
  if (imageWidth <= 0 || imageHeight <= 0) {
    console.warn('Invalid image dimensions:', { imageWidth, imageHeight });
    return {
      x: targetBox.x,
      y: targetBox.y,
      width: targetBox.width,
      height: targetBox.height,
      offsetX: 0,
      offsetY: 0
    };
  }

  const imageAspectRatio = imageWidth / imageHeight;
  const boxAspectRatio = targetBox.width / targetBox.height;

  let finalWidth: number;
  let finalHeight: number;

  // Determine which dimension should be constrained to preserve aspect ratio
  if (imageAspectRatio > boxAspectRatio) {
    // Image is wider relative to its height than the box
    // Constrain by width, calculate height
    finalWidth = targetBox.width;
    finalHeight = targetBox.width / imageAspectRatio;
    
    // If calculated height exceeds box height, constrain by height instead
    if (finalHeight > targetBox.height) {
      finalHeight = targetBox.height;
      finalWidth = targetBox.height * imageAspectRatio;
    }
  } else {
    // Image is taller relative to its width than the box
    // Constrain by height, calculate width
    finalHeight = targetBox.height;
    finalWidth = targetBox.height * imageAspectRatio;
    
    // If calculated width exceeds box width, constrain by width instead
    if (finalWidth > targetBox.width) {
      finalWidth = targetBox.width;
      finalHeight = targetBox.width / imageAspectRatio;
    }
  }

  // Calculate centering offsets
  const offsetX = (targetBox.width - finalWidth) / 2;
  const offsetY = (targetBox.height - finalHeight) / 2;

  // Calculate final position (centered within the box)
  const finalX = targetBox.x + offsetX;
  const finalY = targetBox.y + offsetY;

  const result = {
    x: finalX,
    y: finalY,
    width: finalWidth,
    height: finalHeight,
    offsetX,
    offsetY
  };

  console.log('🎯 SIGNATURE ASPECT RATIO CALCULATION:', {
    input: {
      imageSize: { width: imageWidth, height: imageHeight, aspectRatio: imageAspectRatio },
      targetBox,
      boxAspectRatio
    },
    output: result,
    preservationMode: imageAspectRatio > boxAspectRatio ? 'width-constrained' : 'height-constrained'
  });

  return result;
}

/**
 * Get image dimensions from a base64 data URL
 * This is useful for canvas and Wacom signatures
 */
export function getImageDimensionsFromDataUrl(dataUrl: string): Promise<SignatureImageDimensions> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      resolve({
        width: img.width,
        height: img.height,
        aspectRatio: img.width / img.height
      });
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image from data URL'));
    };
    
    img.src = dataUrl;
  });
}

/**
 * For server-side usage, extract dimensions from embedded PDF image
 * This works with pdf-lib embedded images
 */
export function getEmbeddedImageDimensions(embeddedImage: any): SignatureImageDimensions {
  const width = embeddedImage.width || embeddedImage.Width || 0;
  const height = embeddedImage.height || embeddedImage.Height || 0;
  
  return {
    width,
    height,
    aspectRatio: height > 0 ? width / height : 1
  };
}

/**
 * Validate that signature placement makes sense
 */
export function validateSignaturePlacement(placement: CenteredSignaturePlacement): boolean {
  return (
    placement.width > 0 &&
    placement.height > 0 &&
    !isNaN(placement.x) &&
    !isNaN(placement.y) &&
    !isNaN(placement.width) &&
    !isNaN(placement.height)
  );
}

/**
 * Apply minimum size constraints to prevent signatures from being too small
 */
export function applyMinimumSizeConstraints(
  placement: CenteredSignaturePlacement,
  minWidth: number = 20,
  minHeight: number = 10
): CenteredSignaturePlacement {
  
  if (placement.width < minWidth || placement.height < minHeight) {
    const aspectRatio = placement.width / placement.height;
    
    let constrainedWidth = Math.max(placement.width, minWidth);
    let constrainedHeight = Math.max(placement.height, minHeight);
    
    // Adjust to maintain aspect ratio
    if (constrainedWidth / constrainedHeight !== aspectRatio) {
      if (constrainedWidth / minWidth > constrainedHeight / minHeight) {
        constrainedHeight = constrainedWidth / aspectRatio;
      } else {
        constrainedWidth = constrainedHeight * aspectRatio;
      }
    }
    
    console.log('📏 APPLIED MINIMUM SIZE CONSTRAINTS:', {
      original: { width: placement.width, height: placement.height },
      constrained: { width: constrainedWidth, height: constrainedHeight },
      minimums: { minWidth, minHeight }
    });
    
    return {
      ...placement,
      width: constrainedWidth,
      height: constrainedHeight
    };
  }
  
  return placement;
}
