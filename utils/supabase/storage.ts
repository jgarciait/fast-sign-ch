import { createClient } from "./client"

// Define bucket names
export const BUCKET_PUBLIC = "public-documents"
export const BUCKET_PRIVATE = "documents"

// Function to upload a file to the public bucket
export async function uploadToPublicBucket(file: File, path: string) {
  const supabase = createClient()

  const { data, error } = await supabase.storage.from(BUCKET_PUBLIC).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  })

  if (error) {
    throw new Error(`Error uploading to public bucket: ${error.message}`)
  }

  return data
}

// Function to get a public URL for a file
export async function getPublicUrl(path: string) {
  const supabase = createClient()

  const { data } = supabase.storage.from(BUCKET_PUBLIC).getPublicUrl(path)

  return data.publicUrl
}

// Function to move a file from public to private bucket
export async function moveToPrivateBucket(fromPath: string, toPath: string) {
  const supabase = createClient()

  // First, download the file from public bucket
  const { data: fileData, error: downloadError } = await supabase.storage.from(BUCKET_PUBLIC).download(fromPath)

  if (downloadError) {
    throw new Error(`Error downloading from public bucket: ${downloadError.message}`)
  }

  // Upload to private bucket
  const { error: uploadError } = await supabase.storage.from(BUCKET_PRIVATE).upload(toPath, fileData, {
    cacheControl: "3600",
    upsert: false,
  })

  if (uploadError) {
    throw new Error(`Error uploading to private bucket: ${uploadError.message}`)
  }

  // Remove from public bucket
  const { error: removeError } = await supabase.storage.from(BUCKET_PUBLIC).remove([fromPath])

  if (removeError) {
    throw new Error(`Error removing from public bucket: ${removeError.message}`)
  }

  return true
}
