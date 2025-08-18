/**
 * Direct PDF Loader - Uses simple Range Requests on public URLs
 */

export class DirectPDFLoader {
  private documentUrl: string
  private loadedChunks = new Map<string, ArrayBuffer>()
  private fileSize: number | null = null

  constructor(documentUrl: string) {
    this.documentUrl = documentUrl
  }

  /**
   * Get file size using HEAD request
   */
  async getFileSize(): Promise<number> {
    if (this.fileSize !== null) {
      return this.fileSize
    }

    console.log('📏 Getting file size via HEAD request...')
    
    try {
      const response = await fetch(this.documentUrl, {
        method: 'HEAD'
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const contentLength = response.headers.get('content-length')
      if (!contentLength) {
        throw new Error('Content-Length header not found')
      }

      this.fileSize = parseInt(contentLength, 10)
      console.log('✅ File size:', this.fileSize, 'bytes')
      return this.fileSize
      
    } catch (error) {
      console.error('❌ Error getting file size:', error)
      throw error
    }
  }

  /**
   * Load a specific byte range using HTTP Range Requests
   */
  async loadRange(start: number, end: number): Promise<ArrayBuffer> {
    const rangeKey = `${start}-${end}`
    
    // Check cache first
    if (this.loadedChunks.has(rangeKey)) {
      console.log(`📦 Range ${rangeKey} loaded from cache`)
      return this.loadedChunks.get(rangeKey)!
    }

    console.log(`🌐 Loading range ${start}-${end} bytes...`)
    
    try {
      const response = await fetch(this.documentUrl, {
        method: 'GET',
        headers: {
          'Range': `bytes=${start}-${end}`,
          'Accept': 'application/octet-stream'
        }
      })

      if (!response.ok && response.status !== 206) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      
      // Cache the result
      this.loadedChunks.set(rangeKey, arrayBuffer)
      
      console.log(`✅ Range ${rangeKey} loaded successfully (${arrayBuffer.byteLength} bytes)`)
      return arrayBuffer
      
    } catch (error) {
      console.error(`❌ Error loading range ${rangeKey}:`, error)
      throw error
    }
  }

  /**
   * Load the first chunk of the PDF (header + first few pages)
   */
  async loadFirstChunk(chunkSize: number = 1024 * 1024): Promise<ArrayBuffer> {
    console.log('🚀 Loading first chunk of PDF...')
    return this.loadRange(0, chunkSize - 1)
  }

  /**
   * Load the entire file if Range Requests fail
   */
  async loadEntireFile(): Promise<ArrayBuffer> {
    console.log('📥 Loading entire file as fallback...')
    
    try {
      const response = await fetch(this.documentUrl)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      console.log(`✅ Entire file loaded (${arrayBuffer.byteLength} bytes)`)
      return arrayBuffer
      
    } catch (error) {
      console.error('❌ Error loading entire file:', error)
      throw error
    }
  }

  /**
   * Smart load: Try Range Request first, fallback to full download
   */
  async smartLoad(chunkSize: number = 1024 * 1024): Promise<ArrayBuffer> {
    try {
      // Try to get file size first
      await this.getFileSize()
      
      // If file is small, just download the whole thing
      if (this.fileSize! < chunkSize * 2) {
        console.log('📁 File is small, downloading entirely')
        return this.loadEntireFile()
      }
      
      // Try Range Request for first chunk
      return this.loadFirstChunk(chunkSize)
      
    } catch (error) {
      console.warn('⚠️ Range Request failed, falling back to full download:', error)
      return this.loadEntireFile()
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.loadedChunks.clear()
    this.fileSize = null
  }
}

/**
 * Factory function to create a direct PDF loader
 */
export function createDirectPDFLoader(documentUrl: string): DirectPDFLoader {
  return new DirectPDFLoader(documentUrl)
} 