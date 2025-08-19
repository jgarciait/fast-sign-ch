"use client"

import { useState, useEffect, useMemo } from "react"
import { 
  Trash2, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Edit, 
  Plus, 
  MoreVertical,
  Truck,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText,
  Clock
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { 
  toggleChoferAvailability,
  type ChoferWithProfile 
} from "@/app/actions/chofer-actions"
import { removeUserFromGroup } from "@/app/actions/groups-actions"
import ChoferModal from "./chofer-modal"
import AddChoferModal from "./add-chofer-modal"
import { 
  getChoferFullName, 
  getChoferDisplayInfo, 
  getTruckDisplayName,
  getStatusDisplayName,
  isChoferAvailable 
} from "@/types/chofer-types"

interface ChoferesListProps {
  initialChoferes: ChoferWithProfile[]
  initialTotal: number
  initialError?: string
}

export default function ChoferesList({ 
  initialChoferes, 
  initialTotal,
  initialError 
}: ChoferesListProps) {
  const [choferes, setChoferes] = useState<ChoferWithProfile[]>(initialChoferes)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  
  // Modal states
  const [choferModalOpen, setChoferModalOpen] = useState(false)
  const [choferToEdit, setChoferToEdit] = useState<ChoferWithProfile | null>(null)
  const [addChoferModalOpen, setAddChoferModalOpen] = useState(false)
  
  // Remove from group modal states
  const [removeFromGroupModalOpen, setRemoveFromGroupModalOpen] = useState(false)
  const [choferToRemove, setChoferToRemove] = useState<ChoferWithProfile | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)
  
  const itemsPerPage = 12

  // Filter choferes based on search term
  const filteredChoferes = useMemo(() => {
    if (!searchTerm.trim()) return choferes

    const term = searchTerm.toLowerCase()
    return choferes.filter(chofer => {
      const fullName = getChoferFullName(chofer).toLowerCase()
      const email = (chofer.email || chofer.auth_email || '').toLowerCase()
      const employeeId = (chofer.employee_id || '').toLowerCase()
      const truckPlate = (chofer.truck_plate || '').toLowerCase()
      const truckInfo = getTruckDisplayName(chofer).toLowerCase()
      
      return fullName.includes(term) || 
             email.includes(term) || 
             employeeId.includes(term) ||
             truckPlate.includes(term) ||
             truckInfo.includes(term)
    })
  }, [choferes, searchTerm])

  // Calculate pagination
  const totalPages = Math.ceil(filteredChoferes.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedChoferes = filteredChoferes.slice(startIndex, endIndex)

  // Reset pagination when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  const handleRemoveFromGroup = async () => {
    if (!choferToRemove) return

    setIsRemoving(true)
    try {
      // Get choferes group ID
      const { getChoferesGroup } = await import("@/app/actions/groups-actions")
      const groupResult = await getChoferesGroup()
      
      if (!groupResult.success || !groupResult.data) {
        toast.error("Error al obtener grupo de choferes")
        return
      }

      const result = await removeUserFromGroup(choferToRemove.user_id, groupResult.data.id)
      
      if (result.success) {
        // Remove from local state
        setChoferes(prev => prev.filter(c => c.id !== choferToRemove.id))
        toast.success(`${getChoferFullName(choferToRemove)} removido del grupo de choferes`)
      } else {
        toast.error(result.error || "Error al remover del grupo")
      }
    } catch (error) {
      toast.error("Error inesperado al remover del grupo")
    } finally {
      setIsRemoving(false)
      setRemoveFromGroupModalOpen(false)
      setChoferToRemove(null)
    }
  }

  const handleToggleAvailability = async (chofer: ChoferWithProfile) => {
    try {
      const result = await toggleChoferAvailability(chofer.id)
      
      if (result.success && result.data) {
        // Update local state
        setChoferes(prev => prev.map(c => 
          c.id === chofer.id ? { ...c, is_available: result.data!.is_available } : c
        ))
        
        const status = result.data.is_available ? 'disponible' : 'no disponible'
        toast.success(`${getChoferFullName(chofer)} marcado como ${status}`)
      } else {
        toast.error(result.error || "Error al actualizar disponibilidad")
      }
    } catch (error) {
      toast.error("Error inesperado al actualizar disponibilidad")
    }
  }

  const openEditModal = (chofer: ChoferWithProfile) => {
    setChoferToEdit(chofer)
    setChoferModalOpen(true)
  }

  const openRemoveFromGroupModal = (chofer: ChoferWithProfile) => {
    setChoferToRemove(chofer)
    setRemoveFromGroupModalOpen(true)
  }

  const handleChoferCreated = (newChofer: ChoferWithProfile) => {
    setChoferes(prev => [newChofer, ...prev])
  }

  const handleChoferUpdated = (updatedChofer: ChoferWithProfile) => {
    setChoferes(prev => prev.map(c => 
      c.id === updatedChofer.id ? updatedChofer : c
    ))
  }

  if (initialError) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 mb-2">Error al cargar choferes</p>
            <p className="text-sm text-gray-600">{initialError}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por nombre, email, placa, empleado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button onClick={() => setAddChoferModalOpen(true)} className="bg-green-600 hover:bg-green-700">
            <Plus className="h-4 w-4 mr-2" />
            Agregar Chofer
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <User className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{choferes.length}</p>
                <p className="text-sm text-gray-600">Total Choferes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">
                  {choferes.filter(c => isChoferAvailable(c)).length}
                </p>
                <p className="text-sm text-gray-600">Disponibles</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Truck className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">
                  {choferes.filter(c => c.truck_plate).length}
                </p>
                <p className="text-sm text-gray-600">Con Vehículo</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-2xl font-bold">
                  {choferes.filter(c => (c.expired_documents_count || 0) > 0).length}
                </p>
                <p className="text-sm text-gray-600">Con Docs. Vencidos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Choferes Grid */}
      {filteredChoferes.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">
                {searchTerm ? 'No se encontraron choferes' : 'No hay choferes registrados'}
              </p>
              {!searchTerm && (
                <Button onClick={() => setAddChoferModalOpen(true)} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar primer chofer
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedChoferes.map((chofer, index) => (
              <Card key={chofer.id || chofer.user_id || `chofer-${index}`} className="hover:shadow-md transition-shadow min-h-[280px] flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base font-semibold truncate">
                        {getChoferFullName(chofer) || (chofer.email || chofer.auth_email)}
                      </CardTitle>
                      <CardDescription className="mt-1 space-y-1">
                        {chofer.employee_id && (
                          <div className="text-sm text-gray-600">
                            ID: {chofer.employee_id}
                          </div>
                        )}
                        {/* Status Badge */}
                        <Badge 
                          variant={isChoferAvailable(chofer) ? "default" : "secondary"}
                          className={`text-xs ${isChoferAvailable(chofer) ? "bg-green-100 text-green-800" : ""}`}
                        >
                          {isChoferAvailable(chofer) ? "Disponible" : "No Disponible"}
                        </Badge>
                      </CardDescription>
                    </div>
                    
                    {/* Actions Only */}
                    <div className="flex-shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditModal(chofer)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar Perfil
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleAvailability(chofer)}>
                            {isChoferAvailable(chofer) ? (
                              <>
                                <XCircle className="h-4 w-4 mr-2" />
                                Marcar No Disponible
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Marcar Disponible
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => openRemoveFromGroupModal(chofer)}
                            className="text-red-600"
                          >
                            <User className="h-4 w-4 mr-2" />
                            Remover del Grupo
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="flex-1 pt-0 pb-4 px-4">
                  {/* Contact Information Section */}
                  <div className="space-y-2 mb-3">
                    {/* Email - Only show if we have a real name in the title, otherwise email is already shown as title */}
                    {getChoferFullName(chofer) && (chofer.email || chofer.auth_email) && (
                      <div className="flex items-center space-x-2 text-sm text-gray-700">
                        <Mail className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        <span className="truncate font-medium">{chofer.email || chofer.auth_email}</span>
                      </div>
                    )}
                    
                    {chofer.phone && (
                      <div className="flex items-center space-x-2 text-sm text-gray-700">
                        <Phone className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span className="truncate">{chofer.phone}</span>
                      </div>
                    )}
                    
                    {chofer.city && (
                      <div className="flex items-center space-x-2 text-sm text-gray-700">
                        <MapPin className="h-4 w-4 text-orange-500 flex-shrink-0" />
                        <span className="truncate">{chofer.city}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Vehicle Information Section */}
                  {chofer.truck_plate || getTruckDisplayName(chofer) !== 'Sin información de vehículo' ? (
                    <div className="mb-3 p-3 bg-gray-50 rounded-md">
                      <div className="flex items-center space-x-2 text-sm">
                        <Truck className="h-4 w-4 text-purple-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            {getTruckDisplayName(chofer)}
                          </div>
                          {chofer.truck_plate && (
                            <div className="text-xs text-gray-600 mt-1">
                              Placa: {chofer.truck_plate}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <div className="flex items-center space-x-2 text-sm text-yellow-700">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        <span className="text-xs">Sin información de vehículo</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Footer Section */}
                  <div className="mt-auto space-y-2">
                    {/* Document Status */}
                    {(chofer.documents_count || 0) > 0 && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1 text-xs text-gray-600">
                          <FileText className="h-3 w-3" />
                          <span>{chofer.documents_count} doc{(chofer.documents_count || 0) !== 1 ? 's' : ''}</span>
                        </div>
                        {(chofer.expired_documents_count || 0) > 0 && (
                          <Badge variant="destructive" className="text-xs h-5">
                            {chofer.expired_documents_count} vencido{(chofer.expired_documents_count || 0) !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    )}
                    
                    {/* Creation Date */}
                    {chofer.created_at && (
                      <div className="flex items-center space-x-1 text-xs text-gray-500 pt-2 border-t">
                        <Calendar className="h-3 w-3" />
                        <span>Agregado: {new Date(chofer.created_at).toLocaleDateString('es-DO')}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">
                Mostrando {startIndex + 1} a {Math.min(endIndex, filteredChoferes.length)} de {filteredChoferes.length} choferes
              </p>
              
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                
                <span className="flex items-center px-4 text-sm">
                  Página {currentPage} de {totalPages}
                </span>
                
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <AddChoferModal
        isOpen={addChoferModalOpen}
        onClose={() => setAddChoferModalOpen(false)}
        onChoferCreated={handleChoferCreated}
      />

      <ChoferModal
        isOpen={choferModalOpen}
        onClose={() => {
          setChoferModalOpen(false)
          setChoferToEdit(null)
        }}
        chofer={choferToEdit}
        onChoferUpdated={handleChoferUpdated}
      />

      {/* Remove from Group Modal */}
      <AlertDialog open={removeFromGroupModalOpen} onOpenChange={setRemoveFromGroupModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Chofer del Grupo</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres remover a{' '}
              <strong>{choferToRemove ? (getChoferFullName(choferToRemove) || (choferToRemove.email || choferToRemove.auth_email)) : ''}</strong>{' '}
              del grupo de choferes?
              <br /><br />
              Esta acción:
              <br />• Removerá al usuario del grupo de choferes
              <br />• El usuario mantendrá su cuenta y datos personales
              <br />• Ya no podrá recibir asignaciones de conduces
              <br />• Se puede volver a agregar al grupo después
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveFromGroup}
              disabled={isRemoving}
              className="bg-red-600 hover:bg-red-700"
            >
              {isRemoving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Removiendo...
                </>
              ) : (
                'Remover del Grupo'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
