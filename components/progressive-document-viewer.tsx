"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  RotateCw, 
  ZoomIn, 
  ZoomOut, 
  Loader2, 
  FileText,
  Maximize,
  Minimize,
  RotateCcw
} from 'lucide-react';

interface ProgressiveDocumentViewerProps {
  documentUrl: string;
  numPages: number;
  currentPage: number;
  onPageChange: (pageNumber: number) => void;
  onPageRotate: (pageNumber: number, rotation: number) => void;
  onRotateAll: (rotation: number) => void;
  pageRotations: Record<number, number>;
  className?: string;
  pdfDocument?: any; // Accept shared PDF document
}

const PRERENDER_BUFFER = 3;
const PROGRESSIVE_LOAD_FIRST_PAGES = 20; // Load first 20 pages immediately

export default function ProgressiveDocumentViewer({
  documentUrl,
  numPages,
  currentPage,
  onPageChange,
  onPageRotate,
  onRotateAll,
  pageRotations,
  className = '',
  pdfDocument // Use shared PDF document
}: ProgressiveDocumentViewerProps) {
  const [documentLoading, setDocumentLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [allPagesRotation, setAllPagesRotation] = useState(0);
  const [renderedPages, setRenderedPages] = useState<Map<number, string>>(new Map());
  const [currentlyRendering, setCurrentlyRendering] = useState<Set<number>>(new Set());
  const [progressiveLoadingComplete, setProgressiveLoadingComplete] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Progressive loading of first pages
  useEffect(() => {
    if (!pdfDocument || progressiveLoadingComplete) return;

    const loadFirstPages = async () => {
      console.log('🚀 Starting progressive loading of first 20 pages...');
      setDocumentLoading(true);
      setLoadingProgress(0);

      try {
        // Load first 20 pages (or all pages if less than 20)
        const pagesToLoad = Math.min(PROGRESSIVE_LOAD_FIRST_PAGES, numPages);
        let successfulLoads = 0;
        
        for (let i = 1; i <= pagesToLoad; i++) {
          if (!renderedPages.has(i) && !currentlyRendering.has(i)) {
            try {
              await renderPage(i);
              successfulLoads++;
            } catch (error) {
              console.warn(`⚠️ Failed to load page ${i} during progressive loading:`, error);
              // Continue with other pages even if one fails
            }
            setLoadingProgress((i / pagesToLoad) * 100);
          }
        }
        
        setProgressiveLoadingComplete(true);
        console.log(`✅ Progressive loading complete! ${successfulLoads}/${pagesToLoad} pages loaded successfully.`);
        
      } catch (error) {
        console.error('❌ Error during progressive loading:', error);
        // Still mark as complete to prevent infinite loading
        setProgressiveLoadingComplete(true);
      } finally {
        setDocumentLoading(false);
      }
    };

    loadFirstPages();
  }, [pdfDocument, numPages, progressiveLoadingComplete]);

  // Pre-render pages around current page
  useEffect(() => {
    if (!pdfDocument || numPages === 0) return;

    const preRenderPages = async () => {
      // Prioritize current page first
      await renderPage(currentPage);
      
      // Then render a few pages around current page
      const buffer = Math.min(PRERENDER_BUFFER, Math.floor(numPages / 10));
      for (let i = 1; i <= buffer; i++) {
        if (currentPage - i >= 1) {
          setTimeout(() => renderPage(currentPage - i), i * 100);
        }
        if (currentPage + i <= numPages) {
          setTimeout(() => renderPage(currentPage + i), i * 100);
        }
      }
    };

    preRenderPages();
  }, [pdfDocument, currentPage, scale, allPagesRotation, numPages]);

  // No need to clear cache when rotations change since we apply rotation via canvas transform

  // Render current page to main canvas
  useEffect(() => {
    if (canvasRef.current && renderedPages.has(currentPage)) {
      const canvas = canvasRef.current;
      const dataUrl = renderedPages.get(currentPage);
      
      if (dataUrl) {
        const img = new Image();
        img.onload = () => {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            try {
              // Get total rotation for this page
              const totalRotation = (pageRotations[currentPage] || 0) + allPagesRotation;
              
              // For 90° or 270° rotation, swap canvas dimensions
              const isLandscape = totalRotation % 180 === 90;
              const canvasWidth = isLandscape ? img.height : img.width;
              const canvasHeight = isLandscape ? img.width : img.height;
              
              canvas.width = canvasWidth;
              canvas.height = canvasHeight;
              
              // Clear canvas
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              
              // Apply rotation transformation
              ctx.save();
              
              // Move to center for rotation
              ctx.translate(canvas.width / 2, canvas.height / 2);
              
              // Apply rotation
              ctx.rotate((totalRotation * Math.PI) / 180);
              
              // Draw image centered
              ctx.drawImage(img, -img.width / 2, -img.height / 2);
              
              // Restore context
              ctx.restore();
              
              console.log(`✅ Canvas updated for page ${currentPage} with ${totalRotation}° rotation, size: ${canvas.width}x${canvas.height}`);
            } catch (error) {
              console.error(`❌ Error updating canvas for page ${currentPage}:`, error);
            }
          }
        };
        img.onerror = () => {
          console.error(`❌ Failed to load image for page ${currentPage}`);
        };
        img.src = dataUrl;
      }
    }
  }, [currentPage, renderedPages, pageRotations, allPagesRotation]);

  const renderPage = useCallback(async (pageNumber: number): Promise<void> => {
    if (!pdfDocument || renderedPages.has(pageNumber) || currentlyRendering.has(pageNumber)) {
      return;
    }

    setCurrentlyRendering(prev => new Set(prev).add(pageNumber));

    try {
      const page = await pdfDocument.getPage(pageNumber);
      
      // Always render without rotation first (this prevents hanging)
      const viewport = page.getViewport({ 
        scale: scale, // Remove devicePixelRatio multiplication to prevent double scaling
        rotation: 0
      });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) {
        throw new Error('Could not get canvas context');
      }

      // Apply device pixel ratio for crisp rendering
      const devicePixelRatio = window.devicePixelRatio || 1;
      canvas.width = viewport.width * devicePixelRatio;
      canvas.height = viewport.height * devicePixelRatio;
      
      // Scale the context to match device pixel ratio
      context.scale(devicePixelRatio, devicePixelRatio);

      console.log(`🔄 Rendering page ${pageNumber} without rotation, dimensions: ${viewport.width}x${viewport.height} (canvas: ${canvas.width}x${canvas.height})`);

      // Clear canvas before rendering
      context.clearRect(0, 0, viewport.width, viewport.height);

      // Render with longer timeout for large PDFs (30 seconds)
      const renderPromise = page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Render timeout')), 30000);
      });

      await Promise.race([renderPromise, timeoutPromise]);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      
      setRenderedPages(prev => new Map(prev).set(pageNumber, dataUrl));
      console.log(`✅ Page ${pageNumber} rendered successfully (rotation will be applied via CSS)`);
      
    } catch (error) {
      console.error(`❌ Error rendering page ${pageNumber}:`, error);
    } finally {
      setCurrentlyRendering(prev => {
        const newSet = new Set(prev);
        newSet.delete(pageNumber);
        return newSet;
      });
    }
  }, [pdfDocument, scale, allPagesRotation]);

  // Navigation handlers
  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  }, [currentPage, onPageChange]);

  const handleNextPage = useCallback(() => {
    if (currentPage < numPages) {
      onPageChange(currentPage + 1);
    }
  }, [currentPage, numPages, onPageChange]);

  const handleRotateCurrentPage = useCallback(() => {
    const newRotation = (pageRotations[currentPage] || 0) + 90;
    onPageRotate(currentPage, newRotation);
    // Re-render current page with new rotation
    setRenderedPages(prev => {
      const newMap = new Map(prev);
      newMap.delete(currentPage);
      return newMap;
    });
  }, [currentPage, pageRotations, onPageRotate]);

  const handleRotateCurrentPageReverse = useCallback(() => {
    const newRotation = (pageRotations[currentPage] || 0) - 90;
    onPageRotate(currentPage, newRotation);
    // Re-render current page with new rotation
    setRenderedPages(prev => {
      const newMap = new Map(prev);
      newMap.delete(currentPage);
      return newMap;
    });
  }, [currentPage, pageRotations, onPageRotate]);

  const handleRotateAll = useCallback(() => {
    const newRotation = allPagesRotation + 90;
    setAllPagesRotation(newRotation);
    onRotateAll(90);
    // Clear all rendered pages to force re-render with new rotation
    setRenderedPages(new Map());
  }, [allPagesRotation, onRotateAll]);

  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev * 1.2, 1.75));
    setRenderedPages(new Map()); // Clear cache to re-render with new scale
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(prev / 1.2, 0.3));
    setRenderedPages(new Map()); // Clear cache to re-render with new scale
  }, []);

  const handleZoomReset = useCallback(() => {
    setScale(1.0);
    setRenderedPages(new Map()); // Clear cache to re-render with new scale
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with input fields
      if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return;
      
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevPage();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextPage();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleRotateCurrentPage();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        handleZoomReset();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevPage, handleNextPage, handleRotateCurrentPage, handleZoomIn, handleZoomOut, handleZoomReset, toggleFullscreen]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  if (!pdfDocument) {
    return (
      <div className={`flex items-center justify-center h-full bg-gray-50 ${className}`}>
        <div className="text-center space-y-4">
          <div className="relative">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <div className="absolute inset-0 flex items-center justify-center">
              <FileText className="h-4 w-4 text-blue-600" />
            </div>
          </div>
          <div className="text-sm text-gray-600">Preparando documento...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`} ref={containerRef}>
      {/* Progressive loading indicator */}
      {documentLoading && (
        <div className="w-full bg-gray-200 rounded-full h-1">
          <div 
            className="bg-blue-600 h-1 rounded-full transition-all duration-300"
            style={{ width: `${loadingProgress}%` }}
          />
        </div>
      )}

      {/* Document Display */}
      <div className="flex-1 overflow-auto bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="flex items-center justify-center min-h-full p-4">
          <div className="relative">
            {/* Document Container */}
            <div className="bg-white shadow-2xl rounded-lg overflow-hidden">
              {renderedPages.has(currentPage) ? (
                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    className="max-w-full max-h-full block"
                    style={{
                      imageRendering: 'crisp-edges'
                      // Removed problematic transform that was causing double scaling
                    }}
                  />
                  
                  {/* Overlay Controls */}
                  <div className="absolute top-2 right-2 flex items-center space-x-1 opacity-0 hover:opacity-100 transition-opacity">
                    <div className="bg-black bg-opacity-70 rounded-lg p-1 flex items-center space-x-1">
                      <button
                        onClick={handleZoomOut}
                        className="p-1 text-white hover:bg-white hover:bg-opacity-20 rounded transition-colors"
                        title="Alejar (-)"
                      >
                        <ZoomOut className="h-3 w-3" />
                      </button>
                      
                      <button
                        onClick={handleZoomReset}
                        className="px-2 py-1 text-xs text-white hover:bg-white hover:bg-opacity-20 rounded transition-colors"
                        title="Tamaño original (0)"
                      >
                        {Math.round(scale * 100)}%
                      </button>
                      
                      <button
                        onClick={handleZoomIn}
                        className="p-1 text-white hover:bg-white hover:bg-opacity-20 rounded transition-colors"
                        title="Acercar (+)"
                      >
                        <ZoomIn className="h-3 w-3" />
                      </button>
                      
                      <div className="h-4 w-px bg-white bg-opacity-30" />
                      
                      <button
                        onClick={handleRotateCurrentPageReverse}
                        className="p-1 text-white hover:bg-white hover:bg-opacity-20 rounded transition-colors"
                        title="Rotar izquierda"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                      
                      <button
                        onClick={handleRotateCurrentPage}
                        className="p-1 text-white hover:bg-white hover:bg-opacity-20 rounded transition-colors"
                        title="Rotar derecha (R)"
                      >
                        <RotateCw className="h-3 w-3" />
                      </button>
                      
                      <div className="h-4 w-px bg-white bg-opacity-30" />
                      
                      <button
                        onClick={toggleFullscreen}
                        className="p-1 text-white hover:bg-white hover:bg-opacity-20 rounded transition-colors"
                        title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa (F)"}
                      >
                        {isFullscreen ? <Minimize className="h-3 w-3" /> : <Maximize className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                  
                  {/* Navigation Arrows */}
                  {currentPage > 1 && (
                    <button
                      onClick={handlePrevPage}
                      className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all opacity-0 hover:opacity-100"
                      title="Página anterior"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                  )}
                  
                  {currentPage < numPages && (
                    <button
                      onClick={handleNextPage}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all opacity-0 hover:opacity-100"
                      title="Página siguiente"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center w-96 h-96 bg-gray-50">
                  <div className="text-center space-y-4">
                    <div className="relative">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-blue-600" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-gray-700">
                        {documentLoading ? 'Cargando páginas...' : `Renderizando página ${currentPage}...`}
                      </div>
                      <div className="text-xs text-gray-500">
                        Esto solo toma unos segundos
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="px-4 py-2 bg-white border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-3">
            <span>
              {progressiveLoadingComplete ? 
                `🎯 ${Math.min(PROGRESSIVE_LOAD_FIRST_PAGES, numPages)} páginas listas` : 
                `⏳ Cargando...`
              }
            </span>
            <span>•</span>
            <span>
              Renderizadas: {renderedPages.size}/{numPages}
            </span>
            {scale !== 1.0 && (
              <>
                <span>•</span>
                <span>Zoom: {Math.round(scale * 100)}%</span>
              </>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <span>Atajos: ←→ navegar | +/- zoom | R rotar | F pantalla completa</span>
          </div>
        </div>
      </div>
    </div>
  );
} 