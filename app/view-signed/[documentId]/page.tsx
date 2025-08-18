import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { BUCKET_PUBLIC } from "@/utils/supabase/storage"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import ClientWrapper from "./client-wrapper"
import DocumentSidebar from "./document-sidebar"
import Sidebar from "@/components/sidebar"
import { ensureValidRelativeDimensions, STANDARD_PAGE_WIDTH, STANDARD_PAGE_HEIGHT } from '@/utils/signature-dimensions'

interface PageProps {
  params: Promise<{ documentId: string }>
  searchParams: Promise<{ token?: string; requestId?: string }>
}

export default async function ViewSignedDocumentPage({ params, searchParams }: PageProps) {
  const { documentId } = await params
  const { token, requestId } = await searchParams

  if (!token || !requestId) {
    return notFound()
  }

  // Decode the token to get recipient email
  let recipientEmail: string
  try {
    recipientEmail = Buffer.from(token, "base64").toString("utf-8")
  } catch (error) {
    console.warn("Error decoding token:", error)
    return notFound()
  }

  const adminClient = createAdminClient()

  // Get document details
  const { data: document, error: documentError } = await adminClient
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .single()

  if (documentError || !document) {
    console.warn("Document not found:", documentError)
    return notFound()
  }

  // Get request details to verify access
  const { data: request, error: requestError } = await adminClient
    .from("request_details")
    .select("*")
    .eq("id", requestId)
    .eq("document_id", documentId)
    .single()

  if (requestError || !request) {
    console.warn("Request not found:", requestError)
    return notFound()
  }

  // Verify the recipient email matches
  if (request.customer_email !== recipientEmail) {
    console.warn("Email mismatch")
    return notFound()
  }

  // Check if document has been signed
  if (request.status !== "signed" && request.status !== "returned") {
    console.warn("Document not signed yet")
    return notFound()
  }

  // Get text annotations (excluding signatures)
  const { data: annotationData, error: annotationError } = await adminClient
    .from("document_annotations")
    .select("annotations")
    .eq("document_id", documentId)
    .eq("recipient_email", recipientEmail)
    .single()

  // Get signatures ONLY from document_signatures table
  const { data: signatures, error: signaturesError } = await adminClient
    .from("document_signatures")
    .select("*")
    .eq("document_id", documentId)
    .eq("recipient_email", recipientEmail)
    .eq("status", "signed")

  if (signaturesError) {
    console.warn("Error fetching signatures:", signaturesError)
  }

  // Create public client to get document URL
  const supabase = await createClient()
  const { data: urlData } = supabase.storage
    .from(BUCKET_PUBLIC)
    .getPublicUrl(document.file_path)

  const documentUrl = urlData.publicUrl
  
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
          // Create base signature data
          const baseSignature = {
            id: sig.id,
            type: 'signature' as const,
            page: sig.page || 1,
            // SINGLE COORDINATE SYSTEM: Only use and require relative coordinates
            relativeX: sig.relativeX,
            relativeY: sig.relativeY,
            relativeWidth: sig.relativeWidth,
            relativeHeight: sig.relativeHeight,
            imageData: sig.dataUrl || '',
            timestamp: sig.timestamp || sigRecord.signed_at,
            signatureSource: sig.source || sigRecord.signature_source || 'canvas',
            content: sig.content // Include content field for signature indexing
          }
          
          // Validate that signature has required relative coordinates
          if (!baseSignature.relativeX || !baseSignature.relativeY || 
              !baseSignature.relativeWidth || !baseSignature.relativeHeight) {
            console.warn('Signature missing relative coordinates, skipping:', baseSignature.id)
            return // Skip signatures without proper coordinates
          }
          
          // For view-signed: Keep original structure that PdfAnnotationEditor expects
          signatureAnnotations.push({
            id: baseSignature.id,
            type: 'signature' as const,
            page: baseSignature.page,
            imageData: baseSignature.imageData,
            // Keep both relative and absolute coordinates for compatibility
            relativeX: baseSignature.relativeX,
            relativeY: baseSignature.relativeY,
            relativeWidth: baseSignature.relativeWidth,
            relativeHeight: baseSignature.relativeHeight,
            // Calculate absolute coordinates for PdfAnnotationEditor
            x: baseSignature.relativeX * STANDARD_PAGE_WIDTH,
            y: baseSignature.relativeY * STANDARD_PAGE_HEIGHT,
            width: baseSignature.relativeWidth * STANDARD_PAGE_WIDTH,
            height: baseSignature.relativeHeight * STANDARD_PAGE_HEIGHT,
            timestamp: baseSignature.timestamp,
            signatureSource: baseSignature.signatureSource
          })
        })
      } else if (sigRecord.signature_data?.position) {
        // Old format: direct signature data - only use if has relative coordinates
        const position = sigRecord.signature_data.position
        
        if (position.relativeX !== undefined && position.relativeY !== undefined &&
            position.relativeWidth !== undefined && position.relativeHeight !== undefined) {
          
          signatureAnnotations.push({
            id: sigRecord.id,
            type: 'signature' as const,
            page: position.page || 1,
            imageData: sigRecord.signature_data.dataUrl || '',
            // Keep both relative and absolute coordinates for compatibility
            relativeX: position.relativeX,
            relativeY: position.relativeY,
            relativeWidth: position.relativeWidth,
            relativeHeight: position.relativeHeight,
            // Calculate absolute coordinates for PdfAnnotationEditor
            x: position.relativeX * STANDARD_PAGE_WIDTH,
            y: position.relativeY * STANDARD_PAGE_HEIGHT,
            width: position.relativeWidth * STANDARD_PAGE_WIDTH,
            height: position.relativeHeight * STANDARD_PAGE_HEIGHT,
            timestamp: sigRecord.signature_data.timestamp || sigRecord.signed_at,
            signatureSource: sigRecord.signature_source || 'canvas'
          })
        } else {
          console.warn('Old format signature missing relative coordinates, skipping:', sigRecord.id)
        }
      } else {
        console.warn('Signature record has no valid signature data:', sigRecord.id)
      }
    })
    
    annotations = [...annotations, ...signatureAnnotations]
  }

  console.log("Loading view-signed document:", {
    documentId,
    recipientEmail,
    totalAnnotations: annotations.length,
    textAnnotations: annotations.filter((a: any) => a.type !== 'signature').length,
    signaturesFromDB: signatures?.length || 0,
    signaturesInAnnotations: annotations.filter((a: any) => a.type === 'signature').length,
    // Don't log full signature data to avoid console spam from base64 images
    signatureSummary: signatures?.map((sig: any) => ({
      id: sig.id,
      hasImageData: !!sig.signature_data?.dataUrl,
      position: sig.signature_data?.position,
      status: sig.status
    })),
    annotationSummary: annotations.map((a: any) => ({
      id: a.id,
      type: a.type,
      page: a.page,
      x: a.x,
      y: a.y,
      relativeX: a.relativeX,
      relativeY: a.relativeY,
      hasImageData: a.type === 'signature' ? !!a.imageData : undefined,
      hasRelativeCoords: a.type === 'signature' ? !!(a.relativeX && a.relativeY) : undefined
    }))
  })

  // Debug: Check if signatures have imageData
  const signaturesWithImageData = annotations.filter((a: any) => a.type === 'signature' && a.imageData)
  const signaturesWithoutImageData = annotations.filter((a: any) => a.type === 'signature' && !a.imageData)
  
  if (signaturesWithoutImageData.length > 0) {
    console.warn(`view-signed: Found ${signaturesWithoutImageData.length} signatures WITHOUT imageData:`, 
      signaturesWithoutImageData.map(s => ({ id: s.id, page: s.page })))
  }
  
  if (signaturesWithImageData.length > 0) {
    console.log(`view-signed: Found ${signaturesWithImageData.length} signatures WITH imageData:`, 
      signaturesWithImageData.map(s => ({ id: s.id, page: s.page, imageDataLength: s.imageData?.length })))
  }

  // Get the current user for the sidebar
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="flex h-screen">
      {/* Main navigation sidebar (only show if user is authenticated) */}
      {user && <Sidebar user={user} />}
      
      {/* Main content area */}
      <div className="flex-1 flex" style={{ backgroundColor: '#F8F9FB' }}>
        {/* PDF viewer content */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1" style={{ backgroundColor: '#F8F9FB' }}>
            <ClientWrapper
              documentUrl={documentUrl}
              documentName={document.file_name}
              documentId={documentId}
              annotations={annotations}
              token={token}
            />
          </div>
        </div>

        {/* Right sidebar with document details */}
        <DocumentSidebar
          document={document}
          request={request}
          recipientEmail={recipientEmail}
          signatures={signatures || []}
          annotations={annotations}
          requestId={requestId}
          documentUrl={documentUrl}
        />
      </div>
    </div>
  )
}
