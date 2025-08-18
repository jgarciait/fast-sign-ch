"use client"

import { useState, useEffect } from "react"
import { Search, FolderOpen, Plus, User, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { getFileRecords, createFileRecord, getActiveFilingSystem } from "@/app/actions/filing-system-actions"
import { linkDocumentToFileRecordWithArchive } from "@/app/actions/document-archive-actions"
import { createClient } from "@/utils/supabase/client"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

interface FileRecord {
  id: string
  created_by: string
  sistema_id: string
  valores_json: any
  created_at: string
  updated_at: string
  filing_systems?: {
    nombre: string
    esquema_json: any
  }
}

interface OrganizeDocumentModalProps {
  isOpen: boolean
  onClose: () => void
  documentId: string
  documentName: string
  onSuccess?: () => void
}

export default function OrganizeDocumentModal({
  isOpen,
  onClose,
  documentId,
  documentName,
  onSuccess
}: OrganizeDocumentModalProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [showOnlyMyExpedientes, setShowOnlyMyExpedientes] = useState(false)
  const [expedientes, setExpedientes] = useState<FileRecord[]>([])
  const [filteredExpedientes, setFilteredExpedientes] = useState<FileRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLinking, setIsLinking] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [activeFilingSystem, setActiveFilingSystem] = useState<any>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [newExpedienteName, setNewExpedienteName] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const { toast } = useToast()

  // Get current user ID on mount
  useEffect(() => {
    if (isOpen) {
      getCurrentUser()
    }
  }, [isOpen])

  // Load expedientes and active filing system
  useEffect(() => {
    if (isOpen && currentUserId) {
      loadData()
    }
  }, [isOpen, showOnlyMyExpedientes, currentUserId])

  // Filter expedientes based on search term and user filter
  useEffect(() => {
    let filtered = expedientes

    // Filter by user if toggle is enabled
    if (showOnlyMyExpedientes && currentUserId) {
      filtered = filtered.filter(exp => exp.created_by === currentUserId)
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(exp => {
        const valuesString = JSON.stringify(exp.valores_json).toLowerCase()
        const systemName = exp.filing_systems?.nombre?.toLowerCase() || ""
        return valuesString.includes(searchLower) || systemName.includes(searchLower)
      })
    }

    // Sort: prioritize user's expedientes when showing all, then by creation date
    filtered.sort((a, b) => {
      // If showing all expedientes and we have current user ID, prioritize user's expedientes
      if (!showOnlyMyExpedientes && currentUserId) {
        const aIsUserExpediente = a.created_by === currentUserId
        const bIsUserExpediente = b.created_by === currentUserId
        
        // If one is user's and other isn't, prioritize user's
        if (aIsUserExpediente && !bIsUserExpediente) return -1
        if (!aIsUserExpediente && bIsUserExpediente) return 1
      }
      
      // Otherwise sort by creation date (most recent first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    setFilteredExpedientes(filtered)
  }, [expedientes, searchTerm, showOnlyMyExpedientes, currentUserId])

  const getCurrentUser = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        setCurrentUserId(user.id)
      }
    } catch (error) {
      console.error("Error getting current user:", error)
    }
  }

  const loadData = async () => {
    setIsLoading(true)
    try {
      // Load file records (expedientes)
      const expedientesResult = await getFileRecords()
      if (expedientesResult.error) {
        toast({
          title: "Error",
          description: expedientesResult.error,
          variant: "destructive"
        })
      } else {
        setExpedientes(expedientesResult.records)
      }

      // Load active filing system for creating new expedientes
      const systemResult = await getActiveFilingSystem()
      if (systemResult.system) {
        setActiveFilingSystem(systemResult.system)
      }

    } catch (error) {
      console.error("Error loading data:", error)
      toast({
        title: "Error",
        description: "Error cargando expedientes",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleLinkToExpediente = async (expedienteId: string) => {
    setIsLinking(true)
    try {
      const result = await linkDocumentToFileRecordWithArchive(documentId, expedienteId)
      
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive"
        })
        return
      }

      toast({
        title: "Éxito",
        description: "Documento archivado en el expediente exitosamente",
      })

      onSuccess?.()
      onClose()

    } catch (error) {
      console.error("Error linking document:", error)
      toast({
        title: "Error", 
        description: "Error archivando documento",
        variant: "destructive"
      })
    } finally {
      setIsLinking(false)
    }
  }

  const handleCreateNewExpediente = async () => {
    if (!newExpedienteName.trim()) {
      toast({
        title: "Error",
        description: "El nombre del expediente es requerido",
        variant: "destructive"
      })
      return
    }

    if (!activeFilingSystem) {
      toast({
        title: "Error", 
        description: "No hay un sistema de archivo activo",
        variant: "destructive"
      })
      return
    }

    setIsCreating(true)
    try {
      // Create simple expediente with just the name
      const valores = {
        nombre: newExpedienteName.trim(),
        descripcion: `Expediente creado para documento: ${documentName}`
      }

      const result = await createFileRecord(activeFilingSystem.id, valores)
      
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive"
        })
        return
      }

      // Link document to new expediente
      if (result.record) {
        await handleLinkToExpediente(result.record.id)
        
        // Reset form
        setNewExpedienteName("")
        setShowCreateForm(false)
        
        // Reload data to show new expediente
        loadData()
      }

    } catch (error) {
      console.error("Error creating expediente:", error)
      toast({
        title: "Error",
        description: "Error creando nuevo expediente",
        variant: "destructive"
      })
    } finally {
      setIsCreating(false)
    }
  }

  const renderExpedienteValues = (expediente: FileRecord) => {
    const values = expediente.valores_json || {}
    const entries = Object.entries(values).slice(0, 3) // Show first 3 fields
    
    if (entries.length === 0) {
      return <span className="text-gray-500 text-sm">Sin datos adicionales</span>
    }

    return (
      <div className="space-y-1">
        {entries.map(([key, value], index) => (
          <div key={index} className="text-sm">
            <span className="font-medium text-gray-600 capitalize">{key}:</span>{" "}
            <span className="text-gray-800">{String(value)}</span>
          </div>
        ))}
        {Object.keys(values).length > 3 && (
          <span className="text-xs text-gray-500">
            +{Object.keys(values).length - 3} campos más
          </span>
        )}
      </div>
    )
  }

  const getExpedienteDisplayName = (expediente: FileRecord) => {
    const values = expediente.valores_json || {}
    
    // Try common field names for display
    const nameFields = ['nombre', 'name', 'titulo', 'title', 'descripcion', 'description']
    
    for (const field of nameFields) {
      if (values[field] && typeof values[field] === 'string') {
        return values[field]
      }
    }

    // Fallback to first string value or ID
    const firstStringValue = Object.values(values).find(v => typeof v === 'string' && v.trim())
    return firstStringValue || `Expediente ${expediente.id.slice(0, 8)}`
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0 border-b pb-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold">
                Organizar Documento
              </DialogTitle>
              <p className="text-sm text-blue-600 font-medium mt-2">
                Selecciona un expediente para organizar: <strong>{documentName}</strong>
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
          {/* Search and filters */}
          <div className="flex-shrink-0 space-y-3">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar expedientes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Nuevo Expediente
              </Button>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="user-filter"
                checked={showOnlyMyExpedientes}
                onCheckedChange={setShowOnlyMyExpedientes}
              />
              <Label htmlFor="user-filter" className="flex items-center gap-2 text-sm">
                {showOnlyMyExpedientes ? (
                  <>
                    <User className="h-4 w-4" />
                    Mostrar solo mis expedientes
                  </>
                ) : (
                  <>
                    <Users className="h-4 w-4" />
                    Mostrar todos los expedientes
                  </>
                )}
              </Label>
              {currentUserId && (
                <Badge variant="outline" className="text-xs">
                  Usuario: {currentUserId.slice(0, 8)}...
                </Badge>
              )}
            </div>

            {/* Create new expediente form */}
            {showCreateForm && (
              <Card className="border-dashed border-2 border-blue-300 bg-blue-50">
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="expediente-name" className="text-sm font-medium">
                        Nombre del Expediente
                      </Label>
                      <Input
                        id="expediente-name"
                        value={newExpedienteName}
                        onChange={(e) => setNewExpedienteName(e.target.value)}
                        placeholder="Ingresa el nombre del nuevo expediente..."
                        className="mt-1"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        onClick={handleCreateNewExpediente}
                        disabled={isCreating || !newExpedienteName.trim()}
                        size="sm"
                      >
                        {isCreating ? "Creando..." : "Crear y Archivar"}
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setShowCreateForm(false)
                          setNewExpedienteName("")
                        }}
                        size="sm"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Expedientes list */}
          <div className="flex-1 overflow-hidden">
            <div className="text-sm font-medium text-gray-700 mb-3 flex items-center justify-between">
              <span>
                Expedientes Existentes ({filteredExpedientes.length})
              </span>
              {isLoading && <span className="text-blue-600">Cargando...</span>}
            </div>

            {filteredExpedientes.length === 0 && !isLoading ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                <FolderOpen className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-center">
                  {expedientes.length === 0 
                    ? "No se encontraron expedientes"
                    : "No se encontraron expedientes que coincidan con tu búsqueda"
                  }
                </p>
                <p className="text-sm text-center mt-1">
                  {expedientes.length === 0 && "Crea el primer expediente para organizar tus documentos"}
                </p>
              </div>
            ) : (
              <div className="space-y-2 h-full overflow-y-auto">
                {filteredExpedientes.map((expediente) => (
                  <Card 
                    key={expediente.id} 
                    className="cursor-pointer hover:shadow-md transition-shadow border hover:border-blue-300"
                    onClick={() => handleLinkToExpediente(expediente.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-medium text-gray-900 truncate">
                              {getExpedienteDisplayName(expediente)}
                            </h3>
                            {expediente.created_by === currentUserId && (
                              <Badge variant="secondary" className="text-xs">
                                Mío
                              </Badge>
                            )}
                            {expediente.filing_systems && (
                              <Badge variant="outline" className="text-xs">
                                {expediente.filing_systems.nombre}
                              </Badge>
                            )}
                          </div>
                          
                          {renderExpedienteValues(expediente)}
                          
                          <p className="text-xs text-gray-500 mt-2">
                            Creado {formatDistanceToNow(new Date(expediente.created_at), { 
                              addSuffix: true, 
                              locale: es 
                            })}
                          </p>
                        </div>
                        
                        <div className="flex-shrink-0 ml-4">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isLinking}
                            className="hover:bg-blue-50 hover:border-blue-300"
                          >
                            {isLinking ? "Archivando..." : "Archivar en Expediente"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t pt-4">
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
