/**
 * PDF Cache Manager
 * Handles efficient caching and memory management for large PDF documents
 */

interface CachedPage {
  pageNumber: number
  canvas: HTMLCanvasElement
  dataUrl: string
  timestamp: number
  size: number
}

interface CachedDocument {
  url: string
  pdfDocument: any
  numPages: number
  pageCache: Map<number, CachedPage>
  lastAccessed: number
  memoryUsage: number
}

interface CacheStats {
  totalMemoryUsage: number
  totalPages: number
  hitRate: number
  totalRequests: number
  cacheHits: number
}

export class PDFCacheManager {
  private static instance: PDFCacheManager
  private documents: Map<string, CachedDocument> = new Map()
  private maxMemoryUsage: number = 100 * 1024 * 1024 // 100MB default
  private maxCacheSize: number = 50 // Max pages to cache per document
  private preloadQueue: Array<{ url: string; pageNumber: number }> = []
  private isPreloading: boolean = false
  private stats: CacheStats = {
    totalMemoryUsage: 0,
    totalPages: 0,
    hitRate: 0,
    totalRequests: 0,
    cacheHits: 0
  }

  private constructor() {}

  static getInstance(): PDFCacheManager {
    if (!PDFCacheManager.instance) {
      PDFCacheManager.instance = new PDFCacheManager()
    }
    return PDFCacheManager.instance
  }

  /**
   * Configure cache settings
   */
  configure(options: {
    maxMemoryUsage?: number
    maxCacheSize?: number
  }) {
    if (options.maxMemoryUsage) {
      this.maxMemoryUsage = options.maxMemoryUsage
    }
    if (options.maxCacheSize) {
      this.maxCacheSize = options.maxCacheSize
    }
  }

  /**
   * Load PDF document and cache it
   */
  async loadDocument(url: string): Promise<any> {
    const cached = this.documents.get(url)
    if (cached) {
      cached.lastAccessed = Date.now()
      return cached.pdfDocument
    }

    try {
      // Dynamic import of pdfjs-dist
      const pdfjs = await import('pdfjs-dist')
      
      // Configure worker - handle different import structures for 3.11.174
      if (typeof window !== 'undefined') {
        if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        }
      }

      // Use the imported pdfjs directly (3.11.174 structure)
      const pdfjsLib = pdfjs
      
      const loadingTask = pdfjsLib.getDocument({
        url,
        verbosity: 0,
        disableAutoFetch: false,
        disableStream: false,
        maxImageSize: 2 * 1024 * 1024,
        enableXfa: false,
        isEvalSupported: false
      })

      const pdfDocument = await loadingTask.promise

      // Cache the document
      const cachedDoc: CachedDocument = {
        url,
        pdfDocument,
        numPages: pdfDocument.numPages,
        pageCache: new Map(),
        lastAccessed: Date.now(),
        memoryUsage: 0
      }

      this.documents.set(url, cachedDoc)
      this.cleanupOldDocuments()

      return pdfDocument
    } catch (error) {
      console.error('Failed to load PDF document:', error)
      throw error
    }
  }

  /**
   * Get or render page with caching
   */
  async getPage(url: string, pageNumber: number, scale: number = 1): Promise<string> {
    this.stats.totalRequests++

    const cachedDoc = this.documents.get(url)
    if (!cachedDoc) {
      throw new Error('Document not loaded')
    }

    // Check cache first
    const cachedPage = cachedDoc.pageCache.get(pageNumber)
    if (cachedPage) {
      this.stats.cacheHits++
      this.updateHitRate()
      return cachedPage.dataUrl
    }

    // Render page
    try {
      const page = await cachedDoc.pdfDocument.getPage(pageNumber)
      const viewport = page.getViewport({ scale })

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      
      if (!context) {
        throw new Error('Could not get canvas context')
      }

      canvas.width = viewport.width
      canvas.height = viewport.height

      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise

      const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
      const imageSize = this.estimateImageSize(dataUrl)

      // Cache the page
      const cachedPage: CachedPage = {
        pageNumber,
        canvas,
        dataUrl,
        timestamp: Date.now(),
        size: imageSize
      }

      cachedDoc.pageCache.set(pageNumber, cachedPage)
      cachedDoc.memoryUsage += imageSize
      this.stats.totalMemoryUsage += imageSize
      this.stats.totalPages++

      // Cleanup if necessary
      this.cleanupPageCache(url)
      this.updateHitRate()

      return dataUrl
    } catch (error) {
      console.error('Failed to render page:', error)
      throw error
    }
  }

  /**
   * Preload pages for better performance
   */
  async preloadPages(url: string, pageNumbers: number[], scale: number = 1): Promise<void> {
    if (this.isPreloading) {
      return
    }

    this.isPreloading = true

    try {
      const cachedDoc = this.documents.get(url)
      if (!cachedDoc) {
        throw new Error('Document not loaded')
      }

      // Filter out already cached pages
      const pagesToLoad = pageNumbers.filter(pageNum => 
        !cachedDoc.pageCache.has(pageNum)
      )

      // Load pages in batches to avoid overwhelming the browser
      const batchSize = 5
      for (let i = 0; i < pagesToLoad.length; i += batchSize) {
        const batch = pagesToLoad.slice(i, i + batchSize)
        
        await Promise.all(
          batch.map(pageNum => 
            this.getPage(url, pageNum, scale).catch(error => {
              console.warn(`Failed to preload page ${pageNum}:`, error)
            })
          )
        )

        // Allow other tasks to run
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    } finally {
      this.isPreloading = false
    }
  }

  /**
   * Get thumbnail for a page
   */
  async getThumbnail(url: string, pageNumber: number): Promise<string> {
    return this.getPage(url, pageNumber, 0.2) // Small scale for thumbnails
  }

  /**
   * Clear cache for a specific document
   */
  clearDocument(url: string): void {
    const cachedDoc = this.documents.get(url)
    if (cachedDoc) {
      this.stats.totalMemoryUsage -= cachedDoc.memoryUsage
      this.stats.totalPages -= cachedDoc.pageCache.size
      this.documents.delete(url)
    }
  }

  /**
   * Clear all cache
   */
  clearAll(): void {
    this.documents.clear()
    this.stats = {
      totalMemoryUsage: 0,
      totalPages: 0,
      hitRate: 0,
      totalRequests: 0,
      cacheHits: 0
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats }
  }

  /**
   * Get document info
   */
  getDocumentInfo(url: string): { numPages: number; memoryUsage: number } | null {
    const cachedDoc = this.documents.get(url)
    return cachedDoc ? {
      numPages: cachedDoc.numPages,
      memoryUsage: cachedDoc.memoryUsage
    } : null
  }

  /**
   * Private: Clean up old documents when memory limit is reached
   */
  private cleanupOldDocuments(): void {
    if (this.stats.totalMemoryUsage <= this.maxMemoryUsage) {
      return
    }

    // Sort documents by last accessed time
    const sortedDocs = Array.from(this.documents.entries())
      .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed)

    // Remove oldest documents until under memory limit
    while (this.stats.totalMemoryUsage > this.maxMemoryUsage && sortedDocs.length > 0) {
      const [url] = sortedDocs.shift()!
      this.clearDocument(url)
    }
  }

  /**
   * Private: Clean up page cache when it gets too large
   */
  private cleanupPageCache(url: string): void {
    const cachedDoc = this.documents.get(url)
    if (!cachedDoc || cachedDoc.pageCache.size <= this.maxCacheSize) {
      return
    }

    // Sort pages by timestamp (LRU)
    const sortedPages = Array.from(cachedDoc.pageCache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp)

    // Remove oldest pages
    const pagesToRemove = sortedPages.length - this.maxCacheSize
    for (let i = 0; i < pagesToRemove; i++) {
      const [pageNumber, page] = sortedPages[i]
      cachedDoc.pageCache.delete(pageNumber)
      cachedDoc.memoryUsage -= page.size
      this.stats.totalMemoryUsage -= page.size
      this.stats.totalPages--
    }
  }

  /**
   * Private: Estimate image size in bytes
   */
  private estimateImageSize(dataUrl: string): number {
    // Rough estimate: base64 string length * 0.75 (base64 overhead)
    const base64Length = dataUrl.split(',')[1]?.length || 0
    return base64Length * 0.75
  }

  /**
   * Private: Update hit rate statistics
   */
  private updateHitRate(): void {
    this.stats.hitRate = this.stats.totalRequests > 0 
      ? (this.stats.cacheHits / this.stats.totalRequests) * 100 
      : 0
  }
}

export default PDFCacheManager.getInstance() 