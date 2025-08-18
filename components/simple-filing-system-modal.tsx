"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { createFilingSystem, updateFilingSystem } from "@/app/actions/filing-system-actions"

interface SimpleFilingSystemModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editingSystem?: {
    id: string
    nombre: string
    descripcion?: string
    esquema_json?: {
      indices?: any[]
    }
  }
}

interface FieldDefinition {
  clave: string
  etiqueta: string
  tipo_dato: 'string' | 'int' | 'fecha' | 'bool' | 'enum'
  obligatorio: boolean
  opciones_enum?: string[]
}

export default function SimpleFilingSystemModal({ isOpen, onClose, onSuccess, editingSystem }: SimpleFilingSystemModalProps) {
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [fields, setFields] = useState<FieldDefinition[]>([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const firstInputRef = useRef<HTMLInputElement>(null)

  console.log('SimpleFilingSystemModal rendered, isOpen:', isOpen)
  
  if (isOpen) {
    console.log('Modal should be visible!')
  }

  // Load editing data when modal opens
  useEffect(() => {
    if (isOpen && editingSystem) {
      setNombre(editingSystem.nombre)
      setDescripcion(editingSystem.descripcion || '')
      
      // Load existing indices
      if (editingSystem.esquema_json?.indices) {
        const existingFields = editingSystem.esquema_json.indices.map((index: any) => ({
          clave: index.clave,
          etiqueta: index.etiqueta,
          tipo_dato: index.tipo_dato,
          obligatorio: index.obligatorio,
          opciones_enum: index.opciones_enum
        }))
        setFields(existingFields)
      }
    } else if (isOpen && !editingSystem) {
      // Reset for new creation
      setNombre('')
      setDescripcion('')
      setFields([])
    }
  }, [isOpen, editingSystem])

  const handleSubmit = async () => {
    if (!nombre.trim()) {
      toast({
        title: "Error",
        description: "Name is required",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const systemData = {
        nombre,
        descripcion,
        indices: fields.map((field, index) => ({
          clave: field.clave,
          etiqueta: field.etiqueta,
          tipo_dato: field.tipo_dato,
          obligatorio: field.obligatorio,
          opciones_enum: field.opciones_enum,
          orden: index
        }))
      }

      const result = editingSystem 
        ? await updateFilingSystem(editingSystem.id, systemData)
        : await createFilingSystem(systemData)

      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Success",
          description: editingSystem 
            ? "Filing system updated successfully"
            : "Filing system created successfully",
        })
        onSuccess()
        onClose()
        setNombre('')
        setDescripcion('')
        setFields([])
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create filing system",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const addField = () => {
    setFields([...fields, {
      clave: '',
      etiqueta: '',
      tipo_dato: 'string',
      obligatorio: false,
      opciones_enum: undefined
    }])
  }

  const updateField = (index: number, updates: Partial<FieldDefinition>) => {
    const newFields = [...fields]
    newFields[index] = { ...newFields[index], ...updates }
    setFields(newFields)
  }

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index))
  }

  const handleClose = () => {
    setNombre('')
    setDescripcion('')
    setFields([])
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            {editingSystem ? 'Edit Filing System' : 'Create New Filing System'}
          </DialogTitle>
          <DialogDescription>
            {editingSystem 
              ? 'Update the filing system information and fields.'
              : 'Enter basic information about your filing system. You can add fields later.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 px-1 max-h-96 overflow-y-auto">
          {/* Basic Info */}
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="nombre" className="text-sm font-medium text-gray-700">System Name *</Label>
              <Input
                ref={firstInputRef}
                id="nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="e.g., Member Files, Contract Management"
                className="h-10 px-3 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent hover:border-gray-400"
                onFocus={(e) => {
                  // Prevent auto-selection when opening for edit
                  if (editingSystem) {
                    // Use setTimeout to ensure this runs after browser's auto-selection
                    setTimeout(() => {
                      e.target.setSelectionRange(e.target.value.length, e.target.value.length)
                    }, 0)
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descripcion" className="text-sm font-medium text-gray-700">Description</Label>
              <Textarea
                id="descripcion"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Describe what this filing system is used for..."
                rows={3}
                className="px-3 py-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent hover:border-gray-400 resize-none"
                onFocus={(e) => {
                  // Prevent auto-selection when opening for edit
                  if (editingSystem) {
                    setTimeout(() => {
                      e.target.setSelectionRange(e.target.value.length, e.target.value.length)
                    }, 0)
                  }
                }}
              />
            </div>
          </div>

          {/* Fields Section */}
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold text-gray-800">Fields (Índices)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addField}
                className="h-9 px-3 border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 focus:ring-2 focus:ring-blue-600"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Field
              </Button>
            </div>
            
            {fields.length === 0 && (
              <p className="text-sm text-gray-500 italic">
                No fields defined yet. Add fields to capture metadata for each document.
              </p>
            )}

            {fields.map((field, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-5 space-y-4 bg-gray-50/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800">Field {index + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeField(index)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Key (clave) *</Label>
                    <Input
                      value={field.clave}
                      onChange={(e) => updateField(index, { clave: e.target.value })}
                      placeholder="e.g., client_name"
                      className="text-sm h-10 px-3 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent hover:border-gray-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Label (etiqueta) *</Label>
                    <Input
                      value={field.etiqueta}
                      onChange={(e) => updateField(index, { etiqueta: e.target.value })}
                      placeholder="e.g., Client Name"
                      className="text-sm h-10 px-3 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent hover:border-gray-400"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Data Type</Label>
                    <Select
                      value={field.tipo_dato}
                      onValueChange={(value: 'string' | 'int' | 'fecha' | 'bool' | 'enum') => 
                        updateField(index, { tipo_dato: value })
                      }
                    >
                      <SelectTrigger className="text-sm h-10 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent hover:border-gray-400">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="string">Text (string)</SelectItem>
                        <SelectItem value="int">Number (int)</SelectItem>
                        <SelectItem value="fecha">Date (fecha)</SelectItem>
                        <SelectItem value="bool">Yes/No (bool)</SelectItem>
                        <SelectItem value="enum">Options (enum)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-3 pt-8">
                    <Checkbox
                      id={`required-${index}`}
                      checked={field.obligatorio}
                      onCheckedChange={(checked) => 
                        updateField(index, { obligatorio: !!checked })
                      }
                      className="focus:ring-2 focus:ring-blue-600"
                    />
                    <Label htmlFor={`required-${index}`} className="text-sm font-medium text-gray-700">
                      Required
                    </Label>
                  </div>
                </div>

                {field.tipo_dato === 'enum' && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Options (comma separated)</Label>
                    <Input
                      value={field.opciones_enum?.join(', ') || ''}
                      onChange={(e) => updateField(index, { 
                        opciones_enum: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                      })}
                      placeholder="e.g., Active, Inactive, Pending"
                      className="text-sm h-10 px-3 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent hover:border-gray-400"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button 
            variant="outline" 
            onClick={handleClose}
            className="h-10 px-4 border-gray-300 hover:bg-gray-50 focus:ring-2 focus:ring-gray-400"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading}
            className="h-10 px-4 bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
          >
            {loading 
              ? (editingSystem ? 'Updating...' : 'Creating...')
              : (editingSystem ? 'Update System' : 'Create System')
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
