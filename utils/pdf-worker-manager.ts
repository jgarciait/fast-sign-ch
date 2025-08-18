/**
 * PDF Worker Manager - Optimized for Heavy Documents
 * Handles PDF.js worker configuration and document processing for 200MB+ files
 */

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

interface WorkerConfig {
  maxWorkers: number;
  workerSrc: string;
  verbosity: number;
  maxImageSize: number;
  disableAutoFetch: boolean;
  disableStream: boolean;
  enableXfa: boolean;
  isEvalSupported: boolean;
}

class PDFWorkerManager {
  private static instance: PDFWorkerManager;
  private pdfjsLib: any = null;
  private workerInitialized = false;
  private initializationPromise: Promise<any> | null = null;

  private constructor() {}

  static getInstance(): PDFWorkerManager {
    if (!PDFWorkerManager.instance) {
      PDFWorkerManager.instance = new PDFWorkerManager();
    }
    return PDFWorkerManager.instance;
  }

  /**
   * Initialize PDF.js with optimized settings for heavy documents
   */
  async initialize(): Promise<any> {
    if (this.workerInitialized && this.pdfjsLib) {
      return this.pdfjsLib;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.loadPDFJS();
    return this.initializationPromise;
  }

  private async loadPDFJS(): Promise<any> {
    if (typeof window === 'undefined') {
      throw new Error('PDF.js can only be loaded in browser environment');
    }

    try {
      // Load PDF.js from CDN for reliability
      await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
      
      this.pdfjsLib = window.pdfjsLib;
      if (!this.pdfjsLib) {
        throw new Error('PDF.js library not found after loading');
      }

      // Configure worker for heavy document processing
      const workerConfig: WorkerConfig = {
        maxWorkers: Math.max(1, Math.floor(navigator.hardwareConcurrency / 2)),
        workerSrc: 'https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs',
        verbosity: 0, // Reduce logging for performance
        maxImageSize: 16 * 1024 * 1024, // 16MB max image size for heavy documents
        disableAutoFetch: false,
        disableStream: false,
        enableXfa: false,
        isEvalSupported: false
      };

      // Set global worker options
      this.pdfjsLib.GlobalWorkerOptions.workerSrc = workerConfig.workerSrc;
      
      // Configure for heavy document processing
      this.pdfjsLib.GlobalWorkerOptions.verbosity = workerConfig.verbosity;

      this.workerInitialized = true;
      console.log('PDF.js worker initialized for heavy document processing');
      
      return this.pdfjsLib;
    } catch (error) {
      console.error('Failed to initialize PDF.js:', error);
      this.initializationPromise = null;
      throw error;
    }
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if script already exists
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  /**
   * Load PDF document with optimized settings for heavy files
   */
  async loadDocument(url: string, options: Partial<any> = {}): Promise<any> {
    const pdfjsLib = await this.initialize();
    
    const loadingConfig = {
      url,
      verbosity: 0,
      disableAutoFetch: false,
      disableStream: false,
      maxImageSize: 16 * 1024 * 1024, // 16MB for heavy documents
      enableXfa: false,
      isEvalSupported: false,
      cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/',
      ...options
    };

    console.log('Loading PDF document...');
    const loadingTask = pdfjsLib.getDocument(loadingConfig);
    
    // Simple progress tracking without excessive logging
    let lastLoggedProgress = 0;
    loadingTask.onProgress = (progress: any) => {
      if (progress.total > 0) {
        const percent = Math.round((progress.loaded / progress.total) * 100);
        // Only log progress every 25% to avoid spam
        if (percent - lastLoggedProgress >= 25) {
          console.log(`PDF loading: ${percent}%`);
          lastLoggedProgress = percent;
        }
      }
    };

    return loadingTask.promise;
  }

  /**
   * Get PDF library instance
   */
  getPDFLib(): any {
    return this.pdfjsLib;
  }

  /**
   * Check if worker is initialized
   */
  isInitialized(): boolean {
    return this.workerInitialized && this.pdfjsLib !== null;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.workerInitialized = false;
    this.pdfjsLib = null;
    this.initializationPromise = null;
  }
}

export default PDFWorkerManager; 