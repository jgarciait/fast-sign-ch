"use client"

import { useState, useRef } from "react"
import { Upload, FileText, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import SimplePdfWrapper from "@/components/simple-pdf-wrapper"

export default function FastSignPageSimple() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [documentUrl, setDocumentUrl] = useState<string>("")
  const [documentId, setDocumentId] = useState<string>("")
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [numPages, setNumPages] = useState<number>(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleFileSelect = (file: File) => {
    if (file.type !== 'application/pdf') {
      setUploadError('Por favor selecciona un archivo PDF')
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      setUploadError('El tamaño del archivo debe ser menor a 50MB')
      return
    }

    setUploadedFile(file)
    setUploadError(null)
    uploadDocument(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const uploadDocument = async (file: File) => {
    setIsUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(error || 'Upload failed')
      }

      const result = await response.json()
      setDocumentUrl(result.url)
      setDocumentId(result.path)
      
      toast({
        title: "Documento subido exitosamente",
        description: "Ahora puedes ver tu documento.",
      })
    } catch (error) {
      console.error('Upload error:', error)
      setUploadError('Error al subir el documento. Por favor intenta de nuevo.')
      setUploadedFile(null)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteDocument = () => {
    setUploadedFile(null)
    setDocumentUrl("")
    setDocumentId("")
    setUploadError(null)
    setNumPages(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const onDocumentLoadSuccess = (pdf: any) => {
    setNumPages(pdf.numPages)
  }

  // If no document is uploaded, show upload interface
  if (!uploadedFile || !documentUrl) {
    return (
      <div className="flex h-full" style={{ backgroundColor: '#F8F9FB' }}>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-2xl w-full">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Fast Sign</h1>
              <p className="text-lg text-gray-600">
                Sube un documento y agrega tu firma de manera rápida y fácil
              </p>
            </div>

            {uploadError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{uploadError}</p>
              </div>
            )}

            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileChange}
                disabled={isUploading}
              />

              {isUploading ? (
                <div className="flex flex-col items-center">
                  <svg className="animate-spin h-12 w-12 text-blue-500 mb-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <p className="text-lg font-medium text-gray-900 mb-2">Subiendo documento...</p>
                  <p className="text-sm text-gray-500">Por favor espera mientras procesamos tu archivo</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Upload className="h-16 w-16 text-gray-400 mb-4" />
                  <p className="text-xl font-medium text-gray-900 mb-2">
                    Arrastra tu PDF aquí o haz clic para navegar
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    Admite archivos PDF de hasta 50MB
                  </p>
                  <div className="flex items-center space-x-2 text-xs text-gray-400">
                    <FileText className="h-4 w-4" />
                    <span>Solo documentos PDF</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right sidebar placeholder */}
        <div 
          className="w-80 border-l border-border flex flex-col shadow-lg" 
          style={{ backgroundColor: '#FFFFFF' }}
        >
          <div className="p-6 text-center text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>Sube un documento para comenzar</p>
          </div>
        </div>
      </div>
    )
  }

  // Show simple document viewer
  return (
    <div className="flex h-full">
      {/* PDF Viewer */}
      <div className="flex-1" style={{ backgroundColor: '#F8F9FB' }}>
        <div className="p-4 border-b bg-white flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold">Fast Sign</h1>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <FileText className="h-4 w-4" />
              <span>{uploadedFile.name}</span>
              {numPages > 0 && <span>({numPages} páginas)</span>}
            </div>
          </div>
          <button
            onClick={handleDeleteDocument}
            className="flex items-center space-x-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Eliminar documento y empezar de nuevo"
          >
            <Trash2 className="h-4 w-4" />
            <span className="text-sm">Eliminar</span>
          </button>
        </div>

        <div className="h-full p-4">
          <SimplePdfWrapper
            documentUrl={documentUrl}
            onLoadSuccess={onDocumentLoadSuccess}
          >
            {/* This is where PDF pages would be rendered */}
          </SimplePdfWrapper>
        </div>
      </div>

      {/* Right Sidebar */}
      <div 
        className="w-80 border-l border-border flex flex-col shadow-lg" 
        style={{ backgroundColor: '#FFFFFF' }}
      >
        <div className="p-4 border-b border-border">
          <h1 className="text-lg font-semibold text-foreground truncate mb-2" title={uploadedFile.name}>
            {uploadedFile.name}
          </h1>
          <div className="flex items-center justify-between mb-4">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Documento Fast Sign
            </span>
            <span className="text-xs text-muted-foreground">
              {numPages} páginas
            </span>
          </div>

          <div className="space-y-3">
            <button
              className="w-full inline-flex items-center justify-center px-4 py-3 shadow-sm text-sm font-medium rounded-lg text-white transition-colors"
              style={{ backgroundColor: '#0d2340' }}
              onClick={() => {
                toast({
                  title: "Función próximamente",
                  description: "La funcionalidad de firma estará disponible pronto.",
                })
              }}
            >
              Agregar Firma
            </button>

            <button
              className="w-full inline-flex items-center justify-center px-4 py-3 shadow-sm text-sm font-medium rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              onClick={() => {
                window.open(documentUrl, '_blank')
              }}
            >
              <Upload className="h-4 w-4 mr-2" />
              Abrir en Nueva Pestaña
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4 flex-1">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Detalles del Documento</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center">
                <FileText className="h-4 w-4 mr-2" />
                <span>{uploadedFile.name}</span>
              </div>
              <div className="flex items-center">
                <span className="mr-2">📄</span>
                <span>{numPages} páginas</span>
              </div>
              <div className="flex items-center">
                <span className="mr-2">💾</span>
                <span>{(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
