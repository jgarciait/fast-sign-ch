"use client"

import React, { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { 
  User,
  Search,
  AlertCircle,
  CheckCircle,
  Truck,
  X,
  Info,
  ChevronLeft
} from "lucide-react"
import { toast } from "sonner"

import { getAvailableUsersForChoferes } from "@/app/actions/chofer-actions"
import { addUserToGroup, getChoferesGroup } from "@/app/actions/groups-actions"
import type { AvailableUser, ChoferWithProfile } from "@/types/chofer-types"

interface AddChoferModalProps {
  isOpen: boolean
  onClose: () => void
  onChoferCreated: (chofer: ChoferWithProfile) => void
}

export default function AddChoferModal({
  isOpen,
  onClose,
  onChoferCreated
}: AddChoferModalProps) {
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([])
  const [filteredUsers, setFilteredUsers] = useState<AvailableUser[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedUser, setSelectedUser] = useState<AvailableUser | null>(null)
  const [choferesGroupId, setChoferesGroupId] = useState<string>("")
  const [submitting, setSubmitting] = useState(false)
  
  // Form data for chofer details
  const [choferName, setChoferName] = useState("")

  // Load available users and choferes group when modal opens
  useEffect(() => {
    if (isOpen) {
      loadData()
    } else {
      // Reset state when modal closes
      setAvailableUsers([])
      setFilteredUsers([])
      setSearchTerm("")
      setSelectedUser(null)
      setChoferesGroupId("")
      setChoferName("")
    }
  }, [isOpen])

  // Helper functions
  const getUserDisplayName = (user: AvailableUser) => {
    // Use computed full_name if available, otherwise construct from first/last name
    if (user.full_name) return user.full_name
    
    const firstName = user.first_name || ''
    const lastName = user.last_name || ''
    const constructedName = `${firstName} ${lastName}`.trim()
    
    return constructedName || user.email || `Usuario ${user.id.slice(0, 8)}`
  }

  const getUserInitials = (user: AvailableUser) => {
    const displayName = getUserDisplayName(user)
    if (displayName && !displayName.startsWith('Usuario ')) {
      return displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }
    if (user.email) {
      return user.email.slice(0, 2).toUpperCase()
    }
    return '??'
  }

  // Filter users based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredUsers(availableUsers.filter(user => !user.is_chofer))
    } else {
      const term = searchTerm.toLowerCase()
      setFilteredUsers(
        availableUsers
          .filter(user => !user.is_chofer)
          .filter(user => {
            const displayName = getUserDisplayName(user).toLowerCase()
            const email = (user.email || '').toLowerCase()
            return displayName.includes(term) || email.includes(term)
          })
      )
    }
  }, [searchTerm, availableUsers])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load available users and choferes group in parallel
      const [usersResult, groupResult] = await Promise.all([
        getAvailableUsersForChoferes(),
        getChoferesGroup()
      ])

      if (usersResult.success && usersResult.data) {
        setAvailableUsers(usersResult.data)
      } else {
        toast.error(usersResult.error || "Error al cargar usuarios")
      }

      if (groupResult.success && groupResult.data) {
        setChoferesGroupId(groupResult.data.id)
      } else {
        toast.error(groupResult.error || "Error al cargar grupo de choferes")
      }
    } catch (error) {
      console.error("Error loading data:", error)
      toast.error("Error inesperado al cargar datos")
    } finally {
      setLoading(false)
    }
  }

  const handleUserSelect = (user: AvailableUser) => {
    setSelectedUser(user)
    // Always start with empty name - force user to enter complete name
    setChoferName("")
  }

  const handleSubmit = async () => {
    if (!selectedUser || !choferesGroupId) return
    
    // Validate name is provided
    const finalName = choferName.trim()
    if (!finalName) {
      toast.error("Por favor ingresa el nombre completo del chofer")
      return
    }

    setSubmitting(true)
    try {
      // Add user to choferes group
      const result = await addUserToGroup({
        user_id: selectedUser.id,
        group_id: choferesGroupId,
        role_in_group: 'member'
      })

      if (result.success) {
        // Update chofer profile with the provided name
        const nameParts = finalName.split(' ')
        const firstName = nameParts[0] || ''
        const lastName = nameParts.slice(1).join(' ') || ''
        
        // Try to update the chofer profile with the name
        const { createChoferProfile } = await import("@/app/actions/chofer-actions")
        await createChoferProfile({
          user_id: selectedUser.id,
          first_name: firstName,
          last_name: lastName,
          email: selectedUser.email
        })
        
        toast.success(`${finalName} agregado como chofer`)
        
        // Create chofer profile object for the callback
        const newChofer: ChoferWithProfile = {
          id: '', // Will be populated by database
          user_id: selectedUser.id,
          first_name: firstName,
          last_name: lastName,
          status: 'active',
          is_available: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          full_name: finalName,
          auth_email: selectedUser.email || '',
          auth_first_name: selectedUser.first_name,
          auth_last_name: selectedUser.last_name,
          role_in_group: 'member',
          assigned_at: new Date().toISOString(),
          documents_count: 0,
          expired_documents_count: 0
        }
        
        onChoferCreated(newChofer)
        onClose()
      } else {
        toast.error(result.error || "Error al agregar chofer")
      }
    } catch (error) {
      console.error("Error adding chofer:", error)
      toast.error("Error inesperado al agregar chofer")
    } finally {
      setSubmitting(false)
    }
  }



  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-2xl h-[95vh] max-h-[500px] sm:max-h-[600px] md:max-h-[700px] lg:max-h-[80vh] flex flex-col overflow-hidden m-2 sm:m-6">
        <DialogHeader className="flex-shrink-0 pb-2">
          <DialogTitle className="flex items-center space-x-2">
            <Truck className="h-5 w-5 text-green-600" />
            <span>Agregar Chofer</span>
          </DialogTitle>
          <DialogDescription className="text-sm">
            Selecciona un usuario existente para agregarlo al grupo de choferes. 
            Podrás completar su información de perfil después.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1">
          {!selectedUser ? (
            <>
              {/* Search */}
              <div className="space-y-2 flex-shrink-0">
                <Label className="text-sm">Buscar Usuario</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por nombre o email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                    disabled={loading}
                  />
                </div>
              </div>

              <Separator className="flex-shrink-0" />
            </>
          ) : null}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-6 flex-1">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
                <span className="text-sm text-gray-600">Cargando usuarios...</span>
              </div>
            </div>
          )}

          {/* No Users Available */}
          {!loading && filteredUsers.length === 0 && (
            <div className="text-center py-6 text-gray-500 flex-1 flex items-center justify-center">
              <div className="max-w-xs">
                <User className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                <p className="font-medium text-sm mb-1">
                  {searchTerm ? 'No se encontraron usuarios' : 'No hay usuarios disponibles'}
                </p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {searchTerm 
                    ? 'Intenta con un término de búsqueda diferente'
                    : 'Todos los usuarios ya son choferes o no hay usuarios en el sistema'
                  }
                </p>
              </div>
            </div>
          )}

          {/* User Selection or Name Form */}
          {!selectedUser ? (
            // Show user list if no user selected
            !loading && filteredUsers.length > 0 && (
              <div className="space-y-2 flex-1 min-h-0">
                <Label className="flex items-center justify-between">
                  <span>Usuarios Disponibles</span>
                  <Badge variant="secondary" className="text-xs">
                    {filteredUsers.length} usuario{filteredUsers.length !== 1 ? 's' : ''}
                  </Badge>
                </Label>
                <div className="flex-1 min-h-[200px] max-h-[300px] overflow-y-auto space-y-2 border rounded-md p-2 bg-gray-50">
                  {filteredUsers.map((user) => (
                    <Card 
                      key={user.id}
                      className="cursor-pointer transition-all hover:shadow-sm bg-white hover:border-green-300 hover:bg-green-50"
                      onClick={() => handleUserSelect(user)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center space-x-3">
                          <Avatar className="flex-shrink-0">
                            <AvatarFallback className="bg-blue-100 text-blue-600 text-sm">
                              {getUserInitials(user)}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{getUserDisplayName(user)}</div>
                            {user.email && (
                              <div className="text-xs text-gray-500 truncate">{user.email}</div>
                            )}
                            {user.created_at && (
                              <div className="text-xs text-gray-400">
                                Registro: {new Date(user.created_at).toLocaleDateString('es-DO')}
                              </div>
                            )}
                          </div>

                          <div className="flex-shrink-0">
                            <div className="h-5 w-5 border-2 border-gray-300 rounded-full hover:border-green-400"></div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )
          ) : (
            // Show name form when user is selected
            <div className="space-y-4 flex-1">
              {/* Selected User Display */}
              <div>
                <Label className="text-sm">Usuario Seleccionado</Label>
                <Card className="mt-2 border-green-200 bg-green-50">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <Avatar className="flex-shrink-0">
                        <AvatarFallback className="bg-green-100 text-green-600">
                          {getUserInitials(selectedUser)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-green-900">
                          {selectedUser.email}
                        </div>
                        <div className="text-sm text-green-700">
                          ID: {selectedUser.id.slice(0, 8)}...
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedUser(null)
                          setChoferName("")
                        }}
                        className="text-green-700 hover:text-green-900 flex-shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Name Input Form - Prominently displayed */}
              <div className="space-y-3">
                <div>
                  <Label htmlFor="chofer_name" className="text-base font-semibold text-gray-900">
                    Nombre Completo del Chofer *
                  </Label>
                  <p className="text-sm text-gray-600 mt-1 mb-3">
                    Este será el nombre que aparecerá en las tarjetas y asignaciones
                  </p>
                  <input
                    id="chofer_name"
                    type="text"
                    value={choferName}
                    onChange={(e) => setChoferName(e.target.value)}
                    placeholder="Ej: Juan Carlos Pérez García"
                    className="w-full px-3 py-2 text-lg font-medium border border-gray-300 rounded-md transition-colors duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-50 disabled:text-gray-500"
                    style={{ outline: 'none' }}
                    disabled={submitting}
                    autoFocus
                  />
                </div>
                
                {/* Preview of how it will look */}
                {choferName.trim() && (
                  <div className="mt-3">
                    <Label className="text-sm text-gray-600">Vista Previa:</Label>
                    <Card className="mt-2 border-blue-200 bg-blue-50">
                      <CardContent className="p-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-600">
                              {choferName.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-blue-900">{choferName.trim()}</div>
                            <div className="text-sm text-blue-700">{selectedUser.email}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <div className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-700">
                    <p className="font-medium">¡Listo para agregar!</p>
                    <p className="text-xs mt-1">Después podrás completar información del vehículo, teléfono y documentos desde la página de choferes.</p>
                  </div>
                </div>
              </div>
            </div>
          )}


        </div>

        <DialogFooter className="flex-shrink-0 flex flex-col sm:flex-row gap-2 pt-4 border-t">
          {/* Show different footer based on selection state */}
          {!selectedUser ? (
            <div className="flex items-center justify-center w-full py-2">
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Info className="h-4 w-4" />
                <span>Selecciona un usuario para continuar</span>
              </div>
            </div>
          ) : (
            <>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSelectedUser(null)
                  setChoferName("")
                }} 
                disabled={submitting}
                className="w-full sm:w-auto order-2 sm:order-1"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Cambiar Usuario
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={!choferName.trim() || submitting}
                className="bg-green-600 hover:bg-green-700 w-full sm:w-auto order-1 sm:order-2"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creando Chofer...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Crear Chofer
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
