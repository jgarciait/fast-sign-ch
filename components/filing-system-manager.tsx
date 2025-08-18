"use client"

import { useState, useEffect } from "react"
import { Plus, Settings, Trash2, Eye, Power, PowerOff, Edit } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  getFilingSystems,
  activateFilingSystem,
  deleteFilingSystem,
  type FilingSystem
} from "@/app/actions/filing-system-actions"
import SimpleFilingSystemModal from "@/components/simple-filing-system-modal"

interface FilingSystemManagerProps {
  onCreateNew?: () => void
  onEdit?: (system: FilingSystem) => void
}

export default function FilingSystemManager({ onCreateNew, onEdit }: FilingSystemManagerProps) {
  const [systems, setSystems] = useState<FilingSystem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showBuilder, setShowBuilder] = useState(false)
  const [editingSystem, setEditingSystem] = useState<FilingSystem | undefined>()
  const [showPreview, setShowPreview] = useState(false)
  const [previewSystem, setPreviewSystem] = useState<FilingSystem | null>(null)
  const { toast } = useToast()

  console.log('FilingSystemManager rendered, showBuilder:', showBuilder)

  const loadSystems = async () => {
    setLoading(true)
    try {
      const result = await getFilingSystems()
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      } else {
        setSystems(result.systems)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load filing systems",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSystems()
  }, [])

  const handleActivate = async (systemId: string) => {
    setActionLoading(systemId)
    try {
      const result = await activateFilingSystem(systemId)
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Success",
          description: "Filing system activated successfully",
        })
        loadSystems()
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to activate filing system",
        variant: "destructive",
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (systemId: string) => {
    setActionLoading(systemId)
    try {
      const result = await deleteFilingSystem(systemId)
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Success",
          description: "Filing system deleted successfully",
        })
        loadSystems()
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete filing system",
        variant: "destructive",
      })
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (systems.length === 0) {
    return (
      <>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <Plus className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-lg font-medium mb-2">No filing systems configured</h3>
            <p className="text-gray-600 text-center mb-4 max-w-md">
              Create your first filing system to organize documents with custom metadata fields and search capabilities.
            </p>
            <Button onClick={() => {
              console.log('Create button clicked!')
              setShowBuilder(true)
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Filing System
            </Button>
          </CardContent>
        </Card>
        
        <SimpleFilingSystemModal
          isOpen={showBuilder}
          editingSystem={editingSystem}
          onClose={() => {
            console.log('Modal closing')
            setShowBuilder(false)
            setEditingSystem(undefined)
          }}
          onSuccess={() => {
            console.log('Modal success')
            loadSystems()
            setShowBuilder(false)
            setEditingSystem(undefined)
          }}
        />
      </>
    )
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Your Filing Systems</h3>
            <p className="text-sm text-gray-600">
              Manage document classification templates. Only one can be active at a time.
            </p>
          </div>
          <Button onClick={() => {
            console.log('Create New System button clicked!')
            setShowBuilder(true)
          }}>
            <Plus className="w-4 h-4 mr-2" />
            Create New System
          </Button>
        </div>

        <div className="grid gap-4">
          {systems.map((system) => (
            <Card key={system.id} className={system.is_active ? "border-green-200 bg-green-50" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <CardTitle className="text-lg">{system.nombre}</CardTitle>
                    {system.is_active && (
                      <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                        Active
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        console.log('Preview button clicked for system:', system.id)
                        setPreviewSystem(system)
                        setShowPreview(true)
                      }}
                      disabled={actionLoading === system.id}
                      className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Preview
                    </Button>
                    {!system.is_active && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleActivate(system.id)}
                        disabled={actionLoading === system.id}
                        className="text-green-600 border-green-200 hover:bg-green-50"
                      >
                        <Power className="h-4 w-4 mr-1" />
                        Activate
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingSystem(system)
                        setShowBuilder(true)
                      }}
                      disabled={actionLoading === system.id}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={actionLoading === system.id || system.is_active}
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Filing System</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{system.nombre}"? This action cannot be undone and will affect all related file records.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(system.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {system.descripcion && (
                    <p className="text-sm text-gray-600">{system.descripcion}</p>
                  )}
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center space-x-4">
                      <span>
                        Fields: {system.esquema_json?.indices?.length || 0}
                      </span>
                      <span>
                        Created: {new Date(system.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {system.is_active && (
                      <span className="text-green-600 font-medium">
                        Currently active for new documents
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      
        <SimpleFilingSystemModal
          isOpen={showBuilder}
          editingSystem={editingSystem}
          onClose={() => {
            console.log('Modal closing')
            setShowBuilder(false)
            setEditingSystem(undefined)
          }}
          onSuccess={() => {
            console.log('Modal success')
            loadSystems()
            setShowBuilder(false)
            setEditingSystem(undefined)
          }}
        />

        {/* Preview Modal */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-blue-600" />
                Preview Filing System: {previewSystem?.nombre}
              </DialogTitle>
              <DialogDescription>
                Esto es exactamente lo que los usuarios verán al crear un nuevo expediente con este sistema de archivos.
              </DialogDescription>
            </DialogHeader>

            {previewSystem && (
              <div className="space-y-6 py-4">
                {/* System Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Filing System Information</h4>
                  <div className="text-sm text-blue-800 space-y-1">
                    <p><strong>Name:</strong> {previewSystem.nombre}</p>
                    {previewSystem.descripcion && (
                      <p><strong>Description:</strong> {previewSystem.descripcion}</p>
                    )}
                    <p><strong>Fields:</strong> {previewSystem.esquema_json?.indices?.length || 0}</p>
                    <p><strong>Status:</strong> {previewSystem.is_active ? 'Active' : 'Inactive'}</p>
                  </div>
                </div>

                {/* Form Preview */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Vista Previa del Formulario de Creación de Expediente</h4>
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <div className="space-y-4">
                      {previewSystem.esquema_json?.indices?.map((field: any, index: number) => (
                        <div key={field.clave} className="space-y-2">
                          <Label className="text-sm font-medium text-gray-700">
                            {field.etiqueta}
                            {field.obligatorio && <span className="text-red-500 ml-1">*</span>}
                          </Label>
                          
                          {field.tipo_dato === 'string' && (
                            <Input
                              placeholder={`Enter ${field.etiqueta.toLowerCase()}...`}
                              disabled
                              className="bg-white"
                            />
                          )}
                          
                          {field.tipo_dato === 'int' && (
                            <Input
                              type="number"
                              placeholder={`Enter ${field.etiqueta.toLowerCase()}...`}
                              disabled
                              className="bg-white"
                            />
                          )}
                          
                          {field.tipo_dato === 'fecha' && (
                            <Input
                              type="date"
                              disabled
                              className="bg-white"
                            />
                          )}
                          
                          {field.tipo_dato === 'bool' && (
                            <div className="flex items-center space-x-2">
                              <Checkbox disabled />
                              <Label className="text-sm text-gray-600">
                                {field.etiqueta}
                              </Label>
                            </div>
                          )}
                          
                          {field.tipo_dato === 'enum' && field.opciones_enum && (
                            <Select disabled>
                              <SelectTrigger className="bg-white">
                                <SelectValue placeholder={`Select ${field.etiqueta.toLowerCase()}...`} />
                              </SelectTrigger>
                              <SelectContent>
                                {field.opciones_enum.map((option: string, optIndex: number) => (
                                  <SelectItem key={optIndex} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          
                          {field.obligatorio && (
                            <p className="text-xs text-red-600">This field is required</p>
                          )}
                        </div>
                      ))}
                      
                      {(!previewSystem.esquema_json?.indices || previewSystem.esquema_json.indices.length === 0) && (
                        <div className="text-center py-8 text-gray-500">
                          <p>No fields configured for this filing system.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Usage Instructions */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">How to Use This Filing System</h4>
                  <div className="text-sm text-gray-700 space-y-2">
                                    <p>1. <strong>Activa este sistema de archivos</strong> para hacerlo disponible para nuevos expedientes</p>
                <p>2. <strong>Crea expedientes</strong> llenando exactamente estos campos</p>
                <p>3. <strong>Vincula documentos</strong> a expedientes para mejor organización</p>
                <p>4. <strong>Busca y filtra</strong> expedientes usando cualquiera de estos campos</p>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </>
    )
  }
