"use client"

import { useState, useEffect, use, useRef } from "react"
import { useRouter } from "next/navigation"
import { FileText, Upload, Trash2, ArrowLeft, X, FolderOpen, ChevronDown, Info, Edit3, Unlink, ChevronLeft, ChevronRight, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import PdfAnnotationEditor from "@/components/pdf-annotation-editor"
import { PdfErrorBoundary } from "@/components/pdf-error-boundary"
import FastSignAquariusModal from "@/components/fast-sign-aquarius-modal"
import FileRecordSelector from "@/components/file-record-selector"


interface FastSignAnnotation {
  id: string
  type: "signature" | "text"
  x: number
  y: number
  width: number
  height: number
  content?: string
  imageData?: string
  signatureSource?: "canvas" | "wacom"
  page: number
  relativeX?: number
  relativeY?: number
  relativeWidth?: number
  relativeHeight?: number
  timestamp: string
}

interface DocumentSidebarProps {
  document: {
    id: string
    file_name: string
    file_path: string
  }
  annotations: FastSignAnnotation[]
  linkedFileRecord?: any
  onPrint: () => void
  onSendToAquarius: () => void
  onDelete: () => void
  onSave: () => void
  onLinkToFileRecord: () => void
  onUnlinkFileRecord: () => void
  onGoToPage?: (page: number) => void
  onDeleteSignature?: (id: string) => Promise<void>
  isPrinting: boolean
  isSaving: boolean
  lastUpdated?: Date | null
  documentCreated?: Date | null
  hasUnsavedChanges?: boolean
  isOpen?: boolean
  onClose?: () => void
}

function DocumentSidebar({
  document,
  annotations,
  linkedFileRecord,
  onPrint,
  onSendToAquarius,
  onDelete,
  onSave,
  onLinkToFileRecord,
  onUnlinkFileRecord,
  onGoToPage,
  onDeleteSignature,
  isPrinting,
  isSaving,
  lastUpdated,
  documentCreated,
  hasUnsavedChanges = false,
  isOpen = true,
  onClose,
}: DocumentSidebarProps) {
  const signatureCount = annotations.filter((a) => a.type === "signature").length
  const [isCompact, setIsCompact] = useState(false)

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />

          {/* Sidebar */}
          <div
            className={`relative ${isCompact ? 'w-16' : 'w-72'} max-w-sm border-l border-border flex flex-col shadow-lg ml-auto transition-all duration-300`}
            style={{ backgroundColor: "#FFFFFF" }}
          >
            {/* Mobile close button */}
            <div className="lg:hidden absolute top-4 left-4 z-10">
              <button
                onClick={onClose}
                className="p-2 rounded-md bg-white shadow-md border border-gray-200 hover:bg-gray-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Sidebar content */}
            <SidebarContent
              document={document}
              annotations={annotations}
              linkedFileRecord={linkedFileRecord}
              onPrint={onPrint}
              onSendToAquarius={onSendToAquarius}
              onDelete={onDelete}
              onSave={onSave}
              onLinkToFileRecord={onLinkToFileRecord}
              onUnlinkFileRecord={onUnlinkFileRecord}
              onGoToPage={onGoToPage}
              onDeleteSignature={onDeleteSignature}
              isPrinting={isPrinting}
              isSaving={isSaving}
              signatureCount={signatureCount}
              isCompact={isCompact}
              onToggleCompact={() => setIsCompact(!isCompact)}
              hasUnsavedChanges={hasUnsavedChanges}
            />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div
        className={`hidden lg:flex ${isCompact ? 'w-16' : 'w-72'} border-l border-border flex-col shadow-lg transition-all duration-300`}
        style={{ backgroundColor: "#FFFFFF" }}
      >
        <SidebarContent
          document={document}
          annotations={annotations}
          linkedFileRecord={linkedFileRecord}
          onPrint={onPrint}
          onSendToAquarius={onSendToAquarius}
          onDelete={onDelete}
          onSave={onSave}
          onLinkToFileRecord={onLinkToFileRecord}
          onUnlinkFileRecord={onUnlinkFileRecord}
          onGoToPage={onGoToPage}
          onDeleteSignature={onDeleteSignature}
          isPrinting={isPrinting}
          isSaving={isSaving}
          lastUpdated={lastUpdated}
          signatureCount={signatureCount}
          isCompact={isCompact}
          onToggleCompact={() => setIsCompact(!isCompact)}
          hasUnsavedChanges={hasUnsavedChanges}
        />
      </div>
    </>
  )
}

function SidebarContent({
  document,
  annotations,
  linkedFileRecord,
  onPrint,
  onSendToAquarius,
  onDelete,
  onSave,
  onLinkToFileRecord,
  onUnlinkFileRecord,
  onGoToPage,
  onDeleteSignature,
  isPrinting,
  isSaving,
  lastUpdated,
  signatureCount,
  isCompact,
  onToggleCompact,
  hasUnsavedChanges,
}: {
  document: { id: string; file_name: string; file_path: string }
  annotations: FastSignAnnotation[]
  linkedFileRecord?: any
  onPrint: () => void
  onSendToAquarius: () => void
  onDelete: () => void
  onSave: () => void
  onLinkToFileRecord: () => void
  onUnlinkFileRecord: () => void
  onGoToPage?: (page: number) => void
  onDeleteSignature?: (id: string) => Promise<void>
  isPrinting: boolean
  isSaving: boolean
  lastUpdated?: Date | null
  signatureCount: number
  isCompact?: boolean
  onToggleCompact?: () => void
  hasUnsavedChanges?: boolean
}) {
  const [deleteSignatureId, setDeleteSignatureId] = useState<string | null>(null)

  // Si está en modo compacto, mostrar solo iconos
  if (isCompact) {
    return (
      <TooltipProvider>
        {/* Toggle button */}
        <div className="p-2 border-b border-border flex justify-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleCompact}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Expandir panel</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Compact action buttons */}
        <div className="flex flex-col gap-2 p-2">
          {/* Descargar PDF */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  onPrint()
                  if (onToggleCompact) onToggleCompact()
                }}
                disabled={isPrinting || signatureCount === 0}
                className="p-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <FileText className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Descargar PDF</p>
            </TooltipContent>
          </Tooltip>

          {/* Expediente - Moved after Descargar PDF */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  onLinkToFileRecord()
                  if (onToggleCompact) onToggleCompact()
                }}
                className={`p-3 rounded-lg transition-colors ${linkedFileRecord
                  ? "text-green-700 bg-green-50 hover:bg-green-100"
                  : "text-blue-700 bg-blue-50 hover:bg-blue-100 animate-pulse-blue-border"
                  }`}
              >
                <FolderOpen className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Expediente</p>
            </TooltipContent>
          </Tooltip>

          {/* Enviar Aquarius */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  onSendToAquarius()
                  if (onToggleCompact) onToggleCompact()
                }}
                disabled={signatureCount === 0}
                className="p-3 rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Upload className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Enviar Aquarius</p>
            </TooltipContent>
          </Tooltip>

          {/* Eliminar */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  onDelete()
                  if (onToggleCompact) onToggleCompact()
                }}
                className="p-3 rounded-lg border border-red-300 text-red-700 bg-white hover:bg-red-50 transition-colors"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Eliminar documento</p>
            </TooltipContent>
          </Tooltip>

          {/* Firmas */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative">
                <button
                  onClick={onToggleCompact}
                  className="p-3 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  <Edit3 className="h-5 w-5" />
                </button>
                {signatureCount > 0 && (
                  <div className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {signatureCount}
                  </div>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Firmas ({signatureCount})</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    )
  }

  // Vista expandida normal
  return (
    <TooltipProvider>
      {/* Sidebar header */}
      <div className="p-4 border-b border-border">
        {/* Toggle button */}
        <div className="justify-start">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleCompact}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Compactar panel</p>
            </TooltipContent>
          </Tooltip>
        </div>


        {/* Document Timestamp - Always show creation or last update time */}
        {lastUpdated && (
          <div className="w-full text-center mb-3">
            <span className="text-xs text-muted-foreground">
              Última actualización: {lastUpdated.toLocaleString()}
            </span>
          </div>
        )}

        {/* Unsaved Changes Notice */}
        {hasUnsavedChanges && (
          <div className="w-full text-center mb-3">
            <span className="text-xs text-orange-600 font-medium">Cambios sin guardar</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Update Document Button */}
          <button
            onClick={onSave}
            disabled={isSaving}
            className={`w-full inline-flex items-center justify-center px-4 py-3 shadow-sm text-sm font-medium rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${hasUnsavedChanges ? 'hover:bg-orange-600' : 'hover:bg-blue-800'
              }`}
            style={{
              backgroundColor: hasUnsavedChanges ? "#ea580c" : "#0d2340",
            }}
            title="Actualizar documento con anotaciones y firmas actuales"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Actualizando...
              </>
            ) : (
              <>
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Actualizar Documento
              </>
            )}
          </button>

          {/* Print Button */}
          <button
            onClick={onPrint}
            disabled={isPrinting || signatureCount === 0}
            className="w-full inline-flex items-center justify-center px-4 py-3 shadow-sm text-sm font-medium rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "#0d2340",
            }}
            title={signatureCount === 0 ? "Agrega una firma antes de guardar" : "Guardar documento con firmas en PC"}
          >
            {isPrinting ? (
              <>
                <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Preparando Documento...
              </>
            ) : (
              <>
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                  />
                </svg>
                Guardar en PC
              </>
            )}
          </button>

          {/* Link to Case File Button - Moved after Print Button */}
          <button
            onClick={onLinkToFileRecord}
            className={`w-full inline-flex items-center justify-center px-4 py-3 shadow-sm text-sm font-medium rounded-lg transition-all duration-300 ${linkedFileRecord
              ? "text-green-700 bg-green-50 border border-green-300 hover:bg-green-100"
              : "text-blue-700 bg-white border border-blue-300 hover:bg-blue-50 animate-pulse-blue-border"
              }`}
            title={linkedFileRecord ? "Cambiar vinculación de expediente" : "Vincular documento a un expediente"}
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            {linkedFileRecord ? "Cambiar Expediente" : "Añadir a Expediente"}
          </button>

          {/* Send to Aquarius Button */}
          <button
            onClick={onSendToAquarius}
            disabled={signatureCount === 0}
            className="w-full inline-flex items-center justify-center px-4 py-3 shadow-sm text-sm font-medium rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={signatureCount === 0 ? "Agrega una firma antes de enviar a Aquarius" : "Enviar a Aquarius"}
          >
            <Upload className="h-4 w-4 mr-2" />
            Enviar a Aquarius
          </button>

          {/* Delete Button */}
          <button
            onClick={onDelete}
            className="w-full inline-flex items-center justify-center px-4 py-3 shadow-sm text-sm font-medium rounded-lg border border-red-300 text-red-700 bg-white hover:bg-red-50 transition-colors"
            title="Eliminar documento y todas las firmas"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar Documento
          </button>
        </div>
      </div>

      {/* Case File Section */}
      <div className="p-4 space-y-4 flex-1">
        {/* Linked Case File */}
        {linkedFileRecord && (
          <div>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="case-file" className="border border-green-200 rounded-lg">
                <AccordionTrigger className="px-3 py-2 hover:no-underline">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-700">
                        Documento en Expediente
                      </span>
                      <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                        {linkedFileRecord.filing_systems?.nombre || 'Expediente'}
                      </Badge>
                    </div>
                    <div
                      onClick={(e) => {
                        e.stopPropagation()
                        onUnlinkFileRecord()
                      }}
                      className="p-1 rounded-full hover:bg-red-100 transition-colors text-red-600 hover:text-red-700 cursor-pointer"
                      title="Desvincular del expediente"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          e.stopPropagation()
                          onUnlinkFileRecord()
                        }
                      }}
                    >
                      <Unlink className="h-4 w-4" />
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <div className="space-y-2">
                    {linkedFileRecord.filing_systems?.esquema_json?.indices?.map((field: any) => {
                      const value = linkedFileRecord.valores_json?.[field.clave]
                      if (value === undefined || value === null || value === '') return null

                      return (
                        <div key={field.clave} className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-gray-600">
                            {field.etiqueta}:
                          </span>
                          <span className="text-sm text-gray-900 bg-gray-50 px-2 py-1 rounded">
                            {field.tipo_dato === 'bool'
                              ? (value ? 'Sí' : 'No')
                              : field.tipo_dato === 'fecha'
                                ? new Date(value).toLocaleDateString()
                                : String(value)
                            }
                          </span>
                        </div>
                      )
                    })}
                    <div className="flex flex-col gap-1 pt-2 border-t border-gray-200">
                      <span className="text-xs font-medium text-gray-600">Creado:</span>
                      <span className="text-sm text-gray-900">
                        {new Date(linkedFileRecord.created_at).toLocaleString()}
                      </span>
                    </div>

                    {/* Link to Case File */}
                    <div className="pt-2 border-t border-gray-200">
                      <a
                        href={`/case-files/${linkedFileRecord.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                      >
                        <FolderOpen className="h-4 w-4" />
                        Ver Expediente Completo
                      </a>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}

        {/* Signatures Section */}
        {annotations.filter(a => a.type === "signature").length > 0 && (
          <div className="">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="signatures" className="border border-blue-200 rounded-lg">
                <AccordionTrigger className="px-3 py-2 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Edit3 className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">
                      Firmas en Documento
                    </span>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                      {annotations.filter(a => a.type === "signature").length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-2 pb-2">
                  <div className="relative">
                    {/* Scroll indicator for many signatures */}
                    {annotations.filter(a => a.type === "signature").length > 4 && (
                      <div className="absolute top-0 right-0 z-10 bg-gradient-to-b from-white via-white to-transparent h-6 w-4 pointer-events-none"></div>
                    )}

                    <div
                      className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-2"
                      style={{
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#d1d5db #f3f4f6'
                      }}
                    >
                      {annotations
                        .filter(a => a.type === "signature")
                        .map((signature, index) => (
                          <div
                            key={signature.id}
                            className="flex items-center justify-between px-2 py-2 bg-gray-50 rounded-md hover:bg-blue-50 transition-colors border border-gray-200 group"
                          >
                            {/* Signature info - compact layout */}
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-xs text-gray-600 font-medium flex-shrink-0">
                                {index + 1}.
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  // Trigger signature highlight pulse
                                  window.dispatchEvent(new CustomEvent('highlightSignature', {
                                    detail: { 
                                      signatureId: signature.id,
                                      page: signature.page,
                                      x: signature.x,
                                      y: signature.y,
                                      width: signature.width,
                                      height: signature.height
                                    }
                                  }))
                                  onGoToPage?.(signature.page)
                                }}
                                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                title={`Ir a página ${signature.page}`}
                              >
                                Ir a Pág. {signature.page}
                              </button>
                            </div>

                            {/* Action buttons - compact */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDeleteSignatureId(signature.id)
                                }}
                                className="p-1 text-red-500 hover:bg-red-100 rounded transition-colors opacity-80 group-hover:opacity-100"
                                title="Eliminar firma"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>

                    {/* Bottom scroll indicator */}
                    {annotations.filter(a => a.type === "signature").length > 4 && (
                      <div className="absolute bottom-0 right-0 z-10 bg-gradient-to-t from-white via-white to-transparent h-6 w-4 pointer-events-none"></div>
                    )}

                    {/* Scroll hint */}
                    {annotations.filter(a => a.type === "signature").length > 4 && (
                      <div className="text-center mt-2 pt-2 border-t border-gray-100">
                        <p className="text-xs text-gray-400">
                          Scroll para ver más firmas ({annotations.filter(a => a.type === "signature").length} total)
                        </p>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}
      </div>

      {/* Delete Signature Confirmation Dialog */}
      <Dialog open={!!deleteSignatureId} onOpenChange={() => setDeleteSignatureId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar esta firma? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteSignatureId(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (deleteSignatureId && onDeleteSignature) {
                  await onDeleteSignature(deleteSignatureId)
                  setDeleteSignatureId(null)
                }
              }}
            >
              Eliminar Firma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}

export default function FastSignEditPage({ params }: { params: Promise<{ documentId: string }> }) {
  // Add CSS for blue border pulse animation
  const bluePortalPulseStyles = `
    @keyframes pulse-blue-border {
      0%, 100% {
        border-color: #3b82f6;
        box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
      }
      50% {
        border-color: #1d4ed8;
        box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
      }
    }
    .animate-pulse-blue-border {
      animation: pulse-blue-border 2s infinite;
    }
  `;
  const resolvedParams = use(params)
  const documentId = resolvedParams.documentId
  const router = useRouter()
  const { toast } = useToast()

  const [documentUrl, setDocumentUrl] = useState<string>("")
  const [documentName, setDocumentName] = useState<string>("")
  const [annotations, setAnnotations] = useState<FastSignAnnotation[]>([]) // Only NEW user annotations
  const [existingSignatures, setExistingSignatures] = useState<FastSignAnnotation[]>([]) // Only for sidebar display, NO overlay
  const [isPrinting, setIsPrinting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [activeVersion, setActiveVersion] = useState<'original' | 'signed'>('signed')
  const [showAquariusModal, setShowAquariusModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showFileRecordSelector, setShowFileRecordSelector] = useState(false)
  const [showUnlinkModal, setShowUnlinkModal] = useState(false)
  const [linkedFileRecord, setLinkedFileRecord] = useState<any>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [documentCreated, setDocumentCreated] = useState<Date | null>(null)
  const [hasVersioning, setHasVersioning] = useState<boolean>(false)
  const [isManualUpdate, setIsManualUpdate] = useState(false)

  // Load document and annotations on mount
  useEffect(() => {
    if (!documentId) return
    const loadDocument = async () => {
      try {
        setIsLoading(true)


        // Get document from database
        const response = await fetch(`/api/documents/${documentId}`)
        if (!response.ok) {
          throw new Error("Failed to fetch document")
        }

        const documentData = await response.json()

        // Set document state
        setDocumentUrl(documentData.file_url || documentData.url)
        setDocumentName(documentData.file_name)
        
        // Check if document has versioning (original_file_path exists)
        setHasVersioning(!!documentData.original_file_path)


        // Set document creation/update time
        if (documentData.updated_at) {
          setLastUpdated(new Date(documentData.updated_at))
        }
        if (documentData.created_at) {
          setDocumentCreated(new Date(documentData.created_at))
        }

        // Load linked file record if exists
        if (documentData.file_record_id) {
          try {
            const { getFileRecordById } = await import("@/app/actions/filing-system-actions")
            const fileRecordResult = await getFileRecordById(documentData.file_record_id)
            if (fileRecordResult.record) {
              setLinkedFileRecord(fileRecordResult.record)

            }
          } catch (error) {

          }
        }

        // Load annotations (text annotations)
        try {
          const annotationsResponse = await fetch(`/api/annotations/${documentId}`)
          if (annotationsResponse.ok) {
            const annotationsData = await annotationsResponse.json()

          }
        } catch (error) {

        }

        // Load signatures
        try {
          const signaturesResponse = await fetch(`/api/documents/${documentId}/signatures/check`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              token: Buffer.from("fast-sign-docs@view-all").toString("base64"),
              includeData: true,
            }),
          })

          if (signaturesResponse.ok) {
            const signaturesData = await signaturesResponse.json()



            if (signaturesData.signatures && signaturesData.signatures.length > 0) {
              // Convert signatures to annotations format
              const signatureAnnotations: FastSignAnnotation[] = []

              signaturesData.signatures.forEach((sigRecord: any, recordIndex: number) => {
                // Process ALL signature records regardless of recipient_email
                // This allows editing documents that originated in sent-to-sign


                if (sigRecord.signature_data?.signatures) {
                  // New format: signatures array
                  sigRecord.signature_data.signatures.forEach((sig: any, sigIndex: number) => {

                    // Ensure each signature has a unique ID
                    const signatureId = sig.id || `sig-${recordIndex}-${sigIndex}-${Date.now()}`

                    // Calculate missing relative dimensions from absolute ones if available
                    let relativeWidth = sig.relativeWidth
                    let relativeHeight = sig.relativeHeight
                    
                    // If relative dimensions are missing but absolute ones exist, calculate them
                    if (!relativeWidth && sig.width) {
                      relativeWidth = sig.width / 612 // 612 = STANDARD_PAGE_WIDTH
                    }
                    if (!relativeHeight && sig.height) {
                      relativeHeight = sig.height / 792 // 792 = STANDARD_PAGE_HEIGHT
                    }
                    
                    // Skip signatures without proper relative coordinates (X,Y are mandatory, W,H can be calculated)
                    if (!sig.relativeX || !sig.relativeY) {
                      console.warn('Fast-sign/edit: Signature missing essential relative coordinates (X,Y), skipping:', {
                        id: sig.id,
                        relativeX: sig.relativeX,
                        relativeY: sig.relativeY
                      })
                      return
                    }
                    
                    // If we still don't have dimensions, use fallback values
                    if (!relativeWidth) {
                      relativeWidth = 0.2 // 20% of page width as fallback
                    }
                    if (!relativeHeight) {
                      relativeHeight = 0.1 // 10% of page height as fallback
                    }

                    const loadedSignature = {
                      id: signatureId,
                      type: "signature" as const,
                      x: sig.x || (sig.relativeX * 612), // 612 = STANDARD_PAGE_WIDTH
                      y: sig.y || (sig.relativeY * 792), // 792 = STANDARD_PAGE_HEIGHT
                      width: sig.width || (relativeWidth * 612),
                      height: sig.height || (relativeHeight * 792),
                      page: sig.page || 1, // Direct page property, not sig.position.page
                      relativeX: sig.relativeX,
                      relativeY: sig.relativeY,
                      relativeWidth: relativeWidth, // Use calculated/corrected value
                      relativeHeight: relativeHeight, // Use calculated/corrected value
                      imageData: "", // No images stored in DB anymore
                      timestamp: sig.timestamp || sigRecord.signed_at,
                      signatureSource: sig.source || sigRecord.signature_source || "canvas",
                      content: `${signatureAnnotations.length + 1}`, // Add signature number for indexing
                    }



                    signatureAnnotations.push(loadedSignature)
                  })
                } else if (sigRecord.signature_data?.dataUrl) {
                  // Old format: direct signature data


                  // Ensure unique ID for old format
                  const signatureId = sigRecord.id || `sig-old-${recordIndex}-${Date.now()}`

                  const loadedOldSignature = {
                    id: signatureId,
                    type: "signature" as const,
                    x: sigRecord.signature_data.position?.x || 100,
                    y: sigRecord.signature_data.position?.y || 100,
                    width: sigRecord.signature_data.position?.width || 300,
                    height: sigRecord.signature_data.position?.height || 150,
                    page: sigRecord.signature_data.position?.page || 1,
                    relativeX: sigRecord.signature_data.position?.relativeX || 0.15,
                    relativeY: sigRecord.signature_data.position?.relativeY || 0.15,
                    relativeWidth: sigRecord.signature_data.position?.relativeWidth || 0.49,
                    relativeHeight: sigRecord.signature_data.position?.relativeHeight || 0.19,
                    imageData: sigRecord.signature_data.dataUrl || "",
                    timestamp: sigRecord.signature_data.timestamp || sigRecord.signed_at,
                    signatureSource: sigRecord.signature_source || "canvas",
                  }

                  console.log(`🔍 SIGNATURE INDEXING SYSTEM: Loaded legacy signature ${signatureId} with coordinates:`, {
                    coordinates: { x: loadedOldSignature.x, y: loadedOldSignature.y, width: loadedOldSignature.width, height: loadedOldSignature.height },
                    relativePosition: { relativeX: loadedOldSignature.relativeX, relativeY: loadedOldSignature.relativeY, relativeWidth: loadedOldSignature.relativeWidth, relativeHeight: loadedOldSignature.relativeHeight },
                    page: loadedOldSignature.page
                  })

                  signatureAnnotations.push(loadedOldSignature)
                } else {

                }
              })



              // Store existing signatures separately - NOT as annotations to avoid overlay
              setExistingSignatures(signatureAnnotations)
            } else {

            }
          }
        } catch (error) {

        }
      } catch (error) {

        router.push("/fast-sign?view=manage")
      } finally {
        setIsLoading(false)
      }
    }

    loadDocument()
  }, [documentId, router])

  // Track unsaved changes for manual save
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const handleSaveAnnotations = async (newAnnotations: FastSignAnnotation[]) => {
    // In edit mode, we track changes but don't auto-save


    // ENHANCED CHANGE DETECTION: Detect any signature movement or changes
    const hasAnyChange = (
      annotations.length !== newAnnotations.length || // Different count
      JSON.stringify(annotations) !== JSON.stringify(newAnnotations) || // Any content difference
      // Specifically check for position changes in signatures (most common change)
      newAnnotations.some(newAnn => {
        const oldAnn = annotations.find(a => a.id === newAnn.id)
        if (!oldAnn) return true // New annotation

        // Check if position changed (with small tolerance for floating point)
        const tolerance = 0.001
        return (
          Math.abs((oldAnn.x || 0) - (newAnn.x || 0)) > tolerance ||
          Math.abs((oldAnn.y || 0) - (newAnn.y || 0)) > tolerance ||
          Math.abs((oldAnn.relativeX || 0) - (newAnn.relativeX || 0)) > tolerance ||
          Math.abs((oldAnn.relativeY || 0) - (newAnn.relativeY || 0)) > tolerance ||
          oldAnn.page !== newAnn.page
        )
      })
    )



    if (hasAnyChange) {

    } else {

    }

    // OLD COMPLEX LOGIC (keeping for reference but not using)
    const previousIds = new Set(annotations.map(a => a.id))
    const newIds = new Set(newAnnotations.map(a => a.id))

    const hasAddedAnnotations = newAnnotations.some(a => !previousIds.has(a.id))
    const hasRemovedAnnotations = annotations.some(a => !newIds.has(a.id))
    const hasChangedPositions = newAnnotations.some(newAnn => {
      const oldAnn = annotations.find(a => a.id === newAnn.id)
      if (!oldAnn) return false

      // Use a small tolerance for floating point comparisons
      const tolerance = 0.001
      const positionChanged = (
        Math.abs((oldAnn.x || 0) - (newAnn.x || 0)) > tolerance ||
        Math.abs((oldAnn.y || 0) - (newAnn.y || 0)) > tolerance ||
        Math.abs((oldAnn.width || 0) - (newAnn.width || 0)) > tolerance ||
        Math.abs((oldAnn.height || 0) - (newAnn.height || 0)) > tolerance ||
        oldAnn.page !== newAnn.page ||
        Math.abs((oldAnn.relativeX || 0) - (newAnn.relativeX || 0)) > tolerance ||
        Math.abs((oldAnn.relativeY || 0) - (newAnn.relativeY || 0)) > tolerance ||
        Math.abs((oldAnn.relativeWidth || 0) - (newAnn.relativeWidth || 0)) > tolerance ||
        Math.abs((oldAnn.relativeHeight || 0) - (newAnn.relativeHeight || 0)) > tolerance
      )

      return positionChanged
    })

    // USE SIMPLIFIED LOGIC: If there's any change, mark as unsaved
    if (!hasAnyChange) {

      return
    }



    // Update local state immediately to keep UI responsive
    setAnnotations(newAnnotations)

    // Mark as having unsaved changes
    setHasUnsavedChanges(true)

  }





  const updateDocument = async () => {
    // Prevent multiple save operations
    if (isSaving) {

      return
    }

    setIsSaving(true)
    setIsManualUpdate(true) // Prevent auto-save during manual update



    try {








      // Dispatch a custom event to request current annotations from PDF editor
      const syncEvent = new CustomEvent('requestCurrentAnnotations', {
        detail: { requestId: Date.now() }
      })
      window.dispatchEvent(syncEvent)

      // Wait a moment for the response
      await new Promise(resolve => setTimeout(resolve, 100))

      // Check if we received updated annotations
      const potentialUpdatedAnnotations = (window as any).lastSyncedAnnotations
      if (potentialUpdatedAnnotations && Array.isArray(potentialUpdatedAnnotations)) {
        // Update our state with the synced data
        if (potentialUpdatedAnnotations.length !== annotations.length) {
          setAnnotations(potentialUpdatedAnnotations)
        }
      }



      // FORCE USE FRESHEST DATA: Use synced data if available, otherwise fall back to state
      const freshAnnotations = (window as any).lastSyncedAnnotations && Array.isArray((window as any).lastSyncedAnnotations)
        ? (window as any).lastSyncedAnnotations
        : annotations

      // Combine existing signatures with fresh annotations (new signatures + text annotations)
      const combinedAnnotations = [...existingSignatures, ...freshAnnotations]

      // Separate signatures from text annotations using COMBINED data
      const signatures = combinedAnnotations.filter((ann: any) => ann.type === "signature")
      const textAnnotations = combinedAnnotations.filter((ann: any) => ann.type !== "signature")





      // Save merged PDF and persist versions (signed + original path)
      try {

        const saveResponse = await fetch(`/api/fast-sign/${documentId}/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            signatures, 
            isEditMode: true // /fast-sign/edit accumulates on current document
          })
        })
        if (!saveResponse.ok) {
          const errorText = await saveResponse.text()
          throw new Error(`Failed to save merged PDF: ${errorText}`)
        }
        const saved = await saveResponse.json()

      } catch (error) {

        throw error
      }

      // Update text annotations using PUT method (replace all text annotations atomically)
      try {


        const updateAnnotationsResponse = await fetch(`/api/annotations/${documentId}`, {
          method: "PUT", // Use PUT for complete replacement
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            annotations: textAnnotations, // Send all current text annotations (empty array if none)
            token: Buffer.from("fast-sign-docs@view-all").toString("base64"),
          }),
        })

        if (!updateAnnotationsResponse.ok) {
          const errorText = await updateAnnotationsResponse.text()
          // Don't throw error for text annotations - signatures are more critical
        } else {

        }
      } catch (error) {
        // Don't throw error for text annotations - signatures are more critical
      }

      setLastUpdated(new Date())

      // Clear unsaved changes flag on successful save
      setHasUnsavedChanges(false)


    } catch (error) {

      
      // Enhanced error messaging for migration issues
      let errorMessage = "Failed to update document. Please try again."
      if (error instanceof Error) {
        if (error.message.includes('Migration Issue')) {
          errorMessage = `⚠️ ${error.message}\n\nThis document may need manual attention during the migration process.`
        } else if (error.message.includes('Failed to download')) {
          errorMessage = `🔄 Document file issue: ${error.message}\n\nThis may be a temporary migration issue. Please try again or contact support.`
        } else {
          errorMessage = error.message
        }
      }
      

      
      // Show user-friendly toast for migration issues
      toast({
        title: "Error al guardar",
        description: errorMessage,
        variant: "destructive",
        duration: 8000,
      })
    } finally {
      setIsSaving(false)
      setIsManualUpdate(false) // Re-enable auto-save
    }
  }

  const handlePrint = async () => {
    if (annotations.filter((a) => a.type === "signature").length === 0) {

      return
    }

    // Auto-save changes before printing
    if (hasUnsavedChanges) {


      try {
        await updateDocument()

      } catch (error) {

        return
      }
    }

    setIsPrinting(true)



    try {
      // Use the fast-sign print endpoint (now with proper PDF merging like view-signed)
      const printUrl = `/api/fast-sign/${documentId}/print`

      // Fetch the merged PDF first to ensure it's processed
      const response = await fetch(printUrl)

      if (!response.ok) {

        throw new Error(`Failed to generate PDF: ${response.statusText}`)
      }



      // Step 2: Create a blob URL for the merged PDF
      const pdfBlob = await response.blob()
      const blobUrl = URL.createObjectURL(pdfBlob)



      // Step 3: Create a temporary download link and click it to open in new tab
      const downloadLink = window.document.createElement("a")
      downloadLink.href = blobUrl
      downloadLink.target = "_blank"
      downloadLink.download = `SIGNED_${documentName}`

      // Add to DOM temporarily
      window.document.body.appendChild(downloadLink)

      // Click the link to open in new tab
      downloadLink.click()

      // Remove from DOM
      window.document.body.removeChild(downloadLink)



      // Clean up blob URL after a delay
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl)

      }, 10000) // Longer delay to ensure PDF is fully loaded


    } catch (error) {

    } finally {
      setIsPrinting(false)
    }
  }

  const handleSendToAquarius = () => {
    if (annotations.filter((a) => a.type === "signature").length === 0) {

      return
    }
    setShowAquariusModal(true)
  }

  const handleLinkToFileRecord = () => {

    setShowFileRecordSelector(true)
  }

  const handleCloseFileRecordSelector = () => {
    setShowFileRecordSelector(false)
  }

  const handleFileRecordSuccess = async (recordId: string) => {


    // Load the linked file record data
    try {
      const { getFileRecordById } = await import("@/app/actions/filing-system-actions")
      const fileRecordResult = await getFileRecordById(recordId)
      if (fileRecordResult.record) {
        setLinkedFileRecord(fileRecordResult.record)

      } else {

      }
    } catch (error) {

    }

    // Force a refresh of the document data to ensure file_record_id is updated
    try {

      const response = await fetch(`/api/documents/${documentId}`)
      if (response.ok) {
        const documentData = await response.json()


        if (documentData.file_record_id !== recordId) {

          toast({
            title: "Error de vinculación",
            description: "El documento no se vinculó correctamente. Intenta de nuevo.",
            variant: "destructive",
          })
          return
        }
      }
    } catch (error) {

    }


    setShowFileRecordSelector(false)

    toast({
      title: "Éxito",
      description: "Documento vinculado exitosamente al expediente",
    })
  }

  const handleUnlinkClick = () => {
    setShowUnlinkModal(true)
  }

  const handleUnlinkFileRecord = async () => {
    try {
      const { unlinkDocumentFromFileRecord } = await import("@/app/actions/filing-system-actions")
      const result = await unlinkDocumentFromFileRecord(documentId)

      if (result.error) {

      } else {
        setLinkedFileRecord(null)

      }
    } catch (error) {

    } finally {
      setShowUnlinkModal(false)
    }
  }

  const handleDeleteDocument = async () => {
    if (deleteConfirmText.toLowerCase() === "eliminar") {
      try {
        // Delete the document using the Fast Sign actions
        const { deleteFastSignDocument } = await import("@/app/actions/fast-sign-actions")
        const result = await deleteFastSignDocument(documentId)

        if (result.error) {
          throw new Error(result.error)
        }



        // Navigate back to manage
        router.push("/fast-sign?view=manage")
      } catch (error) {

      }

      setShowDeleteModal(false)
      setDeleteConfirmText("")
    }
  }

  const handleDeleteClick = () => {
    setShowDeleteModal(true)
    setDeleteConfirmText("")
  }

  const handleBack = () => {
    router.push("/fast-sign?view=manage")
  }

  const handleGoToPage = (page: number) => {
    // Dispatch custom event to notify PDF editor to go to specific page
    const event = new CustomEvent('goToPage', { detail: { page } })
    window.dispatchEvent(event)
  }

  const handleDeleteSignature = async (signatureId: string) => {
    const signatureToDelete = annotations.find(a => a.id === signatureId)

    try {

      
      // Delete signature from database first
      const response = await fetch(`/api/documents/${documentId}/signature`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signatureId: signatureId,
          token: Buffer.from("fast-sign@system").toString("base64")
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        toast({
          title: "Error",
          description: `No se pudo eliminar la firma: ${errorData.error || response.statusText}`,
          variant: "destructive"
        })
        return
      }



      // Remove signature from both local annotations and existing signatures
      const newAnnotations = annotations.filter(annotation => annotation.id !== signatureId)
      const newExistingSignatures = existingSignatures.filter(signature => signature.id !== signatureId)
      
      console.log('🔍 SIGNATURE INDEXING SYSTEM: Signature deleted, remaining signatures with state:', [...newExistingSignatures, ...newAnnotations].filter(a => a.type === "signature").map(s => ({
        id: s.id,
        page: s.page,
        coordinates: { x: s.x, y: s.y, width: s.width, height: s.height },
        relativePosition: { relativeX: s.relativeX, relativeY: s.relativeY, relativeWidth: s.relativeWidth, relativeHeight: s.relativeHeight }
      })))
      
      setAnnotations(newAnnotations)
      setExistingSignatures(newExistingSignatures)

      // Dispatch event to notify PDF editor of the deletion
      const deleteEvent = new CustomEvent('deleteAnnotation', { detail: { id: signatureId } })
      window.dispatchEvent(deleteEvent)

      toast({
        title: "Firma eliminada",
        description: "La firma se ha eliminado correctamente.",
      })


    } catch (error) {

      toast({
        title: "Error",
        description: "Error al eliminar la firma.",
        variant: "destructive"
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ backgroundColor: "#F8F9FB" }}>
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-blue-500 mb-4 mx-auto" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="text-lg font-medium text-gray-900 mb-2">Cargando documento...</p>
          <p className="text-sm text-gray-500">Por favor espera mientras cargamos tu documento para editar</p>
        </div>
      </div>
    )
  }

  if (!documentUrl) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ backgroundColor: "#F8F9FB" }}>
        <div className="text-center">
          <p className="text-lg font-medium text-gray-900 mb-2">Documento no encontrado</p>
          <Button onClick={handleBack}>Volver a Gestión de Documentos</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen relative">
      {/* Blue Border Pulse Animation Styles */}
      <style>{bluePortalPulseStyles}</style>

      {/* PDF Editor */}
      <div className="flex-1 w-full lg:w-auto overflow-hidden" style={{ backgroundColor: "#F8F9FB" }}>
        <div className="h-full">
          <PdfErrorBoundary>
            <PdfAnnotationEditor
              documentUrl={documentUrl}
              documentName={documentName}
              documentId={documentId}
              onBack={handleBack}
              onSave={handleSaveAnnotations}
              initialAnnotations={annotations} // Only new user annotations, never existing signatures
              readOnly={false}
              hideSaveButton={true}
              onOpenSidebar={() => window.dispatchEvent(new Event("openMainSidebar"))}
              onOpenRightSidebar={() => setIsMobileSidebarOpen(true)}
              showMappingToggle={true} // Enable signature mapping only for fast-sign/edit
            />
          </PdfErrorBoundary>
        </div>
      </div>

      {/* Right Sidebar */}
      <DocumentSidebar
        document={{
          id: documentId,
          file_name: documentName,
          file_path: documentId,
        }}
        annotations={[...existingSignatures, ...annotations]}
        linkedFileRecord={linkedFileRecord}
        onPrint={handlePrint}
        onSendToAquarius={handleSendToAquarius}
        onDelete={handleDeleteClick}
        onSave={updateDocument}
        onLinkToFileRecord={handleLinkToFileRecord}
        onUnlinkFileRecord={handleUnlinkClick}
        onGoToPage={handleGoToPage}
        onDeleteSignature={handleDeleteSignature}
        isPrinting={isPrinting}
        isSaving={isSaving}
        lastUpdated={lastUpdated}
        documentCreated={documentCreated}
        hasUnsavedChanges={hasUnsavedChanges}
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Top-right version selector */}
      <div className="absolute top-2 right-2 z-10">
        <div className="bg-white/90 backdrop-blur border rounded-md px-2 py-1 flex items-center gap-2 shadow-sm">
          <span className="text-xs text-gray-600">Versión:</span>
          <select
            className="text-xs border rounded px-1 py-0.5"
            value={activeVersion}
            onChange={async (e) => {
              const value = e.target.value as 'original' | 'signed'
              setActiveVersion(value)
              try {
                const res = await fetch(`/api/documents/${documentId}`)
                if (res.ok) {
                  const doc = await res.json()
                  const path = value === 'original' && doc.original_file_path ? doc.original_file_path : doc.file_path
                  // Create public URL using the standard Supabase URL format
                  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
                  const publicUrl = `${baseUrl}/storage/v1/object/public/public-documents/${path}`
                  setDocumentUrl(publicUrl)
                }
              } catch (error) {

              }
            }}
          >
            <option value="signed">Firmado</option>
            <option value="original">Original</option>
          </select>
        </div>
      </div>

      {/* Send to Aquarius Modal */}
      {showAquariusModal && (
        <FastSignAquariusModal
          isOpen={showAquariusModal}
          onClose={() => setShowAquariusModal(false)}
          documentId={documentId}
          documentName={documentName}
          onSuccess={() => {

          }}
        />
      )}

      {/* File Record Selector Modal */}
      <FileRecordSelector
        isOpen={showFileRecordSelector}
        onClose={handleCloseFileRecordSelector}
        onSuccess={handleFileRecordSuccess}
        documentId={documentId}
      />

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Eliminar Documento</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente tu documento y todas las firmas.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="delete-confirm" className="text-right">
                Escribe "eliminar"
              </Label>
              <Input
                id="delete-confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="col-span-3"
                placeholder="eliminar"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteDocument}
              disabled={deleteConfirmText.toLowerCase() !== "eliminar"}
            >
              Eliminar Documento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlink Confirmation Modal */}
      <Dialog open={showUnlinkModal} onOpenChange={setShowUnlinkModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Desvincular del Expediente</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que quieres desvincular este documento del expediente? Esta acción se puede deshacer vinculándolo de nuevo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnlinkModal(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleUnlinkFileRecord}
            >
              Desvincular Documento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
