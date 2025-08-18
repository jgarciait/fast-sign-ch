"use client"

import React, { useMemo, useRef, useCallback, useEffect, Fragment, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useInView } from "react-intersection-observer"
import { useRouter } from "next/navigation"
import {
  Edit2,
  Trash2,
  Archive,
  FileText,
  ArchiveRestore,
  Mail,
  Eye,
  MoreVertical,
  Download,
  PenTool,
  FolderOpen
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { createPortal } from "react-dom"
import { formatDistanceToNow, format } from "date-fns"
import { es } from "date-fns/locale"

interface FileRecord {
  id: string
  valores_json: Record<string, any>
  created_at: string
  filing_systems: {
    id: string
    nombre: string
    filing_indices: Array<{
      clave: string
      etiqueta: string
      tipo_dato: string
      obligatorio: boolean
      orden: number
    }>
  }
}

interface Document {
  id: string
  file_name: string
  file_path: string
  file_size?: number
  file_type?: string
  status: string
  created_at: string
  creator?: {
    first_name?: string
    last_name?: string
    email: string
    full_name?: string
  }
  profiles?: {
    id: string
    email: string
    full_name?: string
  }
  file_records?: FileRecord[]
  document_type?: string
  documentStatus?: string
}

interface VirtualizedDocumentTableProps {
  documents: Document[]
  isArchived: boolean
  hasNextPage?: boolean
  isLoadingNextPage?: boolean
  onLoadMore?: () => void
  onView: (document: Document) => void
  onEdit: (documentId: string) => void
  onSendByEmail: (documentId: string) => void
  onPrint: (documentId: string, fileName: string) => void
  onArchive: (documentId: string, documentName?: string) => void
  onUnarchive: (documentId: string, documentName?: string) => void
  onDelete: (documentId: string, documentName?: string) => void
  actionLoading?: string
  isWideScreen?: boolean
}

// Custom tooltip component that renders outside the table container
const TableTooltip = ({ children, content, ...props }: { children: React.ReactNode, content: string, [key: string]: any }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [placement, setPlacement] = useState<'top' | 'bottom'>('bottom')
  const triggerRef = useRef<HTMLDivElement>(null)

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const windowHeight = window.innerHeight
    const tooltipHeight = 40 // Approximate tooltip height
    
    // Check if there's enough space below the button
    const spaceBelow = windowHeight - rect.bottom
    const spaceAbove = rect.top
    
    let y: number
    let newPlacement: 'top' | 'bottom'
    
    if (spaceBelow >= tooltipHeight + 8 || spaceBelow > spaceAbove) {
      // Position below the button
      y = rect.bottom + 8
      newPlacement = 'bottom'
    } else {
      // Position above the button
      y = rect.top - tooltipHeight - 8
      newPlacement = 'top'
    }
    
    setPosition({ x: rect.left + rect.width / 2, y })
    setPlacement(newPlacement)
    setIsOpen(true)
  }

  const handleMouseLeave = () => {
    setIsOpen(false)
  }

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {children}
      </div>
             {isOpen && typeof window !== 'undefined' && createPortal(
         <div
           style={{
             position: 'fixed',
             left: position.x,
             top: position.y,
             transform: 'translateX(-50%)',
             zIndex: 99999,
             backgroundColor: 'white',
             border: '1px solid #e5e7eb',
             borderRadius: '6px',
             padding: '6px 12px',
             fontSize: '14px',
             boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
             pointerEvents: 'none',
           }}
         >
           {content}
           {/* Arrow */}
           <div
             style={{
               position: 'absolute',
               left: '50%',
               transform: 'translateX(-50%)',
               width: 0,
               height: 0,
               borderLeft: '4px solid transparent',
               borderRight: '4px solid transparent',
               ...(placement === 'bottom' 
                 ? {
                     top: '-4px',
                     borderBottom: '4px solid #e5e7eb',
                   }
                 : {
                     bottom: '-4px',
                     borderTop: '4px solid #e5e7eb',
                   }
               ),
             }}
           />
         </div>,
         document.body
       )}
    </>
  )
}

const VirtualizedDocumentTable = React.memo(({
  documents,
  isArchived,
  hasNextPage,
  isLoadingNextPage,
  onLoadMore,
  onView,
  onEdit,
  onSendByEmail,
  onPrint,
  onArchive,
  onUnarchive,
  onDelete,
  actionLoading,
  isWideScreen = false
}: VirtualizedDocumentTableProps) => {
  const router = useRouter()
  const desktopParentRef = useRef<HTMLDivElement>(null)
  const tabletParentRef = useRef<HTMLDivElement>(null)
  const mobileParentRef = useRef<HTMLDivElement>(null)

  // Setup infinite scroll trigger
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    rootMargin: '200px',
  })

  // Handle navigation to case file
  const handleCaseFileClick = useCallback((fileRecordId: string) => {
    router.push(`/case-files/${fileRecordId}`)
  }, [router])

  // Fallback: Trigger load more on intersection observer
  useEffect(() => {
    if (inView && hasNextPage && !isLoadingNextPage && onLoadMore) {
      onLoadMore()
    }
  }, [inView, hasNextPage, isLoadingNextPage, onLoadMore])

  // Format creation date in Spanish format "12-jun-25"
  const formatCreationDate = (dateString: string) => {
    if (!dateString) return ''
    
    try {
      const date = new Date(dateString)
      // Format: DD-MMM-YY in Spanish
      const day = format(date, 'dd')
      const month = format(date, 'MMM', { locale: es }).toLowerCase()
      const year = format(date, 'yy')
      
      return `${day}-${month}-${year}`
    } catch (error) {
      console.error('Error formatting date:', error)
      return ''
    }
  }

  // Format file size helper
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Format case file data
  const formatCaseFileData = (fileRecords: FileRecord[] | any) => {
    // Handle both array and single object
    const record = Array.isArray(fileRecords) ? fileRecords[0] : fileRecords
    if (!record) return null
    
    const filingSystem = record.filing_systems
    const indices = filingSystem?.filing_indices || []
    
    // Process expediente data
    
    // Try to get "Nombre" field from valores_json first, with various possible keys
    const expedienteName = record.valores_json?.Nombre || 
                          record.valores_json?.nombre || 
                          record.valores_json?.name ||
                          record.valores_json?.descripcion ||
                          record.valores_json?.title ||
                          record.valores_json?.titulo
    
    // If no name found, try to get the first meaningful value
    const fallbackName = expedienteName || (() => {
      const entries = Object.entries(record.valores_json || {})
      const firstValue = entries.find(([key, value]) => 
        value && 
        typeof value === 'string' && 
        value.trim() && 
        !key.toLowerCase().includes('id')
      )
      return firstValue ? String(firstValue[1]) : null
    })()
    
    return {
      systemName: filingSystem?.nombre || "Sin Sistema",
      displayValue: fallbackName || `Expediente ${record.id.slice(0, 8)}...`
    }
  }

  // Get document status
  const getDocumentStatus = (document: Document) => {
    const isFastSignDocument = document.document_type === 'fast_sign'
    let displayStatus = document.documentStatus || "sin_mapeo"
    
    if (isFastSignDocument) {
      displayStatus = (document.status || 'sin_firma').toLowerCase()
    }

    switch (displayStatus) {
      case 'signed':
      case 'firmado':
        return { text: 'Firmado', color: 'bg-green-100 text-green-800' }
      case 'pending':
      case 'pendiente':
        return { text: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' }
      case 'expired':
      case 'expirado':
        return { text: 'Expirado', color: 'bg-red-100 text-red-800' }
      case 'sin_firma':
        return { text: 'Sin Firma', color: 'bg-gray-100 text-gray-800' }
      case 'sin_mapeo':
        return { text: 'Sin Mapeo', color: 'bg-blue-100 text-blue-800' }
      default:
        return { text: displayStatus, color: 'bg-gray-100 text-gray-800' }
    }
  }

  // Row renderer for desktop
  const renderDesktopRow = (document: Document, index: number) => {
    const caseFileData = document.file_records ? formatCaseFileData(document.file_records) : null
    const status = getDocumentStatus(document)

    return (
      <div
        key={document.id}
        className={`grid gap-4 px-6 py-4 border-b border-gray-200 hover:bg-gray-50 items-center ${isArchived ? 'grid-cols-12' : 'grid-cols-11'}`}
        style={{ minHeight: '80px' }}
      >
        {/* Document */}
        <div className={`flex items-center space-x-3 ${isArchived ? 'col-span-4' : 'col-span-5'}`}>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
            document.document_type === 'email' ? 'bg-blue-100' : 'bg-gray-100'
          }`}>
            {document.document_type === 'email' ? (
              <Mail className="h-5 w-5 text-blue-600" />
            ) : (
              <FileText className="h-5 w-5 text-gray-600" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 break-words leading-tight">
              {document.file_name}
            </p>
            <div className="flex items-center space-x-2 mt-1">
              {document.creator?.email && (
                <p className="text-xs text-gray-500 truncate">
                  Creado por: {document.creator.email}
                </p>
              )}
              {document.profiles?.email && !document.creator?.email && (
                <p className="text-xs text-gray-500 truncate">
                  {document.profiles.email}
                </p>
              )}
              {document.file_size && (
                <>
                  {(document.creator?.email || document.profiles?.email) && <span className="text-xs text-gray-300">•</span>}
                  <p className="text-xs text-gray-500">
                    {formatFileSize(document.file_size)}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Case File / Expediente - Only show when archived */}
        {isArchived && (
          <div className="col-span-2">
            {caseFileData ? (
              <div className="flex items-center space-x-2">
                <FolderOpen className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <div className="min-w-0">
                  <button
                    onClick={() => handleCaseFileClick(document.file_record_id)}
                    className="text-left hover:bg-blue-50 rounded p-1 -m-1 transition-colors cursor-pointer"
                    title={`Ir al expediente: ${caseFileData.displayValue}`}
                  >
                    <p className="text-sm font-medium text-blue-600 hover:text-blue-800 truncate">
                      {caseFileData.displayValue}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {caseFileData.systemName}
                    </p>
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-400">
                <span>Sin expediente</span>
                {(document as any).file_record_id && (
                  <span className="block text-xs text-red-500">
                    ID: {(document as any).file_record_id} (datos no cargados)
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Creation Date */}
        <div className="col-span-1">
          <div className="text-sm text-gray-700 font-medium">
            {formatCreationDate(document.created_at)}
          </div>
        </div>

        {/* Status */}
        <div className="col-span-1">
          <Badge className={`px-2 py-1 text-xs font-medium ${status.color}`}>
            {status.text}
          </Badge>
        </div>

        {/* Actions */}
        <div className={`flex justify-end ${isArchived ? 'col-span-4' : 'col-span-4'}`}>
                     {isWideScreen ? (
             <div className="flex items-center space-x-1">
                   <Button
                     variant="ghost"
                     size="sm"
                     onClick={() => onView(document)}
                     disabled={actionLoading === document.id}
                     className="h-12 px-2 text-gray-600 hover:text-white hover:bg-gray-600 transition-colors flex flex-col items-center gap-0.5"
                   >
                     <Eye className="h-3 w-3" />
                     <span className="text-xs leading-none">Ver</span>
                   </Button>

                   <Button
                     variant="ghost"
                     size="sm"
                     onClick={() => onEdit(document.id)}
                     disabled={actionLoading === document.id}
                     className="h-12 px-2 text-blue-600 hover:text-white hover:bg-blue-600 transition-colors flex flex-col items-center gap-0.5"
                   >
                     <PenTool className="h-3 w-3" />
                     <span className="text-xs leading-none">Firmar</span>
                   </Button>

                   <Button
                     variant="ghost"
                     size="sm"
                     onClick={() => onSendByEmail(document.id)}
                     disabled={actionLoading === document.id}
                     className="h-12 px-2 text-green-600 hover:text-white hover:bg-green-600 transition-colors flex flex-col items-center gap-0.5"
                   >
                     <Mail className="h-3 w-3" />
                     <span className="text-xs leading-none">Email</span>
                   </Button>

                   <Button
                     variant="ghost"
                     size="sm"
                     onClick={() => onPrint(document.id, document.file_name)}
                     disabled={actionLoading === document.id}
                     className="h-12 px-2 text-gray-600 hover:text-white hover:bg-[#174070] transition-colors flex flex-col items-center gap-0.5"
                   >
                     <Download className="h-3 w-3" />
                     <span className="text-xs leading-none">Descargar</span>
                   </Button>

                   {isArchived ? (
                     <Button
                       variant="ghost"
                       size="sm"
                       onClick={() => onUnarchive(document.id, document.file_name)}
                       disabled={actionLoading === document.id}
                       className="h-12 px-2 text-blue-600 hover:text-white hover:bg-blue-600 transition-colors flex flex-col items-center gap-0.5"
                     >
                       <ArchiveRestore className="h-3 w-3" />
                       <span className="text-xs leading-none">Restaurar</span>
                     </Button>
                   ) : (
                     <Button
                       variant="ghost"
                       size="sm"
                       onClick={() => onArchive(document.id, document.file_name)}
                       disabled={actionLoading === document.id}
                       className="h-12 px-2 text-blue-600 hover:text-white hover:bg-blue-600 transition-colors flex flex-col items-center gap-0.5"
                     >
                       <Archive className="h-3 w-3" />
                       <span className="text-xs leading-none">Archivar</span>
                     </Button>
                   )}

                   <Button
                     variant="ghost"
                     size="sm"
                     onClick={() => onDelete(document.id, document.file_name)}
                     disabled={actionLoading === document.id}
                     className="h-12 px-2 text-red-600 hover:text-white hover:bg-red-600 transition-colors flex flex-col items-center gap-0.5"
                   >
                     <Trash2 className="h-3 w-3" />
                     <span className="text-xs leading-none">Eliminar</span>
                   </Button>
               </div>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-gray-600 hover:bg-gray-100"
                  disabled={actionLoading === document.id}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onView(document)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Ver
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(document.id)}>
                  <PenTool className="mr-2 h-4 w-4" />
                  Firmar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSendByEmail(document.id)}>
                  <Mail className="mr-2 h-4 w-4" />
                  Enviar por Email
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onPrint(document.id, document.file_name)}>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {isArchived ? (
                  <DropdownMenuItem onClick={() => onUnarchive(document.id)}>
                    <ArchiveRestore className="mr-2 h-4 w-4" />
                    Restaurar
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onArchive(document.id)}>
                    <Archive className="mr-2 h-4 w-4" />
                    Archivar
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onDelete(document.id, document.file_name)} className="text-red-600">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    )
  }

  // Row renderer for tablet
  const renderTabletRow = (document: Document, index: number) => {
    const status = getDocumentStatus(document)

    return (
      <div
        key={document.id}
        className="grid grid-cols-8 gap-3 px-4 py-3 border-b border-gray-200 hover:bg-gray-50 items-center"
        style={{ minHeight: '70px' }}
      >
        {/* Document */}
        <div className="flex items-center space-x-2 col-span-4">
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
            document.document_type === 'email' ? 'bg-blue-100' : 'bg-gray-100'
          }`}>
            {document.document_type === 'email' ? (
              <Mail className="h-4 w-4 text-blue-600" />
            ) : (
              <FileText className="h-4 w-4 text-gray-600" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 break-words leading-tight">
              {document.file_name}
            </p>
            <div className="flex items-center space-x-2 mt-1">
              {document.creator?.email && (
                <p className="text-xs text-gray-500 truncate">
                  {document.creator.email}
                </p>
              )}
              {document.profiles?.email && !document.creator?.email && (
                <p className="text-xs text-gray-500 truncate">
                  {document.profiles.email}
                </p>
              )}
              {document.file_size && (
                <>
                  {(document.creator?.email || document.profiles?.email) && <span className="text-xs text-gray-300">•</span>}
                  <p className="text-xs text-gray-500">
                    {formatFileSize(document.file_size)}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Creation Date */}
        <div className="col-span-1">
          <div className="text-sm text-gray-700 font-medium">
            {formatCreationDate(document.created_at)}
          </div>
        </div>

        {/* Status */}
        <div className="col-span-2">
          <Badge className={`px-2 py-1 text-xs font-medium ${status.color}`}>
            {status.text}
          </Badge>
        </div>

        {/* Actions */}
        <div className="flex justify-end col-span-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-gray-600 hover:bg-gray-100"
                disabled={actionLoading === document.id}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onView(document)}>
                <Eye className="mr-2 h-4 w-4" />
                Ver
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(document.id)}>
                <PenTool className="mr-2 h-4 w-4" />
                Firmar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSendByEmail(document.id)}>
                <Mail className="mr-2 h-4 w-4" />
                Enviar por Email
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPrint(document.id, document.file_name)}>
                <Download className="mr-2 h-4 w-4" />
                Descargar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {isArchived ? (
                <DropdownMenuItem onClick={() => onUnarchive(document.id)}>
                  <ArchiveRestore className="mr-2 h-4 w-4" />
                  Restaurar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => onArchive(document.id)}>
                  <Archive className="mr-2 h-4 w-4" />
                  Archivar
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onDelete(document.id, document.file_name)} className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    )
  }

  // Determine current view
  const getCurrentView = () => {
    if (typeof window === 'undefined') return 'desktop' // SSR fallback
    if (window.innerWidth >= 1024) return 'desktop'  // lg+
    if (window.innerWidth >= 768) return 'tablet'   // md-lg
    return 'mobile' // <md
  }

  const currentView = getCurrentView()

  // True virtualization setup - only render visible items + 10 overscan
  const totalCount = Math.max(documents.length, 0)
  
  const desktopVirtualizer = useVirtualizer({
    count: totalCount + (hasNextPage ? 1 : 0),
    getScrollElement: () => desktopParentRef.current || null,
    estimateSize: () => 80,
    overscan: 10, // Only 10 items beyond visible area
  })
  


  const tabletVirtualizer = useVirtualizer({
    count: totalCount + (hasNextPage ? 1 : 0),
    getScrollElement: () => tabletParentRef.current || null,
    estimateSize: () => 80,
    overscan: 10, // Only 10 items beyond visible area
  })

  const mobileVirtualizer = useVirtualizer({
    count: totalCount + (hasNextPage ? 1 : 0),
    getScrollElement: () => mobileParentRef.current || null,
    estimateSize: () => 140,
    overscan: 10, // Only 10 items beyond visible area
  })

  const desktopItems = desktopVirtualizer.getVirtualItems()
  const tabletItems = tabletVirtualizer.getVirtualItems()
  const mobileItems = mobileVirtualizer.getVirtualItems()



  // Preemptive loading: Check if we need to load more based on visible range
  const shouldLoadMore = useMemo(() => {
    return desktopItems.some(item => 
      item.index >= documents.length - 20 && hasNextPage && !isLoadingNextPage
    ) || tabletItems.some(item => 
      item.index >= documents.length - 20 && hasNextPage && !isLoadingNextPage
    ) || mobileItems.some(item => 
      item.index >= documents.length - 20 && hasNextPage && !isLoadingNextPage
    )
  }, [desktopItems, tabletItems, mobileItems, documents.length, hasNextPage, isLoadingNextPage])

  // Trigger preemptive loading
  useEffect(() => {
    if (shouldLoadMore && onLoadMore) {
      onLoadMore()
    }
  }, [shouldLoadMore, onLoadMore])

  // Debug removed for cleaner console

  if (!documents.length) {
    return (
      <div className="text-center py-16 bg-gray-50 rounded-lg border border-gray-200">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No hay documentos {isArchived ? 'archivados' : 'activos'}
        </h3>
        <p className="text-gray-600">
          {isArchived 
            ? 'Los documentos archivados aparecerán aquí cuando los archives.'
            : 'Los documentos que subas aparecerán aquí.'
          }
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Desktop view (lg+) */}
      <div className="hidden lg:block bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        {/* Headers */}
        <div className="bg-[#1f2937] border-b border-gray-200">
          <div className={`grid gap-4 px-6 py-4 ${isArchived ? 'grid-cols-12' : 'grid-cols-11'}`}>
            <div className={`text-xs font-semibold text-white uppercase tracking-wider ${isArchived ? 'col-span-4' : 'col-span-5'}`}>Documento</div>
            {isArchived && (
              <div className="text-xs font-semibold text-white uppercase tracking-wider col-span-2">Expediente</div>
            )}
            <div className="text-xs font-semibold text-white uppercase tracking-wider col-span-1">Fecha</div>
            <div className={`text-xs font-semibold text-white uppercase tracking-wider ${isArchived ? 'col-span-1' : 'col-span-1'}`}>Estatus</div>
            <div className={`text-xs font-semibold text-white uppercase tracking-wider text-right ${isArchived ? 'col-span-4' : 'col-span-4'}`}>Acciones</div>
          </div>
        </div>

        {/* Virtualized content */}
        <div
          ref={desktopParentRef}
          className="overflow-auto"
          style={{ height: '600px' }} // Fixed height for virtualization

        >
          <div
            style={{
              height: `${desktopVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {desktopItems.map((virtualItem) => {
              const isLoaderRow = virtualItem.index >= documents.length
              const document = documents[virtualItem.index]

              // True virtualization: Only render visible + overscan items

              return (
                <div
                  key={virtualItem.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  {isLoaderRow ? (
                    <div ref={loadMoreRef} className="flex items-center justify-center py-4">
                      {isLoadingNextPage && (
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      )}
                    </div>
                  ) : document ? (
                    renderDesktopRow(document, virtualItem.index)
                  ) : (
                    <div className="p-4 text-gray-500">Loading document...</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tablet view (md-lg) */}
      <div className="hidden md:block lg:hidden bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        {/* Headers */}
        <div className="bg-[#1f2937] border-b border-gray-200">
          <div className="grid grid-cols-7 gap-3 px-4 py-3">
            <div className="text-xs font-semibold text-white uppercase tracking-wider col-span-4">Documento</div>
            <div className="text-xs font-semibold text-white uppercase tracking-wider col-span-1">Fecha</div>
            <div className="text-xs font-semibold text-white uppercase tracking-wider col-span-1">Estatus</div>
            <div className="text-xs font-semibold text-white uppercase tracking-wider text-right col-span-1">Acciones</div>
          </div>
        </div>

        {/* Virtualized content */}
        <div
          ref={tabletParentRef}
          className="overflow-auto"
          style={{ height: '600px' }}
        >
          <div
            style={{
              height: `${tabletVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {tabletItems.map((virtualItem) => {
              const isLoaderRow = virtualItem.index >= documents.length
              const document = documents[virtualItem.index]

              // True virtualization: Only render visible + overscan items

              return (
                <div
                  key={virtualItem.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  {isLoaderRow ? (
                    <div ref={loadMoreRef} className="flex items-center justify-center py-4">
                      {isLoadingNextPage && (
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      )}
                    </div>
                  ) : document ? (
                    renderTabletRow(document, virtualItem.index)
                  ) : (
                    <div className="p-4 text-gray-500">Loading document...</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Mobile view (< md) */}
      <div className="md:hidden space-y-3">
        <div
          ref={mobileParentRef}
          className="overflow-auto"
          style={{ height: '600px' }}
        >
          <div
            style={{
              height: `${mobileVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {mobileItems.map((virtualItem) => {
              const isLoaderRow = virtualItem.index >= documents.length
              const document = documents[virtualItem.index]

              // True virtualization: Only render visible + overscan items

              if (isLoaderRow) {
                return (
                  <div
                    key={virtualItem.key}
                    ref={loadMoreRef}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                    className="flex items-center justify-center py-4"
                  >
                    {isLoadingNextPage && (
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    )}
                  </div>
                )
              }

              if (!document) {
                return (
                  <div
                    key={virtualItem.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <div className="p-4 text-gray-500">Loading document...</div>
                  </div>
                )
              }

              const caseFileData = document.file_records ? formatCaseFileData(document.file_records) : null
              const status = getDocumentStatus(document)

              return (
                <div
                  key={virtualItem.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm mx-3 mb-3">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                          document.document_type === 'email' ? 'bg-blue-100' : 'bg-gray-100'
                        }`}>
                          {document.document_type === 'email' ? (
                            <Mail className="h-5 w-5 text-blue-600" />
                          ) : (
                            <FileText className="h-5 w-5 text-gray-600" />
                          )}
                        </div>
                                                  <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 break-words leading-tight">
                              {document.file_name}
                            </p>
                            <div className="flex items-center space-x-2 mt-1">
                              {document.creator?.email && (
                                <p className="text-xs text-gray-500 truncate">
                                  {document.creator.email}
                                </p>
                              )}
                              {document.profiles?.email && !document.creator?.email && (
                                <p className="text-xs text-gray-500 truncate">
                                  {document.profiles.email}
                                </p>
                              )}
                              {(document.creator?.email || document.profiles?.email) && <span className="text-xs text-gray-300">•</span>}
                              <p className="text-xs text-gray-500">
                                {formatCreationDate(document.created_at)}
                              </p>
                              {document.file_size && (
                                <>
                                  <span className="text-xs text-gray-300">•</span>
                                  <p className="text-xs text-gray-500">
                                    {formatFileSize(document.file_size)}
                                  </p>
                                </>
                              )}
                            </div>
                          </div>
                      </div>
                      <Badge className={`px-2 py-1 text-xs font-medium ${status.color}`}>
                        {status.text}
                      </Badge>
                    </div>

                    {/* Case file information - Only show when archived */}
                    {isArchived && caseFileData && (
                      <div className="mb-3">
                        <button
                          onClick={() => handleCaseFileClick(document.file_record_id)}
                          className="w-full p-2 bg-gray-50 hover:bg-blue-50 rounded transition-colors cursor-pointer text-left"
                          title={`Ir al expediente: ${caseFileData.displayValue}`}
                        >
                          <div className="flex items-center space-x-1 text-xs">
                            <FolderOpen className="h-3 w-3 text-blue-500" />
                            <span className="font-medium text-gray-600">{caseFileData.systemName}:</span>
                            <span className="text-blue-600 hover:text-blue-800 font-medium">{caseFileData.displayValue}</span>
                          </div>
                        </button>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-gray-600 hover:bg-gray-100"
                            disabled={actionLoading === document.id}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => onView(document)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEdit(document.id)}>
                            <PenTool className="mr-2 h-4 w-4" />
                            Firmar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onSendByEmail(document.id)}>
                            <Mail className="mr-2 h-4 w-4" />
                            Enviar por Email
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onPrint(document.id, document.file_name)}>
                            <Download className="mr-2 h-4 w-4" />
                            Descargar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {isArchived ? (
                            <DropdownMenuItem onClick={() => onUnarchive(document.id)}>
                              <ArchiveRestore className="mr-2 h-4 w-4" />
                              Restaurar
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => onArchive(document.id)}>
                              <Archive className="mr-2 h-4 w-4" />
                              Archivar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => onDelete(document.id, document.file_name)} className="text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}, (prevProps, nextProps) => {
  // Temporary debug: Check which props are changing
  const changes = []
  
  if (prevProps.documents !== nextProps.documents) changes.push('documents')
  if (prevProps.isArchived !== nextProps.isArchived) changes.push('isArchived')
  if (prevProps.hasNextPage !== nextProps.hasNextPage) changes.push('hasNextPage')
  if (prevProps.isLoadingNextPage !== nextProps.isLoadingNextPage) changes.push('isLoadingNextPage')
  if (prevProps.actionLoading !== nextProps.actionLoading) changes.push('actionLoading')
  if (prevProps.isWideScreen !== nextProps.isWideScreen) changes.push('isWideScreen')
  if (prevProps.onLoadMore !== nextProps.onLoadMore) changes.push('onLoadMore')
  if (prevProps.onView !== nextProps.onView) changes.push('onView')
  if (prevProps.onEdit !== nextProps.onEdit) changes.push('onEdit')
  if (prevProps.onSendByEmail !== nextProps.onSendByEmail) changes.push('onSendByEmail')
  if (prevProps.onPrint !== nextProps.onPrint) changes.push('onPrint')
  if (prevProps.onArchive !== nextProps.onArchive) changes.push('onArchive')
  if (prevProps.onUnarchive !== nextProps.onUnarchive) changes.push('onUnarchive')
  if (prevProps.onDelete !== nextProps.onDelete) changes.push('onDelete')
  
  const shouldUpdate = changes.length > 0
  
  if (shouldUpdate) {
    console.log('🚨 VirtualizedDocumentTable will re-render due to props changes:', changes)
    // Log more details about documents if it's changing
    if (changes.includes('documents')) {
      console.log('📄 Documents changed:', {
        prevLength: prevProps.documents?.length || 0,
        nextLength: nextProps.documents?.length || 0,
        prevRef: prevProps.documents,
        nextRef: nextProps.documents
      })
    }
  }
  
  return !shouldUpdate  // Return true to prevent re-render, false to allow re-render
})

export default VirtualizedDocumentTable
