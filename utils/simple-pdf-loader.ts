import { createClient } from "./supabase/client"

export interface PDFChunk {
  start: number
  end: number
  data: ArrayBuffer
}

export class SimplePDFLoader {
  private supabase = createClient()
  private documentUrl: string
  private bucketName: string
  private filePath: string
  private loadedChunks = new Map<string, ArrayBuffer>()
  private fileSize: number | null = null

  constructor(documentUrl: string) {
    this.documentUrl = documentUrl
    const urlParts = this.extractSupabaseInfo(documentUrl)
    this.bucketName = urlParts.bucket
    this.filePath = urlParts.path
  }

  private extractSupabaseInfo(url: string): { bucket: string; path: string } {
    console.log('🔍 Extracting Supabase info from URL:', url)
    
    const match = url.match(/\/storage\/v1\/object\/public\/([^\/]+)\/(.+)/)
    if (!match) {
      throw new Error(`Invalid Supabase storage URL: ${url}`)
    }
    
    const bucket = match[1]
    const path = match[2]
    
    console.log('✅ Extracted bucket:', bucket, 'path:', path)
    return { bucket, path }
  }

  /**
   * Get file size from Supabase Storage
   */
  async getFileSize(): Promise<number> {
    if (this.fileSize !== null) {
      return this.fileSize
    }

    console.log('📏 Getting file size...')
    
    try {
      const { data: fileInfo, error } = await this.supabase.storage
        .from(this.bucketName)
        .list(this.filePath.split('/').slice(0, -1).join('/'), {
          search: this.filePath.split('/').pop()
        })

      if (error) {
        throw new Error(`Storage error: ${error.message}`)
      }

      if (!fileInfo || fileInfo.length === 0) {
        throw new Error(`File not found: ${this.filePath}`)
      }

      const size = fileInfo[0].metadata?.size || 0
      this.fileSize = size
      console.log('✅ File size:', size, 'bytes')
      return size
      
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
      // Get the public URL for the file
      const { data: urlData } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(this.filePath)
      
      const publicUrl = urlData.publicUrl
      
      // Use fetch with Range header
      const response = await fetch(publicUrl, {
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
   * Load the last chunk of the PDF (trailer + xref)
   */
  async loadLastChunk(chunkSize: number = 1024 * 1024): Promise<ArrayBuffer> {
    const fileSize = await this.getFileSize()
    const start = Math.max(0, fileSize - chunkSize)
    console.log('📄 Loading last chunk of PDF...')
    return this.loadRange(start, fileSize - 1)
  }

  /**
   * Load a specific page by estimating its position
   * This is a simplified approach - we estimate page positions
   */
  async loadPageChunk(pageNumber: number, pagesPerChunk: number = 10): Promise<ArrayBuffer> {
    const fileSize = await this.getFileSize()
    
    // Estimate page size (simplified - assumes uniform page sizes)
    const estimatedPageSize = fileSize / 855 // Your document has 855 pages
    const chunkSize = estimatedPageSize * pagesPerChunk
    
    // Calculate chunk start
    const chunkStart = Math.floor((pageNumber - 1) / pagesPerChunk) * chunkSize
    const chunkEnd = Math.min(chunkStart + chunkSize - 1, fileSize - 1)
    
    console.log(`📥 Loading chunk for page ${pageNumber} (range: ${chunkStart}-${chunkEnd})`)
    return this.loadRange(chunkStart, chunkEnd)
  }

  /**
   * Preload multiple chunks for faster access
   */
  async preloadChunks(chunks: Array<{ start: number; end: number }>): Promise<void> {
    console.log(`🚀 Preloading ${chunks.length} chunks...`)
    
    const loadPromises = chunks.map(async (chunk, index) => {
      try {
        await this.loadRange(chunk.start, chunk.end)
        console.log(`✅ Chunk ${index + 1}/${chunks.length} preloaded`)
      } catch (error) {
        console.error(`❌ Failed to preload chunk ${index + 1}:`, error)
      }
    })

    await Promise.all(loadPromises)
    console.log('✅ All chunks preloaded')
  }

  /**
   * Get loading progress
   */
  getLoadingProgress(): number {
    return (this.loadedChunks.size / Math.max(this.fileSize ? Math.ceil(this.fileSize / (1024 * 1024)) : 1, 1)) * 100
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
 * Factory function to create a simple PDF loader
 */
export function createSimplePDFLoader(documentUrl: string): SimplePDFLoader {
  return new SimplePDFLoader(documentUrl)
} 