"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import VirtualizedThumbnailPanel from './virtualized-thumbnail-panel';
import ProgressiveDocumentViewer from './progressive-document-viewer';
import { loadPdfDocument, getCachedPdfDocument } from '@/utils/pdf-singleton';
import { 
  RotateCw, 
  Save, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  RefreshCw,
  FileText,
  Eye,
  EyeOff
} from 'lucide-react';

interface CompleteDocumentViewerProps {
  documentUrl: string;
  documentId?: string;
  fileName?: string;
  onSave?: (rotations: Record<number, number>) => void;
  onDownload?: () => void;
  onLoad?: (numPages: number) => void;
  className?: string;
}

interface ViewerState {
  currentPage: number;
  numPages: number;
  pageRotations: Record<number, number>;
  allPagesRotation: number;
  documentLoading: boolean;
  documentError: string | null;
  loadingProgress: number;
  showThumbnails: boolean;
  isMobile: boolean;
  progressiveLoadingComplete: boolean;
  initialPagesLoaded: boolean;
  saving: boolean;
  scale: number;
}

export default function CompleteDocumentViewer({
  documentUrl,
  documentId,
  fileName,
  onSave,
  onDownload,
  onLoad,
  className = ''
}: CompleteDocumentViewerProps) {
  const [state, setState] = useState<ViewerState>({
    currentPage: 1,
    numPages: 0,
    pageRotations: {},
    allPagesRotation: 0,
    documentLoading: true,
    documentError: null,
    loadingProgress: 0,
    showThumbnails: false,
    isMobile: false,
    progressiveLoadingComplete: false,
    initialPagesLoaded: false,
    saving: false,
    scale: 1.0
  });

  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [pageInput, setPageInput] = useState('');
  const [showPageInput, setShowPageInput] = useState(false);
  const pageInputRef = useRef<HTMLInputElement>(null);

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setState(prev => ({
        ...prev,
        isMobile: window.innerWidth < 768
      }));
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize PDF document with progressive loading
  useEffect(() => {
    if (!documentUrl) return;

    const loadDocument = async () => {
      try {
        setState(prev => ({
          ...prev,
          documentLoading: true,
          documentError: null,
          loadingProgress: 0
        }));

        console.log('🚀 Loading document with PDF singleton:', documentUrl.substring(0, 50) + '...');
        
        // First, check if we have a cached document
        const cachedDocument = getCachedPdfDocument(documentUrl);
        if (cachedDocument) {
          console.log('📦 Using cached PDF document');
          setPdfDocument(cachedDocument);
                  setState(prev => ({
          ...prev,
          numPages: cachedDocument.numPages,
          documentLoading: false,
          loadingProgress: 100,
          progressiveLoadingComplete: true,
          initialPagesLoaded: true
        }));
        onLoad?.(cachedDocument.numPages);
        return;
        }

        // Use the PDF singleton for loading
        const pdfDoc = await loadPdfDocument(documentUrl);
        setPdfDocument(pdfDoc);
        
        setState(prev => ({
          ...prev,
          numPages: pdfDoc.numPages,
          documentLoading: false,
          loadingProgress: 100,
          progressiveLoadingComplete: true,
          initialPagesLoaded: true
        }));

        onLoad?.(pdfDoc.numPages);
        console.log(`✅ Document loaded with ${pdfDoc.numPages} pages via PDF singleton`);
        
      } catch (error) {
        console.error('❌ Error loading document:', error);
        setState(prev => ({
          ...prev,
          documentError: error instanceof Error ? error.message : 'Error al cargar el documento',
          documentLoading: false
        }));
      }
    };

    loadDocument();
  }, [documentUrl]);

  // Handler functions
  const handlePageChange = useCallback((pageNumber: number) => {
    setState(prev => ({ ...prev, currentPage: Math.max(1, Math.min(pageNumber, prev.numPages)) }));
  }, []);

  const handlePageRotate = useCallback((pageNumber: number, rotation: number) => {
    setState(prev => ({
      ...prev,
      pageRotations: {
        ...prev.pageRotations,
        [pageNumber]: rotation
      }
    }));
  }, []);

  const handleRotateAll = useCallback(() => {
    setState(prev => ({
      ...prev,
      allPagesRotation: prev.allPagesRotation + 90
    }));
  }, []);

  const handleToggleThumbnails = useCallback(() => {
    setState(prev => ({ ...prev, showThumbnails: !prev.showThumbnails }));
  }, []);

  const handleSave = useCallback(async () => {
    if (onSave) {
      setState(prev => ({ ...prev, saving: true }));
      try {
        await onSave(state.pageRotations);
      } finally {
        setState(prev => ({ ...prev, saving: false }));
      }
    }
  }, [onSave, state.pageRotations]);

  const handleGoToPage = useCallback(() => {
    const pageNum = parseInt(pageInput.trim());
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= state.numPages) {
      handlePageChange(pageNum);
      setShowPageInput(false);
      setPageInput('');
    } else {
      // Show visual feedback for invalid input
      if (pageInput.trim() !== '') {
        // Briefly flash the input border red
        const inputElement = pageInputRef.current;
        if (inputElement) {
          inputElement.style.borderColor = '#ef4444';
          inputElement.style.boxShadow = '0 0 0 2px rgba(239, 68, 68, 0.2)';
          setTimeout(() => {
            inputElement.style.borderColor = '';
            inputElement.style.boxShadow = '';
          }, 1000);
        }
        // Don't reset automatically - let user fix their input
      }
    }
  }, [pageInput, state.numPages, state.currentPage, handlePageChange]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleGoToPage();
    } else if (e.key === 'Escape') {
      setShowPageInput(false);
      setPageInput('');
    }
  }, [handleGoToPage]);

  // Auto-focus and select all text when page input opens
  useEffect(() => {
    if (showPageInput) {
      // Only set initial value when first opening, not on every re-render
      if (pageInput === '') {
        setPageInput(state.currentPage.toString());
      }
      // Use setTimeout to ensure the input is rendered
      setTimeout(() => {
        if (pageInputRef.current) {
          pageInputRef.current.focus();
          pageInputRef.current.select();
        }
      }, 0);
    }
  }, [showPageInput]);

  // Navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return;
      
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePageChange(state.currentPage - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handlePageChange(state.currentPage + 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        handlePageChange(1);
      } else if (e.key === 'End') {
        e.preventDefault();
        handlePageChange(state.numPages);
      } else if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        setShowPageInput(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePageChange, state.currentPage, state.numPages]);

  // Loading state
  if (state.documentLoading) {
    return (
      <div className={`flex items-center justify-center h-full bg-gray-50 ${className}`}>
        <div className="text-center space-y-4">
          <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
            <div className="absolute inset-0 flex items-center justify-center">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-900">Cargando documento...</h3>
            <p className="text-sm text-gray-600">
              {state.loadingProgress > 0 ? `${state.loadingProgress}% completado` : 'Preparando visualización'}
            </p>
          </div>
          {state.loadingProgress > 0 && (
            <div className="w-64 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${state.loadingProgress}%` }}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Error state
  if (state.documentError) {
    return (
      <div className={`flex items-center justify-center h-full bg-red-50 ${className}`}>
        <div className="text-center space-y-4 max-w-md">
          <div className="text-red-500 text-6xl">⚠️</div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-red-900">Error al cargar el documento</h3>
            <p className="text-sm text-red-700">{state.documentError}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Main viewer
  return (
    <div className={`flex flex-col h-full bg-white ${className}`}>
      {/* Header Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
        {/* Left: Thumbnails Toggle */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleToggleThumbnails}
            className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium bg-transparent text-gray-700 hover:bg-gray-100 border border-gray-300 transition-all duration-200"
            title={state.showThumbnails ? "Ocultar panel de miniaturas" : "Mostrar panel de miniaturas"}
          >
            {state.showThumbnails ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {state.showThumbnails ? 'Ocultar Panel' : 'Mostrar Panel'}
          </button>
        </div>

                {/* Center: Navigation */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => handlePageChange(state.currentPage - 1)}
            disabled={state.currentPage <= 1}
            className="p-2 rounded-lg bg-transparent border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            title="Página anterior (←)"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="relative">
            {showPageInput ? (
              <div className="flex items-center">
                <input
                  ref={pageInputRef}
                  type="number"
                  min="1"
                  max={state.numPages}
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  onBlur={() => {
                    if (!pageInput) {
                      setShowPageInput(false);
                    }
                  }}
                  className="w-20 px-2 py-1 text-sm text-center border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={`${state.currentPage}`}
                />
                <button
                  onClick={() => {
                    setShowPageInput(false);
                    setPageInput('');
                  }}
                  className="ml-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                >
                  ×
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowPageInput(true)}
                className="px-4 py-2 text-sm bg-transparent border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200"
                title="Ir a página (G)"
              >
                {state.currentPage} de {state.numPages}
              </button>
            )}
          </div>

          <button
            onClick={() => handlePageChange(state.currentPage + 1)}
            disabled={state.currentPage >= state.numPages}
            className="p-2 rounded-lg bg-transparent border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            title="Página siguiente (→)"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-3">
          {/* Page Rotation */}
          <button
            onClick={() => handlePageRotate(state.currentPage, (state.pageRotations[state.currentPage] || 0) + 90)}
            className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium bg-transparent text-gray-700 hover:bg-gray-100 border border-gray-300 transition-all duration-200"
            title="Rotar página actual 90°"
          >
            <RotateCw className="h-4 w-4 mr-2" />
            Rotar Página
          </button>

          {/* Document Rotation */}
          <button
            onClick={handleRotateAll}
            className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium bg-transparent text-gray-700 hover:bg-gray-100 border border-gray-300 transition-all duration-200"
            title="Rotar todas las páginas 90°"
          >
            <RotateCw className="h-4 w-4 mr-2" />
            Rotar Documento
          </button>

          {/* Save Document */}
          {onSave && Object.keys(state.pageRotations).length > 0 && (
            <button
              onClick={handleSave}
              disabled={state.saving}
              className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium bg-transparent text-gray-700 hover:bg-gray-100 border border-gray-300 transition-all duration-200 disabled:opacity-50"
              title="Guardar documento rotado"
            >
              {state.saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar
                </>
              )}
            </button>
          )}

          {/* Download Document */}
          {onDownload && (
            <button
              onClick={onDownload}
              className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium bg-transparent text-gray-700 hover:bg-gray-100 border border-gray-300 transition-all duration-200"
              title="Descargar documento"
            >
              <Download className="h-4 w-4 mr-2" />
              Descargar
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Thumbnails Panel */}
        {state.showThumbnails && !state.isMobile && (
          <div className="w-64 flex-shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col">
            <VirtualizedThumbnailPanel
              documentUrl={documentUrl}
              numPages={state.numPages}
              currentPage={state.currentPage}
              onPageSelect={handlePageChange}
              onPageRotate={handlePageRotate}
              pageRotations={state.pageRotations}
              pdfDocument={pdfDocument}
              className="flex-1"
            />
          </div>
        )}

        {/* Document Viewer */}
        <div className="flex-1 flex flex-col">
          <ProgressiveDocumentViewer
            documentUrl={documentUrl}
            numPages={state.numPages}
            currentPage={state.currentPage}
            onPageChange={handlePageChange}
            onPageRotate={handlePageRotate}
            onRotateAll={handleRotateAll}
            pageRotations={state.pageRotations}
            pdfDocument={pdfDocument}
            className="flex-1"
          />
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-4">
            <span>
              {state.progressiveLoadingComplete ? 
                `✅ Documento cargado (${Math.min(20, state.numPages)} páginas prioritarias)` : 
                `🔄 Cargando primeras páginas...`
              }
            </span>
            {Object.keys(state.pageRotations).length > 0 && (
              <span className="text-orange-600">
                📋 {Object.keys(state.pageRotations).length} página{Object.keys(state.pageRotations).length !== 1 ? 's' : ''} modificada{Object.keys(state.pageRotations).length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <span>Navegación: ←→ | Ir a página: G</span>
          </div>
        </div>
      </div>
    </div>
  );
} 