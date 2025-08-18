"use client"

import { useState, useEffect } from "react"
import { FolderOpen, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { getDocumentArchiveInfo } from "@/app/actions/document-archive-actions"

interface UnarchiveDocumentModalProps {
  isOpen: boolean
  onClose: () => void
  documentId: string
  documentName: string
  onConfirm: () => void
}

export default function UnarchiveDocumentModal({
  isOpen,
  onClose,
  documentId,
  documentName,
  onConfirm
}: UnarchiveDocumentModalProps) {
  const [expedienteInfo, setExpedienteInfo] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const { toast } = useToast()

  // Load expediente information when modal opens
  useEffect(() => {
    if (isOpen && documentId) {
      loadExpedienteInfo()
    }
  }, [isOpen, documentId])

  const loadExpedienteInfo = async () => {
    setIsLoading(true)
    try {
      const result = await getDocumentArchiveInfo(documentId)
      
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive"
        })
        onClose()
        return
      }

      setExpedienteInfo(result.info)
    } catch (error) {
      console.error("Error loading expediente info:", error)
      toast({
        title: "Error",
        description: "Error cargando información del expediente",
        variant: "destructive"
      })
      onClose()
    } finally {
      setIsLoading(false)
    }
  }

  const getExpedienteName = () => {
    if (!expedienteInfo?.file_records) return "Expediente desconocido"
    
    const valores = expedienteInfo.file_records.valores_json || {}
    return valores.Nombre || valores.nombre || `Expediente ${expedienteInfo.file_records.id.slice(0, 8)}`
  }

  const getFilingSystemName = () => {
    return expedienteInfo?.file_records?.filing_systems?.nombre || "Sistema de archivo desconocido"
  }

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Desarchivar Documento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-6">
              <p className="text-gray-600">Cargando información del expediente...</p>
            </div>
          ) : expedienteInfo ? (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FolderOpen className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-amber-800 font-medium">
                      Este documento será desarchivado del siguiente expediente:
                    </p>
                    <div className="mt-2 space-y-1">
                      <p className="font-semibold text-amber-900">
                        {getExpedienteName()}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {getFilingSystemName()}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-600">
                  <strong>Documento:</strong> {documentName}
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>¿Qué sucederá?</strong>
                </p>
                <ul className="text-sm text-blue-700 mt-1 space-y-1 ml-4">
                  <li>• El documento se moverá de "Archivados" a "Activos"</li>
                  <li>• Se desvinculará del expediente</li>
                  <li>• Podrás organizarlo en otro expediente si lo deseas</li>
                </ul>
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <p className="text-gray-600">No se pudo cargar la información del expediente</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={isLoading || !expedienteInfo}
            className="bg-amber-600 hover:bg-amber-700"
          >
            Desarchivar Documento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
