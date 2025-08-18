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
  CheckCircle,
  Settings,
  ChevronDown,
  ChevronUp,
  Info
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

interface UploadedFile {
  id: string
  file: File
  name: string
  size: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
  progress: number
}

interface PdfMergeComponentProps {
  onMergeComplete: (result: { success: boolean; message: string; documentUrl?: string; documentId?: string }) => void
}

export default function PdfMergeComponent({ onMergeComplete }: PdfMergeComponentProps) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isMerging, setIsMerging] = useState(false)
  const [mergeProgress, setMergeProgress] = useState(0)
  const [mergedDocumentUrl, setMergedDocumentUrl] = useState<string | null>(null)
  const [mergedDocumentId, setMergedDocumentId] = useState<string | null>(null)
  
  // Detailed progress states
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [currentStep, setCurrentStep] = useState<'merge' | 'compress' | 'upload' | 'complete'>('merge')
  const [mergeStatus, setMergeStatus] = useState({
    completed: false,
    currentDocument: 0,
    totalDocuments: 0,
    currentPage: 0,
    totalPages: 0
  })
  const [compressionStatus, setCompressionStatus] = useState({
    completed: false,
    currentPage: 0,
    totalPages: 0,
    originalSize: 0,
    currentReduction: 0,
    averageReduction: 0,
    currentPageInfo: ''
  })
  const [finalResults, setFinalResults] = useState({
    originalSize: 0,
    compressedSize: 0,
    totalPages: 0,
    reductionPercentage: 0
  })
  const [tempDocumentData, setTempDocumentData] = useState<any>(null)
  
  // Upload progress states (extending existing isUploading)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadBytesUploaded, setUploadBytesUploaded] = useState(0)
  const [uploadBytesTotal, setUploadBytesTotal] = useState(0)
  const [uploadSpeed, setUploadSpeed] = useState(0)
  const [uploadStartTime, setUploadStartTime] = useState<number>(0)
    const [uploadMethod, setUploadMethod] = useState<'tus' | 'standard' | null>(null)

  // Merge session for temporary file management
  const [mergeSessionId, setMergeSessionId] = useState<string>('')

  // Simplified - no compression settings
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

  // Removed compression utility functions

  const formatUploadSpeed = (bytesPerSecond: number) => {
    if (bytesPerSecond === 0) return '0 B/s'
    const k = 1024
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s']
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k))
    return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const calculateUploadSpeed = (bytesUploaded: number, timeElapsed: number) => {
    return timeElapsed > 0 ? bytesUploaded / (timeElapsed / 1000) : 0
  }

  const estimateTimeRemaining = (bytesUploaded: number, bytesTotal: number, speed: number) => {
    if (speed === 0 || bytesUploaded === 0) return 'Calculando...'
    
    const remainingBytes = bytesTotal - bytesUploaded
    const remainingSeconds = remainingBytes / speed
    
    if (remainingSeconds < 60) {
      return `${Math.round(remainingSeconds)}s restantes`
    } else if (remainingSeconds < 3600) {
      return `${Math.round(remainingSeconds / 60)}m restantes`
    } else {
      return `${Math.round(remainingSeconds / 3600)}h restantes`
    }
  }

  const validateFile = (file: File): { isValid: boolean; error?: string } => {
    // Check file type
    if (file.type !== 'application/pdf') {
      return { isValid: false, error: 'Solo se permiten archivos PDF' }
    }
    
    // Check file size - Vercel strict limit 4.5MB total, so max 2MB per file
    if (file.size > 2 * 1024 * 1024) {
      return { isValid: false, error: 'Máximo 2MB por archivo (límite Vercel 4.5MB total)' }
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
    }
  }, [])

  const addFiles = (fileList: File[]) => {
    // Check if we already have 20 files
    if (files.length >= 20) {
      toast({
        title: "Máximo de archivos alcanzado",
        description: "Solo puedes subir hasta 20 documentos",
        variant: "destructive",
      })
      return
    }

    const validFiles: UploadedFile[] = []
    const invalidFiles: string[] = []

    fileList.forEach((file, index) => {
      // Check if we would exceed the 20 file limit
      if (files.length + validFiles.length >= 20) {
        invalidFiles.push(`${file.name} (excede límite de 20 archivos)`)
        return
      }

      // Check if file already exists
      const existingFile = files.find(f => f.name === file.name && f.size === file.size)
      if (existingFile) {
        invalidFiles.push(`${file.name} (ya fue agregado)`)
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
      toast({
        title: "Archivos agregados",
        description: `${validFiles.length} archivo(s) agregado(s) exitosamente`,
      })
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
    // Removed compression status reset
  }

  // Simulate realistic merge progress
  const simulateMergeProgress = async () => {
    const totalFiles = files.length
    let estimatedTotalPages = totalFiles * 15 // Estimate ~15 pages per document
    
    setMergeStatus(prev => ({
      ...prev,
      totalPages: estimatedTotalPages
    }))

    // Simulate processing each document
    for (let docIndex = 0; docIndex < totalFiles; docIndex++) {
      setMergeStatus(prev => ({
        ...prev,
        currentDocument: docIndex + 1
      }))

      // Simulate pages for this document
      const pagesInDoc = Math.floor(Math.random() * 20) + 10 // 10-30 pages per doc
      for (let page = 0; page < pagesInDoc; page++) {
        setMergeStatus(prev => ({
          ...prev,
          currentPage: prev.currentPage + 1
        }))
        
        const overallProgress = Math.min(60, ((docIndex + (page / pagesInDoc)) / totalFiles) * 60)
        setMergeProgress(overallProgress)
        
        await new Promise(resolve => setTimeout(resolve, 50)) // 50ms per page simulation
      }
    }

    setMergeStatus(prev => ({ ...prev, completed: true }))
    setMergeProgress(100) // Complete merge
    setCurrentStep('complete') // Go to results
  }

  // Simulate compression progress animation with page details
  const simulateCompressionProgressSteps = async () => {
    // Simulate compression steps from 60% to 90%
    const totalPages = mergeStatus.currentPage || 100
    
    for (let progress = 60; progress <= 90; progress += 2) {
      setMergeProgress(progress)
      
      // Simulate page processing with realistic page numbers
      const currentPage = Math.floor((progress - 60) / 30 * totalPages)
      const reductionPercent = 55 + Math.random() * 10 // 55-65% reduction
      
      setCompressionStatus(prev => ({
        ...prev,
        currentPage: currentPage,
        totalPages: totalPages,
        currentPageInfo: `Escalando página ${currentPage} de ${totalPages} (${reductionPercent.toFixed(1)}% reducción)`,
        currentReduction: reductionPercent
      }))
      
      await new Promise(resolve => setTimeout(resolve, 150))
    }
  }

  // Update with real compression results
  const simulateCompressionProgress = (result: any) => {
    if (result.compressionInfo) {
      // Show completion animation first
      setTimeout(() => {
        setCompressionStatus({
          completed: true,
          currentPage: result.totalPages,
          totalPages: result.totalPages,
          originalSize: result.compressionInfo.originalSize,
          currentReduction: result.compressionInfo.reductionPercentage,
          averageReduction: result.compressionInfo.reductionPercentage,
          currentPageInfo: `Compresión completada - ${result.totalPages} páginas procesadas con ${result.compressionInfo.reductionPercentage.toFixed(1)}% de reducción`
        })
        
        setFinalResults({
          originalSize: result.compressionInfo.originalSize,
          compressedSize: result.compressionInfo.compressedSize,
          totalPages: result.totalPages,
          reductionPercentage: result.compressionInfo.reductionPercentage
        })
      }, 500) // Small delay to show the completion visually
    }
  }

  const onDragEnd = (result: any) => {
    if (!result.destination) return

    const items = Array.from(files)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    setFiles(items)
  }

  const handleMerge = async () => {
    if (files.length < 2) {
      toast({
        title: "Archivos insuficientes",
        description: "Por favor sube al menos 2 documentos para fusionar",
        variant: "destructive",
      })
      return
    }

        // Check total file size for Vercel STRICT limits
    const totalSize = files.reduce((sum, file) => sum + file.file.size, 0)
    const totalSizeMB = totalSize / 1024 / 1024

    // Vercel has a STRICT 4.5MB limit for serverless functions
    // This is regardless of Pro/Hobby plans
    if (totalSizeMB > 4) {
      toast({
        title: "Archivos demasiado grandes para Vercel",
        description: `Total: ${totalSizeMB.toFixed(1)}MB. Vercel limita estrictamente a 4.5MB. Usa archivos más pequeños o menos archivos.`,
        variant: "destructive",
      })
      return
    }

    if (totalSizeMB > 3) {
      toast({
        title: "Archivos cerca del límite",
        description: `Total: ${totalSizeMB.toFixed(1)}MB. Vercel tiene límite de 4.5MB. Puede fallar si es muy grande.`,
        variant: "default",
      })
    }

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
      // Create FormData with all files in the correct order
      const formData = new FormData()
      files.forEach((uploadedFile, index) => {
        formData.append(`files`, uploadedFile.file)
      })

      // No compression settings - compression is disabled

      // Simulate merge progress - more realistic
      await simulateMergeProgress()

      const response = await fetch('/api/merge-pdf', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        let errorData
        try {
          errorData = await response.json()
        } catch (jsonError) {
          // Handle cases where response is not JSON (like HTML error pages)
          console.error('Non-JSON error response:', response.status, response.statusText)
          throw new Error(`Server error (${response.status}): Files may be too large for upload. Try with fewer or smaller files.`)
        }
        
        if (response.status === 413) {
          throw new Error(
            errorData.error || 
            'Files too large for upload. Vercel has limits: 50MB total for Pro accounts, 4.5MB for Hobby accounts. Try with smaller files.'
          )
        }
        
        throw new Error(errorData.error || 'Failed to merge documents')
      }

      const result = await response.json()
      
      if (result.success) {
        console.log('PDF processing result:', {
          requiresUserConfirmation: result.requiresUserConfirmation,
          hasSessionId: !!result.tempSessionId,
          fileSize: result.fileSize,
          sizeMB: (result.fileSize / 1024 / 1024).toFixed(2),
          totalPages: result.totalPages
        })
        
        if (result.requiresUserConfirmation) {
          // Store session ID for server memory retrieval - NO DATA TRANSFER
          setTempDocumentData({
            ...result,
            tempSessionId: result.tempSessionId
          })
          
          setCurrentStep('complete')
          setMergeProgress(100)
          
          // Update final results with REAL DATA from server
          setFinalResults({
            originalSize: result.fileSize,
            compressedSize: result.fileSize, // Same as original since no compression
            totalPages: result.totalPages,
            reductionPercentage: 0 // No compression
          })
          
          toast({
            title: "Procesamiento completado",
            description: `${files.length} documentos fusionados exitosamente. Guardando documento...`,
          })
          
          // Auto-save after merge completion
          setTimeout(() => {
            handleSaveDocument()
          }, 1000)
          
        } else {
          // Document already saved (shouldn't happen with new logic)
          setMergedDocumentUrl(result.documentUrl)
          setMergedDocumentId(result.documentId)
          setCurrentStep('complete')
          setMergeProgress(100)
          simulateCompressionProgress(result)
          setTempDocumentData(null)
          
          toast({
            title: "Documento fusionado y guardado",
            description: `${files.length} documentos procesados exitosamente.`,
          })
        }
      } else {
        throw new Error(result.error || 'Failed to process documents')
      }

    } catch (error) {
      console.error('Merge error:', error)
      const errorMessage = error instanceof Error ? error.message : 'An error occurred during merge'
      
      onMergeComplete({
        success: false,
        message: errorMessage
      })
      
      toast({
        title: "Fusión fallida",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsMerging(false)
    }
  }

  const downloadMergedDocument = () => {
    if (mergedDocumentUrl) {
      const link = document.createElement('a')
      link.href = mergedDocumentUrl
      link.download = `merged-document-${Date.now()}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const handleSaveDocument = async () => {
    if (!tempDocumentData) {
      toast({
        title: "No hay documento para guardar",
        description: "Por favor, fusiona documentos primero.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsUploading(true)
      setCurrentStep('upload')

      // Save PDF from server memory to storage with progress simulation
      // TODO: Implement real TUS resumable upload with actual progress reporting
      console.log('Saving PDF from server memory to storage...')
      
      const tempSessionId = tempDocumentData.tempSessionId
      if (!tempSessionId) {
        throw new Error('No session ID available')
      }
      
      // Start progress simulation
      const fileSize = tempDocumentData.fileSize || 0
      setUploadBytesTotal(fileSize)
      setUploadBytesUploaded(0)
      setUploadSpeed(0)
      setUploadProgress(0)
      
      // Simulate realistic upload progress
      const startTime = Date.now()
      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(95, (elapsed / 30) * 100) // 95% in ~30 seconds for large files
        const bytesUploaded = Math.floor((progress / 100) * fileSize)
        const speed = bytesUploaded / (elapsed / 1000) || 0
        
        setUploadProgress(progress)
        setUploadBytesUploaded(bytesUploaded)
        setUploadSpeed(speed)
      }, 500)
      
      console.log('Requesting save from server memory:', { tempSessionId })
      
      try {
        const response = await fetch('/api/merge-pdf/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tempSessionId })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to save document')
        }

        const saveResult = await response.json()
        
        // Complete the progress
        clearInterval(progressInterval)
        setUploadProgress(100)
        setUploadBytesUploaded(fileSize)
        
        console.log('PDF saved successfully:', {
          documentId: saveResult.documentId,
          documentUrl: saveResult.documentUrl
        })
        
        setMergedDocumentUrl(saveResult.documentUrl)
        setMergedDocumentId(saveResult.documentId)

        // Move success logic inside the try block
        setCurrentStep('complete')
        setIsUploading(false)
        setTempDocumentData(null)
        
        toast({
          title: "Documento guardado exitosamente",
          description: "El documento fusionado ha sido guardado correctamente.",
        })

        // Reset everything and close modal after successful save
        setTimeout(() => {
          setShowProgressModal(false)
          setFiles([])
          setMergeProgress(0)
          setIsMerging(false)
          setIsUploading(false)
          setUploadProgress(0)
          setUploadBytesUploaded(0)
          setUploadBytesTotal(0)
          setUploadSpeed(0)
          setCurrentStep('merge')
          
          // Call the completion callback
          onMergeComplete({
            success: true,
            message: '¡Documentos fusionados y guardados exitosamente!',
            documentUrl: saveResult.documentUrl,
            documentId: saveResult.documentId
          })
        }, 2000)
        
      } catch (error) {
        clearInterval(progressInterval)
        throw error
      }
      
    } catch (error) {
      console.error('Error saving document:', error)
      setIsUploading(false)
      toast({
        title: "Error al guardar",
        description: `Error al guardar el documento: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        variant: "destructive",
      })
    }
  }

  const handleSaveDocumentOLD = async () => {
    if (tempDocumentData) {
      try {
        setCurrentStep('upload')
        setIsUploading(true)
        setUploadProgress(0)
        setUploadBytesUploaded(0)
        setUploadBytesTotal(0)
        setUploadSpeed(0)
        setUploadStartTime(Date.now())
        
                      // Import TUS upload function with fallback
        const { uploadFileResumableSafe, uploadFileStandard } = await import('@/utils/tus-upload')
        
        // Convert base64 back to Uint8Array safely
        console.log('Converting base64 to bytes...', {
          base64Length: tempDocumentData.pdfDataBase64?.length,
          estimatedBytes: tempDocumentData.pdfDataBase64 ? Math.floor(tempDocumentData.pdfDataBase64.length * 0.75) : 0
        })
        
        let pdfBytes: Uint8Array
        try {
          // Decode base64 in chunks to avoid "Invalid array length" error
          const base64 = tempDocumentData.pdfDataBase64
          const binaryString = atob(base64)
          console.log('Binary string length:', binaryString.length)
          
          // Convert binary string to Uint8Array in chunks
          const chunkSize = 1000000 // 1MB chunks
          const chunks: Uint8Array[] = []
          
          for (let i = 0; i < binaryString.length; i += chunkSize) {
            const chunk = binaryString.slice(i, i + chunkSize)
            const chunkArray = new Uint8Array(chunk.length)
            for (let j = 0; j < chunk.length; j++) {
              chunkArray[j] = chunk.charCodeAt(j)
            }
            chunks.push(chunkArray)
          }
          
          // Combine all chunks into final array
          const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
          pdfBytes = new Uint8Array(totalLength)
          let offset = 0
          for (const chunk of chunks) {
            pdfBytes.set(chunk, offset)
            offset += chunk.length
          }
          
          console.log('Successfully created PDF bytes:', pdfBytes.length)
        } catch (error) {
          console.error('Error converting base64 to bytes:', error)
          throw new Error('Error al procesar el documento PDF: datos corruptos')
        }
        setUploadBytesTotal(pdfBytes.length)

        // Start resumable upload with progress tracking and fallback
        let saveResult
        
        // TEMPORARILY DISABLE TUS TO TEST STANDARD UPLOAD
        console.log('TESTING: Using standard upload only (TUS disabled)...')
        setUploadMethod('standard')
        saveResult = await uploadFileStandard(
          pdfBytes,
          tempDocumentData.tempFileName,
          tempDocumentData.compressionInfo
        )
        
        // Set progress to 100% for standard upload
        if (saveResult.success) {
          setUploadProgress(100)
          setUploadBytesUploaded(pdfBytes.length)
          setUploadBytesTotal(pdfBytes.length)
          console.log('Standard upload completed successfully')
        }
        
        if (!saveResult.success) {
          throw new Error(saveResult.error || 'Failed to save document')
        }
        
        setMergedDocumentUrl(saveResult.documentUrl!)
        setMergedDocumentId(saveResult.documentId!)
        setMergeProgress(100)
        
        onMergeComplete({
          success: true,
          message: '¡Documentos fusionados y guardados exitosamente!',
          documentUrl: saveResult.documentUrl!,
          documentId: saveResult.documentId!
        })
        
      toast({
          title: "Documento guardado",
          description: "Tu documento fusionado ha sido guardado exitosamente",
      })
      
      // Reset the merge state
        setShowProgressModal(false)
      setFiles([])
        setTempDocumentData(null)
      setMergeProgress(0)
        setIsMerging(false)
        setIsUploading(false)
        setUploadProgress(0)
        setUploadBytesUploaded(0)
        setUploadBytesTotal(0)
        setUploadSpeed(0)
        setUploadMethod(null)
      } catch (error) {
        console.error('Resumable upload error:', error)
        toast({
          title: "Error al guardar",
          description: error instanceof Error ? error.message : "Hubo un problema al guardar el documento",
          variant: "destructive"
        })
        setCurrentStep('complete') // Reset to allow retry
        setMergeProgress(100)
        setIsUploading(false)
        setUploadMethod(null)
      }
    }
  }



  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload className={`mx-auto h-12 w-12 mb-4 ${isDragOver ? 'text-blue-500' : 'text-gray-400'}`} />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Subir Documentos para Fusionar
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Arrastra y suelta tus archivos aquí, o haz clic para examinar
        </p>
        <div className="flex flex-col sm:flex-row gap-2 items-center justify-center text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span>Solo PDF</span>
          </div>
          <div className="hidden sm:block">•</div>
          <div>Máx 50MB cada uno</div>
          <div className="hidden sm:block">•</div>
          <div>{20 - files.length} espacios restantes</div>
        </div>
        
        <input
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          id="file-upload"
          accept=".pdf"
        />
        <label htmlFor="file-upload" className="mt-4 inline-block">
          <Button variant="outline" className="cursor-pointer" asChild>
            <span>
            <Upload className="h-4 w-4 mr-2" />
              Examinar Archivos
            </span>
          </Button>
        </label>
      </div>

      {/* Removed compression settings - compression is disabled */}

      {/* Files List */}
      {files.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-medium">
                  Documentos Subidos ({files.length})
                </h3>
                {files.length > 0 && (
                  <div className="text-sm">
                    <p className="text-gray-600">
                      Tamaño total: {((files.reduce((sum, file) => sum + file.file.size, 0)) / 1024 / 1024).toFixed(1)} MB
                    </p>
                    <p className="text-xs text-red-600">
                      ⚠️ Límite estricto de Vercel: 4.5MB para todas las cuentas
                    </p>
                    {((files.reduce((sum, file) => sum + file.file.size, 0)) / 1024 / 1024) > 4 && (
                      <p className="text-xs text-red-700 font-medium">
                        🚫 Este tamaño fallará en producción
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllFiles}
                  disabled={isMerging}
                >
                  <X className="h-4 w-4 mr-2" />
                  Limpiar Todo
                </Button>
              </div>
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
                                <Badge variant="secondary" className="text-xs">
                                  {index + 1}
                                </Badge>
                                <span className="font-medium break-words">{file.name}</span>
                              </div>
                              <div className="text-sm text-gray-500">
                                {formatFileSize(file.size)}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                {file.status === 'success' && (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                )}
                                {file.status === 'error' && (
                                  <AlertCircle className="h-4 w-4 text-red-600" />
                                )}
                                <Badge variant={
                                  file.status === 'success' ? 'default' :
                                  file.status === 'error' ? 'destructive' :
                                  'secondary'
                                }>
                                  {file.status === 'pending' && 'Ready'}
                                  {file.status === 'uploading' && 'Uploading'}
                                  {file.status === 'success' && 'Ready'}
                                  {file.status === 'error' && 'Error'}
                                </Badge>
                              </div>
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFile(file.id)}
                                disabled={isMerging}
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

      {/* Progress Modal */}
      <Dialog open={showProgressModal} onOpenChange={setShowProgressModal}>
        <DialogContent className="max-w-4xl w-full max-w-[95vw] mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              Procesando Documentos
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Header Info */}
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-blue-800 font-medium">
                Fusionando {files.length} documentos
              </p>
            </div>

            {/* Progress Tasks */}
            <div className="space-y-4">
              {/* Merge Task */}
              <div className={`flex items-center gap-3 p-4 rounded-lg ${mergeStatus.completed ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${mergeStatus.completed ? 'bg-green-500' : 'bg-blue-500'}`}>
                  {mergeStatus.completed ? (
                    <CheckCircle className="h-5 w-5 text-white" />
                  ) : (
                    <Loader2 className="h-5 w-5 text-white animate-spin" />
                  )}
            </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-2">
                    <span className={`font-medium text-lg ${mergeStatus.completed ? 'text-green-800' : 'text-blue-800'}`}>
                      1. Fusión de Documentos
                    </span>
                    <span className={`text-sm ${mergeStatus.completed ? 'text-green-600' : 'text-blue-600'}`}>
                      {mergeStatus.currentDocument}/{mergeStatus.totalDocuments} documentos
                    </span>
                  </div>
                  {mergeStatus.completed ? (
                    <p className="text-sm text-green-600">
                      ✓ {mergeStatus.totalDocuments} documentos fusionados - {mergeStatus.currentPage} páginas totales
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <Progress 
                        value={currentStep === 'merge' ? (mergeStatus.currentDocument / mergeStatus.totalDocuments) * 100 : 0} 
                        className="h-3" 
                      />
                      <p className="text-sm text-blue-600">
                        Procesando página {mergeStatus.currentPage} - Documento {mergeStatus.currentDocument} de {mergeStatus.totalDocuments}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Removed compression and upload steps */}

              {/* Completion Status */}
              {currentStep === 'complete' && (
                <div className="p-6 bg-green-50 border border-green-200 rounded-lg text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <h3 className="text-xl font-bold text-green-800 mb-2">
                    ¡Fusión Completada!
                  </h3>
                  <p className="text-green-700 mb-4">
                    Tu documento está listo. ¿Deseas guardarlo en el sistema?
                  </p>
                  
                  {/* Results Summary */}
                  <div className="grid grid-cols-3 gap-4 p-4 bg-white rounded-lg border border-green-200 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{files.length}</div>
                      <div className="text-sm text-green-700">Documentos</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{tempDocumentData?.totalPages || finalResults.totalPages || 0}</div>
                      <div className="text-sm text-green-700">Páginas</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{formatFileSizeMB(tempDocumentData?.fileSize || finalResults.compressedSize || 0)}</div>
                      <div className="text-sm text-green-700">Tamaño</div>
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
                    {mergedDocumentId && (
                      <Button
                        onClick={() => {
                          router.push(`/fast-sign/edit/${mergedDocumentId}`)
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

            {/* Overall Progress */}
            {currentStep !== 'complete' && (
              <div className="pt-4 border-t">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Progreso General</span>
                  <span className="text-sm text-gray-600">{Math.round(mergeProgress)}% completado</span>
                </div>
                <Progress value={mergeProgress} className="h-3" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Merged Document Results - REMOVE THIS SECTION TO AVOID DUPLICATE BUTTONS */}
      {/* The modal handles all the saving logic now */}

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
    </div>
  )
} 