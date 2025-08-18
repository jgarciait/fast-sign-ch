"use client"

import { useState, useCallback } from "react"
import { Upload, FileText, X, CheckCircle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { uploadMultipleFilesToCaseFile } from "@/app/actions/filing-system-actions"

interface CaseFileUploadZoneProps {
  caseFileId: string
  onUploadComplete: () => void
}

interface UploadFile {
  file: File
  id: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
  documentId?: string
}

export default function CaseFileUploadZone({ caseFileId, onUploadComplete }: CaseFileUploadZoneProps) {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const { toast } = useToast()

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
    const newFiles: UploadFile[] = fileList.map(file => ({
      file,
      id: `${Date.now()}-${Math.random()}`,
      status: 'pending'
    }))

    setFiles(prev => [...prev, ...newFiles])
  }

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId))
  }

  const clearAllFiles = () => {
    setFiles([])
    setUploadProgress(0)
  }

  const uploadFiles = async () => {
    if (files.length === 0) return

    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Update all files to uploading status
      setFiles(prev => prev.map(f => ({ ...f, status: 'uploading' as const })))

      const filesToUpload = files.map(f => f.file)
      const result = await uploadMultipleFilesToCaseFile(caseFileId, filesToUpload)

      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
        return
      }

      // Update file statuses based on results
      setFiles(prev => prev.map(f => {
        const uploadedFile = result.uploadedFiles?.find(uf => uf.fileName === f.file.name)
        const failedFile = result.failedUploads?.find(ff => ff.fileName === f.file.name)

        if (uploadedFile) {
          return {
            ...f,
            status: 'success' as const,
            documentId: uploadedFile.documentId
          }
        } else if (failedFile) {
          return {
            ...f,
            status: 'error' as const,
            error: failedFile.error
          }
        }
        return f
      }))

      setUploadProgress(100)

      // Show success message
      if (result.totalUploaded && result.totalUploaded > 0) {
        toast({
          title: "Archivos subidos exitosamente",
          description: `${result.totalUploaded} archivo(s) subido(s) al expediente`,
        })
        onUploadComplete()
      }

      if (result.totalFailed && result.totalFailed > 0) {
        toast({
          title: "Algunos archivos fallaron",
          description: `${result.totalFailed} archivo(s) no se pudieron subir`,
          variant: "destructive",
        })
      }

    } catch (error) {
      toast({
        title: "Error",
        description: "Error al subir archivos",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      case 'uploading':
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
      default:
        return <FileText className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: UploadFile['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200'
      case 'error':
        return 'bg-red-50 border-red-200'
      case 'uploading':
        return 'bg-blue-50 border-blue-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-blue-600" />
          Subir Archivos al Expediente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drag and Drop Zone */}
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
            Arrastra archivos aquí o haz clic para seleccionar
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Puedes subir múltiples archivos a la vez. Tamaño máximo: 50MB por archivo.
          </p>
          <input
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
            accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
          />
          <label htmlFor="file-upload">
            <Button variant="outline" className="cursor-pointer">
              Seleccionar Archivos
            </Button>
          </label>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-900">
                Archivos Seleccionados ({files.length})
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFiles}
                disabled={isUploading}
              >
                Limpiar Todo
              </Button>
            </div>

            {/* Upload Progress */}
            {isUploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Subiendo archivos...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="w-full" />
              </div>
            )}

            {/* File Items */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {files.map((uploadFile) => (
                <div
                  key={uploadFile.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${getStatusColor(uploadFile.status)}`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getStatusIcon(uploadFile.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {uploadFile.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(uploadFile.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      {uploadFile.error && (
                        <p className="text-xs text-red-600 mt-1">
                          {uploadFile.error}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      uploadFile.status === 'success' ? 'default' :
                      uploadFile.status === 'error' ? 'destructive' :
                      uploadFile.status === 'uploading' ? 'secondary' : 'outline'
                    }>
                      {uploadFile.status === 'pending' && 'Pendiente'}
                      {uploadFile.status === 'uploading' && 'Subiendo'}
                      {uploadFile.status === 'success' && 'Exitoso'}
                      {uploadFile.status === 'error' && 'Error'}
                    </Badge>
                    {uploadFile.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(uploadFile.id)}
                        disabled={isUploading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Upload Button */}
            <div className="flex justify-end">
              <Button
                onClick={uploadFiles}
                disabled={isUploading || files.length === 0 || files.every(f => f.status !== 'pending')}
                className="gap-2"
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Subir {files.filter(f => f.status === 'pending').length} Archivo(s)
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
