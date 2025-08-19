"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { CalendarIcon, User, MapPin, FileText, PenTool } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { updateAssignment } from "@/app/actions/assignment-actions"
import { getChoferes } from "@/app/actions/chofer-actions"
import type { AssignmentWithDetails } from "@/types/assignment-types"
import type { ChoferProfile } from "@/types/chofer-types"

interface EditAssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  assignment: AssignmentWithDetails | null
  onSuccess: () => void
}

export default function EditAssignmentModal({ 
  isOpen, 
  onClose, 
  assignment, 
  onSuccess 
}: EditAssignmentModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    delivery_address: "",
    client_name: "",
    client_contact: "",
    expected_delivery_date: null as Date | null,
    due_date: null as Date | null,
    priority: "normal" as "low" | "normal" | "high" | "urgent",
    status: "assigned" as "assigned" | "in_transit" | "completed" | "signed" | "cancelled",
    assigned_to_user_id: "",
    requires_chofer_signature: true,
    requires_client_signature: true
  })
  const [loading, setLoading] = useState(false)
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [dueDatePickerOpen, setDueDatePickerOpen] = useState(false)
  const [choferes, setChoferes] = useState<ChoferProfile[]>([])
  const [activeTab, setActiveTab] = useState("info")

  useEffect(() => {
    if (assignment && isOpen) {
      setFormData({
        title: assignment.title || "",
        description: assignment.description || "",
        delivery_address: assignment.delivery_address || "",
        client_name: assignment.client_name || "",
        client_contact: assignment.client_contact || "",
        expected_delivery_date: assignment.expected_delivery_date ? new Date(assignment.expected_delivery_date) : null,
        due_date: assignment.due_date ? new Date(assignment.due_date) : null,
        priority: assignment.priority || "normal",
        status: assignment.status || "assigned",
        assigned_to_user_id: assignment.assigned_to_user_id || "",
        requires_chofer_signature: assignment.requires_chofer_signature ?? true,
        requires_client_signature: assignment.requires_client_signature ?? true
      })
    }
  }, [assignment, isOpen])

  useEffect(() => {
    const loadChoferes = async () => {
      const result = await getChoferes()
      if (result.success && result.data) {
        setChoferes(result.data)
      }
    }
    if (isOpen) {
      loadChoferes()
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assignment) return

    setLoading(true)
    try {
      const updateData = {
        title: formData.title || null,
        description: formData.description || null,
        delivery_address: formData.delivery_address || null,
        client_name: formData.client_name || null,
        client_contact: formData.client_contact || null,
        expected_delivery_date: formData.expected_delivery_date?.toISOString() || null,
        due_date: formData.due_date?.toISOString() || null,
        priority: formData.priority,
        status: formData.status,
        assigned_to_user_id: formData.assigned_to_user_id || assignment.assigned_to_user_id,
        requires_chofer_signature: formData.requires_chofer_signature,
        requires_client_signature: formData.requires_client_signature
      }

      const result = await updateAssignment(assignment.id, updateData)
      
      if (result.success) {
        onSuccess()
        onClose()
      } else {
        console.error('Error updating assignment:', result.error)
        // TODO: Show user-friendly error message
      }
    } catch (error) {
      console.error('Error updating assignment:', error)
      // TODO: Show user-friendly error message
    } finally {
      setLoading(false)
    }
  }

  const handleDateSelect = (date: Date | undefined, type: 'expected' | 'due') => {
    if (type === 'expected') {
      setFormData(prev => ({
        ...prev,
        expected_delivery_date: date || null
      }))
      setDatePickerOpen(false)
    } else {
      setFormData(prev => ({
        ...prev,
        due_date: date || null
      }))
      setDueDatePickerOpen(false)
    }
  }

  if (!assignment) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Editar Entrega
          </DialogTitle>
          <p className="text-sm text-gray-600 mt-1">
            Editar asignación de entrega para el documento: {assignment?.document?.file_name || 'Sin nombre'}
          </p>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="py-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="info" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Información
            </TabsTrigger>
            <TabsTrigger value="delivery" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Entrega
            </TabsTrigger>
            <TabsTrigger value="signatures" className="flex items-center gap-2">
              <PenTool className="w-4 h-4" />
              Firmas
            </TabsTrigger>
            <TabsTrigger value="chofer" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Chofer
            </TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit} className="space-y-6">
            <TabsContent value="info" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="title" className="text-sm font-semibold text-gray-700">
                    Título del Conduce *
                  </Label>
                  <Input
                    id="title"
                    placeholder="Título descriptivo del conduce..."
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      title: e.target.value
                    }))}
                    required
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="priority" className="text-sm font-semibold text-gray-700">
                    Prioridad
                  </Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value: "low" | "normal" | "high" | "urgent") => 
                      setFormData(prev => ({ ...prev, priority: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baja</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="status" className="text-sm font-semibold text-gray-700">
                    Estado
                  </Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: "assigned" | "in_transit" | "completed" | "signed" | "cancelled") => 
                      setFormData(prev => ({ ...prev, status: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="assigned">Asignado</SelectItem>
                      <SelectItem value="in_transit">En Tránsito</SelectItem>
                      <SelectItem value="completed">Completado</SelectItem>
                      <SelectItem value="signed">Firmado</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="description" className="text-sm font-semibold text-gray-700">
                  Descripción / Instrucciones
                </Label>
                <Textarea
                  id="description"
                  placeholder="Instrucciones especiales para la entrega..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    description: e.target.value
                  }))}
                  rows={4}
                  className="min-h-[100px]"
                />
              </div>
            </TabsContent>

            <TabsContent value="chofer" className="space-y-6">
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-gray-700">
                  Asignar a Chofer ({choferes.length} disponibles)
                </Label>
                <Select
                  value={formData.assigned_to_user_id}
                  onValueChange={(value) => 
                    setFormData(prev => ({ ...prev, assigned_to_user_id: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar chofer para esta entrega..." />
                  </SelectTrigger>
                  <SelectContent>
                    {choferes.map((chofer) => (
                      <SelectItem key={chofer.user_id} value={chofer.user_id}>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          {chofer.profiles?.first_name && chofer.profiles?.last_name
                            ? `${chofer.profiles.first_name} ${chofer.profiles.last_name}`
                            : chofer.profiles?.email || 'Sin nombre'}
                          {chofer.truck_plate && (
                            <span className="text-xs text-gray-500">- {chofer.truck_plate}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="delivery" className="space-y-6">
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="delivery_address" className="text-sm font-semibold text-gray-700">
                    Dirección de Entrega
                  </Label>
                  <Textarea
                    id="delivery_address"
                    placeholder="Dirección completa de entrega..."
                    value={formData.delivery_address}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      delivery_address: e.target.value
                    }))}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="client_name" className="text-sm font-semibold text-gray-700">
                      Nombre del Cliente
                    </Label>
                    <Input
                      id="client_name"
                      placeholder="Nombre completo del cliente"
                      value={formData.client_name}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        client_name: e.target.value
                      }))}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="client_contact" className="text-sm font-semibold text-gray-700">
                      Contacto del Cliente
                    </Label>
                    <Input
                      id="client_contact"
                      placeholder="Teléfono o email"
                      value={formData.client_contact}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        client_contact: e.target.value
                      }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold text-gray-700">
                      Fecha Esperada de Entrega
                    </Label>
                    <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.expected_delivery_date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.expected_delivery_date 
                            ? format(formData.expected_delivery_date, "PPP", { locale: es })
                            : "Seleccionar fecha"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.expected_delivery_date || undefined}
                          onSelect={(date) => handleDateSelect(date, 'expected')}
                          initialFocus
                          locale={es}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-semibold text-gray-700">
                      Fecha Límite (Opcional)
                    </Label>
                    <Popover open={dueDatePickerOpen} onOpenChange={setDueDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.due_date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.due_date 
                            ? format(formData.due_date, "PPP", { locale: es })
                            : "Seleccionar fecha límite"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.due_date || undefined}
                          onSelect={(date) => handleDateSelect(date, 'due')}
                          initialFocus
                          locale={es}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="signatures" className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Requisitos de Firma</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="chofer_signature"
                      checked={formData.requires_chofer_signature}
                      onCheckedChange={(checked) => setFormData(prev => ({
                        ...prev,
                        requires_chofer_signature: !!checked
                      }))}
                    />
                    <Label 
                      htmlFor="chofer_signature" 
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Firma del Chofer Requerida
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="client_signature"
                      checked={formData.requires_client_signature}
                      onCheckedChange={(checked) => setFormData(prev => ({
                        ...prev,
                        requires_client_signature: !!checked
                      }))}
                    />
                    <Label 
                      htmlFor="client_signature" 
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Firma del Cliente Requerida
                    </Label>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <PenTool className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">Configuración de Firmas</p>
                      <p className="text-sm text-blue-700 mt-1">
                        Podrás configurar la ubicación exacta de las firmas en el documento después de crear la asignación.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <DialogFooter className="gap-4 pt-6 border-t mt-6">
              <Button 
                type="button"
                variant="outline" 
                onClick={onClose}
                disabled={loading}
                className="px-6 py-2"
              >
                Cancelar
              </Button>
              <Button 
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 px-6 py-2"
              >
                {loading ? 'Guardando...' : 'Actualizar Asignación'}
              </Button>
            </DialogFooter>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
