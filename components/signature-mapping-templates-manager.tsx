"use client"

import React, { useState, useEffect } from "react"
import { Edit, Trash2, Plus, Eye, FileText } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

interface SignatureMappingTemplate {
  id: string
  name: string
  description?: string
  created_by: string
  created_at: string
  updated_at: string
  is_active: boolean
  document_mapping_id: string
  signature_fields: any[]
  creator: {
    full_name: string
    email: string
  }
}

export default function SignatureMappingTemplatesManager() {
  const [templates, setTemplates] = useState<SignatureMappingTemplate[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  // Load templates when component mounts
  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/signature-mapping-templates')
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates || [])
      } else {
        toast.error("Error al cargar las plantillas")
      }
    } catch (error) {
      console.error("Error loading templates:", error)
      toast.error("Error al cargar las plantillas")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteTemplate = async (templateId: string, templateName: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar la plantilla "${templateName}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/signature-mapping-templates/${templateId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success("Plantilla eliminada exitosamente")
        setTemplates(prev => prev.filter(t => t.id !== templateId))
      } else {
        const errorData = await response.json()
        toast.error(`Error al eliminar la plantilla: ${errorData.error}`)
      }
    } catch (error) {
      console.error("Error deleting template:", error)
      toast.error("Error inesperado al eliminar la plantilla")
    }
  }

  const handleEditTemplate = (template: SignatureMappingTemplate) => {
    // Get the document ID for this template's mapping
    const getDocumentId = async () => {
      try {
        const response = await fetch(`/api/signature-mapping-templates/${template.id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'get_document_id' })
        })

        if (response.ok) {
          const data = await response.json()
          if (data.document_id) {
            // Open in new tab to avoid table refresh
            window.open(`/fast-sign/edit/${data.document_id}?template=${template.id}&mode=mapping`, '_blank')
          } else {
            toast.error("No se pudo encontrar el documento asociado a esta plantilla")
          }
        } else {
          toast.error("Error al obtener información de la plantilla")
        }
      } catch (error) {
        console.error("Error getting document ID:", error)
        toast.error("Error al abrir la plantilla para edición")
      }
    }

    getDocumentId()
  }

  const handleCreateTemplate = () => {
    // Navigate to send-to-sign form to create a new template
    router.push('/fast-sign?mode=create-template')
  }

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Plantillas de Mapeo de Firmas</h3>
          <p className="text-sm text-gray-600">
            Gestiona plantillas que definen dónde van las firmas en los documentos
          </p>
        </div>
        <Button onClick={handleCreateTemplate}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Plantilla
        </Button>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Cargando plantillas...</span>
        </div>
      ) : templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-gray-300 mb-4" />
            <h4 className="text-lg font-medium mb-2">No hay plantillas de mapeo guardadas</h4>
            <p className="text-gray-600 text-center mb-4 max-w-md">
              Las plantillas de mapeo te permiten definir posiciones de firma reutilizables para documentos similares.
            </p>
            <Button onClick={handleCreateTemplate}>
              <Plus className="h-4 w-4 mr-2" />
              Crear Primera Plantilla
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    {template.description && (
                      <CardDescription className="mt-1">{template.description}</CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Template Info */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Campos de firma:</span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                        {template.signature_fields?.length || 0}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      <div>Creado por: {template.creator.full_name || template.creator.email}</div>
                      <div>Fecha: {new Date(template.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditTemplate(template)}
                      className="flex items-center space-x-1"
                    >
                      <Edit className="h-3 w-3" />
                      <span>Editar</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteTemplate(template.id, template.name)}
                      className="flex items-center space-x-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Eliminar</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Information Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <h3 className="text-lg font-medium text-blue-900 mb-2">Acerca de las Plantillas de Mapeo</h3>
          <div className="text-blue-800 space-y-2 text-sm">
            <p>
              Las plantillas de mapeo te permiten definir posiciones específicas donde las firmas deben ir en documentos similares.
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Define una vez, reutiliza múltiples veces</li>
              <li>Posicionamiento preciso de campos de firma</li>
              <li>Ahorra tiempo en documentos repetitivos</li>
              <li>Comparte plantillas con otros usuarios</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
