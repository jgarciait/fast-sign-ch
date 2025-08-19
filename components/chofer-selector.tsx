"use client"

import React, { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Truck, User, Users, Search, AlertCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { getActiveChoferes } from "@/app/actions/chofer-actions"
import type { ChoferWithProfile } from "@/types/chofer-types"
import { getChoferFullName } from "@/types/chofer-types"

interface ChoferSelectorProps {
  selectedChoferId?: string
  onChoferSelect: (choferId: string, choferName?: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}

export default function ChoferSelector({
  selectedChoferId,
  onChoferSelect,
  disabled = false,
  placeholder = "Seleccionar chofer...",
  className = ""
}: ChoferSelectorProps) {
  const [choferes, setChoferes] = useState<ChoferWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [showDialog, setShowDialog] = useState(false)
  const [selectedChofer, setSelectedChofer] = useState<ChoferWithProfile | null>(null)

  useEffect(() => {
    loadChoferes()
  }, [])

  useEffect(() => {
    if (selectedChoferId && choferes.length > 0) {
      const chofer = choferes.find(c => c.user_id === selectedChoferId)
      setSelectedChofer(chofer || null)
    }
  }, [selectedChoferId, choferes])

  async function loadChoferes() {
    try {
      setLoading(true)
      setError(null)
      
      const result = await getActiveChoferes()
      
      if (result.success && result.data) {
        setChoferes(result.data)
      } else {
        setError(result.error || "Error al cargar choferes")
      }
    } catch (err) {
      console.error("Error loading choferes:", err)
      setError("Error inesperado al cargar choferes")
    } finally {
      setLoading(false)
    }
  }

  const filteredChoferes = choferes.filter(chofer => {
    if (!searchTerm) return true
    
    const displayName = getChoferDisplayName(chofer).toLowerCase()
    const email = (chofer.auth_email || chofer.email || "").toLowerCase()
    const search = searchTerm.toLowerCase()
    
    return displayName.includes(search) || email.includes(search)
  })

  const getChoferInitials = (chofer: ChoferWithProfile) => {
    const displayName = getChoferDisplayName(chofer)
    if (displayName && !displayName.startsWith('Usuario ')) {
      return displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }
    return '??'
  }

  const getChoferDisplayName = (chofer: ChoferWithProfile) => {
    // First try to get the full name from chofer profile
    const fullName = getChoferFullName(chofer)
    if (fullName) return fullName
    
    // Fallback to email
    return chofer.auth_email || chofer.email || `Usuario ${chofer.user_id.slice(0, 8)}`
  }

  const handleChoferSelect = (chofer: ChoferWithProfile) => {
    setSelectedChofer(chofer)
    onChoferSelect(chofer.user_id, getChoferDisplayName(chofer))
    setShowDialog(false)
  }

  if (loading) {
    return (
      <div className={`space-y-2 ${className}`}>
        <Label>Asignar a Chofer</Label>
        <Select disabled>
          <SelectTrigger>
            <SelectValue placeholder="Cargando choferes..." />
          </SelectTrigger>
        </Select>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`space-y-2 ${className}`}>
        <Label>Asignar a Chofer</Label>
        <div className="flex items-center space-x-2 p-3 border border-red-200 rounded-md bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <span className="text-sm text-red-600">{error}</span>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={loadChoferes}
            className="ml-auto"
          >
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  if (choferes.length === 0) {
    return (
      <div className={`space-y-2 ${className}`}>
        <Label>Asignar a Chofer</Label>
        <div className="flex items-center space-x-2 p-3 border border-yellow-200 rounded-md bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <span className="text-sm text-yellow-600">
            No hay choferes disponibles. Contacta al administrador.
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="flex items-center space-x-2">
        <Truck className="h-4 w-4" />
        <span>Asignar a Chofer</span>
        <Badge variant="secondary" className="ml-2">
          {choferes.length} disponible{choferes.length !== 1 ? 's' : ''}
        </Badge>
      </Label>

      {/* Simple Select for basic usage */}
      <div className="flex space-x-2">
        <Select
          value={selectedChoferId || ""}
          onValueChange={(value) => {
            const chofer = choferes.find(c => c.user_id === value)
            if (chofer) {
              handleChoferSelect(chofer)
            }
          }}
          disabled={disabled}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder={placeholder}>
              {selectedChofer && (
                <div className="flex items-center space-x-2">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-xs bg-blue-100 text-blue-600">
                      {getChoferInitials(selectedChofer)}
                    </AvatarFallback>
                  </Avatar>
                  <span>{getChoferDisplayName(selectedChofer)}</span>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {choferes.map((chofer) => (
              <SelectItem key={chofer.user_id} value={chofer.user_id}>
                <div className="flex items-center space-x-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs bg-blue-100 text-blue-600">
                      {getChoferInitials(chofer)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="font-medium">{getChoferDisplayName(chofer)}</span>
                    {(chofer.auth_email || chofer.email) && (
                      <span className="text-xs text-gray-500">{chofer.auth_email || chofer.email}</span>
                    )}
                  </div>
                  <Badge variant="outline" size="sm">
                    {chofer.role_in_group || 'member'}
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Advanced selection dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon" disabled={disabled}>
              <Users className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Truck className="h-5 w-5" />
                <span>Seleccionar Chofer</span>
              </DialogTitle>
              <DialogDescription>
                Elige el chofer que realizará la entrega de este documento.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por nombre o email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Choferes list */}
              <div className="max-h-64 overflow-y-auto space-y-2">
                {filteredChoferes.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    <User className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p>No se encontraron choferes</p>
                  </div>
                ) : (
                  filteredChoferes.map((chofer) => (
                    <div
                      key={chofer.user_id}
                      className={`
                        flex items-center space-x-3 p-3 rounded-md cursor-pointer transition-colors
                        ${selectedChoferId === chofer.user_id 
                          ? 'bg-blue-50 border-2 border-blue-200' 
                          : 'hover:bg-gray-50 border-2 border-transparent'
                        }
                      `}
                      onClick={() => handleChoferSelect(chofer)}
                    >
                      <Avatar>
                        <AvatarFallback className="bg-blue-100 text-blue-600">
                          {getChoferInitials(chofer)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1">
                        <div className="font-medium">{getChoferDisplayName(chofer)}</div>
                        {(chofer.auth_email || chofer.email) && (
                          <div className="text-sm text-gray-500">{chofer.auth_email || chofer.email}</div>
                        )}
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant="outline" size="sm">
                            {chofer.role_in_group || 'member'}
                          </Badge>
                          {chofer.role_in_group === 'supervisor' && (
                            <Badge variant="secondary" size="sm">Supervisor</Badge>
                          )}
                        </div>
                      </div>

                      {selectedChoferId === chofer.user_id && (
                        <div className="h-2 w-2 bg-blue-500 rounded-full" />
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Summary */}
              <div className="border-t pt-3 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Total choferes:</span>
                  <span className="font-medium">{choferes.length}</span>
                </div>
                {searchTerm && (
                  <div className="flex justify-between">
                    <span>Filtrados:</span>
                    <span className="font-medium">{filteredChoferes.length}</span>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Selected chofer info */}
      {selectedChofer && (
        <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-md border border-blue-200">
          <Avatar>
            <AvatarFallback className="bg-blue-100 text-blue-600">
              {getChoferInitials(selectedChofer)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="font-medium text-blue-900">
              {getChoferDisplayName(selectedChofer)}
            </div>
            <div className="text-sm text-blue-600">
              Rol: {selectedChofer.role_in_group || 'member'}
              {(selectedChofer.auth_email || selectedChofer.email) && ` • ${selectedChofer.auth_email || selectedChofer.email}`}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
