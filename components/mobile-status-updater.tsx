"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
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
import { 
  Truck,
  CheckCircle,
  XCircle,
  Package,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  MoreHorizontal
} from "lucide-react"

interface StatusAction {
  status: string
  label: string
  icon: React.ElementType
  color: string
  description: string
  isForward?: boolean
  requiresConfirmation?: boolean
}

interface MobileStatusUpdaterProps {
  currentStatus: string
  onStatusChange: (newStatus: string) => void
  disabled?: boolean
}

export function MobileStatusUpdater({ 
  currentStatus, 
  onStatusChange, 
  disabled = false 
}: MobileStatusUpdaterProps) {
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    action: StatusAction | null
  }>({ isOpen: false, action: null })

  const getAllActions = (status: string): StatusAction[] => {
    const actions: StatusAction[] = []

    // Forward actions (normal flow)
    switch (status) {
      case 'assigned':
        actions.push({
          status: 'in_transit',
          label: 'Marcar en Tránsito',
          icon: Truck,
          color: 'text-yellow-700',
          description: 'Indica que vas camino a entregar el documento',
          isForward: true,
          requiresConfirmation: true
        })
        break
      case 'in_transit':
        actions.push({
          status: 'completed',
          label: 'Completar Entrega',
          icon: CheckCircle,
          color: 'text-green-700',
          description: 'Marca la entrega como completada exitosamente',
          isForward: true,
          requiresConfirmation: true
        })
        break
      case 'completed':
        actions.push({
          status: 'signed',
          label: 'Marcar como Firmado',
          icon: CheckCircle,
          color: 'text-emerald-700',
          description: 'Confirma que el documento fue firmado',
          isForward: true,
          requiresConfirmation: true
        })
        break
    }

    // Backward actions (correction/rollback)
    switch (status) {
      case 'in_transit':
        actions.push({
          status: 'assigned',
          label: 'Regresar a Asignado',
          icon: ArrowLeft,
          color: 'text-blue-700',
          description: 'Regresa el estado a asignado',
          isForward: false,
          requiresConfirmation: true
        })
        break
      case 'completed':
        actions.push({
          status: 'in_transit',
          label: 'Regresar a En Tránsito',
          icon: ArrowLeft,
          color: 'text-yellow-700',
          description: 'Regresa el estado a en tránsito',
          isForward: false,
          requiresConfirmation: true
        })
        break
    }

    // Cancel option (always available except for completed/signed)
    if (!['completed', 'signed', 'cancelled'].includes(status)) {
      actions.push({
        status: 'cancelled',
        label: 'Cancelar Entrega',
        icon: XCircle,
        color: 'text-red-700',
        description: 'No se pudo completar la entrega por algún motivo',
        isForward: false,
        requiresConfirmation: true
      })
    }

    return actions
  }

  const handleActionClick = (action: StatusAction) => {
    if (action.requiresConfirmation) {
      setConfirmDialog({ isOpen: true, action })
    } else {
      onStatusChange(action.status)
    }
  }

  const handleConfirm = () => {
    if (confirmDialog.action) {
      onStatusChange(confirmDialog.action.status)
    }
    setConfirmDialog({ isOpen: false, action: null })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned': return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'in_transit': return 'bg-yellow-50 text-yellow-700 border-yellow-200'
      case 'completed': return 'bg-green-50 text-green-700 border-green-200'
      case 'signed': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'cancelled': return 'bg-red-50 text-red-700 border-red-200'
      default: return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'assigned': return 'Asignado'
      case 'in_transit': return 'En Tránsito'
      case 'completed': return 'Completado'
      case 'signed': return 'Firmado'
      case 'cancelled': return 'Cancelado'
      default: return status
    }
  }

  const actions = getAllActions(currentStatus)
  const forwardActions = actions.filter(a => a.isForward)
  const backwardActions = actions.filter(a => !a.isForward)

  return (
    <>
      <div className="space-y-2">
        {/* Primary forward action button */}
        {forwardActions.length > 0 && (
          <Button
            onClick={() => handleActionClick(forwardActions[0])}
            disabled={disabled}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            size="sm"
          >
            {React.createElement(forwardActions[0].icon, { className: "w-4 h-4 mr-2" })}
            {forwardActions[0].label}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}

        {/* More actions dropdown */}
        {actions.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full"
                size="sm"
                disabled={disabled}
              >
                <MoreHorizontal className="w-4 h-4 mr-2" />
                Más Opciones
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-72" align="center">
              <DropdownMenuLabel className={`${getStatusColor(currentStatus)} border-l-4`}>
                Estado Actual: {getStatusText(currentStatus)}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              {backwardActions.map((action) => (
                <DropdownMenuItem 
                  key={action.status}
                  onClick={() => handleActionClick(action)}
                  className="flex-col items-start py-3"
                >
                  <div className="flex items-center w-full">
                    {React.createElement(action.icon, { className: `w-4 h-4 mr-2 ${action.color}` })}
                    <span className="font-medium">{action.label}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 ml-6">
                    {action.description}
                  </p>
                </DropdownMenuItem>
              ))}
              
              {forwardActions.slice(1).map((action) => (
                <DropdownMenuItem 
                  key={action.status}
                  onClick={() => handleActionClick(action)}
                  className="flex-col items-start py-3"
                >
                  <div className="flex items-center w-full">
                    {React.createElement(action.icon, { className: `w-4 h-4 mr-2 ${action.color}` })}
                    <span className="font-medium">{action.label}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 ml-6">
                    {action.description}
                  </p>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog 
        open={confirmDialog.isOpen} 
        onOpenChange={(open) => setConfirmDialog({ isOpen: open, action: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Cambio de Estado</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.action && (
                <>
                  ¿Estás seguro que quieres <strong>{confirmDialog.action.label.toLowerCase()}</strong>?
                  <br /><br />
                  <span className="text-sm text-gray-600">
                    {confirmDialog.action.description}
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirm}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
