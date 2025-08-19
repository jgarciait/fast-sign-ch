"use client"

import React, { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { 
  PenTool,
  Save,
  X,
  MapPin,
  User,
  Users,
  AlertCircle
} from "lucide-react"
import { toast } from "sonner"

import PdfAnnotationEditor from "./pdf-annotation-editor"
import type { AssignmentSignatureMapping } from "@/types/assignment-types"

interface AssignmentSignatureMappingModalProps {
  isOpen: boolean
  onClose: () => void
  assignmentId?: string
  documentId: string
  documentName?: string
  documentUrl?: string
  requiresChoferSignature: boolean
  requiresClientSignature: boolean
  onMappingSaved?: (mappings: AssignmentSignatureMapping[]) => void
  onTempFieldsSaved?: (fields: any[]) => void
  tempMode?: boolean
}

export default function AssignmentSignatureMappingModal({
  isOpen,
  onClose,
  assignmentId,
  documentId,
  documentName = "Documento",
  documentUrl,
  requiresChoferSignature,
  requiresClientSignature,
  onMappingSaved,
  onTempFieldsSaved,
  tempMode = false
}: AssignmentSignatureMappingModalProps) {
  const [loading, setLoading] = useState(false)
  const [signatureFields, setSignatureFields] = useState<any[]>([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setSignatureFields([])
      setHasUnsavedChanges(false)
    }
  }, [isOpen])

  const handleSaveMapping = async () => {
    if (signatureFields.length === 0) {
      toast.error("Debe agregar al menos un campo de firma")
      return
    }

    setLoading(true)
    try {
      if (tempMode || !assignmentId) {
        // In temp mode, just save the fields locally
        onTempFieldsSaved?.(signatureFields)
        setHasUnsavedChanges(false)
        onClose()
        return
      }

      // Normal mode - save to database
      const mappingRequests = signatureFields.map((field, index) => {
        let signatureType: 'chofer' | 'client' = 'chofer'
        
        if (requiresChoferSignature && requiresClientSignature) {
          signatureType = index === 0 ? 'chofer' : 'client'
        } else if (requiresClientSignature) {
          signatureType = 'client'
        }

        return {
          assignment_id: assignmentId,
          signature_type: signatureType,
          page_number: field.page,
          x_coordinate: field.relativeX || 0.5,
          y_coordinate: field.relativeY || 0.5,
          width: field.relativeWidth || 0.15,
          height: field.relativeHeight || 0.08,
          is_required: true,
          label: field.label || `Firma ${signatureType === 'chofer' ? 'del Chofer' : 'del Cliente'}`,
          placeholder_text: `Firma aquí - ${signatureType === 'chofer' ? 'Chofer' : 'Cliente'}`
        }
      })

      const response = await fetch(`/api/assignments/${assignmentId}/signature-mapping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mappings: mappingRequests }),
      })

      if (!response.ok) {
        throw new Error('Failed to save signature mapping')
      }

      const result = await response.json()
      onMappingSaved?.(result.mappings)
      toast.success('Mapeo de firmas guardado correctamente')
      setHasUnsavedChanges(false)
      onClose()

    } catch (error) {
      console.error('Error saving signature mapping:', error)
      toast.error('Error al guardar el mapeo de firmas')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (confirm('¿Descartas los cambios sin guardar?')) {
        onClose()
      }
    } else {
      onClose()
    }
  }

  const requiredSignaturesText = () => {
    const required = []
    if (requiresChoferSignature) required.push('Chofer')
    if (requiresClientSignature) required.push('Cliente')
    return required.join(' y ')
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0">
        <div className="h-full flex flex-col">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <PenTool className="h-5 w-5 text-blue-600" />
                <span>Mapeo de Firmas - {documentName}</span>
                {hasUnsavedChanges && (
                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                    Cambios sin guardar
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-6 w-6 p-0 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
            <DialogDescription>
              <div className="space-y-2">
                <p>Haz clic en el documento para colocar los campos de firma para: <strong>{requiredSignaturesText()}</strong></p>
                
                <div className="flex items-center space-x-4 text-sm">
                  {requiresChoferSignature && (
                    <div className="flex items-center space-x-1">
                      <User className="h-4 w-4 text-blue-600" />
                      <span>Firma del Chofer</span>
                    </div>
                  )}
                  {requiresClientSignature && (
                    <div className="flex items-center space-x-1">
                      <Users className="h-4 w-4 text-green-600" />
                      <span>Firma del Cliente</span>
                    </div>
                  )}
                </div>

                {signatureFields.length > 0 && (
                  <div className="flex items-center space-x-1 text-sm text-green-600">
                    <MapPin className="h-4 w-4" />
                    <span>{signatureFields.length} campo(s) de firma colocados</span>
                  </div>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <PdfAnnotationEditor
              documentUrl={documentUrl || `/api/pdf/${documentId}`}
              documentName={documentName || ''}
              documentId={documentId || ''}
              onBack={() => {}}
              onSave={async (annotations) => {
                // EXACT COPY from send-to-sign-form.tsx logic
                const signatureAnnotations = annotations.filter(a => a.type === "signature")
                setSignatureFields(signatureAnnotations)
                setHasUnsavedChanges(signatureAnnotations.length > 0)
              }}
              onSend={() => {}}
              onContinue={() => {}}
              initialAnnotations={[]}
              mappingMode={true}
              readOnly={false}
              hideSaveButton={true}
              showMappingToggle={false}
              onPdfReady={() => {}}
              onPageDimensionsReady={() => {}}
              previewMode={false}
            />
          </div>
          <DialogFooter className="p-4 border-t">
            <Button 
              onClick={handleSaveMapping} 
              disabled={loading || signatureFields.length === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Mapeo ({signatureFields.length})
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
