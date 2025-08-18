"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Check, X } from "lucide-react"
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
import { 
  getActiveFilingSystem,
  searchFileRecords,
  createFileRecord,
  linkDocumentToFileRecord
} from "@/app/actions/filing-system-actions"

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
  created_at: string
}

interface FileRecordSelectorProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (recordId: string) => void
  documentId: string
}

export default function FileRecordSelector({ 
  isOpen, 
  onClose, 
  onSuccess, 
  documentId 
}: FileRecordSelectorProps) {
  const [filingSystem, setFilingSystem] = useState<FilingSystem | null>(null)
  const [searchResults, setSearchResults] = useState<FileRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedRecord, setSelectedRecord] = useState<FileRecord | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const { toast } = useToast()

  useEffect(() => {
    if (isOpen) {
      loadFilingSystem()
    }
  }, [isOpen])

  const loadFilingSystem = async () => {
    setInitialLoading(true)
    try {
      const result = await getActiveFilingSystem()
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
        return
      }

      if (!result.system) {
        toast({
          title: "No Filing System",
          description: "Please create and activate a filing system first",
          variant: "destructive",
        })
        onClose()
        return
      }

      setFilingSystem(result.system)
      
      // Initialize form data
      const initialData: Record<string, any> = {}
      result.system.esquema_json.indices.forEach(field => {
        if (field.tipo_dato === "bool") {
          initialData[field.clave] = false
        } else {
          initialData[field.clave] = ""
        }
      })
      setFormData(initialData)
      
      // Load initial records
      await searchRecords()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load filing system",
        variant: "destructive",
      })
    } finally {
      setInitialLoading(false)
    }
  }

  const searchRecords = async (term?: string) => {
    if (!filingSystem) return
    
    setLoading(true)
    try {
      const result = await searchFileRecords({
        systemId: filingSystem.id,
        searchTerm: term || searchTerm
      })
      
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      } else {
        setSearchResults(result.records || [])
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Search failed",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSelectRecord = async (record: FileRecord) => {
    setLoading(true)
    try {
      const result = await linkDocumentToFileRecord(documentId, record.id)
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Éxito",
          description: "Documento vinculado al expediente exitosamente",
        })
        onSuccess(record.id)
        onClose()
      }
    } catch (error) {
              toast({
          title: "Error",
          description: "Error al vincular documento al expediente",
          variant: "destructive",
        })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateRecord = async () => {
    if (!filingSystem) return

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
      const createResult = await createFileRecord(filingSystem.id, formData)
      if (createResult.error) {
        toast({
          title: "Error",
          description: createResult.error,
          variant: "destructive",
        })
        return
      }

      // Link the document to the new record
      const linkResult = await linkDocumentToFileRecord(documentId, createResult.record.id)
      if (linkResult.error) {
        toast({
          title: "Error",
          description: linkResult.error,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Éxito",
          description: "Nuevo expediente creado y documento vinculado exitosamente",
        })
        onSuccess(createResult.record.id)
        onClose()
      }
    } catch (error) {
              toast({
          title: "Error",
          description: "Error al crear expediente",
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

  const renderFieldValue = (record: FileRecord, field: any) => {
    const value = record.valores_json?.[field.clave]
    if (!value) return "-"
    
    if (field.tipo_dato === "bool") {
      return value ? "Yes" : "No"
    }
    if (field.tipo_dato === "fecha") {
      return new Date(value).toLocaleDateString()
    }
    return String(value)
  }

  if (initialLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Loading...</DialogTitle>
            <DialogDescription>
              Please wait while we load the filing system.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!filingSystem) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>No Filing System</DialogTitle>
            <DialogDescription>
              Please create and activate a filing system before organizing documents.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Organize Document</DialogTitle>
          <DialogDescription>
            Selecciona un expediente existente o crea uno nuevo para organizar este documento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 px-1 max-h-96 overflow-y-auto">
          {!showCreateForm ? (
            <>
              {/* Search Section */}
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label className="text-sm font-medium">Buscar Expedientes</Label>
                    <Input
                      placeholder="Search by any field..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="mt-1 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent hover:border-gray-400"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button onClick={() => searchRecords()} disabled={loading}>
                      <Search className="w-4 h-4 mr-2" />
                      Search
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowCreateForm(true)}
                      className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Nuevo Expediente
                    </Button>
                  </div>
                </div>
              </div>

              {/* Results */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">
                  Expedientes Existentes ({searchResults.length})
                </h3>
                
                {initialLoading || loading ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
                    <p className="text-gray-600 text-sm">
                      {initialLoading ? "Loading case files..." : "Searching..."}
                    </p>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-2">No case files found</p>
                    <p className="text-gray-400 text-sm mb-4">
                      {searchTerm ? `No results for "${searchTerm}"` : "No case files exist yet"}
                    </p>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowCreateForm(true)}
                      className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create First Case File
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-3 max-h-64 overflow-y-auto">
                    {searchResults.map((record) => (
                      <Card 
                        key={record.id} 
                        className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                          selectedRecord?.id === record.id ? 'ring-2 ring-blue-500' : ''
                        }`}
                        onClick={() => setSelectedRecord(record)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                                {filingSystem.esquema_json.indices.slice(0, 3).map((field) => (
                                  <div key={field.clave}>
                                    <span className="font-medium text-gray-600">{field.etiqueta}:</span>
                                    <span className="ml-1">{renderFieldValue(record, field)}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                Created: {new Date(record.created_at).toLocaleDateString()}
                              </div>
                            </div>
                            {selectedRecord?.id === record.id && (
                              <Check className="w-5 h-5 text-blue-600" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Create Form */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Create New Case File</h3>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowCreateForm(false)}
                >
                  <X className="w-4 h-4 mr-1" />
                  Back to Search
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filingSystem.esquema_json.indices.map((field) => (
                  <div key={field.clave} className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">
                      {field.etiqueta}
                      {field.obligatorio && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    
                    {field.tipo_dato === "string" ? (
                      <Input
                        value={formData[field.clave] || ""}
                        onChange={(e) => handleFieldChange(field.clave, e.target.value)}
                        placeholder={`Enter ${field.etiqueta.toLowerCase()}...`}
                        className="border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent hover:border-gray-400"
                      />
                    ) : field.tipo_dato === "enum" ? (
                      <Select
                        value={formData[field.clave] || ""}
                        onValueChange={(value) => handleFieldChange(field.clave, value)}
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
                    ) : (
                      <Input
                        type={field.tipo_dato === "int" ? "number" : field.tipo_dato === "fecha" ? "date" : "text"}
                        value={formData[field.clave] || ""}
                        onChange={(e) => handleFieldChange(field.clave, e.target.value)}
                        placeholder={`Enter ${field.etiqueta.toLowerCase()}...`}
                        className="border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent hover:border-gray-400"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-3">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="h-10 px-4 border-gray-300 hover:bg-gray-50 focus:ring-2 focus:ring-gray-400"
          >
            Cancel
          </Button>
          
          {!showCreateForm ? (
            <Button 
              onClick={() => selectedRecord && handleSelectRecord(selectedRecord)} 
              disabled={!selectedRecord || loading}
              className="h-10 px-4 bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
            >
              {loading ? 'Linking...' : 'Link to Selected Case File'}
            </Button>
          ) : (
            <Button 
              onClick={handleCreateRecord} 
              disabled={loading}
              className="h-10 px-4 bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create & Link Case File'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
