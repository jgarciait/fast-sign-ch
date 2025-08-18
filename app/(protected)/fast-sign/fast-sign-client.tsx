"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Upload, FileText, Trash2, FolderOpen, Plus, Info, Edit3, Unlink, X, ChevronDown, ChevronLeft, ChevronRight, Menu } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import PdfAnnotationEditor from "@/components/pdf-annotation-editor"
import FastSignAquariusModal from "@/components/fast-sign-aquarius-modal"
import { PdfErrorBoundary } from "@/components/pdf-error-boundary"

import { createFastSignDocument } from "@/app/actions/fast-sign-actions"
import { useRouter } from "next/navigation"
import { configurePdfJsWithFallback } from "@/utils/pdf-config"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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
  } | null
  annotations: FastSignAnnotation[]
  linkedFileRecord?: any
  onPrint: () => void
  onSendToAquarius: () => void
  onDelete: () => void
  onSave?: () => void
  onLinkToFileRecord: () => void
  onUnlinkFileRecord: () => void
  onGoToPage?: (page: number) => void
  onDeleteSignature?: (id: string) => Promise<void>
  isPrinting: boolean
  isSaved: boolean
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
  isSaved,
  isSaving,
  lastUpdated,
  documentCreated,
  hasUnsavedChanges = false,
  isOpen = true,
  onClose,
}: DocumentSidebarProps) {
  const signatureCount = annotations.filter((a) => a.type === "signature").length
  const [isCompact, setIsCompact] = useState(false)

  if (!document) {
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
              <div className="p-6 text-center text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>Sube un documento para comenzar</p>
              </div>
            </div>
          </div>
        )}

        {/* Desktop Sidebar */}
        <div
          className={`hidden lg:flex ${isCompact ? 'w-16' : 'w-72'} border-l border-border flex-col shadow-lg transition-all duration-300`}
          style={{ backgroundColor: "#FFFFFF" }}
        >
          <div className="p-6 text-center text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>Sube un documento para comenzar</p>
          </div>
        </div>
      </>
    )
  }

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
              isSaved={isSaved}
              lastUpdated={lastUpdated}
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
          isSaved={isSaved}
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
  isSaved,
}: {
  document: { id: string; file_name: string; file_path: string }
  annotations: FastSignAnnotation[]
  linkedFileRecord?: any
  onPrint: () => void
  onSendToAquarius: () => void
  onDelete: () => void
  onSave?: () => void
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
  isSaved: boolean
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
          {onSave && (
            <button
              onClick={onSave}
              disabled={isSaving}
              className={`w-full inline-flex items-center justify-center px-4 py-3 shadow-sm text-sm font-medium rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${hasUnsavedChanges ? 'hover:bg-orange-600' : 'hover:bg-blue-800'
                }`}
              style={{
                backgroundColor: hasUnsavedChanges ? "#ea580c" : "#0d2340",
              }}
              title="Guardar documento con anotaciones y firmas actuales"
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
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
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
                  Guardar Documento
                </>
              )}
            </button>
          )}

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
                              {onDeleteSignature && (
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
                              )}
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

export default function FastSignClient() {
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

  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [documentUrl, setDocumentUrl] = useState<string>("")
  const [documentId, setDocumentId] = useState<string>("")
  const [isUploading, setIsUploading] = useState(false)
  const [annotations, setAnnotations] = useState<FastSignAnnotation[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isPrinting, setIsPrinting] = useState(false)
  const [showAquariusModal, setShowAquariusModal] = useState(false)
  const [showDocumentManager, setShowDocumentManager] = useState(false)
  const [currentView, setCurrentView] = useState<"options" | "upload">("options")
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [isSaved, setIsSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [documentName, setDocumentName] = useState<string>("")
  const [hasInitialized, setHasInitialized] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Loading state tracking
  const [isComponentsReady, setIsComponentsReady] = useState(false)
  const [isPdfLoaded, setIsPdfLoaded] = useState(false)
  const [isPageDimensionsReady, setIsPageDimensionsReady] = useState(false)

  // Computed loading state - true when all components are ready
  const isFullyReady = isComponentsReady && isPdfLoaded && isPageDimensionsReady

  const [linkedFileRecord, setLinkedFileRecord] = useState<any>(null)
  const [showFileRecordSelector, setShowFileRecordSelector] = useState(false)
  const [showUnlinkModal, setShowUnlinkModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const router = useRouter()

  // Ref para el debounced save
  const debouncedSaveRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize enhanced PDF.js configuration
  useEffect(() => {
    configurePdfJsWithFallback()
  }, [])



  // Interceptar navegación cuando hay documento abierto
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (uploadedFile && annotations.length > 0 && !isSaved) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    const handleFirmasNavigation = (e: CustomEvent) => {
      // Show confirmation if there's any document loaded (saved or unsaved)
      if (uploadedFile || documentId) {
        e.preventDefault()
        setShowSaveConfirmModal(true)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('firmasNavigation', handleFirmasNavigation as EventListener)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('firmasNavigation', handleFirmasNavigation as EventListener)
    }
  }, [uploadedFile, documentId, annotations, isSaved])

  // Initialize view directly to upload
  useEffect(() => {
    // Ir directamente a upload, saltando la página de opciones
    setCurrentView("upload")

    if (!hasInitialized) {
      setHasInitialized(true)
    }
  }, [hasInitialized])

  const handleFileSelect = async (file: File) => {
    if (file.type !== "application/pdf") {
      setUploadError("Por favor selecciona un archivo PDF")
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      setUploadError("El tamaño del archivo debe ser menor a 50MB")
      return
    }

    setUploadedFile(file)
    setUploadError(null)
    setIsSaved(false)
    setDocumentName("") // Clear document name for new uploads

    // Create a blob URL for immediate viewing
    const blobUrl = URL.createObjectURL(file)
    setDocumentUrl(blobUrl)
    setDocumentId(`temp-${Date.now()}`) // Temporary ID

    // Immediately save document to prevent data loss
    await saveDocumentImmediately(file)
  }

  const saveDocumentImmediately = async (file: File) => {
    setIsSaving(true)

    try {
      // Show uploading toast
      toast({
        title: "Guardando documento...",
        description: "Guardando automáticamente para evitar pérdida de datos.",
      })



      // Upload to bucket
      const formData = new FormData()
      formData.append("file", file)

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload document to bucket")
      }

      const result = await uploadResponse.json()

      // Save to database
      const dbResult = await createFastSignDocument(
        file.name,
        result.path,
        result.url,
        file.size,
        file.type,
      )

      if (dbResult.error) {
        throw new Error(`Failed to save to database: ${dbResult.error}`)
      }

      // Update state with permanent URLs and IDs
      setDocumentId(dbResult.document.id)
      setDocumentUrl(result.url)
      setIsSaved(true)
      setDocumentName(file.name)
      setHasUnsavedChanges(false) // Document is saved, no unsaved changes

      // Clean up the blob URL
      if (documentUrl && documentUrl.startsWith("blob:")) {
        URL.revokeObjectURL(documentUrl)
      }



      toast({
        title: "✅ Documento guardado",
        description: "El documento se ha guardado automáticamente. Ahora puedes agregar firmas con seguridad.",
      })

    } catch (error) {
      console.error("Immediate save error:", error)
      toast({
        title: "❌ Error al guardar",
        description: "No se pudo guardar el documento automáticamente. Las firmas se guardarán cuando uses 'Actualizar Firmas'.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const unifiedSave = async (currentAnnotations?: FastSignAnnotation[]) => {
    // Cancel any pending debounced save
    if (debouncedSaveRef.current) {
      clearTimeout(debouncedSaveRef.current)
      debouncedSaveRef.current = null

    }

    // Use provided annotations or fall back to state
    const annotationsToSave = currentAnnotations || annotations

    if (!uploadedFile) {
      toast({
        title: "No hay documento para guardar",
        description: "Por favor sube un documento primero.",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)

    try {
      let currentDocumentId = documentId
      let currentDocumentUrl = documentUrl

      // Step 1: Save document to bucket and database if not already saved
      if (!isSaved) {
        // Show uploading toast
        toast({
          title: "Subiendo documento...",
          description: "Por favor espera mientras subimos tu documento al servidor.",
        })



        // Upload to bucket
        const formData = new FormData()
        formData.append("file", uploadedFile)

        const uploadResponse = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload document to bucket")
        }

        const result = await uploadResponse.json()

        // Show saving to database toast
        toast({
          title: "Saving document...",
          description: "Document uploaded successfully. Now saving to database...",
        })

        // Save to database - use the correct property name 'path'
        const dbResult = await createFastSignDocument(
          uploadedFile.name,
          result.path,
          result.url,
          uploadedFile.size,
          uploadedFile.type,
        )

        if (dbResult.error) {
          throw new Error(`Failed to save to database: ${dbResult.error}`)
        }

        // Update internal variables but DON'T update React state yet
        // This prevents PDF from reloading while we save annotations
        currentDocumentUrl = result.url
        currentDocumentId = dbResult.document.id



        // Update the document name for display
        setDocumentName(uploadedFile.name)
      } else {
        // Document already saved, just show updating toast if there are annotations
        if (annotationsToSave.length > 0) {
          toast({
            title: "Actualizando firmas...",
            description: "Guardando las firmas y anotaciones actualizadas.",
          })
        }
      }

      // Step 2: Save annotations and signatures if any exist
      if (annotationsToSave.length > 0) {


        // Separate signatures from text annotations
        const signatures = annotationsToSave.filter((ann) => ann.type === "signature")
        const textAnnotations = annotationsToSave.filter((ann) => ann.type !== "signature")



        // Use helper function to save annotations
        await saveAnnotationsToDatabase(annotationsToSave, currentDocumentId)
      }

      // Update React state only if document was not previously saved
      if (!isSaved) {
        setDocumentId(currentDocumentId)
        setDocumentUrl(currentDocumentUrl)
        setIsSaved(true)

        // Clean up the blob URL now that everything is saved
        if (documentUrl.startsWith("blob:")) {
          URL.revokeObjectURL(documentUrl)
        }
      }

      // Final success toast
      setLastUpdated(new Date())
      setHasUnsavedChanges(false) // Clear unsaved changes after successful save

      if (isSaved && annotationsToSave.length > 0) {
        // Document was already saved, just updated annotations
        toast({
          title: "✅ Firmas actualizadas",
          description: `Se han guardado ${annotationsToSave.filter((a) => a.type === "signature").length} firma(s) y ${annotationsToSave.filter((a) => a.type === "text").length} anotación(es).`,
        })
      } else {
        // Either new document or no annotations
        toast({
          title: "✅ Documento guardado exitosamente",
          description:
            annotationsToSave.length > 0
              ? `Tu documento con ${annotationsToSave.filter((a) => a.type === "signature").length} firma(s) y ${annotationsToSave.filter((a) => a.type === "text").length} anotación(es) ha sido guardado.`
              : "Tu documento ha sido guardado y puede ser gestionado desde la lista de documentos.",
        })
      }

    } catch (error) {
      console.error("Save error:", error)
      toast({
        title: "❌ Error al guardar",
        description: error instanceof Error ? error.message : "No se pudo guardar el documento. Intenta de nuevo.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteDocument = async () => {
    if (deleteConfirmText.toLowerCase() === "eliminar") {
      // Cancel any pending debounced save
      if (debouncedSaveRef.current) {
        clearTimeout(debouncedSaveRef.current)
        debouncedSaveRef.current = null

      }

      try {
        // If document is saved to database, delete it from there
        if (isSaved && documentId) {
          const { deleteFastSignDocument } = await import("@/app/actions/fast-sign-actions")
          const result = await deleteFastSignDocument(documentId)

          if (result.error) {
            toast({
              title: "Error al eliminar",
              description: result.error,
              variant: "destructive",
            })
            return
          }

          toast({
            title: "Documento eliminado",
            description: "El documento ha sido eliminado permanentemente.",
          })
        } else {
          // Document is only in browser cache, just clear it
          toast({
            title: "Documento eliminado",
            description: "Comenzando con un nuevo documento.",
          })
        }

        // Clean up blob URL if it exists
        if (documentUrl.startsWith("blob:")) {
          URL.revokeObjectURL(documentUrl)
        }

        // Reset all state
        setUploadedFile(null)
        setDocumentUrl("")
        setDocumentId("")
        setAnnotations([])
        setUploadError(null)
        setShowDeleteModal(false)
        setDeleteConfirmText("")
        setIsSaved(false)
        setIsSaving(false)
        setLinkedFileRecord(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      } catch (error) {
        console.error("Error deleting document:", error)
        toast({
          title: "Error",
          description: "Ocurrió un error al eliminar el documento.",
          variant: "destructive",
        })
      }
    }
  }

  const handleDeleteClick = () => {
    setShowDeleteModal(true)
    setDeleteConfirmText("")
  }

  // Debounced auto-save for fast-sign
  const pendingAnnotationsRef = useRef<FastSignAnnotation[]>([])

  const handleSaveAnnotations = async (newAnnotations: FastSignAnnotation[]) => {


    // ENHANCED CHANGE DETECTION: Same logic as fast-sign/edit
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



    // Update local state immediately for smooth UI
    setAnnotations(newAnnotations)

    // If changes detected and document is saved, mark as having unsaved changes
    if (hasAnyChange && isSaved) {

      setHasUnsavedChanges(true)
    } else if (hasAnyChange && !isSaved) {

    } else {

    }

    // REMOVED AUTO-SAVE LOGIC - No more debounced auto-save in fast-sign
    // Users must manually click the "Guardar Documento" button to save changes

  }

  // Cleanup debounced save on unmount
  useEffect(() => {
    return () => {
      if (debouncedSaveRef.current) {
        clearTimeout(debouncedSaveRef.current)
      }
    }
  }, [])



  const handlePrint = async () => {
    if (!isSaved) {
      toast({
        title: "Document not saved",
        description: "Please save the document first before printing.",
        variant: "destructive",
      })
      return
    }

    if (!documentUrl || annotations.filter((a) => a.type === "signature").length === 0) {
      toast({
        title: "No signatures to print",
        description: "Please add at least one signature before printing.",
        variant: "destructive",
      })
      return
    }

    setIsPrinting(true)



    try {
      // Cancel any pending debounced save and force immediate save
      if (debouncedSaveRef.current) {
        clearTimeout(debouncedSaveRef.current)
        debouncedSaveRef.current = null

      }

      // IMPORTANT: Save current annotations to database before printing

      await saveAnnotationsToDatabase(annotations)

      // Use the fast-sign print endpoint
      const printUrl = `/api/fast-sign/${documentId}/print`

      // Fetch the merged PDF first to ensure it's processed
      const response = await fetch(printUrl)

      if (!response.ok) {
        console.error("❌ Failed to generate merged PDF:", response.status, response.statusText)
        throw new Error(`Failed to generate PDF: ${response.statusText}`)
      }



      // Step 2: Create a blob URL for the merged PDF
      const pdfBlob = await response.blob()
      const blobUrl = URL.createObjectURL(pdfBlob)



      // Step 3: Create a temporary download link and click it to open in new tab
      const downloadLink = window.document.createElement("a")
      downloadLink.href = blobUrl
      downloadLink.target = "_blank"
      downloadLink.download = `SIGNED_${uploadedFile?.name || documentName || "document.pdf"}`

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

      toast({
        title: "Document ready",
        description: "The signed document has been opened in a new tab for printing.",
      })
    } catch (error) {
      console.error("❌ Error processing signed document for printing:", error)
      toast({
        title: "Print failed",
        description: "Failed to prepare document for printing.",
        variant: "destructive",
      })
    } finally {
      setIsPrinting(false)
    }
  }

  // Helper function to save annotations to database
  const saveAnnotationsToDatabase = async (annotationsToSave: FastSignAnnotation[], targetDocumentId?: string) => {
    const docId = targetDocumentId || documentId

    // Allow saving if we have a valid document ID (either from parameter or state)
    // and either the document is saved OR we have a target document ID (during initial save)
    if (!docId || (!isSaved && !targetDocumentId)) {

      return
    }

    try {
      // Separate signatures from text annotations
      const signatures = annotationsToSave.filter((a) => a.type === "signature")
      const textAnnotations = annotationsToSave.filter((a) => a.type !== "signature")

      // If there are signatures, use the new merged PDF save endpoint
      if (signatures.length > 0) {
        const saveResponse = await fetch(`/api/fast-sign/${docId}/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            signatures, 
            isEditMode: false // /fast-sign always uses original as base
          })
        })
        if (!saveResponse.ok) {
          const errorText = await saveResponse.text()
          throw new Error(`Failed to save merged PDF: ${errorText}`)
        }
        const saved = await saveResponse.json()

      }

      // Save text annotations separately if any
      if (textAnnotations.length > 0) {
        const annotationResponse = await fetch(`/api/annotations/${docId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            annotations: textAnnotations,
            token: Buffer.from("fast-sign@system").toString("base64"),
          }),
        })

        if (!annotationResponse.ok) {
          throw new Error("Failed to save text annotations")
        }

      }



    } catch (error) {
      console.error("❌ Error saving annotations to database:", error)
      throw error
    }
  }

  const handleSendToAquarius = () => {
    if (!isSaved) {
      toast({
        title: "Document not saved",
        description: "Please save the document first before sending to Aquarius.",
        variant: "destructive",
      })
      return
    }

    if (annotations.filter((a) => a.type === "signature").length === 0) {
      toast({
        title: "No signatures to send",
        description: "Please add at least one signature before sending to Aquarius.",
        variant: "destructive",
      })
      return
    }
    setShowAquariusModal(true)
  }

  // Custom Aquarius upload for Fast Sign documents
  const handleAquariusUpload = async (integrationId: string, token: string, doctype: string) => {
    try {
      // Get the signed PDF from the fast-sign print endpoint
      const printResponse = await fetch(`/api/fast-sign/${documentId}/print`)
      if (!printResponse.ok) {
        throw new Error("Failed to generate signed PDF")
      }

      const pdfBlob = await printResponse.blob()

      // Here you would call the Aquarius API to upload the document
      // For now, we'll just show a success message
      return {
        success: true,
        message: `Document "${uploadedFile?.name}" uploaded successfully to Aquarius!`,
        documentId: `FST-${Date.now()}`,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to upload document",
      }
    }
  }

  const handleStartSigning = () => {

    setCurrentView("upload")
  }

  // Force save function for sidebar - only save when there are unsaved changes
  const handleForceSave = async () => {
    // Only save if there are actual unsaved changes
    if (!hasUnsavedChanges) {
      toast({
        title: "Sin cambios",
        description: "No hay cambios para guardar.",
      })
      return
    }

    if (!isSaved || !documentId) {
      // If document isn't saved yet, use unifiedSave
      await unifiedSave(annotations)
    } else {
      try {
        setIsSaving(true)
        await saveAnnotationsToDatabase(annotations)
        setLastUpdated(new Date())
        setHasUnsavedChanges(false) // Clear unsaved changes after successful save
        toast({
          title: "Guardado exitoso",
          description: "Todas las anotaciones han sido guardadas.",
        })
      } catch (error) {
        console.error("❌ Force save failed:", error)
        toast({
          title: "Error al guardar",
          description: "No se pudieron guardar las anotaciones. Intenta de nuevo.",
          variant: "destructive",
        })
      } finally {
        setIsSaving(false)
      }
    }
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
        console.error("handleFileRecordSuccess: Failed to load file record:", fileRecordResult.error)
      }
    } catch (error) {
      console.warn("handleFileRecordSuccess: Failed to load linked file record after linking:", error)
    }

    // Force a refresh of the document data to ensure file_record_id is updated
    if (documentId && isSaved) {
      try {

        const response = await fetch(`/api/documents/${documentId}`)
        if (response.ok) {
          const documentData = await response.json()


          if (documentData.file_record_id !== recordId) {
            console.error("handleFileRecordSuccess: Mismatch! Expected recordId:", recordId, "but got:", documentData.file_record_id)
            toast({
              title: "Error de vinculación",
              description: "El documento no se vinculó correctamente. Intenta de nuevo.",
              variant: "destructive",
            })
            setShowFileRecordSelector(false)
            return
          }
        }
      } catch (error) {
        console.warn("handleFileRecordSuccess: Failed to refresh document data:", error)
      }
    }


    toast({
      title: "Éxito",
      description: "Documento vinculado exitosamente al expediente",
    })
    setShowFileRecordSelector(false)
  }

  const handleUnlinkClick = () => {
    setShowUnlinkModal(true)
  }

  const handleGoToPage = (page: number) => {
    // Only allow page navigation if everything is ready
    if (!isFullyReady) {
      toast({
        title: "Please wait",
        description: "The document is still loading. Please wait a moment.",
      })
      return
    }

    // Dispatch custom event to notify PDF editor to go to specific page
    const event = new CustomEvent('goToPage', { detail: { page } })
    window.dispatchEvent(event)
  }

  // PDF loading callbacks
  const handlePdfReady = () => {

    setIsPdfLoaded(true)
  }

  const handlePageDimensionsReady = () => {

    setIsPageDimensionsReady(true)
  }

  // Set components ready when component mounts
  useEffect(() => {
    setIsComponentsReady(true)
  }, [])

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
        console.error('Failed to delete signature from database:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        })
        toast({
          title: "Error",
          description: `No se pudo eliminar la firma: ${errorData.error || response.statusText}`,
          variant: "destructive"
        })
        return
      }



      // Remove signature from local annotations
      const newAnnotations = annotations.filter(annotation => annotation.id !== signatureId)

      setAnnotations(newAnnotations)

      // Mark as having unsaved changes if document is saved
      if (isSaved) {
        setHasUnsavedChanges(true)

      }

      // Dispatch event to notify PDF editor of the deletion
      const deleteEvent = new CustomEvent('deleteAnnotation', { detail: { id: signatureId } })
      window.dispatchEvent(deleteEvent)

      toast({
        title: "Firma eliminada",
        description: "La firma se ha eliminado correctamente.",
      })


    } catch (error) {
      console.error('Error deleting signature:', error)
      toast({
        title: "Error",
        description: "Error al eliminar la firma.",
        variant: "destructive"
      })
    }
  }

  const handleUnlinkFileRecord = async () => {
    try {
      const { unlinkDocumentFromFileRecord } = await import("@/app/actions/filing-system-actions")
      const result = await unlinkDocumentFromFileRecord(documentId)

      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      } else {
        setLinkedFileRecord(null)
        toast({
          title: "Éxito",
          description: "Documento desvinculado del expediente",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al desvincular documento del expediente",
        variant: "destructive",
      })
    } finally {
      setShowUnlinkModal(false)
    }
  }

  // Manejar confirmación de guardado antes de navegar
  const handleSaveAndNavigate = async () => {
    try {
      // Guardar cambios actuales si hay anotaciones
      if (annotations.length > 0) {
        await handleForceSave()
      }

      // Limpiar estado completamente
      setUploadedFile(null)
      setDocumentUrl("")
      setDocumentId("")
      setAnnotations([])
      setIsSaved(false)
      setIsSaving(false)
      setDocumentName("")
      setLastUpdated(null)
      setLinkedFileRecord(null)
      setShowSaveConfirmModal(false)

      // Forzar vista de upload
      setCurrentView("upload")

      // Navegar a nueva página de fast-sign
      router.push("/fast-sign")
      router.refresh()
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo guardar el documento",
        variant: "destructive",
      })
    }
  }

  const handleDiscardAndNavigate = () => {
    // Limpiar estado completamente sin guardar
    setUploadedFile(null)
    setDocumentUrl("")
    setDocumentId("")
    setAnnotations([])
    setIsSaved(false)
    setIsSaving(false)
    setDocumentName("")
    setLastUpdated(null)
    setLinkedFileRecord(null)
    setShowSaveConfirmModal(false)

    // Forzar vista de upload
    setCurrentView("upload")

    // Navegar a nueva página de fast-sign
    router.push("/fast-sign")
    router.refresh()
  }



  // Eliminamos la vista de opciones, vamos directo a upload

  // If no document is uploaded, show upload interface
  if (!uploadedFile || !documentUrl) {
    return (
      <div className="flex h-full relative" style={{ backgroundColor: "#F8F9FB" }}>
        {/* Blue Border Pulse Animation Styles */}
        <style>{bluePortalPulseStyles}</style>

        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-2xl w-full">


            {/* Mensaje claro en azul */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6 text-center">
              <p className="text-lg font-semibold text-blue-700">
                👆 Escoja Documento en su Ordenador para Comenzar a Firmar
              </p>
              <p className="text-blue-600 mt-1">
                Haga clic en el área de abajo o arrastre su archivo PDF aquí
              </p>
            </div>

            {uploadError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{uploadError}</p>
              </div>
            )}

            <div
              className="border-2 border-dashed border-blue-300 rounded-lg p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-gray-50 transition-colors animate-pulse"
              style={{
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.3)'
              }}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileChange}
                disabled={isUploading}
              />

              {isUploading ? (
                <div className="flex flex-col items-center">
                  <svg className="animate-spin h-12 w-12 text-blue-500 mb-4" viewBox="0 0 24 24">
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
                  <p className="text-lg font-medium text-gray-900 mb-2">Subiendo documento...</p>
                  <p className="text-sm text-gray-500">Por favor espera mientras procesamos tu archivo</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Upload className="h-16 w-16 text-gray-400 mb-4" />
                  <p className="text-xl font-medium text-gray-900 mb-2">Arrastra tu PDF aquí o haz clic para navegar</p>
                  <p className="text-sm text-gray-500 mb-4">Admite archivos PDF de hasta 50MB</p>
                  <div className="flex items-center space-x-2 text-xs text-gray-400">
                    <FileText className="h-4 w-4" />
                    <span>Solo documentos PDF</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DocumentSidebar
          document={null}
          annotations={annotations}
          linkedFileRecord={linkedFileRecord}
          onPrint={handlePrint}
          onSendToAquarius={handleSendToAquarius}
          onDelete={handleDeleteClick}
          onSave={handleForceSave}
          onLinkToFileRecord={handleLinkToFileRecord}
          onUnlinkFileRecord={handleUnlinkClick}
          onGoToPage={handleGoToPage}
          onDeleteSignature={handleDeleteSignature}
          isPrinting={isPrinting}
          isSaved={isSaved}
          isSaving={isSaving}
          lastUpdated={lastUpdated}
          hasUnsavedChanges={hasUnsavedChanges}
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
      </div>
    )
  }

  // Show document editor with signature capabilities
  return (
    <div className="flex h-full relative">
      {/* Blue Border Pulse Animation Styles */}
      <style>{bluePortalPulseStyles}</style>

      {/* PDF Editor */}
      <div className="flex-1 w-full lg:w-auto overflow-hidden" style={{ backgroundColor: "#F8F9FB" }}>
        <div className="h-full">
          {/* Loading Overlay */}
          {!isFullyReady && (
            <div className="absolute inset-0 bg-white bg-opacity-90 z-50 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-6"></div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Document Editor</h3>
                <p className="text-gray-600 mb-4">Please wait while we prepare everything for you...</p>
                <div className="space-y-2 text-sm text-gray-500">
                  <div className={`flex items-center justify-center ${isComponentsReady ? 'text-green-600' : ''}`}>
                    {isComponentsReady ? '✅' : '⏳'} Components: {isComponentsReady ? 'Ready' : 'Loading'}
                  </div>
                  <div className={`flex items-center justify-center ${isPdfLoaded ? 'text-green-600' : ''}`}>
                    {isPdfLoaded ? '✅' : '⏳'} PDF Document: {isPdfLoaded ? 'Ready' : 'Loading'}
                  </div>
                  <div className={`flex items-center justify-center ${isPageDimensionsReady ? 'text-green-600' : ''}`}>
                    {isPageDimensionsReady ? '✅' : '⏳'} Layout: {isPageDimensionsReady ? 'Ready' : 'Loading'}
                  </div>
                </div>
                <div className="mt-4 text-xs text-gray-400">
                  This ensures signature placement works correctly
                </div>
              </div>
            </div>
          )}

          <PdfErrorBoundary>
            <PdfAnnotationEditor
              documentUrl={documentUrl}
              documentName={uploadedFile?.name || documentName || "Document"}
              documentId={documentId}
              onBack={() => { }} // Not needed for fast sign
              onSave={handleSaveAnnotations}
              initialAnnotations={annotations}
              token={undefined} // No token for Fast Sign - enables local-only mode
              readOnly={false}
              hideSaveButton={true} // Hide the save button - use unified save in sidebar
              onOpenSidebar={() => window.dispatchEvent(new Event("openMainSidebar"))}
              onOpenRightSidebar={() => setIsMobileSidebarOpen(true)}
              onPdfReady={handlePdfReady}
              onPageDimensionsReady={handlePageDimensionsReady}
              showMappingToggle={true} // Enable signature mapping only for fast-sign
            />
          </PdfErrorBoundary>
        </div>
      </div>

      {/* Right Sidebar */}
      <DocumentSidebar
        document={{
          id: documentId,
          file_name: uploadedFile?.name || documentName || "Document",
          file_path: documentId,
        }}
        annotations={annotations}
        linkedFileRecord={linkedFileRecord}
        onPrint={handlePrint}
        onSendToAquarius={handleSendToAquarius}
        onDelete={handleDeleteClick}
        onSave={handleForceSave}
        onLinkToFileRecord={handleLinkToFileRecord}
        onUnlinkFileRecord={handleUnlinkClick}
        onGoToPage={handleGoToPage}
        onDeleteSignature={handleDeleteSignature}
        isPrinting={isPrinting}
        isSaved={isSaved}
        isSaving={isSaving}
        lastUpdated={lastUpdated}
        hasUnsavedChanges={hasUnsavedChanges}
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Send to Aquarius Modal */}
      {showAquariusModal && (
        <FastSignAquariusModal
          isOpen={showAquariusModal}
          onClose={() => setShowAquariusModal(false)}
          documentId={documentId}
          documentName={uploadedFile?.name || documentName || "Document"}
          onSuccess={() => {
            toast({
              title: "Documento enviado a Aquarius",
              description: "Tu documento firmado ha sido subido exitosamente.",
            })
          }}
        />
      )}

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

      {/* File Record Selector Modal */}
      {showFileRecordSelector && (
        <FileRecordSelector
          isOpen={showFileRecordSelector}
          onClose={handleCloseFileRecordSelector}
          onSuccess={handleFileRecordSuccess}
          documentId={documentId}
        />
      )}

      {/* Unlink Confirmation Modal */}
      <Dialog open={showUnlinkModal} onOpenChange={setShowUnlinkModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Desvincular del Expediente</DialogTitle>
            <DialogDescription>
              ¿Estás seguro que deseas desvincular este documento del expediente? Esta acción se puede revertir.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnlinkModal(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleUnlinkFileRecord}>
              Desvincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Confirmation Modal for Navigation */}
      <Dialog open={showSaveConfirmModal} onOpenChange={setShowSaveConfirmModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>¿Comenzar nuevo proceso de firma?</DialogTitle>
            <DialogDescription>
              {annotations.length > 0
                ? `Tienes un documento abierto con ${annotations.length} anotación${annotations.length !== 1 ? 'es' : ''}. ¿Qué deseas hacer antes de comenzar un nuevo proceso de firma?`
                : 'Tienes un documento abierto. ¿Deseas comenzar un nuevo proceso de firma?'
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowSaveConfirmModal(false)}>
              Cancelar
            </Button>
            {annotations.length > 0 ? (
              <>
                <Button
                  variant="destructive"
                  onClick={handleDiscardAndNavigate}
                >
                  Descartar Cambios
                </Button>
                <Button
                  onClick={handleSaveAndNavigate}
                  style={{ backgroundColor: "#0d2340" }}
                >
                  Guardar y Continuar
                </Button>
              </>
            ) : (
              <Button
                onClick={handleDiscardAndNavigate}
                style={{ backgroundColor: "#0d2340" }}
              >
                Comenzar Nuevo Proceso
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
