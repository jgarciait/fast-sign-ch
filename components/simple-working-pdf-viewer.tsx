"use client";

import React, { useState, useEffect, useRef } from 'react';
import { loadPdfDocument } from '@/utils/pdf-working';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RotateCw, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';

interface SimpleWorkingPdfViewerProps {
  documentUrl: string;
  onRotate?: (pageNumber: number, rotation: number) => void;
  onRotateAll?: (rotation: number) => void;
}

interface PageInfo {
  pageNumber: number;
  rotation: number;
}

export default function SimpleWorkingPdfViewer({ 
  documentUrl, 
  onRotate, 
  onRotateAll 
}: SimpleWorkingPdfViewerProps) {
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageRotations, setPageRotations] = useState<Record<number, number>>({});
  const [allRotation, setAllRotation] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Load PDF document
  useEffect(() => {
    async function loadPdf() {
      try {
        setLoading(true);
        setError(null);
        
        const doc = await loadPdfDocument(documentUrl);
        setPdfDocument(doc);
        setNumPages(doc.numPages);
        
        console.log(`PDF loaded: ${doc.numPages} pages`);
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError(err instanceof Error ? err.message : 'Failed to load PDF');
      } finally {
        setLoading(false);
      }
    }
    
    if (documentUrl) {
      loadPdf();
    }
  }, [documentUrl]);
  
  // Render current page
  useEffect(() => {
    async function renderPage() {
      if (!pdfDocument || !canvasRef.current) return;
      
      try {
                 const page = await pdfDocument.getPage(currentPage);
         const canvas = canvasRef.current;
         const context = canvas.getContext('2d');
         
         if (!context) {
           throw new Error('Failed to get 2D context');
         }
         
         // Calculate viewport with rotation
         const pageRotation = pageRotations[currentPage] || 0;
         const totalRotation = (pageRotation + allRotation) % 360;
        
        const viewport = page.getViewport({ 
          scale: scale,
          rotation: totalRotation
        });
        
        // Set canvas size
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        // Clear canvas
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Render page
        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };
        
        await page.render(renderContext).promise;
      } catch (err) {
        console.error('Error rendering page:', err);
        setError('Failed to render page');
      }
    }
    
    renderPage();
  }, [pdfDocument, currentPage, scale, pageRotations, allRotation]);
  
  const handleRotatePage = () => {
    const newRotation = ((pageRotations[currentPage] || 0) + 90) % 360;
    setPageRotations(prev => ({ ...prev, [currentPage]: newRotation }));
    onRotate?.(currentPage, newRotation);
  };
  
  const handleRotateAll = () => {
    const newRotation = (allRotation + 90) % 360;
    setAllRotation(newRotation);
    onRotateAll?.(newRotation);
  };
  
  const nextPage = () => {
    if (currentPage < numPages) {
      setCurrentPage(currentPage + 1);
    }
  };
  
  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };
  
  const zoomIn = () => {
    setScale(prev => Math.min(prev + 0.2, 3.0));
  };
  
  const zoomOut = () => {
    setScale(prev => Math.max(prev - 0.2, 0.5));
  };
  
  if (loading) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Loading PDF...</span>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="p-8">
          <div className="text-center text-red-600">
            <p className="text-lg font-semibold">Error loading PDF</p>
            <p className="text-sm mt-2">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>PDF Viewer</span>
          <span className="text-sm font-normal">
            Page {currentPage} of {numPages}
          </span>
        </CardTitle>
        
        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={prevPage} disabled={currentPage <= 1} size="sm">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <Button onClick={nextPage} disabled={currentPage >= numPages} size="sm">
            <ChevronRight className="h-4 w-4" />
          </Button>
          
          <div className="w-px h-6 bg-gray-300 mx-2" />
          
          <Button onClick={zoomOut} disabled={scale <= 0.5} size="sm">
            <ZoomOut className="h-4 w-4" />
          </Button>
          
          <span className="text-sm font-mono">
            {Math.round(scale * 100)}%
          </span>
          
          <Button onClick={zoomIn} disabled={scale >= 3.0} size="sm">
            <ZoomIn className="h-4 w-4" />
          </Button>
          
          <div className="w-px h-6 bg-gray-300 mx-2" />
          
          <Button onClick={handleRotatePage} size="sm">
            <RotateCw className="h-4 w-4" />
            <span className="ml-1">Rotate Page</span>
          </Button>
          
          <Button onClick={handleRotateAll} size="sm" variant="outline">
            <RotateCw className="h-4 w-4" />
            <span className="ml-1">Rotate All</span>
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="border rounded-lg p-4 bg-gray-50 overflow-auto max-h-[600px]">
          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              className="border shadow-lg bg-white"
              style={{
                maxWidth: '100%',
                height: 'auto'
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 