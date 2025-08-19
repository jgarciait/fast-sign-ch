"use client"

import React, { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DatePicker } from "@/components/ui/date-picker"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { 
  Truck, 
  Clock, 
  MapPin, 
  Phone, 
  User,
  Users,
  FileText, 
  MessageCircle,
  Map,
  PenTool,
  AlertTriangle,
  X,
  CheckCircle,
  Info,
  ArrowRight
} from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

import ChoferSelector from "./chofer-selector"
import AssignmentSignatureMappingModal from "./assignment-signature-mapping-modal"
import { createAssignment } from "@/app/actions/assignment-actions"
import type { CreateAssignmentRequest, AssignmentSignatureMapping } from "@/types/assignment-types"

interface AssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  documentId: string
  documentName?: string
  onAssignmentCreated?: (assignmentId: string) => void
}

export default function AssignmentModal({
  isOpen,
  onClose,
  documentId,
  documentName = "Documento",
  onAssignmentCreated
}: AssignmentModalProps) {
  const [activeTab, setActiveTab] = useState("info")
  const [loading, setLoading] = useState(false)
  
  // Form data
  const [formData, setFormData] = useState<CreateAssignmentRequest>({
    document_id: documentId,
    assigned_to_user_id: '',
    title: `Conduce - ${documentName}`,
    description: '',
    delivery_address: '',
    client_name: '',
    client_contact: '',
    expected_delivery_date: '',
    due_date: '',
    priority: 'normal',
    requires_chofer_signature: true,
    requires_client_signature: true,
  })

  const [selectedChoferName, setSelectedChoferName] = useState<string>("")
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<Date>()
  const [dueDate, setDueDate] = useState<Date>()
  
  // Signature mapping state
  const [mappingModalOpen, setMappingModalOpen] = useState(false)
  const [signatureMappings, setSignatureMappings] = useState<AssignmentSignatureMapping[]>([])
  const [documentUrl, setDocumentUrl] = useState<string | null>(null)
  const [tempSignatureFields, setTempSignatureFields] = useState<any[]>([])

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({
        ...prev,
        document_id: documentId,
        title: `Conduce - ${documentName}`,
      }))
      setActiveTab("info")
      loadDocumentUrl()
    } else {
      // Reset form when modal closes
      setFormData({
        document_id: documentId,
        assigned_to_user_id: '',
        title: `Conduce - ${documentName}`,
        description: '',
        delivery_address: '',
        client_name: '',
        client_contact: '',
        expected_delivery_date: '',
        due_date: '',
        priority: 'normal',
        requires_chofer_signature: true,
        requires_client_signature: true,
      })
      setSelectedChoferName("")
      setExpectedDeliveryDate(undefined)
      setDueDate(undefined)
      setSignatureMappings([])
      setDocumentUrl(null)
      setTempSignatureFields([])
    }
  }, [isOpen, documentId, documentName])

  const loadDocumentUrl = async () => {
    try {
      const response = await fetch(`/api/documents/${documentId}`)
      if (response.ok) {
        const data = await response.json()
        console.log('Document data:', data) // Debug log
        
        if (data.file_path || data.file_url) {
          // Use the public URL if available, otherwise use the download endpoint
          const url = data.file_url || `/api/documents/${documentId}/download`
          setDocumentUrl(url)
          console.log('Document URL set:', url) // Debug log
        } else {
          console.warn('No file_path or file_url in document response')
        }
      } else {
        console.error('Failed to fetch document:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Error loading document URL:', error)
    }
  }

  const handleInputChange = (field: keyof CreateAssignmentRequest, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleChoferSelect = (choferId: string, choferName?: string) => {
    setFormData(prev => ({
      ...prev,
      assigned_to_user_id: choferId
    }))
    setSelectedChoferName(choferName || "")
  }

  const handleDateSelect = (field: 'expected_delivery_date' | 'due_date', date: Date | undefined) => {
    if (field === 'expected_delivery_date') {
      setExpectedDeliveryDate(date)
      setFormData(prev => ({
        ...prev,
        expected_delivery_date: date ? format(date, 'yyyy-MM-dd') : ''
      }))
    } else {
      setDueDate(date)
      setFormData(prev => ({
        ...prev,
        due_date: date ? date.toISOString() : ''
      }))
    }
  }

  const handleOpenSignatureMapping = () => {
    if (!documentUrl) {
      toast.error('El documento no está disponible para mapeo. Intente de nuevo en unos segundos.')
      // Retry loading document URL
      loadDocumentUrl()
      return
    }
    console.log('Opening signature mapping modal with URL:', documentUrl)
    setMappingModalOpen(true)
  }

  const handleSignatureMappingSaved = (mappings: AssignmentSignatureMapping[]) => {
    setSignatureMappings(mappings)
    toast.success('Mapeo de firmas guardado correctamente')
  }

  const handleTempSignatureFieldsSaved = (fields: any[]) => {
    setTempSignatureFields(fields)
    toast.success('Configuración de firmas guardada')
  }

  const handleSubmit = async () => {
    // Basic validation
    if (!formData.assigned_to_user_id) {
      toast.error("Debe seleccionar un chofer")
      return
    }

    if (!formData.title?.trim()) {
      toast.error("El título es requerido")
      return
    }

    setLoading(true)
    
    try {
      const result = await createAssignment(formData)
      
      if (result.success && result.data) {
        // Save temporary signature mapping if exists
        if (tempSignatureFields.length > 0) {
          await saveTempSignatureMapping(result.data.id)
        }
        
        toast.success(`Documento asignado exitosamente a ${selectedChoferName}`)
        onAssignmentCreated?.(result.data.id)
        onClose()
      } else {
        toast.error(result.error || "Error al crear la asignación")
      }
    } catch (error) {
      console.error("Error creating assignment:", error)
      toast.error("Error inesperado al crear la asignación")
    } finally {
      setLoading(false)
    }
  }

  // Wizard flow logic
  const isBasicInfoComplete = () => {
    return formData.assigned_to_user_id && 
           formData.title?.trim() &&
           formData.delivery_address?.trim() &&
           formData.client_name?.trim()
  }

  const requiresSignatureMapping = () => {
    return formData.requires_chofer_signature || formData.requires_client_signature
  }

  const hasSignatureMapping = () => {
    return signatureMappings.length > 0 || tempSignatureFields.length > 0
  }

  const getWizardStep = () => {
    if (!isBasicInfoComplete()) {
      return 'basic-info'
    }
    if (requiresSignatureMapping() && !hasSignatureMapping()) {
      return 'signature-mapping'
    }
    return 'ready-to-create'
  }

  const handleWizardNext = () => {
    const step = getWizardStep()
    
    if (step === 'basic-info') {
      // Go to signatures tab
      setActiveTab('signatures')
    } else if (step === 'signature-mapping') {
      // Open signature mapping modal
      handleOpenSignatureMapping()
    } else if (step === 'ready-to-create') {
      // Create assignment
      handleSubmit()
    }
  }

  const getWizardButtonText = () => {
    const step = getWizardStep()
    
    if (step === 'basic-info') {
      return 'Siguiente'
    } else if (step === 'signature-mapping') {
      return 'Configurar Firmas'
    } else {
      return 'Crear Asignación'
    }
  }

  const getWizardButtonIcon = () => {
    const step = getWizardStep()
    
    if (step === 'basic-info') {
      return <ArrowRight className="h-4 w-4 mr-2" />
    } else if (step === 'signature-mapping') {
      return <MapPin className="h-4 w-4 mr-2" />
    } else {
      return <CheckCircle className="h-4 w-4 mr-2" />
    }
  }

  const saveTempSignatureMapping = async (assignmentId: string) => {
    try {
      // Convert signature fields to mapping requests
      const mappingRequests = tempSignatureFields.map((field, index) => {
        // Determine signature type based on requirements and order
        let signatureType: 'chofer' | 'client' = 'chofer'
        
        if (formData.requires_chofer_signature && formData.requires_client_signature) {
          // If both are required, first is chofer, second is client
          signatureType = index === 0 ? 'chofer' : 'client'
        } else if (formData.requires_client_signature) {
          signatureType = 'client'
        }

        return {
          assignment_id: assignmentId,
          signature_type: signatureType,
          page_number: field.page,
          x_coordinate: field.relativeX,
          y_coordinate: field.relativeY,
          width: field.relativeWidth,
          height: field.relativeHeight,
          is_required: true,
          label: `Firma ${signatureType === 'chofer' ? 'del Chofer' : 'del Cliente'}`,
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

      console.log('✅ Temporary signature mapping saved after assignment creation')
      
    } catch (error) {
      console.error('Error saving temporary signature mapping:', error)
      // Don't fail the whole process, just log the error
      toast.error('La asignación se creó correctamente, pero hubo un error al guardar el mapeo de firmas')
    }
  }

  const canSubmit = formData.assigned_to_user_id && formData.title?.trim()
  const wizardStep = getWizardStep()
  const canProceed = wizardStep !== 'basic-info' || isBasicInfoComplete()

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        console.log('🔴 ASSIGNMENT MODAL: Dialog close triggered')
        onClose()
      }
    }}>
      <DialogContent className="w-[95vw] max-w-4xl h-[95vh] max-h-[600px] sm:max-h-[700px] md:max-h-[800px] lg:max-h-[90vh] flex flex-col overflow-hidden m-2 sm:m-6">
        <DialogHeader className="flex-shrink-0 pb-2">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Truck className="h-5 w-5 text-green-600" />
              <span className="text-lg">Asignar Documento a Chofer</span>
            </div>

          </DialogTitle>
          <DialogDescription className="text-sm">
            Crear un nuevo conduce (asignación de entrega) para el documento: <strong>{documentName}</strong>
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 flex-shrink-0">
            <TabsTrigger value="info" className="flex items-center space-x-1 text-xs sm:text-sm">
              <Info className="h-4 w-4" />
              <span>Información</span>
            </TabsTrigger>
            <TabsTrigger value="signatures" className="flex items-center space-x-1 text-xs sm:text-sm">
              <PenTool className="h-4 w-4" />
              <span>Firmas</span>
            </TabsTrigger>
            <TabsTrigger value="map" className="flex items-center space-x-1 text-xs sm:text-sm">
              <Map className="h-4 w-4" />
              <span>Mapa</span>
            </TabsTrigger>
            <TabsTrigger value="comments" className="flex items-center space-x-1 text-xs sm:text-sm">
              <MessageCircle className="h-4 w-4" />
              <span>Comentarios</span>
            </TabsTrigger>
          </TabsList>

          {/* Information Tab */}
          <TabsContent value="info" className="flex-1 overflow-y-auto space-y-4 mt-4 pr-1">
            {/* Assignment Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>Detalles de la Asignación</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Título del Conduce *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => handleInputChange('title', e.target.value)}
                      placeholder="Ej: Conduce - Entrega medicinas"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Prioridad</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value) => handleInputChange('priority', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                            <span>Baja</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="normal">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                            <span>Normal</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="high">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                            <span>Alta</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="urgent">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 rounded-full bg-red-400"></div>
                            <span>Urgente</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descripción / Instrucciones</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Instrucciones especiales para la entrega..."
                    className="min-h-20"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Chofer Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <User className="h-5 w-5" />
                  <span>Selección de Chofer</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChoferSelector
                  selectedChoferId={formData.assigned_to_user_id}
                  onChoferSelect={handleChoferSelect}
                  placeholder="Seleccionar chofer para esta entrega..."
                />
              </CardContent>
            </Card>

            {/* Delivery Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <MapPin className="h-5 w-5" />
                  <span>Información de Entrega</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="delivery_address">Dirección de Entrega</Label>
                  <Textarea
                    id="delivery_address"
                    value={formData.delivery_address}
                    onChange={(e) => handleInputChange('delivery_address', e.target.value)}
                    placeholder="Dirección completa de entrega..."
                    className="min-h-16"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="client_name">Nombre del Cliente</Label>
                    <Input
                      id="client_name"
                      value={formData.client_name}
                      onChange={(e) => handleInputChange('client_name', e.target.value)}
                      placeholder="Nombre completo del cliente"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="client_contact">Contacto del Cliente</Label>
                    <Input
                      id="client_contact"
                      value={formData.client_contact}
                      onChange={(e) => handleInputChange('client_contact', e.target.value)}
                      placeholder="Teléfono o email"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Fecha Esperada de Entrega</Label>
                    <DatePicker
                      date={expectedDeliveryDate}
                      onDateChange={(date) => handleDateSelect('expected_delivery_date', date)}
                      placeholder="Seleccionar fecha"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Fecha Límite (Opcional)</Label>
                    <DatePicker
                      date={dueDate}
                      onDateChange={(date) => handleDateSelect('due_date', date)}
                      placeholder="Fecha límite"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Signature Requirements */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <PenTool className="h-5 w-5" />
                  <span>Requisitos de Firma</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="requires_chofer_signature"
                      checked={formData.requires_chofer_signature}
                      onChange={(e) => handleInputChange('requires_chofer_signature', e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="requires_chofer_signature">Firma del Chofer Requerida</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="requires_client_signature"
                      checked={formData.requires_client_signature}
                      onChange={(e) => handleInputChange('requires_client_signature', e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="requires_client_signature">Firma del Cliente Requerida</Label>
                  </div>
                </div>

                {(formData.requires_chofer_signature || formData.requires_client_signature) && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <div className="flex items-start space-x-2">
                      <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                      <div className="text-sm text-blue-700">
                        <p className="font-medium">Configuración de Firmas</p>
                        <p>Podrás configurar la ubicación exacta de las firmas en la pestaña "Firmas" después de crear la asignación.</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Signatures Tab */}
          <TabsContent value="signatures" className="flex-1 overflow-y-auto space-y-4 pr-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <PenTool className="h-5 w-5" />
                  <span>Configuración de Firmas</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Signature Requirements Summary */}
                <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                  <div className="flex items-center space-x-2 mb-2">
                    <Info className="h-4 w-4 text-gray-600" />
                    <span className="font-medium text-gray-900">Firmas Requeridas</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    {formData.requires_chofer_signature && (
                      <div className="flex items-center space-x-2 text-blue-700">
                        <User className="h-3 w-3" />
                        <span>Firma del Chofer</span>
                      </div>
                    )}
                    {formData.requires_client_signature && (
                      <div className="flex items-center space-x-2 text-green-700">
                        <Users className="h-3 w-3" />
                        <span>Firma del Cliente</span>
                      </div>
                    )}
                    {!formData.requires_chofer_signature && !formData.requires_client_signature && (
                      <span className="text-gray-500">No se requieren firmas</span>
                    )}
                  </div>
                </div>

                {/* Mapping Status and Actions */}
                {(formData.requires_chofer_signature || formData.requires_client_signature) && (
                  <div className="space-y-3">
                    {(signatureMappings.length > 0 || tempSignatureFields.length > 0) ? (
                      <div className="bg-green-50 border border-green-200 rounded-md p-3">
                        <div className="flex items-center space-x-2 mb-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-green-900">Mapeo Configurado</span>
                        </div>
                        <p className="text-sm text-green-700 mb-3">
                          Se han configurado {Math.max(signatureMappings.length, tempSignatureFields.length)} campo(s) de firma en el documento.
                        </p>
                        <Button 
                          onClick={handleOpenSignatureMapping}
                          variant="outline"
                          size="sm"
                          className="w-full border-green-300 text-green-700 hover:bg-green-50"
                        >
                          <MapPin className="h-4 w-4 mr-2" />
                          Editar Mapeo de Firmas
                        </Button>
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                        <div className="flex items-center space-x-2 mb-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <span className="font-medium text-amber-900">Mapeo Pendiente</span>
                        </div>
                        <p className="text-sm text-amber-700 mb-3">
                          Configure dónde aparecerán los campos de firma en el documento antes de crear la asignación.
                        </p>
                        <Button 
                          onClick={handleOpenSignatureMapping}
                          className="w-full bg-blue-600 hover:bg-blue-700"
                          disabled={!documentUrl}
                        >
                          <MapPin className="h-4 w-4 mr-2" />
                          Configurar Mapeo de Firmas
                        </Button>
                        {!documentUrl && (
                          <p className="text-xs text-gray-500 mt-2 text-center">
                            Cargando documento...
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Info when no signatures required */}
                {!formData.requires_chofer_signature && !formData.requires_client_signature && (
                  <div className="text-center py-6 text-gray-500">
                    <PenTool className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                    <p className="text-base font-medium">No se Requieren Firmas</p>
                    <p className="text-sm mt-1">Esta asignación no requiere firmas digitales. Puedes habilitarlas en la pestaña "Información".</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Map Tab */}
          <TabsContent value="map" className="flex-1 overflow-y-auto space-y-4 pr-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Map className="h-5 w-5" />
                  <span>Seguimiento GPS</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-6 text-gray-500">
                  <Map className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-base font-medium">Mapa Disponible Después de Crear</p>
                  <p className="text-sm mt-1">El seguimiento GPS y la visualización del mapa estarán disponibles una vez que se inicie la entrega.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Comments Tab */}
          <TabsContent value="comments" className="flex-1 overflow-y-auto space-y-4 pr-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <MessageCircle className="h-5 w-5" />
                  <span>Sistema de Comentarios</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-6 text-gray-500">
                  <MessageCircle className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-base font-medium">Comentarios Disponibles Después de Crear</p>
                  <p className="text-sm mt-1">Los comentarios y comunicación con el chofer estarán disponibles una vez que se cree la asignación.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Separator className="flex-shrink-0" />

        <DialogFooter className="flex-shrink-0 flex flex-col sm:flex-row gap-2 pt-4">
          <div className="flex items-center space-x-2 mb-2 sm:mb-0 order-2 sm:order-1">
            {wizardStep === 'basic-info' && !isBasicInfoComplete() && (
              <div className="flex items-center space-x-1 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-xs sm:text-sm">Completa la información básica</span>
              </div>
            )}
            {wizardStep === 'signature-mapping' && (
              <div className="flex items-center space-x-1 text-blue-600">
                <Info className="h-4 w-4" />
                <span className="text-xs sm:text-sm">Configure el mapeo de firmas</span>
              </div>
            )}
            {wizardStep === 'ready-to-create' && (
              <div className="flex items-center space-x-1 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span className="text-xs sm:text-sm">Listo para crear la asignación</span>
              </div>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto order-1 sm:order-2">

            <Button 
              onClick={handleWizardNext} 
              disabled={loading || (wizardStep === 'basic-info' && !isBasicInfoComplete())}
              className={cn(
                "w-full sm:w-auto",
                wizardStep === 'ready-to-create' 
                  ? "bg-green-600 hover:bg-green-700" 
                  : "bg-blue-600 hover:bg-blue-700"
              )}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {wizardStep === 'ready-to-create' ? 'Creando...' : 'Procesando...'}
                </>
              ) : (
                <>
                  {getWizardButtonIcon()}
                  {getWizardButtonText()}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Signature Mapping Modal */}
      <AssignmentSignatureMappingModal
        isOpen={mappingModalOpen}
        onClose={() => setMappingModalOpen(false)}
        assignmentId={undefined} // No assignment ID in creation mode
        documentId={documentId}
        documentName={documentName}
        documentUrl={documentUrl || undefined}
        requiresChoferSignature={formData.requires_chofer_signature}
        requiresClientSignature={formData.requires_client_signature}
        onMappingSaved={handleSignatureMappingSaved}
        onTempFieldsSaved={handleTempSignatureFieldsSaved}
        tempMode={true}
      />
    </Dialog>
  )
}
