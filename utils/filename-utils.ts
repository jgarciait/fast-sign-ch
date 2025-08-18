/**
 * Sanitizes a filename for safe storage by removing/replacing problematic characters
 * @param filename The original filename
 * @returns A sanitized filename safe for storage
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return filename

  return filename
    // Replace accented characters with their base equivalents
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Replace spaces with underscores
    .replace(/\s+/g, '_')
    // Remove any remaining non-ASCII characters except dots and hyphens
    .replace(/[^\w.-]/g, '')
    // Remove multiple consecutive underscores
    .replace(/_+/g, '_')
    // Remove leading/trailing underscores
    .replace(/^_+|_+$/g, '')
    // Ensure we don't have an empty filename
    || 'document.pdf'
}

/**
 * Sanitizes a full file path for storage
 * @param path The file path 
 * @returns Sanitized path
 */
export function sanitizeFilePath(path: string): string {
  if (!path) return path

  const parts = path.split('/')
  return parts.map(part => {
    // Don't sanitize path segments that are UUIDs or timestamps
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part)) {
      return part // UUID
    }
    if (/^\d{13}_/.test(part)) {
      // Timestamp prefix - sanitize the filename part only
      const [timestamp, ...filenameParts] = part.split('_')
      const filename = filenameParts.join('_')
      return `${timestamp}_${sanitizeFilename(filename)}`
    }
    return sanitizeFilename(part)
  }).join('/')
}
