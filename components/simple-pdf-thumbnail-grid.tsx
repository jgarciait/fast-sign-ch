"use client"

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { AnimatedSpinner } from '@/components/ui/animated-spinner'

interface SimplePdfThumbnailGridProps {
  documentUrl: string
  pageCount: number
  currentPage: number
  onPageSelect: (page: number) => void
  pageRotations?: { [pageNumber: number]: number }
}

interface ThumbnailData {
  [pageNumber: number]: {
    imageUrl: string | null
    loading: boolean
    error: boolean
  }
}

export default function SimplePdfThumbnailGrid({
  documentUrl,
  pageCount,
  currentPage,
  onPageSelect,
  pageRotations = {}
}: SimplePdfThumbnailGridProps) {
  const [thumbnails, setThumbnails] = useState<ThumbnailData>({})
  const [pdfDocument, setPdfDocument] = useState<any>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const thumbnailRefs = useRef<{ [key: number]: HTMLDivElement | null }>({})

  // Get the already loaded PDF document
  useEffect(() => {
    // Wait a bit to ensure the main document is loaded
    const timer = setTimeout(() => {
      if (typeof window !== 'undefined' && (window as any).__currentPdfDocument) {
        setPdfDocument((window as any).__currentPdfDocument)
      } else {
        // If not available, load it using react-pdf
        import('react-pdf').then(async ({ pdfjs }) => {
          if (!pdfjs.GlobalWorkerOptions.workerSrc) {
            pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
          }
          
          try {
            const pdf = await pdfjs.getDocument(documentUrl).promise
            setPdfDocument(pdf)
          } catch (error) {
            console.error('Error loading PDF for thumbnails:', error)
          }
        })
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [documentUrl])

  // Render thumbnail
  const renderThumbnail = async (pageNumber: number) => {
    if (!pdfDocument || thumbnails[pageNumber]?.imageUrl) return

    setThumbnails(prev => ({
      ...prev,
      [pageNumber]: { imageUrl: null, loading: true, error: false }
    }))

    try {
      const page = await pdfDocument.getPage(pageNumber)
      const scale = 0.3
      const rotation = pageRotations[pageNumber] || 0
      const viewport = page.getViewport({ scale, rotation })

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      
      if (!context) throw new Error('Canvas context not available')

      canvas.height = viewport.height
      canvas.width = viewport.width

      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise

      const imageUrl = canvas.toDataURL()

      setThumbnails(prev => ({
        ...prev,
        [pageNumber]: { imageUrl, loading: false, error: false }
      }))
    } catch (error) {
      console.error(`Error rendering thumbnail for page ${pageNumber}:`, error)
      setThumbnails(prev => ({
        ...prev,
        [pageNumber]: { imageUrl: null, loading: false, error: true }
      }))
    }
  }

  // Setup intersection observer
  useEffect(() => {
    if (!pdfDocument) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const pageNumber = parseInt(entry.target.getAttribute('data-page') || '0')
            if (pageNumber > 0 && !thumbnails[pageNumber]?.imageUrl && !thumbnails[pageNumber]?.loading) {
              renderThumbnail(pageNumber)
            }
          }
        })
      },
      { rootMargin: '100px' }
    )

    observerRef.current = observer

    // Observe all thumbnail containers
    Object.entries(thumbnailRefs.current).forEach(([_, element]) => {
      if (element) {
        observer.observe(element)
      }
    })

    return () => {
      observer.disconnect()
    }
  }, [pdfDocument, thumbnails])

  const pageNumbers = useMemo(() => 
    Array.from({ length: pageCount }, (_, i) => i + 1),
    [pageCount]
  )

  return (
    <div className="space-y-3">
      {pageNumbers.map(pageNumber => {
        const isSelected = currentPage === pageNumber
        const thumbnail = thumbnails[pageNumber]
        
        return (
          <div
            key={pageNumber}
            ref={(el) => { thumbnailRefs.current[pageNumber] = el }}
            data-page={pageNumber}
            onClick={() => onPageSelect(pageNumber)}
            className={`
              relative cursor-pointer rounded-lg overflow-hidden transition-all group
              ${isSelected 
                ? 'ring-2 ring-blue-500 shadow-lg' 
                : 'hover:ring-2 hover:ring-gray-300 shadow-sm'
              }
            `}
          >
            <div className="relative bg-white aspect-[8.5/11] flex items-center justify-center">
              {thumbnail?.imageUrl ? (
                <img 
                  src={thumbnail.imageUrl} 
                  alt={`Página ${pageNumber}`}
                  className="w-full h-full object-contain"
                />
              ) : thumbnail?.error ? (
                <div className="text-center p-2">
                  <p className="text-xs text-red-500">Error</p>
                </div>
              ) : (
                <AnimatedSpinner size={30} />
              )}
              
              {/* Page number overlay - only visible on hover */}
              <div className={`
                absolute bottom-0 left-0 right-0 px-2 py-1 transition-opacity duration-200
                ${isSelected 
                  ? 'bg-blue-500 text-white opacity-100' 
                  : 'bg-gray-800/80 text-white opacity-0 group-hover:opacity-100'
                }
              `}>
                <p className="text-xs text-center font-medium">
                  Página {pageNumber}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
} 