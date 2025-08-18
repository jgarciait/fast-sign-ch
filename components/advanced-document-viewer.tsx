"use client"

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { 
  FileText, 
  Grid3x3, 
  Loader2, 
  Settings, 
  Download, 
  Save, 
  RotateCw,
  Monitor,
  Smartphone,
  Tablet,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import VirtualThumbnailGrid from './virtual-thumbnail-grid'
import OptimizedDocumentViewer from './optimized-document-viewer'
import pdfCacheManager from '@/utils/pdf-cache-manager'

interface AdvancedDocumentViewerProps {
  documentUrl: string
  documentId?: string
  fileName?: string
  onSave?: (rotatedPages: number[]) => Promise<void>
  onDownload?: () => void
  onRotateAllPages?: () => void
  onRotateCurrentPage?: (pageNumber: number) => void
  className?: string
}

interface ViewerSettings {
  thumbnailSize: 'small' | 'medium' | 'large'
  preloadCount: number
  cacheSize: number
  showThumbnails: boolean
  layout: 'split' | 'viewer-only' | 'thumbnails-only'
  responsive: boolean
}

interface DocumentState {
  currentPage: number
  totalPages: number
  selectedPages: Set<number>
  rotatedPages: Set<number>
  isLoading: boolean
  loadingProgress: number
  error: string | null
  isInitialized: boolean
}

const AdvancedDocumentViewer: React.FC<AdvancedDocumentViewerProps> = ({
  documentUrl,
  documentId,
  fileName,
  onSave,
  onDownload,
  onRotateAllPages,
  onRotateCurrentPage,
  className = ''
}) => {
  const { toast } = useToast()

  const [documentState, setDocumentState] = useState<DocumentState>({
    currentPage: 1,
    totalPages: 0,
    selectedPages: new Set(),
    rotatedPages: new Set(),
    isLoading: true,
    loadingProgress: 0,
    error: null,
    isInitialized: false
  })

  const [viewerSettings, setViewerSettings] = useState<ViewerSettings>({
    thumbnailSize: 'medium',
    preloadCount: 20,
    cacheSize: 50,
    showThumbnails: true,
    layout: 'split',
    responsive: true
  })

  const [screenSize, setScreenSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop')
  const [isSaving, setIsSaving] = useState(false)

  // Initialize document
  useEffect(() => {
    const initializeDocument = async () => {
      if (!documentUrl) return

      try {
        setDocumentState(prev => ({ 
          ...prev, 
          isLoading: true, 
          error: null,
          loadingProgress: 0
        }))

        // Configure cache manager
        pdfCacheManager.configure({
          maxMemoryUsage: 150 * 1024 * 1024, // 150MB for large documents
          maxCacheSize: viewerSettings.cacheSize
        })

        // Load document
        const pdfDocument = await pdfCacheManager.loadDocument(documentUrl)
        
        setDocumentState(prev => ({
          ...prev,
          totalPages: pdfDocument.numPages,
          isLoading: false,
          loadingProgress: 100,
          isInitialized: true
        }))

        toast({
          title: "Document loaded successfully",
          description: `${pdfDocument.numPages} pages ready for viewing`,
          duration: 3000
        })

      } catch (error) {
        console.error('Failed to initialize document:', error)
        setDocumentState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to load document',
          isLoading: false,
          isInitialized: false
        }))

        toast({
          title: "Error loading document",
          description: "Please check the document URL and try again",
          variant: "destructive"
        })
      }
    }

    initializeDocument()
  }, [documentUrl, viewerSettings.cacheSize, toast])

  // Screen size detection
  useEffect(() => {
    const updateScreenSize = () => {
      const width = window.innerWidth
      if (width < 768) {
        setScreenSize('mobile')
      } else if (width < 1024) {
        setScreenSize('tablet')
      } else {
        setScreenSize('desktop')
      }
    }

    updateScreenSize()
    window.addEventListener('resize', updateScreenSize)
    return () => window.removeEventListener('resize', updateScreenSize)
  }, [])

  // Responsive layout adjustment
  useEffect(() => {
    if (viewerSettings.responsive) {
      if (screenSize === 'mobile') {
        setViewerSettings(prev => ({ ...prev, layout: 'viewer-only' }))
      } else if (screenSize === 'tablet') {
        setViewerSettings(prev => ({ ...prev, layout: 'split' }))
      }
    }
  }, [screenSize, viewerSettings.responsive])

  // Handlers
  const handlePageChange = useCallback((page: number) => {
    setDocumentState(prev => ({ ...prev, currentPage: page }))
  }, [])

  const handlePageSelect = useCallback((pageNumber: number) => {
    setDocumentState(prev => {
      const newSelectedPages = new Set(prev.selectedPages)
      if (newSelectedPages.has(pageNumber)) {
        newSelectedPages.delete(pageNumber)
      } else {
        newSelectedPages.add(pageNumber)
      }
      return { ...prev, selectedPages: newSelectedPages }
    })
  }, [])

  const handlePageRotate = useCallback((pageNumber: number) => {
    setDocumentState(prev => ({
      ...prev,
      rotatedPages: new Set(prev.rotatedPages).add(pageNumber)
    }))
    
    if (onRotateCurrentPage) {
      onRotateCurrentPage(pageNumber)
    }
    
    toast({
      title: "Page rotated",
      description: `Page ${pageNumber} has been rotated`,
      duration: 2000
    })
  }, [onRotateCurrentPage, toast])

  const handleRotateAllPages = useCallback(() => {
    const allPages = Array.from({ length: documentState.totalPages }, (_, i) => i + 1)
    setDocumentState(prev => ({
      ...prev,
      rotatedPages: new Set(allPages)
    }))
    
    if (onRotateAllPages) {
      onRotateAllPages()
    }
    
    toast({
      title: "All pages rotated",
      description: `All ${documentState.totalPages} pages have been rotated`,
      duration: 3000
    })
  }, [documentState.totalPages, onRotateAllPages, toast])

  const handleSave = useCallback(async () => {
    if (!onSave) return

    try {
      setIsSaving(true)
      await onSave(Array.from(documentState.rotatedPages))
      
      toast({
        title: "Document saved",
        description: "Your changes have been saved successfully",
        duration: 3000
      })
    } catch (error) {
      toast({
        title: "Error saving document",
        description: error instanceof Error ? error.message : "Failed to save document",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }, [onSave, documentState.rotatedPages, toast])

  const handleRefresh = useCallback(() => {
    pdfCacheManager.clearDocument(documentUrl)
    setDocumentState(prev => ({ ...prev, isInitialized: false }))
    window.location.reload()
  }, [documentUrl])

  // Thumbnail dimensions based on size setting
  const thumbnailDimensions = useMemo(() => {
    switch (viewerSettings.thumbnailSize) {
      case 'small':
        return { width: 100, height: 125 }
      case 'large':
        return { width: 140, height: 175 }
      default:
        return { width: 120, height: 150 }
    }
  }, [viewerSettings.thumbnailSize])

  // Layout configuration
  const layoutConfig = useMemo(() => {
    const { layout } = viewerSettings
    
    if (layout === 'viewer-only') {
      return { showThumbnails: false, thumbnailWidth: '0px', viewerWidth: '100%' }
    }
    
    if (layout === 'thumbnails-only') {
      return { showThumbnails: true, thumbnailWidth: '100%', viewerWidth: '0px' }
    }
    
    // Split layout
    if (screenSize === 'mobile') {
      return { showThumbnails: false, thumbnailWidth: '0px', viewerWidth: '100%' }
    }
    
    return { showThumbnails: true, thumbnailWidth: '320px', viewerWidth: 'calc(100% - 320px)' }
  }, [viewerSettings.layout, screenSize])

  // Performance stats
  const performanceStats = useMemo(() => {
    const stats = pdfCacheManager.getStats()
    return {
      hitRate: stats.hitRate.toFixed(1),
      memoryUsage: Math.round(stats.totalMemoryUsage / 1024 / 1024),
      cachedPages: stats.totalPages,
      totalRequests: stats.totalRequests
    }
  }, [documentState.currentPage]) // Update when page changes

  if (documentState.error) {
    return (
      <div className={`flex items-center justify-center h-full bg-gray-50 ${className}`}>
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error Loading Document</h3>
            <p className="text-gray-600 mb-6">{documentState.error}</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={handleRefresh} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
              {onDownload && (
                <Button onClick={onDownload} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download Original
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (documentState.isLoading) {
    return (
      <div className={`flex items-center justify-center h-full bg-gray-50 ${className}`}>
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-12 w-12 text-blue-500 mx-auto mb-4 animate-spin" />
            <h3 className="text-lg font-semibold mb-2">Loading Document</h3>
            <p className="text-gray-600 mb-4">
              {fileName ? `Loading ${fileName}...` : 'Preparing document for viewing...'}
            </p>
            <Progress value={documentState.loadingProgress} className="h-2" />
            <div className="mt-4 text-sm text-gray-500">
              This may take a moment for large documents
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-full bg-white ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-blue-600" />
          <div>
            <h1 className="text-lg font-semibold">
              {fileName || 'Document Viewer'}
            </h1>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>{documentState.totalPages} pages</span>
              <Separator orientation="vertical" className="h-4" />
              <span>{documentState.selectedPages.size} selected</span>
              <Separator orientation="vertical" className="h-4" />
              <span>{documentState.rotatedPages.size} rotated</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Screen size indicator */}
          <div className="flex items-center gap-1 text-sm text-gray-500">
            {screenSize === 'mobile' && <Smartphone className="h-4 w-4" />}
            {screenSize === 'tablet' && <Tablet className="h-4 w-4" />}
            {screenSize === 'desktop' && <Monitor className="h-4 w-4" />}
          </div>

          {/* Performance badge */}
          <Badge variant="secondary" className="text-xs">
            {performanceStats.hitRate}% cache hit
          </Badge>

          {/* Settings */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Viewer Settings</SheetTitle>
              </SheetHeader>
              <div className="space-y-6 mt-6">
                {/* Layout Settings */}
                <div>
                  <h3 className="font-medium mb-3">Layout</h3>
                  <div className="space-y-2">
                    {['split', 'viewer-only', 'thumbnails-only'].map((layout) => (
                      <label key={layout} className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={viewerSettings.layout === layout}
                          onChange={() => setViewerSettings(prev => ({ ...prev, layout: layout as any }))}
                        />
                        <span className="capitalize">{layout.replace('-', ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Thumbnail Size */}
                <div>
                  <h3 className="font-medium mb-3">Thumbnail Size</h3>
                  <div className="space-y-2">
                    {['small', 'medium', 'large'].map((size) => (
                      <label key={size} className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={viewerSettings.thumbnailSize === size}
                          onChange={() => setViewerSettings(prev => ({ ...prev, thumbnailSize: size as any }))}
                        />
                        <span className="capitalize">{size}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Performance Settings */}
                <div>
                  <h3 className="font-medium mb-3">Performance</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium">Preload Count: {viewerSettings.preloadCount}</label>
                      <input
                        type="range"
                        min="5"
                        max="50"
                        value={viewerSettings.preloadCount}
                        onChange={(e) => setViewerSettings(prev => ({ ...prev, preloadCount: parseInt(e.target.value) }))}
                        className="w-full mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Cache Size: {viewerSettings.cacheSize}</label>
                      <input
                        type="range"
                        min="20"
                        max="100"
                        value={viewerSettings.cacheSize}
                        onChange={(e) => setViewerSettings(prev => ({ ...prev, cacheSize: parseInt(e.target.value) }))}
                        className="w-full mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Statistics */}
                <div>
                  <h3 className="font-medium mb-3">Performance Stats</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Cache Hit Rate:</span>
                      <span>{performanceStats.hitRate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Memory Usage:</span>
                      <span>{performanceStats.memoryUsage}MB</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cached Pages:</span>
                      <span>{performanceStats.cachedPages}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Requests:</span>
                      <span>{performanceStats.totalRequests}</span>
                    </div>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleRotateAllPages}
              variant="outline"
              size="sm"
              disabled={documentState.totalPages === 0}
            >
              <RotateCw className="h-4 w-4 mr-2" />
              Rotate All
            </Button>

            {onSave && (
              <Button
                onClick={handleSave}
                disabled={isSaving || documentState.rotatedPages.size === 0}
                size="sm"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            )}

            {onDownload && (
              <Button onClick={onDownload} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Thumbnail Panel */}
        {layoutConfig.showThumbnails && (
          <div 
            className="border-r bg-gray-50"
            style={{ width: layoutConfig.thumbnailWidth }}
          >
            <VirtualThumbnailGrid
              documentUrl={documentUrl}
              totalPages={documentState.totalPages}
              selectedPages={documentState.selectedPages}
              onPageSelect={handlePageSelect}
              onPageRotate={handlePageRotate}
              thumbnailWidth={thumbnailDimensions.width}
              thumbnailHeight={thumbnailDimensions.height}
              preloadCount={viewerSettings.preloadCount}
            />
          </div>
        )}

        {/* Main Viewer */}
        <div 
          className="flex-1"
          style={{ width: layoutConfig.viewerWidth }}
        >
          <OptimizedDocumentViewer
            documentUrl={documentUrl}
            currentPage={documentState.currentPage}
            totalPages={documentState.totalPages}
            onPageChange={handlePageChange}
            onRotateAllPages={handleRotateAllPages}
            onRotateCurrentPage={() => handlePageRotate(documentState.currentPage)}
            preloadCount={viewerSettings.preloadCount}
          />
        </div>
      </div>
    </div>
  )
}

export default AdvancedDocumentViewer 