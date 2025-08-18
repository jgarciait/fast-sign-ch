import { type NextRequest, NextResponse } from "next/server"
import { updateDocumentStatus } from "@/app/actions/document-status-actions"

export async function POST(request: NextRequest) {
  try {
    // Try to get parameters from query string first (for backward compatibility)
    const searchParams = request.nextUrl.searchParams
    let documentId = searchParams.get("id")
    let status = searchParams.get("status")
    let email = searchParams.get("email")

    // If not in query params, try to get from request body
    if (!documentId || !status || !email) {
      const body = await request.json()
      documentId = body.documentId || documentId
      status = body.status || status
      email = body.email || email
      
      // If we have a token instead of email, decode it
      if (!email && body.token) {
        try {
          email = Buffer.from(body.token, "base64").toString("utf-8")
        } catch (tokenError) {
          console.error("Error decoding token:", tokenError)
        }
      }
    }

    if (!documentId) {
      return NextResponse.json({ error: "Missing document ID" }, { status: 400 })
    }

    // For checking status (no status provided), just return a placeholder response
    if (!status) {
      return NextResponse.json({ status: "pending" })
    }

    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 })
    }

    const result = await updateDocumentStatus(documentId, status, decodeURIComponent(email))

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating document status:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unexpected error occurred" },
      { status: 500 },
    )
  }
}
