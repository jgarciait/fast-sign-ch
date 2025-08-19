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
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { updateAssignment } from "@/app/actions/assignment-actions"
import type { AssignmentWithDetails } from "@/types/assignment-types"

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
    delivery_address: "",
    expected_delivery_date: null as Date | null,
    priority: "medium" as "low" | "medium" | "high",
    status: "assigned" as "assigned" | "in_transit" | "completed" | "signed" | "cancelled",
    description: ""
  })
  const [loading, setLoading] = useState(false)
  const [datePickerOpen, setDatePickerOpen] = useState(false)

  useEffect(() => {
    if (assignment && isOpen) {
      setFormData({
        delivery_address: assignment.delivery_address || "",
        expected_delivery_date: assignment.expected_delivery_date ? new Date(assignment.expected_delivery_date) : null,
        priority: assignment.priority || "medium",
        status: assignment.status || "assigned",
        description: assignment.description || ""
      })
    }
  }, [assignment, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assignment) return

    setLoading(true)
    try {
      const updateData = {
        delivery_address: formData.delivery_address || null,
        expected_delivery_date: formData.expected_delivery_date?.toISOString() || null,
        priority: formData.priority,
        status: formData.status,
        description: formData.description || null
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

  const handleDateSelect = (date: Date | undefined) => {
    setFormData(prev => ({
      ...prev,
      expected_delivery_date: date || null
    }))
    setDatePickerOpen(false)
  }

  if (!assignment) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-xl font-semibold">Editar Entrega</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-8 py-4">
          {/* Document Info (Read-only) */}
          <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4 text-lg">Información del Documento</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-sm">
              <div className="space-y-2">
                <span className="text-gray-500 font-medium">Documento:</span>
                <div className="font-medium text-gray-900 break-words">
                  {assignment.document?.file_name || 'Sin nombre'}
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-gray-500 font-medium">Chofer:</span>
                <div className="font-medium text-gray-900">
                  {assignment.assigned_to_user?.first_name && assignment.assigned_to_user?.last_name
                    ? `${assignment.assigned_to_user.first_name} ${assignment.assigned_to_user.last_name}`
                    : assignment.assigned_to_user?.email || 'No asignado'}
                </div>
              </div>
            </div>
          </div>

          {/* Editable Fields */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-3">
              <Label htmlFor="delivery_address" className="text-sm font-semibold text-gray-700">
                Dirección de Entrega
              </Label>
              <Textarea
                id="delivery_address"
                placeholder="Ingresa la dirección de entrega..."
                value={formData.delivery_address}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  delivery_address: e.target.value
                }))}
                rows={4}
                className="min-h-[100px] text-sm"
              />
            </div>

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
                    onSelect={handleDateSelect}
                    initialFocus
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-3">
              <Label htmlFor="priority" className="text-sm font-semibold text-gray-700">
                Prioridad
              </Label>
              <Select
                value={formData.priority}
                onValueChange={(value: "low" | "medium" | "high") => 
                  setFormData(prev => ({ ...prev, priority: value }))
                }
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Seleccionar prioridad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baja</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
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
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Seleccionar estado" />
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

          <div className="space-y-3 lg:col-span-2">
            <Label htmlFor="description" className="text-sm font-semibold text-gray-700">
              Descripción e Instrucciones
            </Label>
            <Textarea
              id="description"
              placeholder="Descripción detallada e instrucciones especiales para la entrega..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                description: e.target.value
              }))}
              rows={4}
              className="min-h-[120px] text-sm"
            />
          </div>

          <DialogFooter className="gap-4 pt-6 border-t">
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
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
