import { NextResponse } from "next/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { BUCKET_PUBLIC } from "@/utils/supabase/storage"
import { PDFDocument, rgb, degrees } from 'pdf-lib'
import { ensureValidRelativeDimensions, STANDARD_PAGE_WIDTH, STANDARD_PAGE_HEIGHT } from '@/utils/signature-dimensions'
import { correctPdfPageDimensions, ensureValidRelativeDimensionsWithCorrection } from '@/utils/force-correct-pdf-dimensions'
import { encodeFileNameForHeader } from "@/utils/file-utils"
import { calculateWacomSignatureDimensions } from '@/utils/wacom-signature-processor'
import { screenToPDFSignature, createSignatureFromRelative, PDFPageProperties } from '@/utils/signature-coordinates'
import { calculateSignaturePosition, debugCoordinateConversion, validateSignatureCoordinates, getRawPDFPageDimensions, getPageRotation } from '@/utils/signature-coordinate-utils'

import { extractPageProperties } from '@/utils/pdf-lib-dimensions'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params
    
    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 })
    }
    
    const adminClient = createAdminClient()
    
    // Get document details
    const { data: document, error: documentError } = await adminClient
      .from("documents")
      .select("file_path, file_name, original_file_path, status")
      .eq("id", documentId)
      .single()

    if (documentError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Check if document has been signed (has merged version)
    const hasSignedVersion = document.status === 'firmado' && document.original_file_path
    const filePathToUse = hasSignedVersion ? document.file_path : (document.original_file_path || document.file_path)
    


    // Download the appropriate PDF
    const { data: pdfData, error: downloadError } = await adminClient.storage
      .from(BUCKET_PUBLIC)
      .download(filePathToUse)

    if (downloadError || !pdfData) {
      return NextResponse.json({ 
        error: 'Failed to download document',
        details: downloadError?.message || 'No data returned'
      }, { status: 500 })
    }

    // If we have a signed version, just return it directly (signatures already merged)
    if (hasSignedVersion) {

      const pdfBytes = await pdfData.arrayBuffer()
      
      return new NextResponse(pdfBytes, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; ${encodeFileNameForHeader(`SIGNED_${document.file_name}`)}`,
          "X-Document-Status": "fast-signed",
          "X-Document-Type": "fast_sign",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Access-Control-Allow-Origin": "*",
        },
      })
    }

    // For unsigned documents, get signature data for overlay (fallback mode)

    const { data: signatures, error: sigError } = await adminClient
      .from('document_signatures')
      .select('*')
      .eq('document_id', documentId)

    if (sigError) {
      // Error fetching signatures, continue without them
    }

    // For unsigned documents, process text annotations and signatures for overlay
    const { data: textAnnotations, error: annotationsError } = await adminClient
      .from('document_annotations')
      .select('*')
      .eq('document_id', documentId)
    
    if (annotationsError) {
      // Error loading annotations, continue without them
    }

    // Process annotations for overlay (fallback mode for unsigned documents)
    let annotations: any[] = []

    // Add text annotations
    if (textAnnotations && textAnnotations.length > 0) {
      annotations.push(...textAnnotations.map((ann: any) => ({
        id: ann.id,
        type: ann.annotation_type || 'text',
        x: ann.x,
        y: ann.y,
        width: ann.width,
        height: ann.height,
        page: ann.page,
        text: ann.text,
        fontSize: ann.font_size,
        relativeX: ann.relative_x,
        relativeY: ann.relative_y
      })))
    }

    // Add signatures if any
    if (signatures && signatures.length > 0) {
      console.log('🔍 PRINT ROUTE - STEP 2: Loading signature data from database:', {
        totalSignatureRecords: signatures.length,
        note: 'PRINT ROUTE: This is what was stored by the SAVE ROUTE'
      });

      signatures.forEach((sigRecord: any) => {
        if (sigRecord.signature_data?.signatures) {
          // New format: signatures array
          sigRecord.signature_data.signatures.forEach((sig: any) => {
            console.log('🔍 PRINT ROUTE - STEP 3: FIXED - Processing signature from database:', {
              signatureId: sig.id,
              page: sig.page,
              loadedCoordinates: {
                absolute: { x: sig.x, y: sig.y, width: sig.width, height: sig.height },
                relative: { x: sig.relativeX, y: sig.relativeY, width: sig.relativeWidth, height: sig.relativeHeight }
              },
              originalCoordinates: sig.originalX !== undefined ? {
                absolute: { x: sig.originalX, y: sig.originalY, width: sig.originalWidth, height: sig.originalHeight }
              } : 'not available',
              coordinatesWereTransformed: sig.originalX !== undefined && (sig.x !== sig.originalX || sig.y !== sig.originalY),
              dataSource: 'document_signatures table',
              note: 'PRINT ROUTE: These are now the FINAL coordinates that were drawn to PDF'
            });

            annotations.push({
              id: sig.id,
              type: 'signature',
              x: sig.x,
              y: sig.y,
              width: sig.width || 200,
              height: sig.height || 100,
              page: sig.page || 1,
              relativeX: sig.relativeX,
              relativeY: sig.relativeY,
              relativeWidth: sig.relativeWidth,
              relativeHeight: sig.relativeHeight,
              imageData: sig.dataUrl || '',
              signatureSource: sig.source || 'canvas',
              content: sig.content // Include content field for signature indexing
            })
          })
        }
      })
    }



    // Load PDF for annotation overlay
    const pdfBytes = await pdfData.arrayBuffer()
    const pdfDoc = await PDFDocument.load(pdfBytes)
    const pages = pdfDoc.getPages()
    const drawnPageBorder = new Set<number>()
    let abortReason: string | null = null

    // 🎯 UNIFIED APPROACH: No longer need scanned document detection
    // Page flattening system handles all PDFs uniformly
    console.log('🔍 PRINT ROUTE: Using unified PDF processing approach');

    // Process each annotation with better error handling
    for (const annotation of annotations) {
      try {
        const pageIndex = (annotation.page || 1) - 1 // Convert to 0-based index
        
        if (pageIndex < 0 || pageIndex >= pages.length) {
          continue
        }

        const page = pages[pageIndex]
        
        // 🎯 SINGLE SOURCE OF TRUTH: Use centralized page property extraction
        const pageProperties = extractPageProperties(page, pageIndex + 1)
        
        console.log('🔍 PRINT ROUTE - STEP 4: Raw PDF-lib data vs Normalized data:', {
          signatureId: annotation.id,
          page: pageIndex + 1,
          rawPdfLibData: {
            width: pageProperties.originalWidth,
            height: pageProperties.originalHeight,
            rotation: pageProperties.originalWidth !== undefined ? 'available' : 'not available',
            note: 'Raw data from PDF-lib before normalization'
          },
          normalizedData: {
            width: pageProperties.width,
            height: pageProperties.height,
            rotation: pageProperties.actualRotate,
            orientation: pageProperties.orientation,
            aspectRatio: pageProperties.aspectRatio,
            isScannedDocument: pageProperties.isScannedDocument,
            correctionApplied: pageProperties.scannedOrientationCorrectionApplied
          },
          dataTransformation: {
            widthChanged: pageProperties.originalWidth !== pageProperties.width,
            heightChanged: pageProperties.originalHeight !== pageProperties.height,
            wasNormalized: pageProperties.scannedOrientationCorrectionApplied
          },
          note: 'PRINT ROUTE: Using centralized normalization from pdf-lib-dimensions.ts'
        })
        
        // Use normalized properties from centralized system
        const actualPageWidth = pageProperties.width
        const actualPageHeight = pageProperties.height 
        const actualRotation = pageProperties.actualRotate
        const isLandscapeMisreported = pageProperties.scannedOrientationCorrectionApplied || false

        // Calculate viewer dimensions with normalized orientation
        const correctedViewerWidth = (actualRotation % 180 === 0) ? actualPageWidth : actualPageHeight
        const correctedViewerHeight = (actualRotation % 180 === 0) ? actualPageHeight : actualPageWidth

        // Draw a visible page border to show exactly what the print sees (normalized PDF box)
        if (!drawnPageBorder.has(pageIndex)) {
          page.drawRectangle({
            x: 0,
            y: 0,
            width: actualPageWidth,
            height: actualPageHeight,
            borderColor: rgb(0, 0.6, 1),
            borderWidth: 2,
            color: undefined,
            opacity: 1,
          })
          drawnPageBorder.add(pageIndex)
          console.log('🖼️ PRINT VIEW BOX - UNIFIED PROCESSING', {
            pageIndex,
            rawPdfLibDimensions: { width: pageProperties.originalWidth, height: pageProperties.originalHeight },
            normalizedDimensions: { width: actualPageWidth, height: actualPageHeight },
            normalizedRotation: actualRotation,
            viewer: { width: correctedViewerWidth, height: correctedViewerHeight },
            viewerOrientation: correctedViewerWidth > correctedViewerHeight ? 'landscape' : 'portrait',
            wasNormalized: isLandscapeMisreported,
            note: 'Using same normalization as save route'
          })
        }

        // Update variables to use normalized values
        let viewerWidth = correctedViewerWidth
        let viewerHeight = correctedViewerHeight
        let pageRotation = actualRotation

        if (annotation.type === 'signature' && annotation.imageData) {
          // Normalize signature dimensions using UNIFIED normalized page dimensions
          const normalizedAnnotation = ensureValidRelativeDimensionsWithCorrection(
            annotation, 
            actualPageWidth,  // Use normalized width
            actualPageHeight  // Use normalized height
          )
          try {
            // Extract base64 data from data URL
            const base64Data = annotation.imageData.split(',')[1]
            if (!base64Data) {
              continue
            }

            // Convert base64 to bytes
            const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
            
            // Enhanced image processing for Wacom signatures
            let image
            const isWacomSignature = annotation.signatureSource === 'wacom'
            
            if (annotation.imageData.includes('data:image/png')) {
              image = await pdfDoc.embedPng(imageBytes)
            } else if (annotation.imageData.includes('data:image/jpeg') || annotation.imageData.includes('data:image/jpg')) {
              image = await pdfDoc.embedJpg(imageBytes)
            } else {
              // Default to PNG
              image = await pdfDoc.embedPng(imageBytes)
            }

            // USE THE SAME COORDINATE SYSTEM AS REGULAR DOCUMENTS PRINT API
            // This ensures consistency between fast-sign and regular document printing
            
            let x, y, width, height

            // Calculate position and dimensions ONCE
            if (annotation.relativeX !== undefined && annotation.relativeY !== undefined) {
              // ENHANCED RELATIVE POSITIONING with dimension validation
              
              // Check for potential dimension mismatch indicators
              const hasAbsoluteCoords = annotation.x !== undefined && annotation.y !== undefined
              const expectedAbsoluteX = hasAbsoluteCoords ? annotation.x : null
              const expectedAbsoluteY = hasAbsoluteCoords ? annotation.y : null
              
              // Use relative positioning - convert from browser coordinates using VIEWER dimensions
              x = annotation.relativeX * viewerWidth
              y = annotation.relativeY * viewerHeight
              width = annotation.relativeWidth ? annotation.relativeWidth * viewerWidth : (annotation.width || 300)
              height = annotation.relativeHeight ? annotation.relativeHeight * viewerHeight : (annotation.height || 150)
              
              // DIMENSION MISMATCH DETECTION (NO FALLBACK)
              if (expectedAbsoluteX !== null && expectedAbsoluteY !== null) {
                const xDiff = Math.abs(x - expectedAbsoluteX)
                const yDiff = Math.abs(y - expectedAbsoluteY)
                const xDiffPercent = (xDiff / pageWidth) * 100
                const yDiffPercent = (yDiff / pageHeight) * 100
                if (xDiffPercent > 15 || yDiffPercent > 15) {
                  console.error('COORDINATE_MISMATCH_NO_FALLBACK', {
                    annotationId: annotation.id,
                    expectedAbsolute: { x: expectedAbsoluteX, y: expectedAbsoluteY },
                    computedFromRelative: { x, y, viewerWidth, viewerHeight },
                    percents: { xDiffPercent, yDiffPercent },
                  })
                }
              }
            } else {
              // Legacy fallback for old signatures without relative coordinates
              x = annotation.x || 100
              y = annotation.y || 100
              width = annotation.width || 300
              height = annotation.height || 150
            }

            // Special handling for Wacom signatures to prevent distortion (AFTER coordinate calculation)
            if (isWacomSignature) {
              
              // Get original image dimensions
              const originalWidth = image.width
              const originalHeight = image.height
              
              // Store original box dimensions before adjustment
              const originalBoxWidth = width
              const originalBoxHeight = height
              

              
              // Calculate optimal dimensions using utility function
              const { width: adjustedWidth, height: adjustedHeight, adjusted } = calculateWacomSignatureDimensions(
                originalWidth,
                originalHeight,
                width,
                height,
                pageWidth,
                pageHeight,
                x,
                y // Use y before PDF conversion
              )
              

              
              if (adjusted) {
                width = adjustedWidth
                height = adjustedHeight
                
                // CENTER the Wacom signature within the original signature box
                // Calculate offset to center the adjusted signature in the original box
                const xOffset = (originalBoxWidth - width) / 2
                const yOffset = (originalBoxHeight - height) / 2
                

                
                // Apply centering offset
                x = x + xOffset
                y = y + yOffset
                

                

              } else {

              }
            }

            // Get page rotation for proper handling
            const pageRotationInfo = getPageRotation(page)
            const pageRotation = pageRotationInfo.rotation || 0

            // CRITICAL FIX: Use unified coordinate system that matches mapping system EXACTLY
            if (!validateSignatureCoordinates(annotation)) {
              continue
            }

            // Handle rotation properly using UNIFIED normalized properties
            const legacyPageProperties: PDFPageProperties = {
              width: actualPageWidth,     // Use normalized width
              height: actualPageHeight,   // Use normalized height
              rotate: pageRotation,       // Use normalized rotation
              orientation: pageProperties.orientation,  // Use normalized orientation from centralized system
              aspectRatio: pageProperties.aspectRatio   // Use normalized aspect ratio from centralized system
            }
            
            // 🔍 DEBUG: Log signature coordinates being LOADED for MERGE with UNIFIED properties
            console.log('🔍 PRINT ROUTE - STEP 5: FIXED - Processing final coordinates:', {
              signatureId: annotation.id,
              pageNumber: annotation.page,
              finalCoordinatesFromDatabase: {
                absolute: { x: annotation.x, y: annotation.y, width: annotation.width, height: annotation.height },
                relative: { x: annotation.relativeX, y: annotation.relativeY, width: annotation.relativeWidth, height: annotation.relativeHeight }
              },
              originalCoordinates: annotation.originalX !== undefined ? {
                absolute: { x: annotation.originalX, y: annotation.originalY, width: annotation.originalWidth, height: annotation.originalHeight }
              } : 'not available',
              unifiedPageProperties: {
                width: actualPageWidth,    // Normalized width
                height: actualPageHeight,  // Normalized height
                rotate: pageRotation,      // Normalized rotation
                orientation: pageProperties.orientation, // Normalized orientation
                isScannedDocument: pageProperties.isScannedDocument,
                correctionApplied: pageProperties.scannedOrientationCorrectionApplied
              },
              fix: 'Database now contains FINAL coordinates instead of original frontend coordinates',
              note: 'PRINT ROUTE: These are the exact coordinates that were drawn by save route'
            })

            // Convert viewer coordinates to PDF coordinates accounting for rotation
            const uiRect = {
              x: x,
              y: y,
              width: width,
              height: height
            }
            
            // 🔧 CRITICAL FIX: Database now contains FINAL coordinates from save route
            // NO additional coordinate transformation needed!
            let finalX, finalY, finalWidth, finalHeight
            
            // 🎯 For scanned documents with corrected orientation, use coordinates directly
            if (pageProperties.isScannedDocument && pageProperties.scannedOrientationCorrectionApplied) {
              // SCANNED DOCUMENT: Database coordinates are already final - use directly
              finalX = x
              finalY = y
              finalWidth = width
              finalHeight = height
              console.log(`🔧 PRINT ROUTE - SCANNED DOC FIX: Using database coordinates directly x:${finalX}, y:${finalY} (NO transformation)`)
            } else {
              // NORMAL DOCUMENT: Apply standard coordinate transformation
              const angle = pageRotation % 360
              const W = actualPageWidth   // Use corrected width
              const H = actualPageHeight  // Use corrected height
              
              // Convert top-left viewer coords to bottom-left viewer coords
              const xV = uiRect.x
              const yV = viewerHeight - uiRect.y - uiRect.height
              
              // Map viewer (rotated) to PDF (unrotated)
              switch (angle) {
                case 0:
                  finalX = xV
                  finalY = yV
                  finalWidth = uiRect.width
                  finalHeight = uiRect.height
                  break
                case 90:   // page rotated CW; viewer W=H, H=W
                  finalX = H - yV - uiRect.height
                  finalY = xV
                  finalWidth = uiRect.height
                  finalHeight = uiRect.width
                  break
                case 180:
                  finalX = W - xV - uiRect.width
                  finalY = H - yV - uiRect.height
                  finalWidth = uiRect.width
                  finalHeight = uiRect.height
                  break
                case 270:
                  finalX = yV
                  finalY = W - xV - uiRect.width
                  finalWidth = uiRect.height
                  finalHeight = uiRect.width
                  break
                default:
                  finalX = xV
                  finalY = yV
                  finalWidth = uiRect.width
                  finalHeight = uiRect.height
              }
              console.log(`📐 PRINT ROUTE - NORMAL DOC: Applied rotation-${angle}° transformation x:${finalX}, y:${finalY}`)
            }
            
            // 🔍 DEBUG: Log final coordinates that will be used for PDF merge with UNIFIED processing
            console.log('🔍 PRINT ROUTE - STEP 6: FIXED - Final coordinates being drawn to PDF:', {
              signatureId: annotation.id,
              pageNumber: annotation.page,
              coordinateFlow: {
                databaseCoordinates: { x: annotation.x, y: annotation.y },
                originalCoordinates: annotation.originalX !== undefined ? { x: annotation.originalX, y: annotation.originalY } : 'not available',
                viewerCalculated: { x: x, y: y },
                pdfFinal: { x: finalX, y: finalY, width: finalWidth, height: finalHeight },
                rotationApplied: angle,
                conversionMethod: `case ${angle}°`
              },
              unifiedPageAnalysis: {
                rawPdfLibDimensions: { width: pageProperties.originalWidth, height: pageProperties.originalHeight },
                normalizedDimensions: { width: actualPageWidth, height: actualPageHeight },
                normalizedRotation: pageRotation,
                viewerDimensions: { width: viewerWidth, height: viewerHeight },
                isScannedDocument: pageProperties.isScannedDocument,
                correctionApplied: pageProperties.scannedOrientationCorrectionApplied
              },
              processingMode: pageProperties.isScannedDocument && pageProperties.scannedOrientationCorrectionApplied 
                ? 'SCANNED: Using final database coordinates directly (no transformation)' 
                : 'NORMAL: Standard coordinate transformation applied',
              fix: 'FIXED: No double transformation for scanned documents',
              note: 'PRINT ROUTE: Scanned docs use database coordinates directly, normal docs use transformation'
            })
            


            // COORDINATE VALIDATION AND ADJUSTMENT using CORRECTED dimensions
            if (finalX < 0) {
              finalWidth = finalWidth + finalX
              finalX = 0
            }
            if (finalX + finalWidth > actualPageWidth) {
              finalWidth = actualPageWidth - finalX
            }
            if (finalY < 0) {
              finalHeight = finalHeight + finalY
              finalY = 0
              finalHeight = Math.max(finalHeight, 10)
            }
            if (finalY + finalHeight > actualPageHeight) {
              finalHeight = actualPageHeight - finalY
            }
            
            // Final validation
            finalWidth = Math.max(finalWidth, 10)   // Minimum width
            finalHeight = Math.max(finalHeight, 10) // Minimum height
            


            // Maintain image aspect ratio: fit inside (finalWidth x finalHeight)
            const naturalAspect = image.height / image.width
            let drawW = finalWidth
            let drawH = finalHeight
            if (drawW && drawH) {
              const fitH = drawW * naturalAspect
              if (fitH <= drawH) {
                drawH = fitH
              } else {
                drawW = drawH / naturalAspect
              }
            } else if (drawW && !drawH) {
              drawH = drawW * naturalAspect
            } else if (!drawW && drawH) {
              drawW = drawH / naturalAspect
            }

            // Center inside the original target box after aspect-fit
            const offsetX = (finalWidth - drawW) / 2
            const offsetY = (finalHeight - drawH) / 2

            // Outline the signature box (what we think we're drawing into)
            page.drawRectangle({
              x: finalX,
              y: finalY,
              width: finalWidth,
              height: finalHeight,
              borderColor: rgb(1, 0, 0),
              borderWidth: 2,
            })

            // Draw signature counter-rotated (keeps visual upright in landscape)
            page.drawImage(image, {
              x: finalX + offsetX,
              y: finalY + offsetY,
              width: drawW,
              height: drawH,
              rotate: degrees(-pageRotation),
            })

          } catch (error) {
            // Continue processing other annotations
          }
        } else if (annotation.type === 'text' && annotation.text) {
          try {
            // Calculate position
            let x, y

            if (annotation.relativeX !== undefined && annotation.relativeY !== undefined) {
              // Use viewer dimensions for relative coordinates
              x = annotation.relativeX * viewerWidth
              y = viewerHeight - (annotation.relativeY * viewerHeight) - 20 // Adjust for text height
              
              // Apply rotation transformation for text using UNIFIED normalized dimensions
              const angle = pageRotation % 360
              switch (angle) {
                case 90:
                  const tempX = x
                  x = actualPageHeight - y  // Use normalized height
                  y = tempX
                  break
                case 180:
                  x = actualPageWidth - x   // Use normalized width
                  y = actualPageHeight - y  // Use normalized height
                  break
                case 270:
                  const tempX2 = x
                  x = y
                  y = actualPageWidth - tempX2  // Use normalized width
                  break
              }
            } else {
              // Legacy fallback using UNIFIED normalized dimensions
              x = annotation.x || 100
              y = actualPageHeight - (annotation.y || 100) - 20  // Use normalized height
            }

            // Draw text annotation
            page.drawText(annotation.text, {
              x,
              y,
              size: annotation.fontSize || 12,
              color: rgb(0, 0, 0), // Black text
            })


          } catch (error) {
            // Continue processing other annotations
          }
        }
      } catch (error) {
        // Continue processing other annotations
      }
    }

    // If orientation mismatch detected, abort without printing
    if (abortReason) {
      return NextResponse.json({ error: 'Landscape orientation mismatch', details: abortReason }, { status: 422 })
    }

    // Save the modified PDF with better error handling
    let modifiedPdfBytes
    try {
      modifiedPdfBytes = await pdfDoc.save()

    } catch (saveError) {
      return NextResponse.json({ 
        error: 'Failed to save modified PDF',
        details: saveError instanceof Error ? saveError.message : 'Unknown save error'
      }, { status: 500 })
    }

    // Return the modified PDF
    return new NextResponse(modifiedPdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; ${encodeFileNameForHeader(`SIGNED_${document.file_name}`)}`,
        "X-Document-Status": "fast-signed",
        "X-Signature-Count": String(signatures?.length || 0),
        "X-Document-Type": "fast_sign",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch (error) {
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
