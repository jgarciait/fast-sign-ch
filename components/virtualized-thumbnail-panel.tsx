"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';

interface ThumbnailData {
  pageNumber: number;
  canvas: HTMLCanvasElement | null;
  dataUrl: string | null;
  loading: boolean;
  error: boolean;
  rotation: number;
}

interface VirtualizedThumbnailPanelProps {
  documentUrl: string;
  numPages: number;
  currentPage: number;
  onPageSelect: (pageNumber: number) => void;
  onPageRotate: (pageNumber: number, rotation: number) => void;
  pageRotations: Record<number, number>;
  className?: string;
  pdfDocument?: any; // Accept shared PDF document
}

interface ThumbnailItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    thumbnails: ThumbnailData[];
    currentPage: number;
    onPageSelect: (pageNumber: number) => void;
    onPageRotate: (pageNumber: number, rotation: number) => void;
    onThumbnailVisible: (pageNumber: number) => void;
  };
}

const THUMBNAIL_SIZE = 150;
const THUMBNAIL_PADDING = 8;
const ITEM_HEIGHT = THUMBNAIL_SIZE + THUMBNAIL_PADDING * 2;
const PRERENDER_BUFFER = 10; // Reduced buffer for better performance

const ThumbnailItem: React.FC<ThumbnailItemProps> = ({ index, style, data }) => {
  const { thumbnails, currentPage, onPageSelect, onPageRotate, onThumbnailVisible } = data;
  const thumbnail = thumbnails[index];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);

  const pageNumber = index + 1;
  const isCurrent = pageNumber === currentPage;

  // Handle visibility for lazy loading
  useEffect(() => {
    if (!itemRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            onThumbnailVisible(pageNumber);
          }
        });
      },
      {
        root: null,
        rootMargin: '100px',
        threshold: 0.1,
      }
    );

    observerRef.current.observe(itemRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [pageNumber, onThumbnailVisible]);

  // Render thumbnail to canvas
  useEffect(() => {
    if (thumbnail?.canvas && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (ctx && thumbnail.canvas) {
        canvas.width = thumbnail.canvas.width;
        canvas.height = thumbnail.canvas.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(thumbnail.canvas, 0, 0);
      }
    }
  }, [thumbnail]);

  const handleClick = () => {
    onPageSelect(pageNumber);
  };

  const handleRotate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newRotation = (thumbnail?.rotation || 0) + 90;
    onPageRotate(pageNumber, newRotation);
  };

  return (
    <div
      ref={itemRef}
      style={style}
      className={`thumbnail-item ${isCurrent ? 'current' : ''}`}
      onClick={handleClick}
    >
      <div className="thumbnail-container">
        <div className="thumbnail-content">
          {thumbnail?.loading && (
            <div className="thumbnail-loading">
              <div className="spinner"></div>
              <span>Cargando...</span>
            </div>
          )}
          
          {thumbnail?.error && (
            <div className="thumbnail-error">
              <span>Error página {pageNumber}</span>
            </div>
          )}
          
          {thumbnail?.canvas && (
            <canvas
              ref={canvasRef}
              className="thumbnail-canvas"
              onClick={() => onPageSelect(pageNumber)}
            />
          )}
        </div>
        
        <div className="thumbnail-controls">
          <span className="page-number">
            {pageNumber}
          </span>
        </div>
      </div>
      
      <style jsx>{`
        .thumbnail-item {
          padding: ${THUMBNAIL_PADDING}px;
          display: flex;
          justify-content: center;
          align-items: center;
          margin-bottom: 8px;
        }
        
        .thumbnail-item.current {
          background-color: rgba(59, 130, 246, 0.1);
          border-radius: 12px;
        }
        
        .thumbnail-container {
          position: relative;
          width: ${THUMBNAIL_SIZE}px;
          height: ${THUMBNAIL_SIZE}px;
          border: 2px solid transparent;
          border-radius: 12px;
          overflow: hidden;
          background: white;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .thumbnail-item.current .thumbnail-container {
          border-color: #3b82f6;
          box-shadow: 0 4px 20px rgba(59, 130, 246, 0.3);
          transform: scale(1.02);
        }
        
        .thumbnail-container:hover {
          border-color: #6b7280;
          transform: scale(1.05);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        }
        
        .thumbnail-content {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        
        .thumbnail-canvas {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          border-radius: 8px;
        }
        
        .thumbnail-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          color: #6b7280;
        }
        
        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid #e5e7eb;
          border-top: 2px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .thumbnail-error {
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          font-size: 10px;
          color: #dc2626;
          padding: 4px;
          background: #fef2f2;
          border-radius: 8px;
          border: 1px solid #fecaca;
        }
        
        .thumbnail-controls {
          position: absolute;
          bottom: 6px;
          right: 6px;
          display: flex;
          align-items: center;
          gap: 4px;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(4px);
          border-radius: 8px;
          padding: 4px 6px;
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        
        .thumbnail-container:hover .thumbnail-controls {
          opacity: 1;
        }
        
        .thumbnail-item.current .thumbnail-controls {
          opacity: 1;
          background: rgba(59, 130, 246, 0.9);
        }
        
        .rotate-button {
          background: transparent;
          border: none;
          color: white;
          font-size: 12px;
          cursor: pointer;
          padding: 2px;
          line-height: 1;
          border-radius: 4px;
          transition: all 0.2s ease;
        }
        
        .rotate-button:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: rotate(90deg);
        }
        
        .page-number {
          font-size: 10px;
          color: white;
          font-weight: 600;
          min-width: 20px;
          text-align: center;
        }
      `}</style>
    </div>
  );
};

export default function VirtualizedThumbnailPanel({
  documentUrl,
  numPages,
  currentPage,
  onPageSelect,
  onPageRotate,
  pageRotations,
  className = '',
  pdfDocument // Use shared PDF document
}: VirtualizedThumbnailPanelProps) {
  const [thumbnails, setThumbnails] = useState<ThumbnailData[]>([]);
  const [renderQueue, setRenderQueue] = useState<Set<number>>(new Set());
  const [containerHeight, setContainerHeight] = useState(400); // Default height
  const listRef = useRef<List>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize thumbnails array
  useEffect(() => {
    const initialThumbnails = Array.from({ length: numPages }, (_, index) => ({
      pageNumber: index + 1,
      canvas: null,
      dataUrl: null,
      loading: false,
      error: false,
      rotation: pageRotations[index + 1] || 0
    }));
    setThumbnails(initialThumbnails);
  }, [numPages, pageRotations]);

  // Update container height when component mounts or resizes
  useEffect(() => {
    const listContainer = containerRef.current?.querySelector('.flex-1');
    if (!listContainer) return;

    const updateHeight = () => {
      const rect = listContainer.getBoundingClientRect();
      setContainerHeight(rect.height);
    };

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(listContainer);
    updateHeight(); // Initial calculation

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Scroll to current page
  useEffect(() => {
    if (listRef.current && currentPage > 0) {
      listRef.current.scrollToItem(currentPage - 1, 'center');
    }
  }, [currentPage]);

  // Render thumbnail for a specific page
  const renderThumbnail = useCallback(async (pageNumber: number) => {
    if (!pdfDocument || renderQueue.has(pageNumber)) return;

    // Check if thumbnail is already rendered and up to date
    const existingThumbnail = thumbnails[pageNumber - 1];
    if (existingThumbnail?.canvas && !existingThumbnail.loading && !existingThumbnail.error) {
      const expectedRotation = pageRotations[pageNumber] || 0;
      if (existingThumbnail.rotation === expectedRotation) {
        return; // Already rendered with correct rotation
      }
    }

    setRenderQueue(prev => new Set(prev).add(pageNumber));

    try {
      // Update loading state
      setThumbnails(prev => prev.map(thumb => 
        thumb.pageNumber === pageNumber 
          ? { ...thumb, loading: true, error: false }
          : thumb
      ));

      const page = await pdfDocument.getPage(pageNumber);
      const pageRotation = pageRotations[pageNumber] || 0;
      const viewport = page.getViewport({ 
        scale: 0.3, // Small scale for thumbnails
        rotation: pageRotation 
      });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Could not get canvas context');
      }

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      // Convert to data URL for better performance
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6);

      // Update thumbnail data
      setThumbnails(prev => prev.map(thumb => 
        thumb.pageNumber === pageNumber 
          ? { 
              ...thumb, 
              canvas, 
              dataUrl,
              loading: false,
              error: false,
              rotation: pageRotation
            }
          : thumb
      ));

      console.log(`📄 Thumbnail ${pageNumber} rendered successfully`);
      
    } catch (error) {
      console.error(`❌ Error rendering thumbnail ${pageNumber}:`, error);
      setThumbnails(prev => prev.map(thumb => 
        thumb.pageNumber === pageNumber 
          ? { ...thumb, loading: false, error: true }
          : thumb
      ));
    } finally {
      setRenderQueue(prev => {
        const newSet = new Set(prev);
        newSet.delete(pageNumber);
        return newSet;
      });
    }
  }, [pdfDocument, pageRotations, thumbnails, renderQueue]);

  // Handle thumbnail visibility (lazy loading)
  const handleThumbnailVisible = useCallback((pageNumber: number) => {
    if (!pdfDocument) return;
    
    // Render the visible thumbnail
    renderThumbnail(pageNumber);
    
    // Preload nearby thumbnails
    const preloadRange = Math.min(PRERENDER_BUFFER, numPages);
    for (let i = 1; i <= preloadRange; i++) {
      if (pageNumber - i >= 1) {
        setTimeout(() => renderThumbnail(pageNumber - i), i * 50);
      }
      if (pageNumber + i <= numPages) {
        setTimeout(() => renderThumbnail(pageNumber + i), i * 50);
      }
    }
  }, [pdfDocument, renderThumbnail, numPages]);

  // Preload current page and nearby thumbnails
  useEffect(() => {
    if (!pdfDocument) return;

    const preloadAroundCurrent = async () => {
      // Render current page thumbnail first
      await renderThumbnail(currentPage);
      
      // Then render nearby thumbnails
      const buffer = Math.min(PRERENDER_BUFFER, numPages);
      for (let i = 1; i <= buffer; i++) {
        if (currentPage - i >= 1) {
          setTimeout(() => renderThumbnail(currentPage - i), i * 100);
        }
        if (currentPage + i <= numPages) {
          setTimeout(() => renderThumbnail(currentPage + i), i * 100);
        }
      }
    };

    preloadAroundCurrent();
  }, [pdfDocument, currentPage, renderThumbnail, numPages]);

  // Memoize item data to prevent unnecessary re-renders
  const itemData = useMemo(() => ({
    thumbnails,
    currentPage,
    onPageSelect,
    onPageRotate,
    onThumbnailVisible: handleThumbnailVisible
  }), [thumbnails, currentPage, onPageSelect, onPageRotate, handleThumbnailVisible]);

  if (!pdfDocument) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <div className="text-sm text-gray-600">Cargando miniaturas...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`} ref={containerRef}>
      {/* Thumbnail List */}
      <div className="flex-1 overflow-hidden">
        <List
          ref={listRef}
          height={containerHeight} // Use full available height
          width={THUMBNAIL_SIZE + THUMBNAIL_PADDING * 2}
          itemCount={numPages}
          itemSize={ITEM_HEIGHT}
          itemData={itemData}
          overscanCount={5} // Render 5 items outside visible area
        >
          {ThumbnailItem}
        </List>
      </div>

      {/* Status */}
      <div className="p-3 border-t border-gray-200 bg-white">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            Renderizadas: {thumbnails.filter(t => t.canvas).length}/{numPages}
          </span>
          <span className="text-blue-600">
            {thumbnails.filter(t => t.loading).length > 0 && '⏳ Cargando...'}
          </span>
        </div>
      </div>
    </div>
  );
} 