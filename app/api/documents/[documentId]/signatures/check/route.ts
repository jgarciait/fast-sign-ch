import { createAdminClient } from "@/utils/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { token, includeData = false, requiredSignatureCount } = await req.json()
    const { documentId } = await params

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
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
    } catch (error) {
      console.error("Error decoding token:", error)
      return NextResponse.json({ error: "Invalid token" }, { status: 400 })
    }



    const adminClient = createAdminClient()

    // Check if any signatures exist for this document
    // Special handling for different token types:
    // - "fast-sign-docs@view-all": Return ALL signatures for the document (for fast-sign-docs viewing)
    // - "fast-sign@system": Return ALL signatures for the document (for fast-sign editing)
    // - Regular email addresses: Filter by specific recipient_email (for sent-to-sign documents)
    const selectFields = includeData ? "*" : "id"
    let signaturesQuery = adminClient
      .from("document_signatures")
      .select(selectFields)
      .eq("document_id", documentId)
      .eq("status", "signed")

    // Only filter by recipient_email if it's NOT a special token
    // Special tokens should return ALL signatures for the document
    if (recipientEmail !== "fast-sign@system" && recipientEmail !== "fast-sign-docs@view-all") {
      signaturesQuery = signaturesQuery.eq("recipient_email", recipientEmail)
    }
    // For special tokens (fast-sign@system, fast-sign-docs@view-all), 
    // do NOT filter by recipient_email - return ALL signatures for the document

    const { data: signatures, error: signatureError } = await signaturesQuery

    if (signatureError) {
      console.error("Error checking signatures:", signatureError)
      return NextResponse.json({ error: "Failed to check signatures" }, { status: 500 })
    }

    const hasSignatures = signatures && signatures.length > 0
    const signatureCount = signatures?.length || 0
    
    // Check if we have all required signatures
    const hasAllSignatures = requiredSignatureCount 
      ? signatureCount >= requiredSignatureCount 
      : hasSignatures



    const response: any = { 
      hasSignatures,
      signatureCount,
      hasAllSignatures,
      requiredSignatureCount: requiredSignatureCount || null
    }

    // Include signature data if requested
    if (includeData && hasSignatures) {
      response.signatures = signatures
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error("Error in signature check API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
