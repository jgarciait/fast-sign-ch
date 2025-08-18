import { createAdminClient } from "@/utils/supabase/admin"
import { type NextRequest, NextResponse } from "next/server"
import { BUCKET_PUBLIC } from "@/utils/supabase/storage"
import { PDFDocument, rgb } from 'pdf-lib'
import { encodeFileNameForHeader } from "@/utils/file-utils"
import { calculateWacomSignatureDimensions } from "@/utils/wacom-signature-processor"
import { correctPdfPageDimensions } from "@/utils/force-correct-pdf-dimensions"
import { calculateSignaturePosition, debugCoordinateConversion, validateSignatureCoordinates, getRawPDFPageDimensions, getPageRotationAndIgnoreIt } from '@/utils/signature-coordinate-utils'

import { extractPageProperties } from '@/utils/pdf-lib-dimensions'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  console.log('Print API: Route called!')
  
  const { documentId } = await params
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const requestId = searchParams.get('requestId')

  console.log('Print API: Parameters:', { documentId, token: token ? 'present' : 'missing', requestId })

  if (!token || !requestId) {
    console.log('Print API: Missing required parameters')
    return NextResponse.json({ error: 'Missing token or requestId' }, { status: 400 })
  }

  // Decode the token to get recipient email
  let recipientEmail: string
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8")
    
    // Handle new token format (email:signingId) and legacy format (email only)
    if (decoded.includes(':')) {
      // New format: extract email from email:signingId
      recipientEmail = decoded.split(':')[0]
    } else {
      // Legacy format: token contains only email
      recipientEmail = decoded
    }
    console.log('Print API: Decoded recipient email:', recipientEmail)
  } catch (error) {
    console.log('Print API: Failed to decode token:', error)
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  try {
    console.log(`Print API: Processing document ${documentId} for user ${recipientEmail}`)
    
    // Get document details
    const { data: document, error: documentError } = await adminClient
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single()

    if (documentError || !document) {
      console.error('Print API: Document not found:', documentError)
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    console.log(`Print API: Found document ${document.file_name}`)

    // Get request details to verify access
    const { data: requestDetails, error: requestError } = await adminClient
      .from("request_details")
      .select("*")
      .eq("id", requestId)
      .eq("document_id", documentId)
      .single()

    if (requestError || !requestDetails) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Verify the recipient email matches
    if (requestDetails.customer_email !== recipientEmail) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Check if document has been signed
    if (requestDetails.status !== "signed" && requestDetails.status !== "returned") {
      return NextResponse.json({ error: 'Document not signed yet' }, { status: 400 })
    }

    // Get the original PDF file
    const { data: pdfData, error: downloadError } = await adminClient.storage
      .from(BUCKET_PUBLIC)
      .download(document.file_path)

    if (downloadError || !pdfData) {
      return NextResponse.json({ error: 'Failed to download document' }, { status: 500 })
    }

    // Get text annotations (excluding signatures)
    const { data: annotationData, error: annotationError } = await adminClient
      .from("document_annotations")
      .select("annotations")
      .eq("document_id", documentId)
      .eq("recipient_email", recipientEmail)
      .single()

    // Get signatures from document_signatures table
    let signaturesQuery = adminClient
      .from("document_signatures")
      .select("*")
      .eq("document_id", documentId)
      .eq("status", "signed")

    // Only filter by recipient_email if it's NOT a special token
    if (recipientEmail !== "fast-sign@system" && recipientEmail !== "fast-sign-docs@view-all") {
      signaturesQuery = signaturesQuery.eq("recipient_email", recipientEmail)
    }
    // For special tokens, return ALL signatures for the document

    const { data: signatures, error: signaturesError } = await signaturesQuery

    if (signaturesError) {
      console.error("Error fetching signatures:", signaturesError)
    }

    // Start with text annotations (filter out any signatures that might be there)
    let annotations = (annotationData?.annotations || []).filter((ann: any) => ann.type !== 'signature')
    
    // Add signatures from document_signatures table
    if (signatures && signatures.length > 0) {
      const signatureAnnotations: any[] = []
      
      signatures.forEach((sigRecord: any) => {
        // Handle both old format (direct signature_data) and new format (signatures array)
        if (sigRecord.signature_data?.signatures) {
          // New format: signatures array
          const signaturesArray = sigRecord.signature_data.signatures
          signaturesArray.forEach((sig: any) => {
            signatureAnnotations.push({
              id: sig.id,
              type: 'signature' as const,
              x: sig.x || 100,
              y: sig.y || 100,
              width: sig.width || 300,
              height: sig.height || 150,
              page: sig.page || 1,
              relativeX: sig.relativeX || 0.15,
              relativeY: sig.relativeY || 0.15,
              relativeWidth: sig.relativeWidth || 0.49,
              relativeHeight: sig.relativeHeight || 0.19,
              imageData: sig.dataUrl || '',
              timestamp: sig.timestamp || sigRecord.signed_at,
              signatureSource: sig.source || sigRecord.signature_source || 'canvas',
              content: sig.content // Include content field for signature indexing
            })
          })
        } else if (sigRecord.signature_data?.dataUrl) {
          // Old format: direct signature data
          signatureAnnotations.push({
            id: sigRecord.id,
            type: 'signature' as const,
            x: sigRecord.signature_data.position?.x || 100,
            y: sigRecord.signature_data.position?.y || 100,
            width: sigRecord.signature_data.position?.width || 300,
            height: sigRecord.signature_data.position?.height || 150,
            page: sigRecord.signature_data.position?.page || 1,
            relativeX: sigRecord.signature_data.position?.relativeX || 0.15,
            relativeY: sigRecord.signature_data.position?.relativeY || 0.15,
            relativeWidth: sigRecord.signature_data.position?.relativeWidth || 0.49,
            relativeHeight: sigRecord.signature_data.position?.relativeHeight || 0.19,
            imageData: sigRecord.signature_data.dataUrl || '',
            timestamp: sigRecord.signature_data.timestamp || sigRecord.signed_at,
            signatureSource: sigRecord.signature_source || 'canvas'
          })
        }
      })
      
      annotations = [...annotations, ...signatureAnnotations]
    }

    // Load the PDF document
    const pdfBytes = await pdfData.arrayBuffer()
    const pdfDoc = await PDFDocument.load(pdfBytes)
    const pages = pdfDoc.getPages()

    // 🎯 UNIFIED APPROACH: No longer need scanned document detection
    // Page flattening system handles all PDFs uniformly
    console.log('🔍 GENERAL DOCUMENTS PRINT ROUTE: Using unified PDF processing approach');

    console.log(`Processing PDF with ${pages.length} pages and ${annotations.length} annotations`)

    // Process each annotation
    for (const annotation of annotations) {
      const pageIndex = (annotation.page || 1) - 1 // Convert to 0-based index
      
      if (pageIndex < 0 || pageIndex >= pages.length) {
        console.warn(`Annotation page ${annotation.page} is out of range (PDF has ${pages.length} pages)`)
        continue
      }

      const page = pages[pageIndex]
      
      // 🎯 SINGLE SOURCE OF TRUTH: Use centralized page property extraction  
      const pageProperties = extractPageProperties(page, pageIndex + 1)
      
      console.log('🔍 GENERAL DOCUMENTS PRINT - STEP 2: Raw PDF-lib data vs Normalized data:', {
        pageIndex: pageIndex + 1,
        rawPdfLibData: {
          width: pageProperties.originalWidth,
          height: pageProperties.originalHeight,
          note: 'Raw data from PDF-lib before normalization'
        },
        normalizedData: {
          width: pageProperties.width,
          height: pageProperties.height,
          rotation: pageProperties.actualRotate,
          orientation: pageProperties.orientation,
          isScannedDocument: pageProperties.isScannedDocument,
          correctionApplied: pageProperties.scannedOrientationCorrectionApplied
        },
        note: 'GENERAL DOCUMENTS PRINT: Using centralized normalization from pdf-lib-dimensions.ts'
      })
      
      // Use normalized properties from centralized system
      const finalPageWidth = pageProperties.width
      const finalPageHeight = pageProperties.height

      if (annotation.type === 'signature' && annotation.imageData) {
        try {
                      // Extract base64 data from data URL
            const base64Data = annotation.imageData.split(',')[1]
            if (!base64Data) {
              console.warn('Invalid signature image data')
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

          // Calculate position and size
          let x, y, width, height

          if (annotation.relativeX !== undefined && annotation.relativeY !== undefined) {
            // Use relative positioning with CORRECTED dimensions
            x = annotation.relativeX * finalPageWidth
            y = annotation.relativeY * finalPageHeight
            width = annotation.relativeWidth ? annotation.relativeWidth * finalPageWidth : (annotation.width || 300)
            height = annotation.relativeHeight ? annotation.relativeHeight * finalPageHeight : (annotation.height || 150)
          } else {
            // Legacy fallback for old signatures without relative coordinates
            x = annotation.x || 100
            y = annotation.y || 100
            width = annotation.width || 300
            height = annotation.height || 150
          }

          // 🚫 DETECTAR Y IGNORAR ROTACIÓN DE PÁGINA COMPLETAMENTE
          const pageRotationInfo = getPageRotationAndIgnoreIt(page)
          console.log(`🚫 DOCUMENTS PRINT: ${pageRotationInfo.message}`)

          // CRITICAL FIX: Use unified coordinate system that matches mapping system EXACTLY
          if (!validateSignatureCoordinates(annotation)) {
            console.warn(`Skipping signature ${annotation.id}: missing coordinate data`)
            continue
          }

          // 🚫 PASAR ROTACIÓN PERO IGNORARLA COMPLETAMENTE
          const position = debugCoordinateConversion(annotation, { width: finalPageWidth, height: finalPageHeight }, pageRotationInfo.rotation)
          let { x: finalX, y: finalY, width: finalWidth, height: finalHeight } = position
          
          console.log(`🎯 DOCUMENTS PRINT: Using RAW PDF dimensions for page ${annotation.page}:`, {
            rawDimensions: { width: finalPageWidth, height: finalPageHeight },
            signaturePosition: position,
            orientation: finalPageWidth > finalPageHeight ? 'LANDSCAPE' : 'PORTRAIT',
            pageRotation: pageRotationInfo.rotation,
            pageRotationIgnored: true,
            note: 'Using RAW dimensions - NO automatic corrections or rotations applied'
          })

          // Apply aspect ratio preservation for ALL signatures (canvas and Wacom)
          console.log(`🖨 Processing signature ${annotation.id} with aspect ratio preservation`)
          
          // Get actual image dimensions
          const imageInfo = getEmbeddedImageDimensions(image)
          
          // Define the target signature box
          const targetBox: SignatureBox = {
            x: finalX,
            y: finalY,
            width: finalWidth,
            height: finalHeight
          }
          
          // Calculate centered placement preserving aspect ratio
          const centeredPlacement = calculateCenteredSignaturePlacement(
            imageInfo.width,
            imageInfo.height,
            targetBox
          )
          
          // Apply minimum size constraints
          const finalPlacement = applyMinimumSizeConstraints(centeredPlacement, 20, 10)
          
          if (!validateSignaturePlacement(finalPlacement)) {
            console.error(`❌ Invalid signature placement for ${annotation.id}:`, finalPlacement)
            continue
          }
          
          // Update coordinates to use centered placement
          finalX = finalPlacement.x
          finalY = finalPlacement.y
          finalWidth = finalPlacement.width
          finalHeight = finalPlacement.height
          
          console.log(`🖨 Signature ${annotation.id} dimensions adjusted with aspect ratio preservation:`, {
            signatureSource: annotation.signatureSource || 'canvas',
            originalImage: { width: imageInfo.width, height: imageInfo.height, aspectRatio: imageInfo.aspectRatio },
            originalBox: targetBox,
            finalPlacement,
            centering: {
              horizontalOffset: finalPlacement.offsetX,
              verticalOffset: finalPlacement.offsetY
            },
            coordinateSystem: 'top-left (matches mapping system)'
          })

          // Ensure the signature fits within the page using unified coordinates
          if (finalX + finalWidth > finalPageWidth) {
            finalWidth = finalPageWidth - finalX
          }
          if (finalY < 0) {
            finalHeight = finalHeight + finalY
            finalY = 0
            finalHeight = Math.max(finalHeight, 10) // Minimum height
          }

          // CRÍTICO: NO hacer rotaciones automáticas - las firmas siempre horizontales
          page.drawImage(image, {
            x: finalX,
            y: finalY,
            width: finalWidth,
            height: finalHeight,
          })

          console.log(`✅ DOCUMENTS PRINT: Applied signature ${annotation.id} with aspect ratio preservation:`, {
            x: finalX, y: finalY, width: finalWidth, height: finalHeight,
            aspectRatioPreserved: true,
            centeredInBox: true,
            note: 'Using RAW dimensions with aspect ratio preservation - NO automatic rotations applied'
          })
        } catch (error) {
          console.error('Error adding signature to PDF:', error)
        }
      } else if (annotation.type === 'text' && annotation.text) {
        try {
          // Calculate position using proper coordinate conversion
          let x, y

          if (annotation.relativeX !== undefined && annotation.relativeY !== undefined) {
            // Use relative positioning with CORRECTED dimensions
            x = annotation.relativeX * finalPageWidth
            y = annotation.relativeY * finalPageHeight
          } else {
            // Legacy fallback
            x = annotation.x || 100
            y = annotation.y || 100
          }

          // Convert Y coordinate from top-left (browser) to bottom-left (PDF coordinate system)
          const pdfY = finalPageHeight - y - 20 // Adjust for text baseline

          // Draw text annotation with proper PDF coordinates
          page.drawText(annotation.text, {
            x,
            y: pdfY,
            size: annotation.fontSize || 12,
            color: rgb(0, 0, 0), // Black text
          })

          console.log(`Added text annotation "${annotation.text}" to page ${annotation.page}`)
        } catch (error) {
          console.error('Error adding text annotation to PDF:', error)
        }
      }
    }

    // Save the modified PDF
    const modifiedPdfBytes = await pdfDoc.save()
    
    console.log(`Print API: Successfully created merged PDF with ${annotations.length} annotations (${annotations.filter((a: any) => a.type === 'signature').length} signatures)`)

    // Return the modified PDF
    return new NextResponse(modifiedPdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; ${encodeFileNameForHeader(`SIGNED_${document.file_name}`)}`,
        "X-Document-Status": "signed",
        "X-Signature-Count": String(signatures?.length || 0),
        "X-Signed-By": `${requestDetails.customer_first_name} ${requestDetails.customer_last_name}`,
        "X-Signed-Date": requestDetails.signed_at || '',
        "Cache-Control": "no-cache, no-store, must-revalidate", // Prevent caching during development
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch (error) {
    console.error('Error in print endpoint:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
