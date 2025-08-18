import { NextResponse } from "next/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { BUCKET_PUBLIC } from "@/utils/supabase/storage"
import { PDFDocument, rgb } from 'pdf-lib'
import { sanitizeFilename } from "@/utils/filename-utils"
import { calculateWacomSignatureDimensions } from "@/utils/wacom-signature-processor"
import { validateSignatureCoordinates, getRawPDFPageDimensions, getPageRotationAndIgnoreIt } from '@/utils/signature-coordinate-utils'
import { createSignatureFromRelative, PDFPageProperties } from '@/utils/signature-coordinates'

// Helper function to process a single signature
async function processSingleSignature(
  pdfDoc: PDFDocument,
  pages: any[],
  dataUrl: string,
  position: any,
  signatureId: string,
  signatureSource: string = 'canvas'
) {
  try {
    // Get page (0-indexed)
    const pageIndex = Math.max(0, Math.min((position.page || 1) - 1, pages.length - 1))
    const page = pages[pageIndex]
    
    // CRÍTICO: Usar dimensiones RAW del PDF directamente (sin correcciones automáticas)
    const { width: rawPageWidth, height: rawPageHeight } = page.getSize()
    
    // 🚫 DETECTAR Y IGNORAR ROTACIÓN DE PÁGINA COMPLETAMENTE
    const pageRotationInfo = getPageRotationAndIgnoreIt(page)


    // Extract image data
    const base64 = dataUrl.split(",")[1]
    if (!base64) {
      console.warn(`⚠️ Skipping signature ${signatureId}: invalid base64 data`)
      return false
    }

    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    const image = dataUrl.includes('image/png') 
      ? await pdfDoc.embedPng(bytes) 
      : await pdfDoc.embedJpg(bytes)

    // CRITICAL FIX: Use unified coordinate system that matches mapping system EXACTLY
    if (!validateSignatureCoordinates(position)) {
      console.warn(`Skipping signature ${signatureId}: missing coordinate data`)
      return false
    }

    // 🚫 IGNORE ROTATION COMPLETELY - Match original system design
    // The original system was designed to ignore rotation and place signatures horizontally
    const pageProperties: PDFPageProperties = {
      width: rawPageWidth,
      height: rawPageHeight,
      rotate: 0, // ALWAYS 0 - ignore actual rotation completely
      orientation: rawPageWidth > rawPageHeight ? 'landscape' : 'portrait',
      aspectRatio: rawPageWidth / rawPageHeight
    }
    
    // Use createSignatureFromRelative to match SAVE API coordinate system exactly
    const calculatedPosition = createSignatureFromRelative(
      position.relativeX || 0,
      position.relativeY || 0, 
      position.relativeWidth || 0.1,
      position.relativeHeight || 0.05,
      pageProperties,
      position.page
    )
    let { x, y: yTop, width, height } = calculatedPosition
    
    console.log(`🎯 MIGRATE-SIGNATURES: Using RAW PDF dimensions for page ${position.page}:`, {
      rawDimensions: { width: rawPageWidth, height: rawPageHeight },
      signaturePosition: calculatedPosition,
      orientation: rawPageWidth > rawPageHeight ? 'LANDSCAPE' : 'PORTRAIT',
      note: 'Using RAW dimensions - NO automatic corrections applied'
    })
    
    // Store original dimensions for centering
    const originalBoxWidth = width
    const originalBoxHeight = height
    const originalBoxX = x
    const originalBoxYTop = yTop

    // Special handling for Wacom signatures to prevent distortion
    const isWacomSignature = signatureSource === 'wacom'
    if (isWacomSignature) {
      console.log(`🖊️ Processing Wacom signature ${signatureId} with special aspect ratio handling`)
      
      // Get original image dimensions  
      const originalImageWidth = image.width
      const originalImageHeight = image.height
      
      // Calculate optimal dimensions using utility function
      const { width: adjustedWidth, height: adjustedHeight, adjusted } = calculateWacomSignatureDimensions(
        originalImageWidth,
        originalImageHeight,
        width,
        height,
        rawPageWidth,
        rawPageHeight,
        x,
        yTop
      )
      
      if (adjusted) {
        width = adjustedWidth
        height = adjustedHeight
        
        // Center the signature within the original bounding box
        x = originalBoxX + (originalBoxWidth - width) / 2
        yTop = originalBoxYTop + (originalBoxHeight - height) / 2
        
        console.log(`🖊️ Wacom signature ${signatureId} dimensions and position adjusted:`, {
          originalImage: { width: originalImageWidth, height: originalImageHeight, aspectRatio: originalImageWidth / originalImageHeight },
          originalBox: { x: originalBoxX, y: originalBoxYTop, width: originalBoxWidth, height: originalBoxHeight },
          finalSignature: { x, y: yTop, width, height, aspectRatio: width / height },
          centering: { deltaX: x - originalBoxX, deltaY: yTop - originalBoxYTop }
        })
      }
    }
    
    // NO coordinate conversion - use mapping system coordinates directly
    console.log(`🖼️ Drawing signature using RAW PDF dimensions:`, {
      x, 
      y: yTop, 
      width, 
      height,
      rawPageSize: { width: rawPageWidth, height: rawPageHeight },
      coordinateSystem: 'top-left (matches mapping system)',
      signatureSource,
      note: 'Using RAW dimensions - NO automatic corrections or rotations applied'
    })

    // CRÍTICO: NO hacer rotaciones automáticas - las firmas siempre horizontales
    page.drawImage(image, { 
      x, 
      y: yTop, 
      width, 
      height 
    })
    
    console.log(`✅ MIGRATE-SIGNATURES: Applied signature ${signatureId} at RAW coordinates to page ${pageIndex + 1}`)
    return true
    
  } catch (sigError) {
    console.error(`❌ Error processing signature ${signatureId}:`, sigError)
    return false
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  
  const { documentId } = await params
  
  if (!documentId) {
    return NextResponse.json({ error: 'Document ID is required' }, { status: 400 })
  }
  
  const adminClient = createAdminClient()
  
  console.log(`🚨 MIGRACIÓN CRÍTICA: Iniciando migración de firmas para documento ${documentId}`)
  
  try {
    // 1. Get document details
    const { data: document, error: documentError } = await adminClient
      .from("documents")
      .select("id, file_path, file_name, original_file_path, status, created_by")
      .eq("id", documentId)
      .single()

    if (documentError || !document) {
      console.error('❌ Document not found:', documentError)
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    console.log(`📄 Documento encontrado: ${document.file_name}`)
    console.log(`📂 File path: ${document.file_path}`)
    console.log(`📂 Original file path: ${document.original_file_path}`)
    console.log(`📊 Status: ${document.status}`)
    
    // Check if filename needs sanitization
    const sanitizedFileName = sanitizeFilename(document.file_name)
    if (sanitizedFileName !== document.file_name) {
      console.log(`🧹 Filename sanitization needed: "${document.file_name}" → "${sanitizedFileName}"`)
    }

    // 2. Check if document has old signatures (document_signatures table)
    const { data: signatures, error: sigError } = await adminClient
      .from('document_signatures')
      .select('*')
      .eq('document_id', documentId)

    if (sigError) {
      console.error('❌ Error fetching signatures:', sigError)
      return NextResponse.json({ error: 'Error fetching signatures' }, { status: 500 })
    }

    if (!signatures || signatures.length === 0) {
      console.log('⚠️ No signatures found in document_signatures table')
      return NextResponse.json({ error: 'No old signatures found to migrate' }, { status: 400 })
    }

    console.log(`🔍 Found ${signatures.length} signatures to migrate`)

    // 3. Determine which document to use as base (use original_file_path if available)
    const baseDocumentPath = document.original_file_path || document.file_path
    
    console.log(`📄 Using base document: ${baseDocumentPath}`)

    // 4. Download the base PDF
    const { data: pdfData, error: downloadError } = await adminClient.storage
      .from(BUCKET_PUBLIC)
      .download(baseDocumentPath)

    if (downloadError || !pdfData) {
      console.error('❌ Failed to download document:', downloadError)
      return NextResponse.json({ 
        error: 'Failed to download document',
        details: downloadError?.message || 'No data returned'
      }, { status: 500 })
    }

    console.log(`✅ Base document downloaded successfully`)

    // 5. Load PDF and apply signatures
    const pdfBytes = await pdfData.arrayBuffer()
    const pdfDoc = await PDFDocument.load(pdfBytes)
    const pages = pdfDoc.getPages()

    console.log(`📄 PDF loaded with ${pages.length} pages`)

    // 6. Process each signature
    let signaturesProcessed = 0
    for (const signature of signatures) {
      try {
        console.log(`🖊️ Processing signature ${signature.id}`)
        console.log(`📋 Signature data structure:`, JSON.stringify(signature.signature_data, null, 2))
        
        // Parse signature data
        let signatureData: any
        try {
          signatureData = typeof signature.signature_data === 'string' 
            ? JSON.parse(signature.signature_data) 
            : signature.signature_data
        } catch (parseError) {
          console.error(`❌ Error parsing signature data for signature ${signature.id}:`, parseError)
          continue
        }

        console.log(`🔍 Parsed signature data:`, JSON.stringify(signatureData, null, 2))

        // Check if this is the old format with signatures array
        if (signatureData.signatures && Array.isArray(signatureData.signatures)) {
          console.log(`✅ Found old format with signatures array containing ${signatureData.signatures.length} signature(s)`)
          
          // Process each signature in the array
          for (const sig of signatureData.signatures) {
            if (sig.dataUrl && sig.position) {
              console.log(`🖊️ Processing signature from array: ${sig.id || 'unknown'}, source: ${sig.source || 'canvas'}`)
              
              const position = sig.position
              const dataUrl = sig.dataUrl
              const source = sig.source || 'canvas' // Get the signature source (canvas/wacom)

              // Process this signature with source information
              const success = await processSingleSignature(pdfDoc, pages, dataUrl, position, sig.id || 'from-array', source)
              if (success) {
                signaturesProcessed++
              }
            } else {
              console.warn(`⚠️ Skipping signature in array: missing dataUrl or position`)
            }
          }
          
          // Skip the rest of the loop since we processed the signatures array
          continue
        }

        // Try other formats for backwards compatibility
        let position: any = null
        let dataUrl: string | null = null

        // Method 1: Standard format (dataUrl + position)
        if (signatureData.dataUrl && signatureData.position) {
          position = signatureData.position
          dataUrl = signatureData.dataUrl
          console.log(`✅ Using standard format`)
        }
        // Method 2: Direct format (all data at root level)
        else if (signatureData.x !== undefined && signatureData.page !== undefined) {
          position = signatureData
          dataUrl = signatureData.dataUrl || signatureData.imageData || signatureData.signature_data
          console.log(`✅ Using direct format`)
        }
        // Method 3: Look for nested signature data
        else if (signatureData.signature_data) {
          try {
            const nestedData = typeof signatureData.signature_data === 'string' 
              ? JSON.parse(signatureData.signature_data)
              : signatureData.signature_data
            position = nestedData.position || nestedData
            dataUrl = nestedData.dataUrl || nestedData.imageData
            console.log(`✅ Using nested format`)
          } catch (nestedError) {
            console.warn(`⚠️ Error parsing nested signature data:`, nestedError)
          }
        }

        if (!dataUrl || !position) {
          console.warn(`⚠️ Skipping signature ${signature.id}: missing dataUrl or position`)
          console.warn(`   - dataUrl present: ${!!dataUrl}`)
          console.warn(`   - position present: ${!!position}`)
          console.warn(`   - Available keys:`, Object.keys(signatureData))
          continue
        }

        console.log(`✅ Found valid signature data:`)
        console.log(`   - Image data length: ${dataUrl?.length || 0}`)
        console.log(`   - Position:`, position)

        // Process this single signature
        // Check signature source from the database record or the signature data
        const source = signature.signature_source || signatureData.source || 'canvas'
        console.log(`🖊️ Processing single signature ${signature.id}, source: ${source}`)
        
        const success = await processSingleSignature(pdfDoc, pages, dataUrl, position, signature.id, source)
        if (success) {
          signaturesProcessed++
        }
        
      } catch (sigError) {
        console.error(`❌ Error processing signature ${signature.id}:`, sigError)
        continue
      }
    }

    if (signaturesProcessed === 0) {
      console.error('❌ No signatures could be processed')
      return NextResponse.json({ error: 'No signatures could be processed' }, { status: 500 })
    }

    console.log(`✅ Successfully processed ${signaturesProcessed}/${signatures.length} signatures`)

    // 7. Save the merged PDF
    const mergedBytes = await pdfDoc.save()
    
    console.log(`💾 PDF merged successfully, size: ${mergedBytes.length} bytes`)

    // 8. Replace the document in storage (CRITICAL: same filename and path)
    const targetPath = document.file_path // Use the current file_path to maintain same location
    
    console.log(`🔄 Replacing document at: ${targetPath}`)

    // Upload the merged PDF to replace the original
    const { error: uploadError } = await adminClient.storage
      .from(BUCKET_PUBLIC)
      .upload(targetPath, mergedBytes, {
        cacheControl: '3600',
        upsert: true, // This will overwrite the existing file
        contentType: 'application/pdf' // Explicitly set MIME type
      })

    if (uploadError) {
      console.error('❌ Failed to upload merged document:', uploadError)
      return NextResponse.json({ 
        error: 'Failed to upload merged document',
        details: uploadError.message
      }, { status: 500 })
    }

    console.log(`✅ Document successfully replaced at ${targetPath}`)

    // 9. Update document status and ensure original_file_path is set if not already
    const updateData: any = {
      status: 'firmado',
      updated_at: new Date().toISOString()
    }

    // If no original_file_path exists, we should set it to preserve the fact that we've modified the document
    if (!document.original_file_path) {
      // Since we're replacing the file in place, we'll set original_file_path to the same path
      // This indicates the document has been processed
      updateData.original_file_path = document.file_path
    }

    // Sanitize filename in database if needed to prevent future issues
    if (sanitizedFileName !== document.file_name) {
      updateData.file_name = sanitizedFileName
      console.log(`🧹 Updating filename in database: "${document.file_name}" → "${sanitizedFileName}"`)
    }

    const { error: updateError } = await adminClient
      .from("documents")
      .update(updateData)
      .eq("id", documentId)

    if (updateError) {
      console.warn('⚠️ Failed to update document status:', updateError)
      // Don't fail the migration for this, the file was already replaced
    }

    console.log(`🎉 MIGRATION COMPLETED SUCCESSFULLY for document ${documentId}`)
    console.log(`📊 Final stats: ${signaturesProcessed} signatures merged`)
    console.log(`🔍 Migration summary for document ${documentId}:`)
    console.log(`   - Total signature records found: ${signatures.length}`)
    console.log(`   - Successfully processed: ${signaturesProcessed}`)
    console.log(`   - Wacom signatures processed with aspect ratio preservation: Check individual logs above`)

    return NextResponse.json({
      success: true,
      message: 'Document migration completed successfully',
      signaturesProcessed,
      totalSignatures: signatures.length,
      documentPath: targetPath
    })

  } catch (error) {
    console.error('❌ CRITICAL ERROR during migration:', error)
    return NextResponse.json({
      error: 'Critical error during migration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
