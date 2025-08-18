"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, GripVertical, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import {
  createFilingSystem,
  updateFilingSystem,
  createFilingIndex,
  updateFilingIndex,
  deleteFilingIndex,
  getFilingIndices,
  type FilingSystem,
  type FilingIndex
} from "@/app/actions/filing-system-actions"

interface FilingSystemBuilderProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  system?: FilingSystem // For editing existing system
}

interface IndexFormData {
  id?: string
  clave: string
  etiqueta: string
  tipo_dato: 'string' | 'int' | 'fecha' | 'bool' | 'enum'
  obligatorio: boolean
  opciones_enum?: string[]
  orden: number
}

export default function FilingSystemBuilder({ isOpen, onClose, onSuccess, system }: FilingSystemBuilderProps) {
  const [step, setStep] = useState<'basic' | 'indices' | 'preview'>('basic')
  const [loading, setLoading] = useState(false)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [indices, setIndices] = useState<IndexFormData[]>([])
  const [currentIndex, setCurrentIndex] = useState<IndexFormData>({
    clave: '',
    etiqueta: '',
    tipo_dato: 'string',
    obligatorio: false,
    orden: 0
  })
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [enumOptions, setEnumOptions] = useState('')
  const { toast } = useToast()

  // Initialize form when editing existing system
  useEffect(() => {
    if (system && isOpen) {
      setNombre(system.nombre)
      setDescripcion(system.descripcion || '')
      loadExistingIndices()
    } else if (isOpen) {
      // Reset form for new system
      setNombre('')
      setDescripcion('')
      setIndices([])
      setStep('basic')
    }
  }, [system, isOpen])

  const loadExistingIndices = async () => {
    if (!system) return
    
    try {
      const result = await getFilingIndices(system.id)
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      } else {
        const indexData = result.indices.map((index, idx) => ({
          id: index.id,
          clave: index.clave,
          etiqueta: index.etiqueta,
          tipo_dato: index.tipo_dato,
          obligatorio: index.obligatorio,
          opciones_enum: index.opciones_enum || [],
          orden: index.orden
        }))
        setIndices(indexData)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load existing indices",
        variant: "destructive",
      })
    }
  }

  const handleBasicNext = () => {
    if (!nombre.trim()) {
      toast({
        title: "Error",
        description: "Name is required",
        variant: "destructive",
      })
      return
    }
    setStep('indices')
  }

  const handleAddIndex = () => {
    if (!currentIndex.clave.trim() || !currentIndex.etiqueta.trim()) {
      toast({
        title: "Error",
        description: "Key and label are required",
        variant: "destructive",
      })
      return
    }

    // Check for duplicate keys
    if (indices.some((index, idx) => index.clave === currentIndex.clave && idx !== editingIndex)) {
      toast({
        title: "Error",
        description: "Key must be unique",
        variant: "destructive",
      })
      return
    }

    const newIndex: IndexFormData = {
      ...currentIndex,
      opciones_enum: currentIndex.tipo_dato === 'enum' ? enumOptions.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      orden: editingIndex !== null ? currentIndex.orden : indices.length
    }

    if (editingIndex !== null) {
      const updated = [...indices]
      updated[editingIndex] = newIndex
      setIndices(updated)
      setEditingIndex(null)
    } else {
      setIndices([...indices, newIndex])
    }

    // Reset form
    setCurrentIndex({
      clave: '',
      etiqueta: '',
      tipo_dato: 'string',
      obligatorio: false,
      orden: 0
    })
    setEnumOptions('')
  }

  const handleEditIndex = (index: number) => {
    const indexData = indices[index]
    setCurrentIndex(indexData)
    setEnumOptions(indexData.opciones_enum?.join(', ') || '')
    setEditingIndex(index)
  }

  const handleDeleteIndex = (index: number) => {
    setIndices(indices.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (indices.length === 0) {
      toast({
        title: "Error",
        description: "At least one index is required",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      let systemId = system?.id

      // Create or update system
      if (system) {
        const result = await updateFilingSystem(system.id, { nombre, descripcion })
        if (result.error) {
          toast({
            title: "Error",
            description: result.error,
            variant: "destructive",
          })
          return
        }
      } else {
        const result = await createFilingSystem(nombre, descripcion)
        if (result.error) {
          toast({
            title: "Error",
            description: result.error,
            variant: "destructive",
          })
          return
        }
        systemId = result.system?.id
      }

      if (!systemId) {
        toast({
          title: "Error",
          description: "Failed to get system ID",
          variant: "destructive",
        })
        return
      }

      // Handle indices - this is simplified for now
      // In a production app, you'd want to handle updates/deletes more carefully
      if (system) {
        // For existing systems, you might want to implement proper index management
        toast({
          title: "Info", 
          description: "Index updates for existing systems need manual implementation",
        })
      } else {
        // Create new indices
        for (const index of indices) {
          const result = await createFilingIndex(
            systemId,
            index.clave,
            index.etiqueta,
            index.tipo_dato,
            index.obligatorio,
            index.orden,
            index.opciones_enum
          )
          if (result.error) {
            toast({
              title: "Warning",
              description: `Failed to create index ${index.clave}: ${result.error}`,
              variant: "destructive",
            })
          }
        }
      }

      toast({
        title: "Success",
        description: `Filing system ${system ? 'updated' : 'created'} successfully`,
      })
      onSuccess()
      onClose()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save filing system",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const renderBasicStep = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="nombre">System Name *</Label>
        <Input
          id="nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="e.g., Member Files, Contract Management"
        />
      </div>
      <div>
        <Label htmlFor="descripcion">Description</Label>
        <Textarea
          id="descripcion"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Describe what this filing system is used for..."
          rows={3}
        />
      </div>
    </div>
  )

  const renderIndicesStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Define Fields</h3>
        <p className="text-sm text-gray-600 mb-4">
          Create the metadata fields that will be used to classify documents in this system.
        </p>
      </div>

      {/* Current Indices */}
      {indices.length > 0 && (
        <div className="space-y-2">
          <Label>Configured Fields ({indices.length})</Label>
          <div className="space-y-2">
            {indices.map((index, idx) => (
              <Card key={idx} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <GripVertical className="h-4 w-4 text-gray-400" />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{index.etiqueta}</span>
                        <Badge variant="outline">{index.tipo_dato}</Badge>
                        {index.obligatorio && (
                          <Badge variant="destructive" className="text-xs">Required</Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">Key: {index.clave}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditIndex(idx)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteIndex(idx)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit Index Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {editingIndex !== null ? 'Edit Field' : 'Add New Field'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="clave">Key (Internal) *</Label>
              <Input
                id="clave"
                value={currentIndex.clave}
                onChange={(e) => setCurrentIndex({...currentIndex, clave: e.target.value})}
                placeholder="e.g., socio_id, num_contrato"
              />
            </div>
            <div>
              <Label htmlFor="etiqueta">Label (Display) *</Label>
              <Input
                id="etiqueta"
                value={currentIndex.etiqueta}
                onChange={(e) => setCurrentIndex({...currentIndex, etiqueta: e.target.value})}
                placeholder="e.g., Member ID, Contract Number"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tipo_dato">Data Type</Label>
              <Select 
                value={currentIndex.tipo_dato} 
                onValueChange={(value: any) => setCurrentIndex({...currentIndex, tipo_dato: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">Text</SelectItem>
                  <SelectItem value="int">Number</SelectItem>
                  <SelectItem value="fecha">Date</SelectItem>
                  <SelectItem value="bool">Yes/No</SelectItem>
                  <SelectItem value="enum">Dropdown List</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2 pt-6">
              <Switch
                id="obligatorio"
                checked={currentIndex.obligatorio}
                onCheckedChange={(checked) => setCurrentIndex({...currentIndex, obligatorio: checked})}
              />
              <Label htmlFor="obligatorio">Required field</Label>
            </div>
          </div>

          {currentIndex.tipo_dato === 'enum' && (
            <div>
              <Label htmlFor="opciones">Options (comma-separated)</Label>
              <Input
                id="opciones"
                value={enumOptions}
                onChange={(e) => setEnumOptions(e.target.value)}
                placeholder="e.g., Active, Inactive, Pending"
              />
            </div>
          )}

          <Button onClick={handleAddIndex} className="w-full">
            {editingIndex !== null ? 'Update Field' : 'Add Field'}
          </Button>
          {editingIndex !== null && (
            <Button 
              variant="outline" 
              onClick={() => {
                setEditingIndex(null)
                setCurrentIndex({
                  clave: '',
                  etiqueta: '',
                  tipo_dato: 'string',
                  obligatorio: false,
                  orden: 0
                })
                setEnumOptions('')
              }}
              className="w-full"
            >
              Cancel Edit
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )

  const renderPreviewStep = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium mb-2">Review Your Filing System</h3>
        <p className="text-sm text-gray-600">
          Please review the configuration before creating the system.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{nombre}</CardTitle>
          {descripcion && <p className="text-sm text-gray-600">{descripcion}</p>}
        </CardHeader>
        <CardContent>
          <div>
            <Label className="text-base">Fields ({indices.length})</Label>
            <div className="mt-2 space-y-2">
              {indices.map((index, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div>
                    <span className="font-medium">{index.etiqueta}</span>
                    <span className="text-sm text-gray-500 ml-2">({index.clave})</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">{index.tipo_dato}</Badge>
                    {index.obligatorio && (
                      <Badge variant="destructive" className="text-xs">Required</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {system ? 'Edit Filing System' : 'Create New Filing System'}
          </DialogTitle>
          <DialogDescription>
            {step === 'basic' && 'Enter basic information about your filing system'}
            {step === 'indices' && 'Define the metadata fields for document classification'}
            {step === 'preview' && 'Review your configuration before saving'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {step === 'basic' && renderBasicStep()}
          {step === 'indices' && renderIndicesStep()}
          {step === 'preview' && renderPreviewStep()}
        </div>

        <DialogFooter className="flex justify-between">
          <div className="flex space-x-2">
            {step !== 'basic' && (
              <Button variant="outline" onClick={() => {
                if (step === 'indices') setStep('basic')
                if (step === 'preview') setStep('indices')
              }}>
                Previous
              </Button>
            )}
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {step === 'basic' && (
              <Button onClick={handleBasicNext}>
                Next
              </Button>
            )}
            {step === 'indices' && (
              <Button onClick={() => setStep('preview')}>
                Preview
              </Button>
            )}
            {step === 'preview' && (
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? 'Creating...' : (system ? 'Update System' : 'Create System')}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
