"use client"

import React, { useContext, useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import ReactPdfThumbnail, { PdfDocumentContext } from '@/components/react-pdf-thumbnail'

interface PageData {
  id: string
  pageNumber: number
  displayPosition: number
  documentIndex: number
}

interface PdfThumbnailGridProps {
  documentUrl: string
  pages: PageData[]
  hasMultipleDocuments: boolean
  currentPage: number
  onPageSelect: (page: number) => void
}

const PdfThumbnailGrid = React.memo<PdfThumbnailGridProps>(({
  documentUrl,
  pages,
  hasMultipleDocuments,
  currentPage,
  onPageSelect
}) => {
  // Access the PDF context to check loading state
  const { isLoading, totalPages } = useContext(PdfDocumentContext)

  // Memoize the rendered thumbnails to prevent unnecessary re-renders
  const thumbnails = useMemo(() => {
    return pages.map((page, index) => (
      <div key={`${page.id}-${page.pageNumber}-${page.displayPosition}`} className="relative flex justify-center">
        {hasMultipleDocuments && (
          <div 
            className={`absolute -top-1 -left-1 w-4 h-4 rounded-full z-20 ${
              page.documentIndex === 0 ? 'bg-blue-500' : 'bg-green-500'
            }`}
            title={`Documento ${page.documentIndex + 1}`}
          />
        )}
        <ReactPdfThumbnail
          pageId={page.id}
          documentUrl={documentUrl}
          pageNumber={page.pageNumber}
          displayPosition={page.displayPosition}
          isSelected={currentPage === page.displayPosition}
          onSelect={() => onPageSelect(page.displayPosition)}
        />
      </div>
    ))
  }, [pages, documentUrl, hasMultipleDocuments, currentPage, onPageSelect])

  // Show loading only while PDF document is loading (not thumbnails)
  if (isLoading && pages.length > 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-4">
        <div className="relative">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
        <div className="text-center">
          <div className="text-sm font-medium text-gray-700">Cargando documento...</div>
          {totalPages > 0 && (
            <div className="text-xs text-gray-500 mt-1">
              {totalPages} páginas detectadas
            </div>
          )}
        </div>
      </div>
    )
  }

  // Show empty state if no pages
  if (pages.length === 0) {
    return (
      <div className="text-center text-gray-500 mt-8">
        Cargando páginas...
      </div>
    )
  }

  // Show the thumbnails grid with lazy loading
  return (
    <div className="space-y-4">
      {/* Info banner for large documents */}
      {pages.length > 50 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
          <strong>Documento grande:</strong> Las miniaturas se cargan automáticamente cuando aparecen en pantalla para optimizar el rendimiento.
        </div>
      )}
      
      {/* Virtual scrolling grid */}
      <div className="grid grid-cols-1 gap-4 justify-items-center max-h-[70vh] overflow-y-auto">
        {thumbnails}
      </div>
      
      {/* Footer info */}
      <div className="text-center text-xs text-gray-500 mt-4">
        Mostrando {pages.length} páginas • Miniaturas cargadas bajo demanda
      </div>
    </div>
  )
},
// Memoization comparison function
(prevProps, nextProps) => {
  return (
    prevProps.documentUrl === nextProps.documentUrl &&
    prevProps.pages.length === nextProps.pages.length &&
    prevProps.currentPage === nextProps.currentPage &&
    prevProps.hasMultipleDocuments === nextProps.hasMultipleDocuments &&
    JSON.stringify(prevProps.pages) === JSON.stringify(nextProps.pages)
  )
})

PdfThumbnailGrid.displayName = 'PdfThumbnailGrid'

export default PdfThumbnailGrid 