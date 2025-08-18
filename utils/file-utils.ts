/**
 * Normalizes a file name to be compatible with Supabase storage
 * - Removes or replaces special characters
 * - Handles UTF-8 character normalization to remove accents
 * - Adds dual timestamp suffix for uniqueness
 * - Format: millisecondTimestamp_secondTimestamp_normalized_filename.ext
 */
export function normalizeFileName(originalFileName: string): string {
  // Get the file extension
  const lastDotIndex = originalFileName.lastIndexOf(".")
  const extension = lastDotIndex !== -1 ? originalFileName.substring(lastDotIndex) : ""
  const nameWithoutExtension = lastDotIndex !== -1 ? originalFileName.substring(0, lastDotIndex) : originalFileName

  // Normalize Unicode characters (NFD normalization) to remove accents
  const normalized = nameWithoutExtension.normalize("NFD")

  // Remove diacritics and special characters for Supabase compatibility
  const withoutDiacritics = normalized.replace(/[\u0300-\u036f]/g, "")

  // Replace special characters with safe alternatives
  const sanitized = withoutDiacritics
    .replace(/[^\w\s-]/g, "") // Remove all non-word characters except spaces and hyphens
    .replace(/\s+/g, "_") // Replace spaces with underscores
    .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
    .replace(/_+/g, "_") // Replace multiple underscores with single underscore
    .replace(/^[-_]+|[-_]+$/g, "") // Remove leading/trailing hyphens and underscores
    .toLowerCase() // Convert to lowercase for consistency

  // Ensure the name is not empty
  const finalName = sanitized || "document"

  // Generate timestamps for uniqueness
  const now = Date.now()
  const millisecondTimestamp = now // Full millisecond timestamp
  const secondTimestamp = Math.floor(now / 1000) // Unix timestamp in seconds

  // Combine in the requested format: millisecondTimestamp_secondTimestamp_normalized_filename.ext
  return `${millisecondTimestamp}_${secondTimestamp}_${finalName}${extension}`
}

/**
 * Test function to demonstrate filename normalization
 * Examples of how files with accents and special characters are normalized
 */
export function testFileNameNormalization() {
  const testFiles = [
    "Certificación de Divulgaciones y Formas Revisadas.pdf",
    "Contrato de Préstamo - José María.docx", 
    "Declaración Jurada (Año 2024).pdf",
    "Formulario de Inscripción & Registro.pdf",
    "Documento con Ñ y Acentos - María José.pdf"
  ]

  console.log("=== Filename Normalization Test ===")
  testFiles.forEach(filename => {
    const normalized = normalizeFileName(filename)
    console.log(`Original: ${filename}`)
    console.log(`Normalized: ${normalized}`)
    console.log("---")
  })
}

/**
 * Validates file type and size
 */
export function validateFile(file: File): { isValid: boolean; error?: string } {
  // Check file size (max 50MB)
  const maxSize = 50 * 1024 * 1024 // 50MB in bytes
  if (file.size > maxSize) {
    return { isValid: false, error: "File size must be less than 50MB" }
  }

  // Check file type
  const allowedTypes = [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ]

  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: "File type not supported. Please upload PDF, Word, image, or text files.",
    }
  }

  return { isValid: true }
}

/**
 * Generates a unique file path with proper structure
 */
export function generateFilePath(normalizedFileName: string, userId?: string): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  // Create a structured path: uploads/YYYY/MM/DD/userId/filename
  const datePath = `${year}/${month}/${day}`
  const userPath = userId ? `${userId.substring(0, 8)}` : "anonymous"

  return `uploads/${datePath}/${userPath}/${normalizedFileName}`
}

/**
 * Encodes a filename for use in HTTP Content-Disposition headers
 * Handles UTF-8 characters and accents properly using RFC 5987 format
 */
export function encodeFileNameForHeader(filename: string): string {
  // Check if filename contains non-ASCII characters
  const hasNonAscii = /[^\x00-\x7F]/.test(filename)
  
  if (!hasNonAscii) {
    // Safe to use as-is for ASCII-only filenames
    return `filename="${filename}"`
  }
  
  // For non-ASCII filenames, use RFC 5987 format
  const encodedFilename = encodeURIComponent(filename)
  return `filename*=UTF-8''${encodedFilename}`
}

/**
 * Test function to demonstrate filename encoding for headers
 */
export function testFileNameEncoding() {
  const testFiles = [
    "document.pdf",
    "Certificación.pdf",
    "Contrato de Préstamo - José María.docx", 
    "Declaración Jurada (Año 2024).pdf",
    "Documento con Ñ y Acentos.pdf"
  ]

  console.log("=== Filename Header Encoding Test ===")
  testFiles.forEach(filename => {
    const encoded = encodeFileNameForHeader(filename)
    console.log(`Original: ${filename}`)
    console.log(`Encoded: ${encoded}`)
    console.log("---")
  })
}

/**
 * Utility functions for file handling
 */

/**
 * Safely convert ArrayBuffer to base64 string, handling large files
 * @param arrayBuffer - The ArrayBuffer to convert
 * @param maxSizeMB - Maximum size in MB (default: 50MB)
 * @returns base64 string or throws error for large files
 */
export function arrayBufferToBase64(arrayBuffer: ArrayBuffer, maxSizeMB: number = 50): string {
  const sizeInMB = arrayBuffer.byteLength / (1024 * 1024)
  
  if (sizeInMB > maxSizeMB) {
    throw new Error(`File too large (${sizeInMB.toFixed(1)} MB). Maximum allowed: ${maxSizeMB} MB`)
  }
  
  // Use efficient chunk-based conversion for large files
  const uint8Array = new Uint8Array(arrayBuffer)
  const chunkSize = 8192 // 8KB chunks for optimal memory usage
  let result = ''
  
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, i + chunkSize)
    let chunkString = ''
    
    // Convert chunk to string efficiently
    for (let j = 0; j < chunk.length; j++) {
      chunkString += String.fromCharCode(chunk[j])
    }
    
    result += btoa(chunkString)
  }
  
  return result
}

/**
 * Get file size in MB from ArrayBuffer
 */
export function getFileSizeMB(arrayBuffer: ArrayBuffer): number {
  return arrayBuffer.byteLength / (1024 * 1024)
}

/**
 * Check if file size is within limits
 */
export function isFileSizeValid(arrayBuffer: ArrayBuffer, maxSizeMB: number = 50): boolean {
  return getFileSizeMB(arrayBuffer) <= maxSizeMB
}
