import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { BUCKET_PUBLIC } from "@/utils/supabase/storage"
import { normalizeFileName, validateFile, generateFilePath } from "@/utils/file-utils"

export async function POST(request: NextRequest) {
  try {
    // Check content length before processing
    const contentLength = request.headers.get("content-length")
    const maxSize = 50 * 1024 * 1024 // 50MB

    if (contentLength && Number.parseInt(contentLength) > maxSize) {
      return NextResponse.json({ error: "File too large. Maximum size is 50MB." }, { status: 413 })
    }

    let formData: FormData
    try {
      formData = await request.formData()
    } catch (error) {
      console.error("Error parsing form data:", error)
      return NextResponse.json({ error: "Invalid form data. Please try uploading again." }, { status: 400 })
    }

    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate the file using the utility function
    const validation = validateFile(file)
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Generate normalized file name with the new format
    const normalizedFileName = normalizeFileName(file.name)
    
    // Generate a structured file path using the utility function
    const filePath = generateFilePath(normalizedFileName)

    console.log(`API route upload to bucket: ${BUCKET_PUBLIC}`)
    console.log(`File path: ${filePath}`)
    console.log(`File type: ${file.type}`)
    console.log(`File size: ${file.size} bytes`)
    console.log(`Original name: ${file.name}`)
    console.log(`Normalized name: ${normalizedFileName}`)

    // Create a Supabase admin client that bypasses RLS
    const supabase = createAdminClient()

    // Convert the File object to ArrayBuffer
    let arrayBuffer: ArrayBuffer
    try {
      arrayBuffer = await file.arrayBuffer()
    } catch (error) {
      console.error("Error reading file:", error)
      return NextResponse.json({ error: "Error reading file. Please try again." }, { status: 500 })
    }

    const buffer = new Uint8Array(arrayBuffer)

    // Upload to public bucket using admin client (bypasses RLS)
    const { data, error } = await supabase.storage.from(BUCKET_PUBLIC).upload(filePath, buffer, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: true,
    })

    if (error) {
      console.error("Supabase upload error:", error)

      // Handle specific Supabase errors
      if (error.message?.includes("duplicate")) {
        // Retry with new normalized filename if duplicate
        const retryNormalizedFileName = normalizeFileName(file.name)
        const retryFilePath = generateFilePath(retryNormalizedFileName)

        console.log(`Retrying upload with new path: ${retryFilePath}`)

        const { data: retryData, error: retryError } = await supabase.storage
          .from(BUCKET_PUBLIC)
          .upload(retryFilePath, buffer, {
            contentType: file.type,
            cacheControl: "3600",
            upsert: true,
          })

        if (retryError) {
          console.error("Retry upload error:", retryError)
          return NextResponse.json({ error: `Upload failed: ${retryError.message}` }, { status: 500 })
        }

        // Get the public URL for retry
        const { data: retryUrlData } = supabase.storage.from(BUCKET_PUBLIC).getPublicUrl(retryFilePath)

        return NextResponse.json({
          success: true,
          path: retryFilePath,
          url: retryUrlData.publicUrl,
          originalName: file.name,
          normalizedName: retryNormalizedFileName,
        })
      }

      return NextResponse.json({ error: `Upload failed: ${error.message}` }, { status: 500 })
    }

    if (!data?.path) {
      console.error("No path returned from upload")
      return NextResponse.json({ error: "Upload completed but no file path returned" }, { status: 500 })
    }

    // Get the public URL
    const { data: urlData } = supabase.storage.from(BUCKET_PUBLIC).getPublicUrl(filePath)

    if (!urlData?.publicUrl) {
      console.error("No public URL generated")
      return NextResponse.json({ error: "Upload completed but no public URL generated" }, { status: 500 })
    }

    console.log(`Upload successful. Public URL: ${urlData.publicUrl}`)

    return NextResponse.json({
      success: true,
      path: filePath,
      url: urlData.publicUrl,
      originalName: file.name,
      normalizedName: normalizedFileName,
    })
  } catch (error) {
    console.error("API upload error:", error)

    // Handle different types of errors
    if (error instanceof Error) {
      if (error.message.includes("PayloadTooLargeError") || error.message.includes("Request Entity Too Large")) {
        return NextResponse.json({ error: "File too large. Maximum size is 50MB." }, { status: 413 })
      }

      return NextResponse.json({ error: `Upload error: ${error.message}` }, { status: 500 })
    }

    return NextResponse.json({ error: "An unexpected error occurred during upload" }, { status: 500 })
  }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}
