import { createAdminClient } from "@/utils/supabase/admin"
import { type NextRequest, NextResponse } from "next/server"
import { BUCKET_PUBLIC } from "@/utils/supabase/storage"
import { encodeFileNameForHeader } from "@/utils/file-utils"

// Add OPTIONS method to handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Range, Authorization",
      "Access-Control-Max-Age": "86400", // 24 hours
    },
  })
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    console.log('PDF Proxy: Starting request processing...')
    
    // Safely extract params
    let documentId: string
    try {
      const resolvedParams = await params
      documentId = resolvedParams.id
      console.log(`PDF Proxy: Fetching document with ID: ${documentId}`)
    } catch (paramError) {
      console.error('PDF Proxy: Error resolving params:', paramError)
      return new NextResponse(JSON.stringify({ 
        error: "Invalid request parameters", 
        details: "Could not resolve document ID from request" 
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      })
    }

    // Validate environment variables first
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
      console.error('PDF Proxy: Missing Supabase environment variables', {
        hasPublicUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSecretKey: !!process.env.SUPABASE_SECRET_KEY
      })
      return new NextResponse(JSON.stringify({ 
        error: "Server configuration error", 
        details: "Missing Supabase environment variables" 
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      })
    }

    // Initialize Supabase client safely
    let supabase
    try {
      supabase = createAdminClient()
      console.log('PDF Proxy: Supabase admin client created successfully')
    } catch (supabaseError) {
      console.error('PDF Proxy: Error creating Supabase client:', supabaseError)
      return new NextResponse(JSON.stringify({ 
        error: "Database connection error", 
        details: "Could not initialize database client" 
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      })
    }
    // Get the file path from the database
    console.log(`PDF Proxy: Querying database for document ID: "${documentId}"`)
    console.log(`PDF Proxy: Document ID length: ${documentId.length}`)
    console.log(`PDF Proxy: Document ID type: ${typeof documentId}`)
    
    const { data: document, error } = await supabase
      .from("documents")
      .select("file_path, file_name")
      .eq("id", documentId)
      .single()

    console.log(`PDF Proxy: Database query result:`, { data: document, error })

    if (error) {
      console.error(`PDF Proxy: Database error fetching document ${documentId}:`, error)
      
      // Let's also try to check if any documents exist with similar IDs
      try {
        const { data: similarDocs } = await supabase
          .from("documents")
          .select("id, file_name")
          .ilike("id", `${documentId.substring(0, 8)}%`)
          .limit(5)
        console.log(`PDF Proxy: Similar documents found:`, similarDocs)
      } catch (e) {
        console.log(`PDF Proxy: Could not query similar documents`)
      }
      
      return new NextResponse(JSON.stringify({ 
        error: "Document not found in database", 
        details: error.message,
        searchedId: documentId,
        idLength: documentId.length,
        timestamp: new Date().toISOString()
      }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      })
    }

    if (!document) {
      console.error(`PDF Proxy: Document ${documentId} not found in database`)
      return new NextResponse(JSON.stringify({ error: "Document not found in database" }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      })
    }

    console.log(`PDF Proxy: Found document ${documentId}`)
    console.log(`PDF Proxy: File path: ${document.file_path}`)
    console.log(`PDF Proxy: File name: ${document.file_name}`)

    // Get the public URL for the document (same as fast-sign edit page)
    const { data: urlData } = supabase.storage
      .from(BUCKET_PUBLIC)
      .getPublicUrl(document.file_path)

    console.log(`PDF Proxy: Generated public URL: ${urlData.publicUrl}`)

    // Fetch the file and serve it directly to avoid CORS issues
    console.log(`PDF Proxy: Attempting to fetch from URL: ${urlData.publicUrl}`)
    const fileResponse = await fetch(urlData.publicUrl, {
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(30000) // 30 second timeout
    })
    
    if (!fileResponse.ok) {
      console.error(`PDF Proxy: Failed to fetch file from storage: ${fileResponse.status}`)
      console.error(`PDF Proxy: Response status text: ${fileResponse.statusText}`)
      console.error(`PDF Proxy: Public URL attempted: ${urlData.publicUrl}`)
      console.error(`PDF Proxy: File path in DB: ${document.file_path}`)
      console.error(`PDF Proxy: Bucket: ${BUCKET_PUBLIC}`)
      
      // Try to get more error details
      try {
        const errorText = await fileResponse.text()
        console.error(`PDF Proxy: Error response body: ${errorText}`)
      } catch (e) {
        console.error(`PDF Proxy: Could not read error response body`)
      }
      
      return new NextResponse(JSON.stringify({ 
        error: "File not found in storage",
        status: fileResponse.status,
        statusText: fileResponse.statusText,
        url: urlData.publicUrl
      }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      })
    }

    const fileBuffer = await fileResponse.arrayBuffer()

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
        "Content-Disposition": `inline; ${encodeFileNameForHeader(document.file_name)}`,
      },
    })

  } catch (error) {
    console.error(`PDF Proxy: Unexpected error serving document:`, error)
    
    // Check if it's a timeout error
    const isTimeout = error instanceof Error && (
      error.name === 'AbortError' || 
      error.message.includes('timeout') ||
      error.message.includes('signal')
    )
    
    const errorDetails = error instanceof Error ? error.message : "Unknown error"
    
    return new NextResponse(
      JSON.stringify({
        error: isTimeout ? "Request Timeout" : "Internal Server Error",
        details: isTimeout ? "File fetch timeout - storage may be slow or unreachable" : errorDetails,
        errorType: isTimeout ? 'timeout' : 'internal',
        timestamp: new Date().toISOString()
      }),
      {
        status: isTimeout ? 408 : 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
            },
    )
  }
}
