"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { 
  Copy,
  Download,
  Edit2,
  ExternalLink,
  Eye,
  FileWarning,
  FileText, 
  Save, 
  X,
  Loader2,
  ArrowLeft,
  RefreshCw,
  RefreshCcw,
  CheckCircle,
  Menu,
  Grid3x3,
  FileCheck,
  PenTool,
  Move,
  ChevronUp,
  ChevronDown,
  Info,
  Upload,
  Send,
  Undo2,
  RotateCw
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { 
  uploadAndPreviewDocument, 
  rotateDocumentPages, 
  cleanupTempDocument,
  saveRotatedDocumentAsRegular,
  saveRotatedDocumentForSigning,
  reorderDocumentPages,
  testSimpleRotation,
  type PageRotationData,
  type PageInfo
} from "@/app/actions/document-rotation-actions"
import CompleteDocumentViewer from "@/components/complete-document-viewer"
import SimplePdfPreview from "@/components/simple-pdf-preview"
import { useIsMobile } from "@/hooks/use-mobile"
import * as PdfSingleton from "@/utils/pdf-singleton"
import { arrayBufferToBase64, getFileSizeMB } from "@/utils/file-utils"

export default function RotateDocumentsPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [documentUrl, setDocumentUrl] = useState<string | null>(null)
  const [pageCount, setPageCount] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageRotations, setPageRotations] = useState<{ [pageNumber: number]: number }>({})
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set())
  const [tempId, setTempId] = useState<string | null>(null)
  const [fileData, setFileData] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [rotatedDocumentUrl, setRotatedDocumentUrl] = useState<string | null>(null)
  const [rotatedDocumentPath, setRotatedDocumentPath] = useState<string | null>(null)
  const [showUploadCard, setShowUploadCard] = useState(false)
  const [showDocumentModal, setShowDocumentModal] = useState(false)
  const [showRangeModal, setShowRangeModal] = useState(false)
  const [isDocumentReady, setIsDocumentReady] = useState(false)
  const [rangeStart, setRangeStart] = useState<number>(1)
  const [rangeEnd, setRangeEnd] = useState<number>(1)
  const [rangeRotation, setRangeRotation] = useState<number>(90)
  const [isPreparingDocument, setIsPreparingDocument] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [currentPageRotation, setCurrentPageRotation] = useState<number>(0)
  const [isSaving, setIsSaving] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  
  // Active document URL used for the viewer (original, rotated, or reordered)
  const activeDocumentUrl = documentUrl || ''
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const isMobile = useIsMobile()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Get URL parameters
  const urlDocumentUrl = searchParams.get('documentUrl')
  const urlDocumentId = searchParams.get('documentId')
  const urlFileName = searchParams.get('fileName')
  const urlMode = searchParams.get('mode')

  // Initialize from URL parameters
  useEffect(() => {
    if (urlDocumentUrl) {
      setDocumentUrl(decodeURIComponent(urlDocumentUrl))
    setShowUploadCard(false)
      
      // Download the PDF to get fileData for rotation operations
      const downloadPdfForRotation = async () => {
        setIsPreparingDocument(true)
        try {
          const response = await fetch(decodeURIComponent(urlDocumentUrl))
          if (!response.ok) throw new Error('Failed to download PDF')
          
          const arrayBuffer = await response.arrayBuffer()
          
          // Check file size to avoid memory issues
          const fileSizeInMB = getFileSizeMB(arrayBuffer)
          console.log(`PDF size: ${fileSizeInMB.toFixed(2)} MB`)
          
          if (fileSizeInMB > 50) {
            toast({
              title: "Documento muy grande",
              description: `El archivo (${fileSizeInMB.toFixed(1)} MB) es demasiado grande para rotación. Máximo recomendado: 50 MB`,
              variant: "destructive",
            })
            return
          }
          
          if (fileSizeInMB > 20) {
            toast({
              title: "Documento grande detectado",
              description: `Procesando archivo de ${fileSizeInMB.toFixed(1)} MB. Esto puede tomar un momento...`,
            })
          }
          
          // Convert to base64 using the safe utility function
          let base64Data: string
          try {
            base64Data = arrayBufferToBase64(arrayBuffer, 50)
          } catch (conversionError) {
            console.error('Error converting to base64:', conversionError)
            toast({
              title: "Error de memoria",
              description: conversionError instanceof Error ? conversionError.message : "El documento es demasiado grande para procesar.",
              variant: "destructive",
            })
            return
          }
          
          const tempId = `url-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          
          setFileData(base64Data)
          setTempId(tempId)
        } catch (error) {
          console.error('Error downloading PDF for rotation:', error)
          toast({
            title: "Error al preparar documento",
            description: "No se pudo preparar el documento para rotación",
            variant: "destructive",
          })
        } finally {
          setIsPreparingDocument(false)
        }
      }
      
      downloadPdfForRotation()
    } else {
      setShowUploadCard(true)
    }
  }, [urlDocumentUrl, toast])

  // Update range defaults when page count changes
  useEffect(() => {
    if (pageCount > 0) {
      setRangeEnd(pageCount)
      console.log('Page count updated:', pageCount)
    }
  }, [pageCount])

  // Function to get current page rotation
  const getCurrentPageRotation = async (pageNumber: number): Promise<number> => {
    try {
      if (!activeDocumentUrl) return 0
      
      // Get cached document or load it
      let pdfDoc = PdfSingleton.getCachedPdfDocument(activeDocumentUrl)
      if (!pdfDoc) {
        pdfDoc = await PdfSingleton.loadPdfDocument(activeDocumentUrl)
      }
      
      const page = await pdfDoc.getPage(pageNumber)
      // PDF.js pages have a rotate property that contains the rotation angle
      const rotation = page.rotate || 0
      return rotation
    } catch (error) {
      console.error('Error getting page rotation:', error)
      return 0
    }
  }

  // Update current page rotation when range start changes
  useEffect(() => {
    if (rangeStart > 0 && pageCount > 0) {
      getCurrentPageRotation(rangeStart).then(rotation => {
        setCurrentPageRotation(rotation)
        console.log(`Current rotation for page ${rangeStart}: ${rotation}°`)
      })
    }
  }, [rangeStart, pageCount, activeDocumentUrl])
      
  // File upload handler
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    try {
      // Create FormData as expected by uploadAndPreviewDocument
      const formData = new FormData()
      formData.append('file', selectedFile)
      
      const result = await uploadAndPreviewDocument(formData)
      
      if (result.success && result.documentUrl) {
        setDocumentUrl(result.documentUrl)
        setTempId(result.tempId || null)
        setFileData(result.fileData || null)
        setShowUploadCard(false)
        
        toast({
          title: "Document uploaded successfully",
          description: "You can now rotate and preview the document",
        })
      } else {
        throw new Error(result.error || 'Failed to upload document')
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload document",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  // Page rotation handlers
  const handleRotateAllPages = useCallback(async () => {
    if (!activeDocumentUrl || !tempId || !fileData) return

    setIsProcessing(true)
    try {
      // Create rotation data for all pages
      const pageRotationData = Array.from({ length: pageCount }, (_, i) => ({
        pageNumber: i + 1,
        rotation: 90
      }))

      const result = await rotateDocumentPages(tempId, fileData, pageRotationData)
      
      if (result.success && result.documentUrl) {
        setRotatedDocumentUrl(result.documentUrl)
        setRotatedDocumentPath(result.documentPath || null)
        
        // Update page rotations state
    const newRotations: { [pageNumber: number]: number } = {}
    for (let i = 1; i <= pageCount; i++) {
          newRotations[i] = (pageRotations[i] || 0) + 90
    }
    setPageRotations(newRotations)
        
      toast({
          title: "All pages rotated",
          description: "Document has been rotated successfully",
        })
          } else {
        throw new Error(result.error || 'Failed to rotate pages')
      }
    } catch (error) {
      console.error('Rotation error:', error)
      toast({
        title: "Rotation failed",
        description: error instanceof Error ? error.message : "Failed to rotate pages",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }, [activeDocumentUrl, tempId, fileData, pageCount, pageRotations, toast])

  const handleRotateCurrentPage = useCallback(async (pageNumber: number) => {
    if (!activeDocumentUrl || !tempId || !fileData) return

    setIsProcessing(true)
    try {
      // Create rotation data for the current page
      const pageRotations = [{
        pageNumber: pageNumber,
        rotation: 90
      }]

      const result = await rotateDocumentPages(tempId, fileData, pageRotations)
      
      if (result.success && result.documentUrl) {
        setRotatedDocumentUrl(result.documentUrl)
        setRotatedDocumentPath(result.documentPath || null)
      
        // Update rotation state for this page
        setPageRotations(prev => ({
          ...prev,
          [pageNumber]: (prev[pageNumber] || 0) + 90
        }))
        
        toast({
          title: `Page ${pageNumber} rotated`,
          description: "Page has been rotated successfully",
        })
      } else {
        throw new Error(result.error || 'Failed to rotate page')
      }
    } catch (error) {
      console.error('Rotation error:', error)
      toast({
        title: "Rotation failed",
        description: error instanceof Error ? error.message : "Failed to rotate page",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }, [activeDocumentUrl, tempId, fileData, toast])

  // Handle save document
  const handleSaveRotatedDocument = async () => {
    if (!rotatedDocumentUrl || !rotatedDocumentPath) {
      toast({
        title: "No rotated document",
        description: "Please rotate some pages first.",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    try {
    const result = await saveRotatedDocumentAsRegular(
      rotatedDocumentUrl || '',
      urlFileName || 'rotated-document.pdf',
      rotatedDocumentPath || '',
      urlFileName || 'rotated-document.pdf'
    )

    if (!result.success) {
      throw new Error(result.error || 'Failed to save document')
    }

      toast({
        title: "Document saved",
        description: "Rotated document has been saved successfully.",
      })
      setRotatedDocumentUrl(null) // Clear URL after saving
      setRotatedDocumentPath(null) // Clear path after saving
    } catch (error) {
      console.error('Save error:', error)
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Failed to save document",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDownload = useCallback(() => {
    if (activeDocumentUrl) {
      const link = document.createElement('a')
      link.href = activeDocumentUrl
      link.download = urlFileName || 'document.pdf'
      link.click()
        }
  }, [activeDocumentUrl, urlFileName])

  // Range rotation handler
  const handleRangeRotate = async () => {
    if (!activeDocumentUrl || !tempId || !fileData) return

    setIsProcessing(true)
    try {
      // Check if file is too large (over 100MB)
      const fileSizeInMB = (fileData.length * 0.75) / (1024 * 1024) // Approximate size
      if (fileSizeInMB > 100) {
        toast({
          title: "Archivo muy grande",
          description: `Este documento (${fileSizeInMB.toFixed(1)}MB) es demasiado grande para rotación. El límite es 100MB.`,
          variant: "destructive",
        })
        return
      }

      // Create rotation data for selected range
      console.log('Range rotation debug:', {
        rangeStart,
        rangeEnd,
        pageCount,
        rangeRotation,
        currentPageRotation,
        fileDataLength: fileData?.length
      })
      
      const pageRotationData = []
      for (let i = rangeStart; i <= rangeEnd; i++) {
        if (i >= 1 && i <= pageCount) {
          // Get current rotation for this page
          const pageCurrentRotation = await getCurrentPageRotation(i)
          const targetRotation = rangeRotation
          
          pageRotationData.push({
            pageNumber: i,
            rotation: targetRotation
          })
          
          console.log(`Page ${i}: ${pageCurrentRotation}° → ${targetRotation}°`)
        }
      }
      
      console.log('Page rotation data created:', pageRotationData)

      const result = await rotateDocumentPages(tempId, fileData, pageRotationData)
      
      if (result.success && result.documentUrl) {
        setRotatedDocumentUrl(result.documentUrl)
        setRotatedDocumentPath(result.documentPath || null)
        
        // Update page rotations state
        const newRotations = { ...pageRotations }
        pageRotationData.forEach(({ pageNumber, rotation }) => {
          newRotations[pageNumber] = (newRotations[pageNumber] || 0) + rotation
        })
        setPageRotations(newRotations)
        
        setShowRangeModal(false)
        
        toast({
          title: "Páginas rotadas exitosamente",
          description: `${pageRotationData.length} páginas han sido rotadas ${rangeRotation}°`,
        })
      } else {
        throw new Error(result.error || 'Failed to rotate pages')
      }
    } catch (error) {
      console.error('Range rotate error:', error)
      toast({
        title: "Error al rotar páginas",
        description: error instanceof Error ? error.message : "Failed to rotate pages",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (tempId) {
        cleanupTempDocument(tempId).catch(console.error)
      }
    }
  }, [tempId])

  // Show upload card if no document is loaded
  if (showUploadCard && !documentUrl) {
    return (
      <div className="container mx-auto p-4 h-full flex items-center justify-center">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Upload Document for Rotation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium mb-2">
                Choose a PDF document to rotate
              </p>
              <p className="text-sm text-gray-600 mb-4">
                Support for documents up to 200MB with thousands of pages
              </p>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".pdf"
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="mb-4"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Select PDF File
                  </>
                )}
              </Button>
            </div>
            
            {selectedFile && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">{selectedFile.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                    </Badge>
                </div>
                  <Button
                    onClick={handleUpload}
                    disabled={isUploading}
                    size="sm"
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Upload'
                    )}
                  </Button>
          </div>
                </div>
              )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show document viewer
  if (activeDocumentUrl) {
    return (
      <div className="h-full flex flex-col">
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Simple Top Bar */}
          <div className="border-b bg-white dark:bg-gray-900 px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
              onClick={() => router.back()}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Atrás
                </Button>
                
                <div className="h-4 w-px bg-gray-300 dark:bg-gray-700" />
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowInfo(!showInfo)}
                  className="gap-2"
                >
                  <Info className="h-4 w-4" />
                  Info
          </Button>
              </div>

          <div className="flex items-center gap-2">
                {/* Range Rotation Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRangeModal(true)}
                  disabled={!documentUrl || pageCount === 0}
                >
                  <RefreshCcw className="h-4 w-4" />
                  <span className="ml-2">Rotar Rango</span>
                </Button>

                <div className="h-4 w-px bg-gray-300 dark:bg-gray-700" />

                {/* Save Button */}
                {rotatedDocumentUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSaveRotatedDocument}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    <span className="ml-2">Guardar</span>
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Content Area with Info Panel */}
          <div className="flex-1 flex overflow-hidden">
            {/* Main Document Viewer */}
            <div className="flex-1">
              {documentUrl ? (
                <CompleteDocumentViewer
                  documentUrl={activeDocumentUrl}
                  documentId={urlDocumentId || undefined}
                  fileName={urlFileName || undefined}
                  onLoad={(numPages: number) => {
                    setPageCount(numPages);
                    setRangeEnd(numPages);
                    setIsDocumentReady(true);
                    setTimeout(() => setShowPreview(true), 1000);
                  }}
                  onSave={(rotations: Record<number, number>) => {
                    const rotatedPages = Object.entries(rotations)
                      .filter(([_, rotation]) => rotation > 0)
                      .map(([pageNum, _]) => parseInt(pageNum));
                    // This onSave handler is for the CompleteDocumentViewer, not the range rotation
                    // For range rotation, we update pageRotations directly. This only a test.
                    // The handleSaveRotatedDocument function handles saving the final rotated document.
                  }}
                  onDownload={handleDownload}
                />
              ) : (
                // Document Upload Card
                <div className="flex items-center justify-center h-full p-8">
                  <Card className="w-full max-w-md">
                    <CardHeader>
                      <CardTitle>Cargar documento</CardTitle>
                      <CardDescription>
                        Selecciona un archivo PDF para rotar sus páginas
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-center w-full">
                          <label
                            htmlFor="file-upload"
                            className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                          >
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              <Upload className="w-8 h-8 mb-3 text-gray-400" />
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                Haz clic para seleccionar
                              </p>
                            </div>
                            <input
                              id="file-upload"
                              type="file"
                              className="hidden"
                              accept="application/pdf"
                              onChange={handleFileSelect}
                            />
                          </label>
                        </div>
                        {selectedFile && (
                          <div className="space-y-2">
                            <p className="text-sm text-gray-600">
                              Archivo seleccionado: {selectedFile.name}
                            </p>
                            <Button
                              onClick={handleUpload}
                              disabled={isUploading}
                              className="w-full"
                              variant="outline"
                            >
                              {isUploading ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Cargando...
                                </>
                              ) : (
                                'Cargar y continuar'
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>

            {/* Right Info Panel */}
            {showInfo && documentUrl && (
              <div className="w-80 border-l bg-gray-50 dark:bg-gray-900 p-4 overflow-y-auto">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-sm mb-2">Documento</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 break-all">
                      {urlFileName || 'Sin nombre'}
                    </p>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="font-semibold text-sm mb-2">Detalles</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Páginas:</span>
                        <span>{pageCount || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Estado:</span>
                        <span>{urlMode === 'edit' ? 'Edición' : 'Vista'}</span>
                      </div>
                      {rotatedDocumentUrl && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Modificado:</span>
                          <span className="text-green-600">Sí</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {pageRotations && Object.keys(pageRotations).length > 0 && (
                    <div className="border-t pt-4">
                      <h3 className="font-semibold text-sm mb-2">Páginas rotadas</h3>
                      <div className="space-y-1 text-sm max-h-40 overflow-y-auto">
                        {Object.entries(pageRotations).map(([page, rotation]) => (
                          <div key={page} className="flex justify-between text-gray-600">
                            <span>Página {page}:</span>
                            <span>{rotation}°</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t pt-4">
                    <h3 className="font-semibold text-sm mb-3">Acciones</h3>
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        onClick={handleDownload}
                        disabled={!documentUrl}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Descargar original
                      </Button>
                      {rotatedDocumentUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => {
                            const link = document.createElement('a')
                            link.href = rotatedDocumentUrl
                            link.download = `rotated-${urlFileName || 'document.pdf'}`
                            link.click()
                          }}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Descargar rotado
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
        </div>

          {/* Range Rotation Modal - Simplified */}
          <Dialog open={showRangeModal} onOpenChange={(open) => {
            setShowRangeModal(open);
            if (open) {
              setShowPreview(false);
            }
          }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Rotar Rango de Páginas</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="range-start">Desde página</Label>
                    <Input
                      id="range-start"
                      type="number"
                      min={1}
                      max={pageCount}
                      value={rangeStart}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 1
                        setRangeStart(Math.min(Math.max(1, value), pageCount))
                        if (value > rangeEnd) {
                          setRangeEnd(value)
                        }
                      }}
                    />
                </div>
                  <div>
                    <Label htmlFor="range-end">Hasta página</Label>
                    <Input
                      id="range-end"
                      type="number"
                      min={rangeStart}
                      max={pageCount}
                      value={rangeEnd}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || pageCount
                        setRangeEnd(Math.min(Math.max(rangeStart, value), pageCount))
                      }}
                    />
                  </div>
                        </div>

                <div>
                  <Label>Rotación</Label>
                  <div className="flex gap-2 mt-2">
                    {[0, 90, 180, 270].map((angle) => (
                      <Button
                        key={angle}
                        variant={rangeRotation === angle ? "default" : "outline"}
                        size="sm"
                        onClick={() => setRangeRotation(angle)}
                        className="flex-1"
                      >
                        {angle}°
                      </Button>
                      ))}
                    </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-sm">
                  <p className="text-gray-600 dark:text-gray-400">
                    Se rotarán {rangeEnd - rangeStart + 1} páginas ({rangeStart} a {rangeEnd})
                  </p>
                  {currentPageRotation !== undefined && currentPageRotation !== 0 && (
                    <p className="text-gray-500 text-xs mt-1">
                      Orientación actual de página {rangeStart}: {currentPageRotation}°
                    </p>
                  )}
                </div>

                {/* Preview with rotation button */}
                {showPreview && rangeStart > 0 && (
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">Vista previa - Página {rangeStart}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRangeRotation((prev) => (prev + 90) % 360)
                        }}
                      >
                        <RotateCw className="h-3 w-3 mr-1" />
                        Rotar +90°
                      </Button>
                    </div>
                    <div className="flex justify-center">
                      <SimplePdfPreview
                        documentUrl={activeDocumentUrl}
                        pageNumber={rangeStart}
                        rotation={rangeRotation}
                        className="w-full"
                        maxHeight={250}
                      />
                    </div>
                  </div>
                )}

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowRangeModal(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleRangeRotate}
                    disabled={isProcessing || rangeRotation === 0}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      'Aplicar Rotación'
                    )}
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    )
  }

  // Loading state
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
        <p className="text-lg font-medium">Loading Document Viewer...</p>
    </div>
    </div>
  )
}