import { createClient } from "./supabase/client"

export interface PDFRange {
  start: number
  end: number
}

export interface PDFPageInfo {
  pageNumber: number
  byteOffset: number
  byteLength: number
}

export class ProgressivePDFLoader {
  private supabase = createClient()
  private documentUrl: string
  private bucketName: string
  private filePath: string
  private pageInfoCache = new Map<number, PDFPageInfo>()
  private loadedRanges = new Set<string>()

  constructor(documentUrl: string) {
    this.documentUrl = documentUrl
    // Extract bucket and path from Supabase URL
    const urlParts = this.extractSupabaseInfo(documentUrl)
    this.bucketName = urlParts.bucket
    this.filePath = urlParts.path
  }

  private extractSupabaseInfo(url: string): { bucket: string; path: string } {
    console.log('🔍 Extracting Supabase info from URL:', url)
    
    // Parse Supabase storage URL: https://project.supabase.co/storage/v1/object/public/bucket/path
    const match = url.match(/\/storage\/v1\/object\/public\/([^\/]+)\/(.+)/)
    if (!match) {
      console.error('❌ Invalid Supabase storage URL format:', url)
      throw new Error(`Invalid Supabase storage URL: ${url}`)
    }
    
    const bucket = match[1]
    const path = match[2]
    
    console.log('✅ Extracted bucket:', bucket, 'path:', path)
    return { bucket, path }
  }

  /**
   * Load a specific byte range from the PDF file using HTTP Range Requests
   */
  async loadRange(range: PDFRange): Promise<ArrayBuffer> {
    const rangeKey = `${range.start}-${range.end}`
    
    if (this.loadedRanges.has(rangeKey)) {
      console.log(`📦 Range ${rangeKey} already loaded from cache`)
      return this.getCachedRange(range)
    }

    console.log(`🌐 Loading range ${range.start}-${range.end} bytes from Supabase...`)
    
    try {
      // Get the public URL for the file
      const { data: urlData } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(this.filePath)
      
      const publicUrl = urlData.publicUrl
      
      // Use fetch with Range header for progressive loading
      const response = await fetch(publicUrl, {
        method: 'GET',
        headers: {
          'Range': `bytes=${range.start}-${range.end}`,
          'Accept': 'application/octet-stream'
        }
      })

      if (!response.ok && response.status !== 206) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      this.cacheRange(range, arrayBuffer)
      this.loadedRanges.add(rangeKey)
      
      console.log(`✅ Range ${rangeKey} loaded successfully (${arrayBuffer.byteLength} bytes)`)
      return arrayBuffer
      
    } catch (error) {
      console.error(`❌ Error loading range ${rangeKey}:`, error)
      throw error
    }
  }

  /**
   * Load PDF header and trailer to get page information
   */
  async loadPDFStructure(): Promise<{ pageCount: number; pageInfo: PDFPageInfo[] }> {
    console.log('🔍 Loading PDF structure...')
    
    // First, load the trailer to get page count and xref table
    const trailerRange = await this.estimateTrailerRange()
    const trailerData = await this.loadRange(trailerRange)
    
    // Parse trailer to get page count
    const pageCount = this.parsePageCountFromTrailer(trailerData)
    console.log(`📄 PDF has ${pageCount} pages`)
    
    // Load xref table to get page byte offsets
    const xrefRange = await this.estimateXrefRange(trailerData)
    const xrefData = await this.loadRange(xrefRange)
    
    // Parse xref to get page information
    const pageInfo = this.parsePageInfoFromXref(xrefData, pageCount)
    
    console.log('✅ PDF structure loaded successfully')
    return { pageCount, pageInfo }
  }

  /**
   * Load a specific page by number
   */
  async loadPage(pageNumber: number): Promise<ArrayBuffer> {
    const pageInfo = this.pageInfoCache.get(pageNumber)
    if (!pageInfo) {
      throw new Error(`Page ${pageNumber} info not available. Load PDF structure first.`)
    }

    const range: PDFRange = {
      start: pageInfo.byteOffset,
      end: pageInfo.byteOffset + pageInfo.byteLength - 1
    }

    return this.loadRange(range)
  }

  /**
   * Preload multiple pages efficiently
   */
  async preloadPages(pageNumbers: number[]): Promise<void> {
    console.log(`🚀 Preloading ${pageNumbers.length} pages: ${pageNumbers.join(', ')}`)
    
    const loadPromises = pageNumbers.map(async (pageNum) => {
      try {
        await this.loadPage(pageNum)
        console.log(`✅ Page ${pageNum} preloaded`)
      } catch (error) {
        console.error(`❌ Failed to preload page ${pageNum}:`, error)
      }
    })

    await Promise.all(loadPromises)
  }

  /**
   * Estimate trailer range (last 8KB of file)
   */
  private async estimateTrailerRange(): Promise<PDFRange> {
    console.log('🔍 Estimating trailer range for file:', this.filePath)
    
    try {
      // Get file size first
      const { data: fileInfo, error } = await this.supabase.storage
        .from(this.bucketName)
        .list(this.filePath.split('/').slice(0, -1).join('/'), {
          search: this.filePath.split('/').pop()
        })

      if (error) {
        console.error('❌ Error listing file:', error)
        throw new Error(`Storage error: ${error.message}`)
      }

      if (!fileInfo || fileInfo.length === 0) {
        console.error('❌ File not found in bucket:', this.bucketName, 'path:', this.filePath)
        throw new Error(`File not found: ${this.filePath}`)
      }

      const fileSize = fileInfo[0].metadata?.size || 0
      console.log('📊 File size:', fileSize, 'bytes')
      
      const trailerSize = Math.min(8192, fileSize) // Last 8KB
      const range = {
        start: Math.max(0, fileSize - trailerSize),
        end: fileSize - 1
      }
      
      console.log('✅ Trailer range:', range)
      return range
      
    } catch (error) {
      console.error('❌ Error estimating trailer range:', error)
      throw error
    }
  }

  /**
   * Parse page count from trailer
   */
  private parsePageCountFromTrailer(trailerData: ArrayBuffer): number {
    const decoder = new TextDecoder('utf-8')
    const trailerText = decoder.decode(trailerData)
    
    // Look for /Size entry in trailer
    const sizeMatch = trailerText.match(/\/Size\s+(\d+)/)
    if (sizeMatch) {
      return parseInt(sizeMatch[1])
    }
    
    // Fallback: count /Page objects
    const pageMatches = trailerText.match(/\/Page\s+\d+\s+\d+\s+R/g)
    return pageMatches ? pageMatches.length : 0
  }

  /**
   * Estimate xref table range
   */
  private async estimateXrefRange(trailerData: ArrayBuffer): Promise<PDFRange> {
    const decoder = new TextDecoder('utf-8')
    const trailerText = decoder.decode(trailerData)
    
    // Look for /XRefStm or /Prev entry
    const xrefMatch = trailerText.match(/\/XRefStm\s+(\d+)/)
    if (xrefMatch) {
      const xrefOffset = parseInt(xrefMatch[1])
      return {
        start: xrefOffset,
        end: xrefOffset + 8192 // Assume 8KB xref table
      }
    }
    
    throw new Error('Could not locate xref table')
  }

  /**
   * Parse page information from xref
   */
  private parsePageInfoFromXref(xrefData: ArrayBuffer, pageCount: number): PDFPageInfo[] {
    const decoder = new TextDecoder('utf-8')
    const xrefText = decoder.decode(xrefData)
    
    const pageInfo: PDFPageInfo[] = []
    
    // Parse xref entries for pages
    for (let i = 1; i <= pageCount; i++) {
      const pageMatch = xrefText.match(new RegExp(`${i}\\s+(\\d+)\\s+(\\d+)\\s+n`))
      if (pageMatch) {
        const byteOffset = parseInt(pageMatch[1])
        const generation = parseInt(pageMatch[2])
        
        pageInfo.push({
          pageNumber: i,
          byteOffset,
          byteLength: 4096 // Estimate page size
        })
        
        this.pageInfoCache.set(i, {
          pageNumber: i,
          byteOffset,
          byteLength: 4096
        })
      }
    }
    
    return pageInfo
  }

  /**
   * Cache management
   */
  private cacheRange(range: PDFRange, data: ArrayBuffer): void {
    // Store in memory cache (in production, you might want to use IndexedDB)
    const key = `${range.start}-${range.end}`
    ;(this as any).rangeCache = (this as any).rangeCache || new Map()
    ;(this as any).rangeCache.set(key, data)
  }

  private getCachedRange(range: PDFRange): ArrayBuffer {
    const key = `${range.start}-${range.end}`
    ;(this as any).rangeCache = (this as any).rangeCache || new Map()
    return (this as any).rangeCache.get(key)
  }

  /**
   * Get loading progress
   */
  getLoadingProgress(): number {
    return (this.loadedRanges.size / Math.max(this.pageInfoCache.size, 1)) * 100
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.loadedRanges.clear()
    this.pageInfoCache.clear()
    ;(this as any).rangeCache?.clear()
  }
}

/**
 * Factory function to create a progressive PDF loader
 */
export function createProgressivePDFLoader(documentUrl: string): ProgressivePDFLoader {
  return new ProgressivePDFLoader(documentUrl)
} 