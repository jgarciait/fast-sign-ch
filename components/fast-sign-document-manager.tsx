"use client"

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react"
import {
  Search,
  Edit2,
  Trash2,
  Archive,
  FileText,
  Calendar,
  ArchiveRestore,
  Filter,
  Clock,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Tag,
  X,
  User,
  Mail,
  Eye,
  MoreVertical,
  Download,
  AlertTriangle,
  PenTool,
  Upload
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// Removed Switch and Label imports since we no longer use toggles
import {
  getFastSignDocumentsByArchiveStatus,
  getFastSignDocumentsCount,
  archiveFastSignDocument,
  unarchiveFastSignDocument,
  deleteFastSignDocument,
  checkDocumentSignatureStatus,
  checkMultipleDocumentsSignatureStatus,
  checkDocumentTemplateUsage,
  getDocumentsWithStatus,
} from "@/app/actions/fast-sign-actions"
import { unlinkDocumentFromFileRecordWithArchive } from "@/app/actions/document-archive-actions"
import { formatDistanceToNow, isToday, isYesterday, isThisWeek, isThisMonth } from "date-fns"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Virtualization components
import VirtualizedDocumentTable from "@/components/virtualized-document-table"
import QueryProvider from "@/components/query-provider"
import { useInfiniteDocuments } from "@/hooks/use-infinite-documents"
import { useQueryClient } from "@tanstack/react-query"

// Lazy loading para componentes pesados
const DocumentViewerModal = lazy(() => import("@/components/document-viewer-modal"))
const OrganizeDocumentModal = lazy(() => import("@/components/organize-document-modal"))
const UnarchiveDocumentModal = lazy(() => import("@/components/unarchive-document-modal"))
const DocumentUploadModal = lazy(() => import("@/components/document-upload-modal"))

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
  profiles?: {
    id: string
    email: string
    full_name?: string
  }
  file_records?: FileRecord[]
  document_type?: string
  documentStatus?: string
}

interface FastSignDocumentManagerProps {
  onClose: () => void
}

// Componente interno que usa React Query
function FastSignDocumentManagerInternal({ onClose }: FastSignDocumentManagerProps) {
  // React Query client
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const router = useRouter()
  
  // Document counts for display purposes only
  const [activeTotalCount, setActiveTotalCount] = useState(0)
  const [archivedTotalCount, setArchivedTotalCount] = useState(0)

  // Estados comunes
  const [searchTerm, setSearchTerm] = useState("")
  const [activeDateFilter, setActiveDateFilter] = useState("all")
  const [archivedDateFilter, setArchivedDateFilter] = useState("all")
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("active")
  // Always filter to show only current user's documents
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Load initial counts for both tabs
  useEffect(() => {
    const loadCounts = async () => {
      try {
        console.log('🔢 Loading document counts for user documents...')
        // Load active count
        const activeResult = await getFastSignDocumentsCount(false, true) // archived: false, showOnlyMyDocuments: true
        if (activeResult && typeof activeResult.totalCount === 'number') {
          console.log('📊 User active documents count:', activeResult.totalCount)
          setActiveTotalCount(activeResult.totalCount)
        }
        
        // Load archived count  
        const archivedResult = await getFastSignDocumentsCount(true, true) // archived: true, showOnlyMyDocuments: true
        if (archivedResult && typeof archivedResult.totalCount === 'number') {
          console.log('📊 User archived documents count:', archivedResult.totalCount)
          setArchivedTotalCount(archivedResult.totalCount)
        }
      } catch (error) {
        console.error('❌ Error loading document counts:', error)
      }
    }
    
    loadCounts()
  }, []) // Only run once on mount

  // Modal states
  const [documentViewerModal, setDocumentViewerModal] = useState<{
    isOpen: boolean
    documentId: string
    documentName: string
  }>({
    isOpen: false,
    documentId: "",
    documentName: ""
  })

  const [templateConfirmModal, setTemplateConfirmModal] = useState<{
    isOpen: boolean
    documentId: string
    documentName: string
    templateCount: number
    copiedDocumentsCount: number
  }>({
    isOpen: false,
    documentId: "",
    documentName: "",
    templateCount: 0,
    copiedDocumentsCount: 0
  })

  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean
    documentId: string
    documentName: string
  }>({
    isOpen: false,
    documentId: "",
    documentName: ""
  })

  const [organizeModal, setOrganizeModal] = useState<{
    isOpen: boolean
    documentId: string
    documentName: string
  }>({
    isOpen: false,
    documentId: "",
    documentName: ""
  })

  const [unarchiveModal, setUnarchiveModal] = useState<{
    isOpen: boolean
    documentId: string
    documentName: string
  }>({
    isOpen: false,
    documentId: "",
    documentName: ""
  })

  const [isWideScreen, setIsWideScreen] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)

  // Detectar ancho de pantalla
  useEffect(() => {
    const checkScreenWidth = () => {
      setIsWideScreen(window.innerWidth >= 1200)
    }

    checkScreenWidth()
    window.addEventListener('resize', checkScreenWidth)

    return () => window.removeEventListener('resize', checkScreenWidth)
  }, [])

  const handleEdit = useCallback((documentId: string) => {
    // Open in new tab to avoid table refresh
    window.open(`/fast-sign/edit/${documentId}`, '_blank')
  }, [])

  const handleView = useCallback((document: Document) => {
    setDocumentViewerModal({
      isOpen: true,
      documentId: document.id,
      documentName: document.file_name
    })
  }, [])

  const handleSendByEmail = useCallback((documentId: string) => {
    // Open in new tab to avoid table refresh
    window.open(`/sent-to-sign?documentId=${documentId}`, '_blank')
  }, [])

  const handlePrint = useCallback((documentId: string, fileName: string) => {
    window.open(`/api/fast-sign/${documentId}/print`, '_blank')
  }, [])

  // Función para formatear tamaño de archivo
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const closeDocumentViewer = useCallback(() => {
    setDocumentViewerModal({
      isOpen: false,
      documentId: "",
      documentName: ""
    })
  }, [])

  const handleCheckSignature = async (documentId: string) => {
    setActionLoading(documentId)
    try {
      const result = await checkDocumentSignatureStatus(documentId)
      if ((result as any).hasSignatures) {
        toast({ title: "Estado sincronizado", description: "Firmas detectadas y estado actualizado." })
        // React Query will automatically refresh data
      } else {
        toast({ title: "Sin firmas", description: "No se detectaron firmas relacionadas a este documento." })
      }
    } catch (error) {
      toast({ title: "Error", description: "Error al verificar firmas", variant: "destructive" })
    } finally {
      setActionLoading(null)
    }
  }

  const handleArchive = useCallback((documentId: string, documentName?: string) => {
    // Open organize modal instead of directly archiving
    setOrganizeModal({
      isOpen: true,
      documentId,
      documentName: documentName || "Documento sin nombre"
    })
  }, [])

  const handleUnarchive = useCallback((documentId: string, documentName?: string) => {
    // Show unarchive confirmation modal instead of directly unarchiving
    setUnarchiveModal({
      isOpen: true,
      documentId,
      documentName: documentName || "Documento sin nombre"
    })
  }, [])

  const handleConfirmUnarchive = async (documentId: string) => {
    setActionLoading(documentId)
    
    const result = await unlinkDocumentFromFileRecordWithArchive(documentId)
    
    if ((result as any).error) {
      toast({
        title: "Error",
        description: (result as any).error,
        variant: "destructive",
      })
      setActionLoading(null)
      return
    }

    // Success - handle updates
    try {
      toast({
        title: "Éxito",
        description: "Documento desarchivado y desvinculado del expediente exitosamente",
      })
      
      // Optimistic update: remove document from archived view
      queryClient.setQueryData(
        ['infinite-documents', 'archived', searchTerm, true, 100],
        (oldData: any) => {
          if (!oldData) return oldData
          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              documents: page.documents.filter((doc: any) => doc.id !== documentId)
            }))
          }
        }
      )
      
      // Update counters immediately
      setArchivedTotalCount(prev => Math.max(0, prev - 1))
      setActiveTotalCount(prev => prev + 1)
      
      // Invalidate all document queries to refresh both tabs
      await queryClient.invalidateQueries({ 
        queryKey: ['infinite-documents'] 
      })
      
    } catch (updateError) {
      console.error('Error updating UI after unarchive:', updateError)
      // Even if UI update fails, the document was unarchived successfully
      // Force a complete refetch
      await queryClient.invalidateQueries({ 
        queryKey: ['infinite-documents'] 
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = useCallback(async (documentId: string, documentName?: string) => {
    // Always show general delete confirmation modal first
    setDeleteConfirmModal({
      isOpen: true,
      documentId,
      documentName: documentName || "Documento"
    })
  }, [])

  const handleConfirmDelete = async () => {
    const documentId = deleteConfirmModal.documentId

    // Close the general confirmation modal
    setDeleteConfirmModal({
      isOpen: false,
      documentId: "",
      documentName: ""
    })

    // Check if the document is being used as a template
    try {
      const templateCheck = await checkDocumentTemplateUsage(documentId)

      if ((templateCheck as any).error) {
        toast({
          title: "Error",
          description: "Error al verificar el uso del documento como plantilla",
          variant: "destructive",
        })
        return
      }

      if ((templateCheck as any).isUsedAsTemplate) {
        // Show template confirmation modal
        setTemplateConfirmModal({
          isOpen: true,
          documentId: documentId,
          documentName: deleteConfirmModal.documentName,
          templateCount: (templateCheck as any).templateCount || 0,
          copiedDocumentsCount: (templateCheck as any).copiedDocumentsCount || 0
        })
        return
      }

      // If not used as template, proceed with regular deletion
      await performDocumentDeletion(documentId)
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al verificar el uso del documento como plantilla",
        variant: "destructive",
      })
    }
  }

  const performDocumentDeletion = async (documentId: string) => {
    setActionLoading(documentId)
    try {
      console.log('🗑️ Starting document deletion for ID:', documentId)
      const result = await deleteFastSignDocument(documentId)
      console.log('🔍 Deletion result:', result)
      
      if ((result as any).error) {
        console.error('❌ Backend deletion failed:', (result as any).error)
        toast({
          title: "Error",
          description: (result as any).error,
          variant: "destructive",
        })
      } else {
        console.log('✅ Backend deletion successful, updating UI...')
        toast({
          title: "Éxito",
          description: "Documento eliminado exitosamente",
        })
        
        try {
          // Optimistic update: remove document from current view immediately
          const currentArchiveStatus = activeTab === 'archived' ? 'archived' : 'active'
          const queryKey = ['infinite-documents', currentArchiveStatus, searchTerm, true, 100] // showUserDocs always true
          console.log('🔄 Updating cache with key:', queryKey)
          
          queryClient.setQueryData(queryKey, (oldData: any) => {
            console.log('📦 Current cache data:', oldData)
            if (!oldData || !oldData.pages) {
              console.log('⚠️ No cache data or pages found, skipping optimistic update')
              return oldData
            }
            
            const updatedData = {
              ...oldData,
              pages: oldData.pages.map((page: any) => ({
                ...page,
                documents: page.documents ? page.documents.filter((doc: any) => doc.id !== documentId) : []
              }))
            }
            console.log('📝 Updated cache data:', updatedData)
            return updatedData
          })
          
          // Invalidate specific queries to refresh the document list and counters
          console.log('🔄 Invalidating queries after deletion')
          await queryClient.invalidateQueries({ 
            queryKey: ['infinite-documents'] 
          })
          console.log('✅ Queries invalidated successfully')
          
        } catch (cacheError) {
          console.error('⚠️ Cache update failed but deletion was successful:', cacheError)
          // Still consider this a success since the backend deletion worked
          // Just refresh the page data
          await queryClient.invalidateQueries({ 
            queryKey: ['infinite-documents'] 
          })
        }
      }
    } catch (error) {
      console.error('💥 Unexpected error during deletion:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al eliminar documento",
        variant: "destructive",
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleConfirmTemplateDelete = async () => {
    setTemplateConfirmModal({
      isOpen: false,
      documentId: "",
      documentName: "",
      templateCount: 0,
      copiedDocumentsCount: 0
    })
    await performDocumentDeletion(templateConfirmModal.documentId)
  }

  // Función para formatear datos de expedientes
  const formatCaseFileData = (fileRecords: FileRecord[]) => {
    if (!fileRecords?.length) return null
    
    const record = fileRecords[0] // Usar el primer record
    const filingSystem = record.filing_systems
    const indices = filingSystem?.filing_indices || []
    
    return {
      systemName: filingSystem?.nombre || "Sin Sistema",
      displayValue: Object.entries(record.valores_json || {})
        .filter(([key]) => indices.some(idx => idx.clave === key))
        .map(([, value]) => String(value))
        .join(" - ") || "Sin Datos"
    }
  }

  const formatStatus = (document: Document) => {
    // Detectar si es documento de fast_sign o de email
    const isFastSignDocument = document.document_type === 'fast_sign'
    
    // Para documentos de fast_sign, usar el status de la columna status
    // Para documentos de email, usar documentStatus o fallback
    let displayStatus = document.documentStatus || "sin_mapeo"
    if (isFastSignDocument) {
      displayStatus = (document.status || 'sin_firma').toLowerCase()
    }

    const emailStatusConfig = {
      signed: { text: "Firmado", className: "bg-green-100 text-green-800 border-green-200" },
      pending: { text: "Pendiente", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
      expired: { text: "Expirado", className: "bg-red-100 text-red-800 border-red-200" },
      sin_mapeo: { text: "Sin Mapeo", className: "bg-blue-100 text-blue-800 border-blue-200" },
      draft: { text: "Borrador", className: "bg-gray-100 text-gray-800 border-gray-200" }
    }

    const fastSignStatusConfig = {
      firmado: { text: "Firmado", className: "bg-green-100 text-green-800 border-green-200" },
      signed: { text: "Firmado", className: "bg-green-100 text-green-800 border-green-200" },
      pending: { text: "Pendiente", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
      pendiente: { text: "Pendiente", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
      expired: { text: "Expirado", className: "bg-red-100 text-red-800 border-red-200" },
      expirado: { text: "Expirado", className: "bg-red-100 text-red-800 border-red-200" },
      sin_firma: { text: "Sin Firma", className: "bg-gray-100 text-gray-800 border-gray-200" },
      draft: { text: "Borrador", className: "bg-gray-100 text-gray-800 border-gray-200" }
    }

    const statusConfig = isFastSignDocument ? fastSignStatusConfig : emailStatusConfig
    const config = statusConfig[displayStatus as keyof typeof statusConfig] ||
      (isFastSignDocument ? fastSignStatusConfig.sin_firma : emailStatusConfig.sin_mapeo)

    return (
      <div className="flex items-center space-x-2">
        <Badge
          variant="outline"
          className={`text-xs font-medium ${config.className}`}
        >
          {config.text}
        </Badge>
      </div>
    )
  }

  // New virtualized component that uses infinite scroll
  const VirtualizedDocuments = ({ isArchived }: { isArchived: boolean }) => {
    const {
      documents,
      totalCount,
      isLoading,
      isError,
      isFetchingNextPage,
      hasNextPage,
      fetchNextPage
    } = useInfiniteDocuments({
      isArchived,
      searchTerm,
      dateFilter: isArchived ? archivedDateFilter : activeDateFilter,
      showUserDocs: true, // Always filter by current user
      pageSize: 100
    })

    // Debug: Only log key info
    if (documents.length > 0) {
      console.log('✅ VirtualizedDocuments loaded:', { documentsLength: documents.length, totalCount })
    } else if (isError) {
      console.log('❌ VirtualizedDocuments error:', { isError, error })
    }

    // Update counts when data changes - only if different to avoid loops
    useEffect(() => {
      console.log(`📊 Updating ${isArchived ? 'archived' : 'active'} count: ${totalCount}`)
      if (isArchived) {
        setArchivedTotalCount(prev => prev !== totalCount ? totalCount : prev)
      } else {
        setActiveTotalCount(prev => prev !== totalCount ? totalCount : prev)
      }
    }, [totalCount, isArchived])

    // React Query automatically refetches when queryKey changes, no manual refetch needed

    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )
    }

    if (isError) {
      return (
        <div className="text-center py-12">
          <p className="text-red-600">Error al cargar documentos</p>
          <Button onClick={() => window.location.reload()} className="mt-2">
            Reintentar
          </Button>
        </div>
      )
    }

    return (
      <VirtualizedDocumentTable
        documents={documents}
        isArchived={isArchived}
        hasNextPage={hasNextPage}
        isLoadingNextPage={isFetchingNextPage}
        onLoadMore={fetchNextPage}
        onView={handleView}
        onEdit={handleEdit}
        onSendByEmail={handleSendByEmail}
        onPrint={handlePrint}
        onArchive={handleArchive}
        onUnarchive={handleUnarchive}
        onDelete={handleDelete}
        actionLoading={actionLoading}
        isWideScreen={isWideScreen}
      />
    )
  }

  return (
      <div className="space-y-4 p-4 bg-gray-50 min-h-screen">
        <div className="bg-white rounded-lg shadow-sm border">
          {/* Encabezado simple - Solo muestra mis documentos */}
          <div className="border-b border-gray-200 px-4 py-3">
            <div className="flex items-center space-x-2">
              <User className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Mis Conduces</h2>
            </div>
          </div>

          <Tabs defaultValue="active" className="w-full" onValueChange={setActiveTab}>
            {/* Header with tabs and back button */}
            <div className="border-b border-gray-200 px-4 py-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left side: Tabs */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Tabs de estado: Activos / Archivados */}
                  <TabsList className="grid grid-cols-2 w-fit">
                    <TabsTrigger value="active" className="flex items-center gap-2 font-semibold">
                      <FileText className="h-4 w-4" />
                      Activos ({activeTotalCount})
                    </TabsTrigger>
                    <TabsTrigger value="archived" className="flex items-center gap-2 font-semibold">
                      <Archive className="h-4 w-4" />
                      Archivados en Expedientes ({archivedTotalCount})
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Right side: Upload and Back buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setUploadModalOpen(true)}
                    className="bg-green-600 hover:bg-green-700 w-fit"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Subir Documento
                  </Button>
                  <Button
                    variant="outline"
                    onClick={onClose}
                    className="w-fit self-end lg:self-auto"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Volver
                  </Button>
                </div>
              </div>
            </div>

            {/* Tab content */}
            <TabsContent value="active" className="space-y-4 p-4">
              {searchTerm && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4 text-blue-600" />
                      <span className="text-sm text-blue-800">
                        Buscando: <strong>"{searchTerm}"</strong>
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSearchTerm("")}
                      className="h-6 w-6 p-0 text-blue-600 hover:bg-blue-100"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Filtros */}
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Buscar documentos..."
                    value={searchTerm}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-10 h-10 text-sm w-full"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <Select value={activeDateFilter} onValueChange={setActiveDateFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las fechas</SelectItem>
                    <SelectItem value="today">Hoy</SelectItem>
                    <SelectItem value="yesterday">Ayer</SelectItem>
                    <SelectItem value="week">Esta Semana</SelectItem>
                    <SelectItem value="month">Este Mes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <VirtualizedDocuments isArchived={false} />
            </TabsContent>

            <TabsContent value="archived" className="space-y-4 p-4">
              {searchTerm && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4 text-blue-600" />
                      <span className="text-sm text-blue-800">
                        Buscando: <strong>"{searchTerm}"</strong>
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSearchTerm("")}
                      className="h-6 w-6 p-0 text-blue-600 hover:bg-blue-100"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Filtros */}
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Buscar documentos archivados..."
                    value={searchTerm}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-10 h-10 text-sm w-full"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <Select value={archivedDateFilter} onValueChange={setArchivedDateFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las fechas</SelectItem>
                    <SelectItem value="today">Hoy</SelectItem>
                    <SelectItem value="yesterday">Ayer</SelectItem>
                    <SelectItem value="week">Esta Semana</SelectItem>
                    <SelectItem value="month">Este Mes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <VirtualizedDocuments isArchived={true} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Document Viewer Modal */}
        <Suspense fallback={<div>Cargando...</div>}>
          {documentViewerModal.isOpen && (
            <DocumentViewerModal
              isOpen={documentViewerModal.isOpen}
              documentId={documentViewerModal.documentId}
              documentName={documentViewerModal.documentName || "Documento"}
              onClose={closeDocumentViewer}
            />
          )}
        </Suspense>

        {/* Delete Confirmation Modal */}
        <AlertDialog open={deleteConfirmModal.isOpen} onOpenChange={(open) => !open && setDeleteConfirmModal({ isOpen: false, documentId: "", documentName: "" })}>
          <AlertDialogContent className="sm:max-w-[500px]">
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar Documento</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="text-sm text-muted-foreground">
                  <p className="mb-2">
                    ¿Estás seguro de que deseas eliminar el documento:
                  </p>
                  <div className="block mt-2 mb-2 p-3 bg-gray-50 rounded border max-w-full overflow-hidden">
                    <strong className="break-all text-sm leading-relaxed block">
                      "{deleteConfirmModal.documentName}"
                    </strong>
                  </div>
                  <p className="mt-2">
                    Esta acción no se puede deshacer.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="bg-red-600 hover:bg-red-700 transition-colors"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Template Usage Confirmation Modal */}
        <AlertDialog open={templateConfirmModal.isOpen} onOpenChange={(open) => !open && setTemplateConfirmModal({ isOpen: false, documentId: "", documentName: "", templateCount: 0, copiedDocumentsCount: 0 })}>
          <AlertDialogContent className="sm:max-w-[500px]">
            <AlertDialogHeader>
              <AlertDialogTitle>Documento Usado como Plantilla</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    El documento:
                  </p>
                  <div className="block mt-1 mb-2 p-3 bg-gray-50 rounded border max-w-full overflow-hidden">
                    <strong className="break-all text-sm leading-relaxed block">
                      "{templateConfirmModal.documentName}"
                    </strong>
                  </div>
                  <p>
                    está siendo usado como plantilla.
                  </p>
                  {templateConfirmModal.templateCount > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-sm text-red-800">
                        <strong>⚠️ Advertencia:</strong> Al eliminar este documento original:
                      </p>
                      <ul className="text-sm text-red-700 mt-2 space-y-1 ml-4">
                        <li>• Las {templateConfirmModal.templateCount} plantilla{templateConfirmModal.templateCount > 1 ? 's' : ''} asociada{templateConfirmModal.templateCount > 1 ? 's' : ''} serán eliminada{templateConfirmModal.templateCount > 1 ? 's' : ''}</li>
                        <li>• No se podrán crear nuevos documentos desde est{templateConfirmModal.templateCount > 1 ? 'as plantillas' : 'a plantilla'}</li>
                        {templateConfirmModal.copiedDocumentsCount && templateConfirmModal.copiedDocumentsCount > 0 && (
                          <li>• Los {templateConfirmModal.copiedDocumentsCount} documento{templateConfirmModal.copiedDocumentsCount > 1 ? 's' : ''} ya creado{templateConfirmModal.copiedDocumentsCount > 1 ? 's' : ''} permanecerán intactos</li>
                        )}
                        <li>• Esta acción <strong>no se puede deshacer</strong></li>
                      </ul>
                    </div>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmTemplateDelete}
                className="bg-red-600 hover:bg-red-700 transition-colors"
              >
                Eliminar Documento y Plantillas
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Organize Document Modal */}
        <Suspense fallback={<div>Cargando...</div>}>
          {organizeModal.isOpen && (
            <OrganizeDocumentModal
              isOpen={organizeModal.isOpen}
              documentId={organizeModal.documentId}
              documentName={organizeModal.documentName}
              onClose={() => setOrganizeModal({ isOpen: false, documentId: "", documentName: "" })}
              onSuccess={() => {
                // Refresh document queries after successful organization
                queryClient.invalidateQueries({ 
                  queryKey: ['infinite-documents'] 
                })
                
                // Update counters - remove from active, add to archived
                setActiveTotalCount(prev => Math.max(0, prev - 1))
                setArchivedTotalCount(prev => prev + 1)
              }}
            />
          )}
        </Suspense>

        {/* Unarchive Confirmation Modal */}
        <Suspense fallback={<div>Cargando...</div>}>
          {unarchiveModal.isOpen && (
            <UnarchiveDocumentModal
              isOpen={unarchiveModal.isOpen}
              documentId={unarchiveModal.documentId}
              documentName={unarchiveModal.documentName}
              onClose={() => setUnarchiveModal({ isOpen: false, documentId: "", documentName: "" })}
              onConfirm={() => handleConfirmUnarchive(unarchiveModal.documentId)}
            />
          )}
        </Suspense>

        {/* Document Upload Modal */}
        <Suspense fallback={<div>Cargando...</div>}>
          <DocumentUploadModal
            isOpen={uploadModalOpen}
            onClose={() => setUploadModalOpen(false)}
            onUploadComplete={async (document) => {
              console.log('Document uploaded successfully:', document)
              
              // Update document count immediately
              setActiveTotalCount(prev => prev + 1)
              
              // Invalidate React Query cache to refresh the document list
              await queryClient.invalidateQueries({ 
                queryKey: ['infinite-documents'] 
              })
              
              setUploadModalOpen(false)
            }}
          />
        </Suspense>

      </div>
  )
}

export default function FastSignDocumentManager({ onClose }: FastSignDocumentManagerProps) {
  return (
    <QueryProvider>
      <FastSignDocumentManagerInternal onClose={onClose} />
    </QueryProvider>
  )
}