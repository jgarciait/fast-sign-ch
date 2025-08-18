"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { createFileRecord, updateFileRecord } from "@/app/actions/filing-system-actions"

interface FilingSystem {
  id: string
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

interface FileRecord {
  id: string
  valores_json: any
}

interface CreateFileRecordModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  filingSystem: FilingSystem
  editingRecord?: FileRecord
}

export default function CreateFileRecordModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  filingSystem,
  editingRecord 
}: CreateFileRecordModalProps) {
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (isOpen) {
      if (editingRecord) {
        // Load existing data for editing
        setFormData(editingRecord.valores_json || {})
      } else {
        // Reset for new record
        const initialData: Record<string, any> = {}
        filingSystem.esquema_json.indices.forEach(field => {
          if (field.tipo_dato === "bool") {
            initialData[field.clave] = false
          } else {
            initialData[field.clave] = ""
          }
        })
        setFormData(initialData)
      }
    }
  }, [isOpen, editingRecord, filingSystem])

  const handleSubmit = async () => {
    // Validate required fields
    const missingFields = filingSystem.esquema_json.indices.filter(field => {
      if (!field.obligatorio) return false
      const value = formData[field.clave]
      return !value || (typeof value === "string" && value.trim() === "")
    })

    if (missingFields.length > 0) {
      toast({
        title: "Validation Error",
        description: `Please fill in required fields: ${missingFields.map(f => f.etiqueta).join(", ")}`,
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      let result
      if (editingRecord) {
        result = await updateFileRecord(editingRecord.id, formData)
      } else {
        result = await createFileRecord(filingSystem.id, formData)
      }

      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Success",
          description: editingRecord 
            ? "Expediente actualizado exitosamente"
            : "Expediente creado exitosamente",
        })
        onSuccess()
        onClose()
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al guardar expediente",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleFieldChange = (fieldKey: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldKey]: value
    }))
  }

  const renderField = (field: any) => {
    const value = formData[field.clave] || ""

    switch (field.tipo_dato) {
      case "string":
        return (
          <Input
            value={value}
            onChange={(e) => handleFieldChange(field.clave, e.target.value)}
            placeholder={`Enter ${field.etiqueta.toLowerCase()}...`}
            className="border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent hover:border-gray-400"
          />
        )

      case "int":
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => handleFieldChange(field.clave, parseInt(e.target.value) || "")}
            placeholder={`Enter ${field.etiqueta.toLowerCase()}...`}
            className="border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent hover:border-gray-400"
          />
        )

      case "fecha":
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => handleFieldChange(field.clave, e.target.value)}
            className="border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent hover:border-gray-400"
          />
        )

      case "bool":
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.clave}
              checked={!!value}
              onCheckedChange={(checked) => handleFieldChange(field.clave, !!checked)}
              className="focus:ring-2 focus:ring-blue-600"
            />
            <Label htmlFor={field.clave} className="text-sm">
              Yes
            </Label>
          </div>
        )

      case "enum":
        return (
          <Select
            value={value}
            onValueChange={(selectedValue) => handleFieldChange(field.clave, selectedValue)}
          >
            <SelectTrigger className="border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent hover:border-gray-400">
              <SelectValue placeholder={`Select ${field.etiqueta.toLowerCase()}...`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {field.opciones_enum?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      default:
        return (
          <Textarea
            value={value}
            onChange={(e) => handleFieldChange(field.clave, e.target.value)}
            placeholder={`Enter ${field.etiqueta.toLowerCase()}...`}
            rows={3}
            className="border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent hover:border-gray-400 resize-none"
          />
        )
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            {editingRecord ? 'Editar Expediente' : 'Crear Nuevo Expediente'}
          </DialogTitle>
          <DialogDescription>
            {editingRecord 
              ? 'Actualiza la información del expediente.'
              : `Crea un nuevo expediente usando el sistema de archivos "${filingSystem.nombre}".`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 px-1 max-h-96 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filingSystem.esquema_json.indices.map((field) => (
              <div key={field.clave} className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  {field.etiqueta}
                  {field.obligatorio && <span className="text-red-500 ml-1">*</span>}
                </Label>
                {renderField(field)}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button 
            variant="outline" 
            onClick={onClose}
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
              ? (editingRecord ? 'Actualizando...' : 'Creando...')
              : (editingRecord ? 'Actualizar Expediente' : 'Crear Expediente')
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
