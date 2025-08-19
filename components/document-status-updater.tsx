"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  Truck, 
  Clock, 
  CheckCircle, 
  XCircle, 
  ChevronDown,
  MapPin,
  AlertTriangle 
} from "lucide-react"
import { updateDocumentStatus } from "@/app/actions/assignment-actions"
import { toast } from "sonner"

interface DocumentStatusUpdaterProps {
  documentId: string
  documentName: string
  currentStatus: string
  onStatusUpdate?: (newStatus: string) => void
  className?: string
}

type DocumentStatus = 'asignado' | 'en_transito' | 'firmado' | 'cancelado'

const statusConfig = {
  asignado: {
    label: 'Asignado',
    color: 'bg-blue-100 text-blue-800',
    icon: Clock,
    nextActions: ['en_transito', 'cancelado']
  },
  en_transito: {
    label: 'En Tránsito',
    color: 'bg-orange-100 text-orange-800',
    icon: Truck,
    nextActions: ['firmado', 'cancelado']
  },
  firmado: {
    label: 'Firmado',
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle,
    nextActions: [] // Final state
  },
  cancelado: {
    label: 'Cancelado',
    color: 'bg-red-100 text-red-800',
    icon: XCircle,
    nextActions: ['asignado'] // Can be reassigned
  }
}

const actionConfig = {
  en_transito: {
    label: 'Marcar en Tránsito',
    description: 'Indica que vas camino a entregar el documento',
    icon: MapPin,
    color: 'bg-orange-600 hover:bg-orange-700',
    requiresReason: false
  },
  firmado: {
    label: 'Marcar como Entregado',
    description: 'El documento fue entregado y firmado por el cliente',
    icon: CheckCircle,
    color: 'bg-green-600 hover:bg-green-700',
    requiresReason: false
  },
  cancelado: {
    label: 'Cancelar Entrega',
    description: 'No se pudo completar la entrega por algún motivo',
    icon: AlertTriangle,
    color: 'bg-red-600 hover:bg-red-700',
    requiresReason: true
  },
  asignado: {
    label: 'Reasignar',
    description: 'Volver a marcar como asignado',
    icon: Clock,
    color: 'bg-blue-600 hover:bg-blue-700',
    requiresReason: false
  }
}

export default function DocumentStatusUpdater({
  documentId,
  documentName,
  currentStatus,
  onStatusUpdate,
  className = ""
}: DocumentStatusUpdaterProps) {
  const [showReasonDialog, setShowReasonDialog] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<DocumentStatus | null>(null)
  const [reason, setReason] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const status = currentStatus.toLowerCase() as DocumentStatus
  const config = statusConfig[status] || statusConfig.asignado
  const CurrentIcon = config.icon

  const handleStatusChange = async (newStatus: DocumentStatus, reasonText?: string) => {
    setIsLoading(true)
    try {
      const result = await updateDocumentStatus(documentId, newStatus, reasonText)
      
      if (result.success) {
        toast.success(`Documento marcado como ${statusConfig[newStatus].label}`)
        onStatusUpdate?.(newStatus)
      } else {
        toast.error(`Error: ${result.error}`)
      }
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Error al actualizar el estatus')
    } finally {
      setIsLoading(false)
      setShowReasonDialog(false)
      setSelectedStatus(null)
      setReason("")
    }
  }

  const handleActionClick = (newStatus: DocumentStatus) => {
    const actionConf = actionConfig[newStatus]
    
    if (actionConf.requiresReason) {
      setSelectedStatus(newStatus)
      setShowReasonDialog(true)
    } else {
      handleStatusChange(newStatus)
    }
  }

  const handleConfirmWithReason = () => {
    if (selectedStatus && reason.trim()) {
      handleStatusChange(selectedStatus, reason.trim())
    }
  }

  return (
    <>
      <div className={`flex items-center gap-2 ${className}`}>
        {/* Current Status Badge */}
        <Badge className={`px-3 py-1 text-sm font-medium ${config.color}`}>
          <CurrentIcon className="w-4 h-4 mr-1" />
          {config.label}
        </Badge>

        {/* Status Update Dropdown */}
        {config.nextActions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                disabled={isLoading}
                className="text-xs"
              >
                Actualizar
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {config.nextActions.map((actionStatus) => {
                const actionConf = actionConfig[actionStatus]
                const ActionIcon = actionConf.icon
                
                return (
                  <DropdownMenuItem 
                    key={actionStatus}
                    onClick={() => handleActionClick(actionStatus)}
                    className="flex flex-col items-start p-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <ActionIcon className="w-4 h-4" />
                      <span className="font-medium">{actionConf.label}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {actionConf.description}
                    </span>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Reason Dialog */}
      <Dialog open={showReasonDialog} onOpenChange={setShowReasonDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Motivo requerido</DialogTitle>
            <DialogDescription>
              Por favor indica el motivo para {selectedStatus && actionConfig[selectedStatus].label.toLowerCase()}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo</Label>
              <Textarea
                id="reason"
                placeholder="Describe el motivo..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="min-h-20"
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowReasonDialog(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirmWithReason}
              disabled={!reason.trim() || isLoading}
              className={selectedStatus ? actionConfig[selectedStatus].color : ''}
            >
              {isLoading ? 'Actualizando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
