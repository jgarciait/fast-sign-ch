"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { BUCKET_PUBLIC } from "@/utils/supabase/storage"
import { normalizeFileName, validateFile, generateFilePath } from "@/utils/file-utils"

export async function uploadFileToPublicBucket(formData: FormData) {
  try {
    const file = formData.get("file") as File

    if (!file) {
      return { error: "No file provided" }
    }

    console.log(`Original file name: ${file.name}`)
    console.log(`File type: ${file.type}`)
    console.log(`File size: ${file.size} bytes`)

    // Validate the file
    const validation = validateFile(file)
    if (!validation.isValid) {
      return { error: validation.error }
    }

    // Create a server-side Supabase client for user auth
    const supabase = await createClient()

    // Get the current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: "Not authenticated" }
    }

    // Create admin client for storage operations (bypasses RLS)
    const adminClient = createAdminClient()

    // Normalize the file name
    const normalizedFileName = normalizeFileName(file.name)
    console.log(`Normalized file name: ${normalizedFileName}`)

    // Generate a structured file path
    const filePath = generateFilePath(normalizedFileName, user.id)
    console.log(`Generated file path: ${filePath}`)

    // Convert the File object to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    // Upload to public bucket with upsert: true to handle potential duplicates
    // Use admin client to bypass RLS policies
    const { data, error } = await adminClient.storage.from(BUCKET_PUBLIC).upload(filePath, buffer, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: true, // This will overwrite if file exists (though unlikely with timestamp)
    })

    if (error) {
      console.error("Server upload error:", error)

      // If it's a duplicate file error, try with a different timestamp
      if (error.message.includes("duplicate") || error.message.includes("already exists")) {
        const retryFileName = normalizeFileName(`${Date.now()}_${file.name}`)
        const retryFilePath = generateFilePath(retryFileName, user.id)

        console.log(`Retrying with new file path: ${retryFilePath}`)

        const { data: retryData, error: retryError } = await adminClient.storage
          .from(BUCKET_PUBLIC)
          .upload(retryFilePath, buffer, {
            contentType: file.type,
            cacheControl: "3600",
            upsert: true,
          })

        if (retryError) {
          return { error: retryError.message }
        }

        // Get the public URL for the retry upload
        const { data: retryUrlData } = adminClient.storage.from(BUCKET_PUBLIC).getPublicUrl(retryFilePath)

        return {
          success: true,
          path: retryFilePath,
          url: retryUrlData.publicUrl,
          originalFileName: file.name,
          normalizedFileName: retryFileName,
        }
      }

      return { error: error.message }
    }

    // Get the public URL
    const { data: urlData } = adminClient.storage.from(BUCKET_PUBLIC).getPublicUrl(filePath)

    console.log(`Upload successful. Public URL: ${urlData.publicUrl}`)

    return {
      success: true,
      path: filePath,
      url: urlData.publicUrl,
      originalFileName: file.name,
      normalizedFileName: normalizedFileName,
    }
  } catch (error) {
    console.error("Server upload error:", error)
    return {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

/**
 * Alternative upload function that generates multiple unique attempts
 * Uses admin client to bypass RLS policies
 */
export async function uploadFileWithRetry(formData: FormData, maxRetries = 3) {
  let lastError = ""

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await uploadFileToPublicBucket(formData)

      if (result.success) {
        return result
      }

      lastError = result.error || "Unknown error"

      // If it's not a duplicate error, don't retry
      if (!lastError.includes("duplicate") && !lastError.includes("already exists")) {
        break
      }

      console.log(`Upload attempt ${attempt} failed, retrying...`)

      // Add a small delay before retry
      await new Promise((resolve) => setTimeout(resolve, 100 * attempt))
    } catch (error) {
      lastError = error instanceof Error ? error.message : "An unexpected error occurred"
      console.error(`Upload attempt ${attempt} failed:`, error)
    }
  }

  return { error: `Upload failed after ${maxRetries} attempts: ${lastError}` }
}
