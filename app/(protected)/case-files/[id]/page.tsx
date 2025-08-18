'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ArrowLeft, FileText, Calendar, Search, Trash2, Edit, Save, X, Upload } from 'lucide-react'
import { getFileRecordById, getDocumentsByFileRecord, deleteFileRecord, updateFileRecord } from '@/app/actions/filing-system-actions'
import { useToast } from '@/hooks/use-toast'
import CaseFileUploadZone from '@/components/case-file-upload-zone'
import CompactCaseFileDocuments from '@/components/compact-case-file-documents'

interface FileRecord {
  id: string
  created_by: string
  sistema_id: string
  valores_json: any
  created_at: string
  updated_at: string
  customer_id?: string | null
  assigned_to_user_id?: string | null
  filing_systems?: {
    nombre: string
    esquema_json: {
      indices: Array<{
        clave: string
        etiqueta: string
        tipo_dato: string
        obligatorio: boolean
        opciones_enum?: string[]
      }>
    }
  }
}

interface Document {
  id: string
  file_name: string
  file_path: string
  created_at: string
  updated_at: string
  status?: string
}

export default function CaseFileDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const [fileRecord, setFileRecord] = useState<FileRecord | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editFormData, setEditFormData] = useState<any>({})
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadCaseFileData()
  }, [resolvedParams.id])

  // Filter documents based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredDocuments(documents)
    } else {
      const filtered = documents.filter(doc =>
        doc.file_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredDocuments(filtered)
    }
  }, [searchTerm, documents])

  const loadCaseFileData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load case file record and linked documents in parallel
      const [recordResult, documentsResult] = await Promise.all([
        getFileRecordById(resolvedParams.id),
        getDocumentsByFileRecord(resolvedParams.id)
      ])

      if (recordResult.error) {
        setError(recordResult.error)
        return
      }

      if (!recordResult.record) {
        setError("Case file not found")
        return
      }

      setFileRecord(recordResult.record)

      if (documentsResult.error) {
        console.warn("Error loading documents:", documentsResult.error)
      } else {
        console.log("Loaded documents for case file:", documentsResult.documents)
        setDocuments(documentsResult.documents)
        setFilteredDocuments(documentsResult.documents)
      }
    } catch (err) {
      setError("Failed to load case file data")
      console.error("Error loading case file:", err)
    } finally {
      setLoading(false)
    }
  }

  const renderFieldValue = (field: any, value: any) => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-gray-400">—</span>
    }

    switch (field.tipo_dato) {
      case 'bool':
        return (
          <Badge variant={value ? 'default' : 'secondary'} className="text-xs">
            {value ? 'Yes' : 'No'}
          </Badge>
        )
      case 'fecha':
        return new Date(value).toLocaleDateString()
      default:
        return String(value)
    }
  }

  const handleEditDocument = (documentId: string) => {
    // Open in new tab to avoid table refresh
    window.open(`/fast-sign/edit/${documentId}`, '_blank')
  }

  const handleDocumentAction = async (action: string, documentId: string) => {
    switch (action) {
      case 'view':
        window.open(`/view/${documentId}`, '_blank')
        break
      case 'download':
        window.open(`/api/pdf/${documentId}`, '_blank')
        break
      case 'edit':
        window.open(`/fast-sign/edit/${documentId}`, '_blank')
        break
      case 'unlink':
        // Handle single document unlink
        try {
          const response = await fetch(`/api/case-files/${resolvedParams.id}/bulk-unlink`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentIds: [documentId] })
          })
          
          if (response.ok) {
            toast({
              title: "Documento desvinculado",
              description: "El documento se desvinculó exitosamente del expediente.",
            })
            loadCaseFileData()
          } else {
            throw new Error('Failed to unlink document')
          }
        } catch (error) {
          toast({
            title: "Error",
            description: "No se pudo desvincular el documento.",
            variant: "destructive",
          })
        }
        break
      case 'delete':
        // Handle single document deletion
        if (confirm('¿Estás seguro que deseas eliminar este documento?')) {
          try {
            const response = await fetch(`/api/documents/${documentId}`, {
              method: 'DELETE'
            })
            
            if (response.ok) {
              toast({
                title: "Documento eliminado",
                description: "El documento se eliminó exitosamente.",
              })
              loadCaseFileData()
            } else {
              throw new Error('Failed to delete document')
            }
          } catch (error) {
            toast({
              title: "Error",
              description: "No se pudo eliminar el documento.",
              variant: "destructive",
            })
          }
        }
        break
    }
  }

  const handleBulkAction = async (action: string, documentIds: string[]) => {
    switch (action) {
      case 'unlink':
        try {
          const response = await fetch(`/api/case-files/${resolvedParams.id}/bulk-unlink`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentIds })
          })
          
          if (response.ok) {
            const result = await response.json()
            toast({
              title: "Documentos desvinculados",
              description: `${result.unlinkedCount} documentos desvinculados exitosamente.`,
            })
            loadCaseFileData()
          } else {
            throw new Error('Failed to unlink documents')
          }
        } catch (error) {
          toast({
            title: "Error",
            description: "No se pudieron desvincular los documentos.",
            variant: "destructive",
          })
        }
        break
      case 'delete':
        if (confirm(`¿Estás seguro que deseas eliminar ${documentIds.length} documentos?`)) {
          try {
            const promises = documentIds.map(docId => 
              fetch(`/api/documents/${docId}`, { method: 'DELETE' })
            )
            
            const responses = await Promise.all(promises)
            const successCount = responses.filter(r => r.ok).length
            
            if (successCount > 0) {
              toast({
                title: "Documentos eliminados",
                description: `${successCount} documentos eliminados exitosamente.`,
              })
              loadCaseFileData()
            }
            
            if (successCount < documentIds.length) {
              toast({
                title: "Advertencia",
                description: `${documentIds.length - successCount} documentos no pudieron ser eliminados.`,
                variant: "destructive",
              })
            }
          } catch (error) {
            toast({
              title: "Error",
              description: "No se pudieron eliminar los documentos.",
              variant: "destructive",
            })
          }
        }
        break
    }
  }

  const handleEditClick = () => {
    if (fileRecord) {
      console.log('=== EDIT MODAL DEBUG ===')
      console.log('File record data:', fileRecord)
      console.log('valores_json:', fileRecord.valores_json)
      console.log('Filing system indices:', fileRecord.filing_systems?.esquema_json?.indices)
      
      // Check if keys match between valores_json and filing system indices
      const valoresKeys = Object.keys(fileRecord.valores_json || {})
      const systemKeys = fileRecord.filing_systems?.esquema_json?.indices?.map(idx => idx.clave) || []
      console.log('Keys in valores_json:', valoresKeys)
      console.log('Keys in filing system:', systemKeys)
      console.log('Keys match:', valoresKeys.every(key => systemKeys.includes(key)))
      
      // Check for key mismatches and suggest mapping
      const unmatchedValoresKeys = valoresKeys.filter(key => !systemKeys.includes(key))
      const unmatchedSystemKeys = systemKeys.filter(key => !valoresKeys.includes(key))
      console.log('Unmatched valores keys:', unmatchedValoresKeys)
      console.log('Unmatched system keys:', unmatchedSystemKeys)
      
      // Initialize form data with current values - use exact keys from valores_json
      const currentData = fileRecord.valores_json || {}
      console.log('Setting edit form data:', currentData)
      setEditFormData(currentData)
      setShowEditModal(true)
    }
  }

  const handleFieldChange = (fieldKey: string, value: any) => {
    console.log(`=== FIELD CHANGE ===`)
    console.log(`Key: "${fieldKey}"`)
    console.log(`New Value: "${value}" (type: ${typeof value})`)
    console.log(`Previous Value: "${editFormData[fieldKey]}" (type: ${typeof editFormData[fieldKey]})`)
    
    setEditFormData((prev: any) => {
      const newData = {
        ...prev,
        [fieldKey]: value
      }
      console.log('Updated form data:', newData)
      console.log('Keys in updated data:', Object.keys(newData))
      console.log('=== END FIELD CHANGE ===')
      return newData
    })
  }

  const handleSaveEdit = async () => {
    if (!fileRecord) return

    console.log('=== SAVING EDIT ===')
    console.log('File record ID:', resolvedParams.id)
    console.log('Data to save:', editFormData)
    console.log('Original data:', fileRecord.valores_json)

    // Validate required fields (only 'Nombre' is required based on the display)
    const requiredFields = ['Nombre']
    const missingFields = requiredFields.filter(field => {
      const value = editFormData[field]
      return !value || (typeof value === "string" && value.trim() === "")
    })

    if (missingFields.length > 0) {
      console.log('Missing required fields:', missingFields)
      toast({
        title: "Error de Validación",
        description: `Por favor completa los campos requeridos: ${missingFields.join(", ")}`,
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    try {
      console.log('Calling updateFileRecord with:', { id: resolvedParams.id, data: editFormData })
      const result = await updateFileRecord(resolvedParams.id, editFormData)
      console.log('Update result:', result)
      
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Éxito",
          description: "Expediente actualizado exitosamente",
        })
        setShowEditModal(false)
        loadCaseFileData() // Reload the data
      }
    } catch (error) {
      console.error('Save error:', error)
      toast({
        title: "Error",
        description: "Error al actualizar el expediente. Inténtalo de nuevo.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
      console.log('=== END SAVING EDIT ===')
    }
  }

  const handleDeleteClick = () => {
    setShowDeleteModal(true)
    setDeleteConfirmText('')
  }

  const handleDeleteConfirm = async () => {
    if (deleteConfirmText.toLowerCase() !== 'eliminar') {
      toast({
        title: "Confirmación inválida",
        description: "Por favor escribe 'eliminar' para confirmar la eliminación",
        variant: "destructive",
      })
      return
    }

    setIsDeleting(true)
    try {
      const result = await deleteFileRecord(resolvedParams.id)
      
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Case file deleted",
          description: "The case file has been permanently deleted",
        })
        router.push('/case-files')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete case file. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setShowDeleteModal(false)
      setDeleteConfirmText('')
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-200 rounded-lg"></div>
            <div className="h-64 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !fileRecord) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Atrás
          </Button>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <div className="w-12 h-12 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-red-500 text-xl">⚠️</span>
          </div>
          <h3 className="text-lg font-medium text-red-900 mb-2">Error al Cargar el Expediente</h3>
          <p className="text-red-700 mb-4">{error}</p>
          <Button variant="outline" onClick={() => router.push('/case-files')}>
            Volver a Expedientes
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Atrás
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Detalles del Expediente</h1>
            <p className="text-sm text-gray-600 mt-1">
              {fileRecord.filing_systems?.nombre} • Creado {new Date(fileRecord.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleEditClick}
            className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            <Edit className="h-4 w-4" />
            Editar Expediente
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteClick}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar Expediente
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Case File Data Card */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Información del Expediente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {fileRecord.filing_systems?.esquema_json?.indices?.map((field: any) => (
              <div key={field.clave} className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  {field.etiqueta}
                  {field.obligatorio && <span className="text-red-500 ml-1">*</span>}
                </label>
                <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md border">
                  {renderFieldValue(field, fileRecord.valores_json?.[field.clave])}
                </div>
              </div>
            ))}
            
            {/* Metadata */}
            <div className="pt-4 border-t border-gray-200 space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="h-4 w-4" />
                <span>Creado: {new Date(fileRecord.created_at).toLocaleString()}</span>
              </div>
              {fileRecord.updated_at !== fileRecord.created_at && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="h-4 w-4" />
                  <span>Actualizado: {new Date(fileRecord.updated_at).toLocaleString()}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Compact Documents Management */}
        <CompactCaseFileDocuments
          fileRecordId={resolvedParams.id}
          onDocumentAction={handleDocumentAction}
          onBulkAction={handleBulkAction}
        />
      </div>

      {/* File Upload Zone */}
      <CaseFileUploadZone 
        caseFileId={resolvedParams.id} 
        onUploadComplete={loadCaseFileData}
      />

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Eliminar Expediente
            </DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente el expediente y todos sus datos.
              <br />
              <strong>Nota:</strong> Los documentos vinculados no serán eliminados, pero se desvincularan de este expediente.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-medium text-red-900 mb-2">Información del Expediente:</h4>
              <div className="text-sm text-red-800">
                <p><strong>Sistema de Archivos:</strong> {fileRecord?.filing_systems?.nombre}</p>
                <p><strong>Creado:</strong> {fileRecord ? new Date(fileRecord.created_at).toLocaleString() : ''}</p>
                <p><strong>Documentos Vinculados:</strong> {documents.length} documento{documents.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Escribe <strong>eliminar</strong> para confirmar:
              </label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Escribe 'eliminar' aquí"
                className="font-mono"
                disabled={isDeleting}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(false)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting || deleteConfirmText.toLowerCase() !== 'eliminar'}
              className="gap-2"
            >
              {isDeleting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Eliminar Expediente
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Case File Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-600">
              <Edit className="h-5 w-5" />
              Editar Expediente
            </DialogTitle>
            <DialogDescription>
              Actualiza la información de este expediente. Los campos requeridos están marcados con un asterisco (*).
            </DialogDescription>
          </DialogHeader>

          {fileRecord && (
            <div className="space-y-4 py-4">
              <div className="space-y-4">
                {/* Show fields directly from valores_json data, with comments at the end */}
                {(() => {
                  const entries = Object.entries(editFormData || {})
                  
                  // Separate comment fields from other fields
                  const isCommentField = (key: string) => {
                    const lowerKey = key.toLowerCase()
                    return lowerKey.includes('comentario') || lowerKey.includes('comment')
                  }
                  
                  const regularFields = entries.filter(([key]) => !isCommentField(key))
                  const commentFields = entries.filter(([key]) => isCommentField(key))
                  
                  // Combine regular fields first, then comment fields
                  const orderedFields = [...regularFields, ...commentFields]
                  
                  return orderedFields.map(([key, value]) => {
                    console.log(`Rendering field: ${key} = ${value}`)
                    
                    // Create friendly labels for the actual keys
                    const getFieldLabel = (key: string) => {
                      switch (key) {
                        case 'Nombre': return 'Nombre de Socio'
                        case 'Num_Socio': return 'Número de Socio'
                        case 'Num_Prestamo': return 'Número de Prestamo'
                        case 'comentarios': return 'Comentarios'
                        default: return key
                      }
                    }
                    
                    const isRequired = key === 'Nombre' // Only name is required based on the display
                    const isComment = isCommentField(key)
                    
                    return (
                      <div key={key} className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">
                          {getFieldLabel(key)}
                          {isRequired && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        {isComment ? (
                          <textarea
                            value={String(value || '')}
                            onChange={(e) => handleFieldChange(key, e.target.value)}
                            placeholder={`Ingresa ${getFieldLabel(key).toLowerCase()}...`}
                            disabled={isSaving}
                            className="w-full min-h-[80px] px-3 py-2 border-2 border-blue-200 focus:border-blue-500 rounded-md resize-vertical"
                            rows={3}
                          />
                        ) : (
                          <Input
                            value={String(value || '')}
                            onChange={(e) => handleFieldChange(key, e.target.value)}
                            placeholder={`Ingresa ${getFieldLabel(key).toLowerCase()}...`}
                            disabled={isSaving}
                            className="border-2 border-blue-200 focus:border-blue-500"
                          />
                        )}
                      </div>
                    )
                  })
                })()}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowEditModal(false)}
              disabled={isSaving}
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={isSaving}
              className="gap-2"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
