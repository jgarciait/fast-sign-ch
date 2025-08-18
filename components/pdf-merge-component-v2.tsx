"use client"

import { useState, useCallback } from "react"
import { uploadFileToTempStorage, cleanupTempFiles, generateMergeSessionId } from '@/utils/supabase-direct-upload'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  Upload, 
  FileText, 
  X,
  GripVertical, 
  Loader2, 
  Download,
  AlertCircle,
  CheckCircle
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'

interface UploadedFile {
  id: string
  file: File
  name: string
  size: number
  status: 'pending' | 'uploading' | 'ready' | 'error'
  progress: number
}

interface FinalResults {
  originalSize: number
  compressedSize: number
  totalPages: number
  reductionPercentage: number
}

interface MergeStatus {
  completed: boolean
  currentDocument: number
  totalDocuments: number
  currentPage: number
  totalPages: number
}

interface TempDocumentData {
  fileSize: number
  totalPages: number
  documentId?: string
}

export function PdfMergeComponentV2() {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isMerging, setIsMerging] = useState(false)
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [mergeProgress, setMergeProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState<'merge' | 'complete'>('merge')
  const [mergeStatus, setMergeStatus] = useState<MergeStatus>({
    completed: false,
    currentDocument: 0,
    totalDocuments: 0,
    currentPage: 0,
    totalPages: 0
  })
  const [finalResults, setFinalResults] = useState<FinalResults>({
    originalSize: 0,
    compressedSize: 0,
    totalPages: 0,
    reductionPercentage: 0
  })
  const [tempDocumentData, setTempDocumentData] = useState<TempDocumentData | null>(null)
  const [mergedDocumentUrl, setMergedDocumentUrl] = useState<string | null>(null)
  const [mergeSessionId, setMergeSessionId] = useState<string>('')
  
  // Real upload progress tracking (no simulation)
  const [uploadProgress, setUploadProgress] = useState<{ [fileId: string]: number }>({})
  const [currentUploadingFile, setCurrentUploadingFile] = useState<string | null>(null)

  const { toast } = useToast()
  const router = useRouter()

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatFileSizeMB = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB'
  }

  const validateFile = (file: File): { isValid: boolean; error?: string } => {
    // Check file type
    if (file.type !== 'application/pdf') {
      return { isValid: false, error: 'Solo se permiten archivos PDF' }
    }
    
    // No more strict size limits - files go directly to Supabase
    if (file.size > 50 * 1024 * 1024) {
      return { isValid: false, error: 'El archivo debe ser menor a 50MB' }
    }
    
    return { isValid: true }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const fileList = Array.from(e.dataTransfer.files)
    addFiles(fileList)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const fileList = Array.from(e.target.files)
      addFiles(fileList)
      e.target.value = '' // Reset input
    }
  }, [])

  const addFiles = (fileList: File[]) => {
    const validFiles: UploadedFile[] = []
    const invalidFiles: string[] = []

    fileList.forEach((file, index) => {
      // Check if file already exists
      if (files.some(f => f.name === file.name && f.size === file.size)) {
        invalidFiles.push(`${file.name} (ya existe)`)
        return
      }

      const validation = validateFile(file)
      if (!validation.isValid) {
        invalidFiles.push(`${file.name} (${validation.error})`)
        return
      }

      validFiles.push({
        id: `${Date.now()}-${index}-${Math.random()}`,
        file,
        name: file.name,
        size: file.size,
        status: 'pending',
        progress: 0
      })
    })

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles])
    }

    if (invalidFiles.length > 0) {
      toast({
        title: "Algunos archivos fueron rechazados",
        description: invalidFiles.join(', '),
        variant: "destructive",
      })
    }
  }

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId))
  }

  const clearAllFiles = () => {
    setFiles([])
    setMergedDocumentUrl(null)
    setMergeProgress(0)
    setCurrentStep('merge')
    setMergeStatus({
      completed: false,
      currentDocument: 0,
      totalDocuments: 0,
      currentPage: 0,
      totalPages: 0
    })
    setUploadProgress({})
    setCurrentUploadingFile(null)
  }

  // Handle drag and drop reordering
  const onDragEnd = (result: any) => {
    const { destination, source } = result

    if (!destination) return

    if (destination.index === source.index) return

    const newFiles = Array.from(files)
    const [reorderedFile] = newFiles.splice(source.index, 1)
    newFiles.splice(destination.index, 0, reorderedFile)

    setFiles(newFiles)
  }

  const handleMerge = async () => {
    if (files.length < 2) {
      toast({
        title: "Error",
        description: "Necesitas al menos 2 documentos para fusionar",
        variant: "destructive",
      })
      return
    }

    // Generate session ID for this merge operation
    const sessionId = generateMergeSessionId()
    setMergeSessionId(sessionId)

    setIsMerging(true)
    setShowProgressModal(true)
    setMergeProgress(0)
    setCurrentStep('merge')
    
    // Reset merge status
    setMergeStatus({
      completed: false,
      currentDocument: 0,
      totalDocuments: files.length,
      currentPage: 0,
      totalPages: 0
    })

    try {
      // Phase 1: Upload files directly to Supabase Storage using TUS with real progress
      
      setMergeProgress(5)
      
      // Sequential upload with real TUS progress tracking
      const uploadedPaths: string[] = []
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        
        setCurrentUploadingFile(file.id)
        setMergeStatus(prev => ({ 
          ...prev, 
          currentDocument: i + 1,
          currentPage: 0,
          totalPages: 0
        }))
        
        // Uploading file ${i + 1}/${files.length}: ${file.name}
        
        const result = await uploadFileToTempStorage(file.file, sessionId, (progress) => {
          // Real TUS progress callback
          setUploadProgress(prev => ({
            ...prev,
            [file.id]: progress.percentage
          }))
          
          // Calculate overall progress: 5% base + (65% total for uploads * file progress)
          const baseProgress = 5
          const uploadWeight = 65 // 65% of total progress for uploads
          const perFileWeight = uploadWeight / files.length
          const completedFilesProgress = i * perFileWeight
          const currentFileProgress = (progress.percentage / 100) * perFileWeight
          const totalProgress = baseProgress + completedFilesProgress + currentFileProgress
          
          setMergeProgress(totalProgress)
        })
        
        if (!result.success) {
          throw new Error(`Error uploading ${file.file.name}: ${result.error}`)
        }
        
        uploadedPaths.push(result.path!)
        
        // Mark this file as complete
        setUploadProgress(prev => ({
          ...prev,
          [file.id]: 100
        }))
        
        console.log(`File ${i + 1}/${files.length} uploaded successfully:`, result.path)
      }
      
      setCurrentUploadingFile(null)
      console.log('All files uploaded to temp storage:', uploadedPaths)
      
      setMergeProgress(70)
      
      // Phase 2: Call merge API with just the file paths (tiny JSON payload!)
      
      const mergeResponse = await fetch('/api/merge-pdf-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePaths: uploadedPaths,
          fileName: `merged-document-${Date.now()}.pdf`,
          sessionId: sessionId
        }),
      })

      if (!mergeResponse.ok) {
        const errorData = await mergeResponse.json()
        throw new Error(errorData.error || 'Failed to merge documents')
      }

      const result = await mergeResponse.json()
      console.log('Merge result:', result)

      if (result.success) {
        setMergedDocumentUrl(result.documentUrl)
        setTempDocumentData({
          fileSize: result.fileSize || 0,
          totalPages: result.totalPages || 0,
          documentId: result.documentId
        })
        
        setCurrentStep('complete')
        setMergeProgress(100)
        
        // Update final results with REAL DATA from server
        setFinalResults({
          originalSize: result.fileSize,
          compressedSize: result.fileSize,
          totalPages: result.totalPages,
          reductionPercentage: 0
        })
        
        setMergeStatus(prev => ({ ...prev, completed: true }))
        
        // Merge completed successfully
      } else {
        throw new Error(result.error || 'Failed to merge documents')
      }
    } catch (error) {
      console.error('Error merging documents:', error)
      
      // Clean up temp files on error
      if (mergeSessionId) {
        try {
          await cleanupTempFiles(mergeSessionId)
        } catch (cleanupError) {
          console.error('Error cleaning up temp files:', cleanupError)
        }
      }
      
      toast({
        title: "Error al fusionar documentos",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      })
      setCurrentStep('merge')
      setMergeProgress(0)
    } finally {
      setIsMerging(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Fusionar Documentos PDF</h2>
        <p className="text-gray-600 mt-2">
          Sube múltiples archivos PDF para fusionarlos en un solo documento
        </p>
      </div>

      {/* Upload Area */}
      <div className="space-y-4">
        <label
          className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 transition-colors duration-200 ${
            isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Upload className={`mx-auto h-12 w-12 mb-4 ${isDragOver ? 'text-blue-500' : 'text-gray-400'}`} />
            <p className="mb-2 text-lg text-gray-600">
              <span className="font-semibold">Haz clic para subir</span> o arrastra archivos aquí
            </p>
            <p className="text-sm text-gray-500">
              Solo archivos PDF (hasta 50MB por archivo)
            </p>
          </div>
          <input
            type="file"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            multiple
            accept=".pdf,application/pdf"
            onChange={handleFileSelect}
          />
        </label>
      </div>

      {/* Files List */}
      {files.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-medium">
                  Documentos Subidos ({files.length})
                </h3>
                <p className="text-sm text-gray-600">
                  Tamaño total: {formatFileSizeMB(files.reduce((sum, file) => sum + file.file.size, 0))}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllFiles}
                className="text-red-600 hover:text-red-700"
              >
                <X className="h-4 w-4 mr-1" />
                Limpiar Todo
              </Button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Arrastra para reordenar • Haz clic en × para eliminar
            </p>

            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="files">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-2"
                  >
                    {files.map((file, index) => (
                      <Draggable key={file.id} draggableId={file.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
                              snapshot.isDragging
                                ? 'shadow-lg bg-blue-50 border-blue-300'
                                : 'hover:bg-gray-50 border-gray-200'
                            }`}
                          >
                            <div
                              {...provided.dragHandleProps}
                              className="flex-shrink-0 text-gray-400 hover:text-gray-600 cursor-grab"
                            >
                              <GripVertical className="h-5 w-5" />
                            </div>
                            
                            <div className="flex-shrink-0">
                              <div className="w-10 h-12 bg-red-100 rounded flex items-center justify-center">
                                <FileText className="h-6 w-6 text-red-600" />
                              </div>
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-500 bg-gray-200 px-2 py-1 rounded min-w-[24px] text-center">
                                  {index + 1}
                                </span>
                                <h3 className="font-medium text-gray-900 break-words">
                                  {file.name}
                                </h3>
                              </div>
                              <div className="flex items-center gap-4 mt-1">
                                <span className="text-sm text-gray-500">
                                  {formatFileSize(file.size)}
                                </span>
                                <Badge 
                                  variant={file.status === 'error' ? 'destructive' : 'secondary'} 
                                  className="text-xs"
                                >
                                  {file.status === 'pending' && 'Listo'}
                                  {file.status === 'uploading' && 'Subiendo'}
                                  {file.status === 'ready' && 'Listo'}
                                  {file.status === 'error' && 'Error'}
                                </Badge>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFile(file.id)}
                                className="h-8 w-8 p-0 text-gray-400 hover:text-red-500 transition-colors"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end">
        <Button
          onClick={handleMerge}
          disabled={files.length < 2 || isMerging}
          className="gap-2"
          size="lg"
        >
          {isMerging ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Fusionando...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Fusionar y Guardar {files.length} Documentos
            </>
          )}
        </Button>
      </div>

      {/* Progress Modal */}
      <Dialog open={showProgressModal} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-4xl w-full max-w-[95vw] mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Procesando Documentos
            </DialogTitle>
            <DialogDescription>
              Progreso de la fusión de documentos PDF. Los archivos se están combinando en un solo documento.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Header Info */}
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-blue-800 font-medium">
                Fusionando {files.length} documentos
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <Progress value={mergeProgress} className="h-3" />
              <p className="text-sm text-center text-gray-600">
                {Math.round(mergeProgress)}% completado
              </p>
            </div>

            {/* Upload Progress - Real TUS Progress */}
            {currentUploadingFile && (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-500">
                  <Upload className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-lg text-blue-800">
                      Subiendo Archivos (TUS)
                    </span>
                    <span className="text-sm text-blue-600">
                      {mergeStatus.currentDocument}/{mergeStatus.totalDocuments}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {files.map((file) => (
                      <div key={file.id} className="flex items-center gap-2">
                        <span className="text-xs w-8 text-gray-500">{files.indexOf(file) + 1}.</span>
                        <span className="text-sm text-blue-700 flex-1 break-words">{file.name}</span>
                        <span className="text-xs text-blue-600 w-12 text-right">
                          {Math.round(uploadProgress[file.id] || 0)}%
                        </span>
                        <div className="w-16">
                          <Progress 
                            value={uploadProgress[file.id] || 0} 
                            className="h-2" 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Merge Task */}
            <div className={`flex items-center gap-3 p-4 rounded-lg ${mergeStatus.completed ? 'bg-green-50 border border-green-200' : currentUploadingFile ? 'bg-gray-50 border border-gray-200' : 'bg-blue-50 border border-blue-200'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${mergeStatus.completed ? 'bg-green-500' : currentUploadingFile ? 'bg-gray-400' : 'bg-blue-500'}`}>
                {mergeStatus.completed ? (
                  <CheckCircle className="h-5 w-5 text-white" />
                ) : currentUploadingFile ? (
                  <span className="text-white text-sm font-bold">2</span>
                ) : (
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-2">
                  <span className={`font-medium text-lg ${mergeStatus.completed ? 'text-green-800' : currentUploadingFile ? 'text-gray-600' : 'text-blue-800'}`}>
                    Fusión de Documentos
                  </span>
                </div>
                {mergeStatus.completed ? (
                  <p className="text-sm text-green-600">
                    ✓ Documentos fusionados exitosamente
                  </p>
                ) : currentUploadingFile ? (
                  <p className="text-sm text-gray-500">
                    Pendiente - Esperando que termine la subida
                  </p>
                ) : (
                  <p className="text-sm text-blue-600">
                    Procesando documentos en el servidor...
                  </p>
                )}
              </div>
            </div>

                          {/* Completion Status */}
              {currentStep === 'complete' && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center overflow-hidden">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <h3 className="text-xl font-bold text-green-800 mb-2">
                  ¡Fusión Completada!
                </h3>
                <p className="text-green-700 mb-4">
                  Tu documento está listo. ¿Deseas guardarlo en el sistema?
                </p>
                
                {/* Results Summary */}
                <div className="flex justify-center gap-4 p-3 bg-white rounded-lg border border-green-200 mb-4 w-full max-w-md mx-auto">
                  <div className="text-center flex-1 min-w-0">
                    <div className="text-lg font-bold text-green-600">{files.length}</div>
                    <div className="text-xs text-green-700">Documentos</div>
                  </div>
                  <div className="text-center flex-1 min-w-0">
                    <div className="text-lg font-bold text-green-600">{finalResults.totalPages || 0}</div>
                    <div className="text-xs text-green-700">Páginas</div>
                  </div>
                  <div className="text-center flex-1 min-w-0">
                    <div className="text-lg font-bold text-green-600">{formatFileSizeMB(finalResults.compressedSize || 0)}</div>
                    <div className="text-xs text-green-700">Tamaño</div>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-3 justify-center">
                  <Button
                    onClick={() => {
                      router.push('/fast-sign-docs')
                      setShowProgressModal(false)
                    }}
                    variant="outline"
                    className="gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Ver Documentos
                  </Button>
                  {tempDocumentData?.documentId && (
                    <Button
                      onClick={() => {
                        router.push(`/fast-sign/edit/${tempDocumentData.documentId}`)
                        setShowProgressModal(false)
                      }}
                      className="bg-blue-600 hover:bg-blue-700 gap-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Firmar Documento
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
