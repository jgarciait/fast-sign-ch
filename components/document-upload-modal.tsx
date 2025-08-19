"use client"

import { useState, useCallback, useRef } from "react"
import { Upload, FileText, X, AlertCircle, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

interface UploadedFile {
  id: string
  file: File
  name: string
  size: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  error?: string
}

interface DocumentUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onUploadComplete?: (document: any) => void
}

export default function DocumentUploadModal({ 
  isOpen, 
  onClose, 
  onUploadComplete 
}: DocumentUploadModalProps) {
  const [file, setFile] = useState<UploadedFile | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const validateFile = (file: File) => {
    // Check file type
    if (file.type !== 'application/pdf') {
      return { isValid: false, error: 'Solo se permiten archivos PDF' }
    }

    // Check file size (max 200MB)
    if (file.size > 200 * 1024 * 1024) {
      return { isValid: false, error: 'El archivo debe ser menor a 200MB' }
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
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFile(files[0]) // Solo tomar el primer archivo
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }, [])

  const handleFile = (uploadFile: File) => {
    if (file && file.status === 'uploading') {
      toast.error('Ya hay un documento cargándose')
      return
    }

    const validation = validateFile(uploadFile)
    if (!validation.isValid) {
      toast.error(validation.error!)
      return
    }

    const newFile: UploadedFile = {
      id: `${Date.now()}-${Math.random()}`,
      file: uploadFile,
      name: uploadFile.name,
      size: formatFileSize(uploadFile.size),
      status: 'pending',
      progress: 0
    }

    setFile(newFile)
  }

  const removeFile = () => {
    if (isUploading) return
    setFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const uploadDocument = async () => {
    if (!file) return

    setIsUploading(true)
    setFile(prev => prev ? { ...prev, status: 'uploading', progress: 0 } : null)

    try {
      // Use the EXACT same upload method as fast-sign
      const formData = new FormData()
      formData.append("file", file.file)

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        throw new Error(errorText || "Failed to upload document")
      }

      const result = await uploadResponse.json()

      // Simulate progress for better UX since /api/upload doesn't provide real progress
      let progress = 0
      const progressInterval = setInterval(() => {
        progress += 10
        if (progress <= 90) {
          setFile(prev => prev ? { ...prev, progress } : null)
        }
      }, 100)

      // Clear interval and set to 100%
      setTimeout(() => {
        clearInterval(progressInterval)
        setFile(prev => prev ? { ...prev, status: 'success', progress: 100 } : null)
      }, 1000)

      // Create document record using the same action as fast-sign
      const { createFastSignDocument } = await import('@/app/actions/fast-sign-actions')
      
      const dbResult = await createFastSignDocument(
        file.file.name,
        result.path,
        result.url,
        file.file.size,
        file.file.type,
      )

      if (dbResult.error) {
        console.warn('Could not create document record:', dbResult.error)
        // Continue anyway, file is uploaded
      }

      toast.success(`${file.name} subido exitosamente`)
      
      // Call completion callback with the document data
      if (onUploadComplete && dbResult.document) {
        onUploadComplete(dbResult.document)
      }

      // Auto-close after 1.5 seconds
      setTimeout(() => {
        handleClose()
      }, 1500)

    } catch (error) {
      console.error('Upload error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error al subir el documento'
      
      setFile(prev => prev ? { 
        ...prev, 
        status: 'error', 
        progress: 0,
        error: errorMessage
      } : null)
      
      toast.error(errorMessage)
    } finally {
      setIsUploading(false)
    }
  }

  const handleClose = () => {
    if (isUploading) {
      toast.error('No se puede cerrar mientras se está subiendo un documento')
      return
    }
    setFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onClose()
  }

  const handleBrowseFiles = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={!isUploading ? handleClose : undefined}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Subir Documento</DialogTitle>
          <DialogDescription>
            Selecciona o arrastra un archivo PDF para subir al sistema
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Upload Zone */}
          {!file && (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragOver
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Arrastra tu documento aquí
              </h3>
              <p className="text-gray-600 mb-4">
                o
              </p>
              <Button onClick={handleBrowseFiles} variant="outline">
                Seleccionar archivo
              </Button>
              <p className="text-xs text-gray-500 mt-3">
                Solo archivos PDF, máximo 200MB
              </p>
            </div>
          )}

          {/* File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="application/pdf"
            className="hidden"
          />

          {/* File Display */}
          {file && (
            <div className="bg-white border rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <FileText className="h-8 w-8 text-red-600 flex-shrink-0 mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">{file.size}</p>
                    </div>
                    {file.status !== 'uploading' && (
                      <Button
                        onClick={removeFile}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* Progress Bar */}
                  {file.status === 'uploading' && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                        <span>Subiendo...</span>
                        <span>{file.progress}%</span>
                      </div>
                      <Progress value={file.progress} className="h-2" />
                    </div>
                  )}

                  {/* Status Messages */}
                  {file.status === 'success' && (
                    <div className="flex items-center mt-2 text-green-600">
                      <CheckCircle className="h-4 w-4 mr-1" />
                      <span className="text-xs">Documento subido exitosamente</span>
                    </div>
                  )}

                  {file.status === 'error' && file.error && (
                    <div className="flex items-center mt-2 text-red-600">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      <span className="text-xs">{file.error}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              onClick={handleClose}
              variant="outline"
              disabled={isUploading}
            >
              {file?.status === 'success' ? 'Cerrar' : 'Cancelar'}
            </Button>
            
            {file && file.status === 'pending' && (
              <Button
                onClick={uploadDocument}
                disabled={isUploading}
              >
                {isUploading ? 'Subiendo...' : 'Subir Documento'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
