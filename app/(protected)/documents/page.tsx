"use client"

import { useState, useEffect, useCallback } from "react"
import { getSigningRequests } from "@/app/actions/document-actions"
import { Eye, User, Users, CheckCircle, Clock, Send, Edit3, FileText } from "lucide-react"
import Link from "next/link"
import DeleteSigningRequestButton from "@/components/delete-signing-request-button"
import DocumentViewerModal from "@/components/document-viewer-modal"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { createClient } from "@/utils/supabase/client"
import { RelativeDateFormatter } from "@/components/ui/date-formatter"

// Función para obtener detalles del estado de solicitudes de firma
function getStatusDetails(status: string) {
  switch (status?.toLowerCase()) {
    case 'pending':
      return {
        label: 'Pendiente de Firma',
        icon: Clock,
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-800',
        progressWidth: '50%',
        description: 'Esperando que el destinatario firme'
      }
    case 'completed':
      return {
        label: 'Firmado',
        icon: CheckCircle,
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
        progressWidth: '100%',
        description: 'Documento firmado exitosamente',
        pulse: true
      }
    case 'sent':
      return {
        label: 'Enviado',
        icon: Send,
        bgColor: 'bg-blue-100',
        textColor: 'text-blue-800',
        progressWidth: '33%',
        description: 'Solicitud enviada al destinatario'
      }
    case 'signed':
      return {
        label: 'Firmado',
        icon: CheckCircle,
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
        progressWidth: '100%',
        description: 'Solicitud completada exitosamente',
        pulse: true
      }
    case 'returned':
      return {
        label: 'Firmado',
        icon: CheckCircle,
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
        progressWidth: '100%',
        description: 'Solicitud completada exitosamente',
        pulse: true
      }
    default:
      return {
        label: 'Desconocido',
        icon: Clock,
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-800',
        progressWidth: '0%',
        description: 'Estado no definido'
      }
  }
}

// Componente de barra de progreso
function DocumentProgressBar({ status }: { status: string }) {
  const statusDetails = getStatusDetails(status)
  
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>Progreso del documento</span>
        <span>{statusDetails.label}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all duration-500 ${
            status === 'completed' || status === 'signed' || status === 'returned' 
              ? 'bg-green-500 progress-shine' 
              : status === 'pending' 
                ? 'bg-yellow-500' 
                : 'bg-blue-500'
          }`}
          style={{ width: statusDetails.progressWidth }}
        ></div>
      </div>
      <div className="text-xs text-gray-500 mt-1">{statusDetails.description}</div>
    </div>
  )
}

export default function DocumentsPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showOnlyMyDocuments, setShowOnlyMyDocuments] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected')
  const [activeTab, setActiveTab] = useState("all")
  const [viewerModal, setViewerModal] = useState<{
    isOpen: boolean
    documentId: string
    documentName: string
    token?: string
    requestId?: string
  }>({
    isOpen: false,
    documentId: '',
    documentName: ''
  })

  const loadRequests = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getSigningRequests(showOnlyMyDocuments)
      
      if (result.error) {
        setError(result.error)
      } else {
        setRequests(result.requests)
        if (!currentUserId && result.currentUserId) {
          setCurrentUserId(result.currentUserId)
        }
        setError(null)
      }
    } catch (err) {
      setError("Error al cargar las solicitudes de firma")
    } finally {
      setLoading(false)
    }
  }, [showOnlyMyDocuments, currentUserId])

  const handleViewDocument = useCallback((document: any, request: any) => {
    setViewerModal({
      isOpen: true,
      documentId: document.id,
      documentName: document.file_name || request.title,
      // REPLICANDO FastSignDocumentManager: NO pasar token ni requestId
      // Esto fuerza a usar la lógica de fast-sign-docs que funciona correctamente
      token: undefined,
      requestId: undefined
    })
  }, [])

  const handleEditDocument = useCallback((documentId: string) => {
    window.open(`/fast-sign/edit/${documentId}`, '_blank')
  }, [])

  useEffect(() => {
    loadRequests()
  }, [])

  // Recargar cuando cambie el filtro de usuario
  useEffect(() => {
    if (currentUserId) {
      loadRequests()
    }
  }, [showOnlyMyDocuments])

  // Configurar actualizaciones en tiempo real
  useEffect(() => {
    const supabase = createClient()
    
    setRealtimeStatus('connecting')
    
    const channel = supabase
      .channel("documents-realtime")
      // Listen to requests table changes
      .on("postgres_changes", 
        { 
          event: "*", 
          schema: "public", 
          table: "requests" 
        }, 
        (payload) => {
          console.log("Realtime update - requests table:", payload)
          loadRequests()
        }
      )
      // Listen to signing_requests table changes
      .on("postgres_changes", 
        { 
          event: "*", 
          schema: "public", 
          table: "signing_requests" 
        }, 
        (payload) => {
          console.log("Realtime update - signing_requests table:", payload)
          loadRequests()
        }
      )
      // Listen to documents table changes
      .on("postgres_changes", 
        { 
          event: "*", 
          schema: "public", 
          table: "documents" 
        }, 
        (payload) => {
          console.log("Realtime update - documents table:", payload)
          loadRequests()
        }
      )
      // Listen to customers table changes
      .on("postgres_changes", 
        { 
          event: "*", 
          schema: "public", 
          table: "customers" 
        }, 
        (payload) => {
          console.log("Realtime update - customers table:", payload)
          loadRequests()
        }
      )
      // Listen to document_signatures table changes
      .on("postgres_changes", 
        { 
          event: "*", 
          schema: "public", 
          table: "document_signatures" 
        }, 
        (payload) => {
          console.log("Realtime update - document_signatures table:", payload)
          loadRequests()
        }
      )
      .subscribe((status) => {
        console.log("Realtime status:", status)
        setRealtimeStatus(status === "SUBSCRIBED" ? "connected" : 
                          status === "CHANNEL_ERROR" ? "disconnected" : "connecting")
      })

    return () => {
      channel.unsubscribe()
    }
  }, [loadRequests])

  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded w-1/3 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white p-6 rounded-lg shadow-sm">
                <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-300 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadRequests}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  // Normalizar equivalencias de estado (e.g., 'firmado' -> 'signed')
  const normalizeStatus = (status: string) => {
    if (!status) return 'unknown'
    const s = status.toLowerCase().trim()
    if (s === 'firmado' || s === 'signed') return 'signed'
    if (s === 'completado' || s === 'completed') return 'completed'
    if (s === 'devuelto' || s === 'returned') return 'returned'
    if (s === 'enviado' || s === 'sent') return 'sent'
    if (s === 'pendiente' || s === 'pending') return 'pending'
    return s
  }

  // Agrupar solicitudes por estado
  const groupedRequests = requests.reduce(
    (acc, request) => {
      const status = normalizeStatus(request.status || "unknown")
      if (!acc[status]) {
        acc[status] = []
      }
      acc[status].push(request)
      return acc
    },
    {} as Record<string, typeof requests>,
  )

  // Obtener todos los estados únicos con traducciones
  const statuses = ["all", ...Object.keys(groupedRequests)]
  const getStatusLabel = (status: string) => {
    if (status === "all") return "Todos"
    return getStatusDetails(status).label
  }

  // Filtrar documentos según el tab activo
  const filteredRequests = activeTab === "all" ? requests : (groupedRequests[activeTab] || [])

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Gestión de Solicitudes de Firma</h1>
      <p className="text-gray-600 mb-6">
        Administra las solicitudes de firma enviadas por email. Puedes eliminar solicitudes para cancelarlas sin afectar el documento original.
      </p>

      {/* Filtro de Usuario */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              {showOnlyMyDocuments ? (
                <User className="h-4 w-4 text-blue-600" />
              ) : (
                <Users className="h-4 w-4 text-green-600" />
              )}
              <Label htmlFor="user-filter" className="text-sm font-medium">
                {showOnlyMyDocuments ? "Mostrando solo mis solicitudes" : "Mostrando todas las solicitudes"}
              </Label>
            </div>
            <Switch
              id="user-filter"
              checked={!showOnlyMyDocuments}
              onCheckedChange={(checked) => setShowOnlyMyDocuments(!checked)}
            />
          </div>
          
          {/* Indicador de estado en tiempo real */}
          <div className="flex items-center space-x-2">
            <div className={`h-2 w-2 rounded-full ${
              realtimeStatus === 'connected' ? 'bg-green-500' :
              realtimeStatus === 'connecting' ? 'bg-yellow-500' :
              'bg-red-500'
            }`}></div>
            <span className="text-xs text-gray-500">
              {realtimeStatus === 'connected' ? 'Conectado' :
               realtimeStatus === 'connecting' ? 'Conectando...' :
               'Desconectado'}
            </span>
          </div>
        </div>
      </div>

      {/* Navegación por pestañas */}
      <div className="mb-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {statuses.map((status) => (
              <button
                key={status}
                onClick={() => setActiveTab(status)}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  status === activeTab
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {getStatusLabel(status)}
                {status === "all"
                  ? ` (${requests.length || 0})`
                  : ` (${groupedRequests[status]?.length || 0})`}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Lista de documentos */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-500">
              {activeTab === "all" 
                ? (showOnlyMyDocuments ? "No has creado ninguna solicitud de documento" : "No se encontraron solicitudes de documento")
                : `No hay documentos con estado "${getStatusLabel(activeTab)}"`
              }
            </p>
          </div>
        ) : (
          filteredRequests.map((request: any) => {
            const customer = request.customer as any
            const document = request.document as any
            const statusDetails = getStatusDetails(request.status)
            const initials = customer
              ? `${(customer.first_name || "").charAt(0)}${(customer.last_name || "").charAt(0)}`
              : "??"

            return (
              <div 
                key={request.id} 
                className={`bg-white border rounded-lg shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md ${
                  statusDetails.pulse ? 'signed-document-pulse signed-border-glow' : ''
                }`}
              >
                <div className="p-4">
                  {/* Header compacto con título, estado y fecha */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <h3 className="text-sm font-medium text-gray-900 truncate">{request.title}</h3>
                      </div>
                      <p className="text-xs text-gray-500">
                        {request.sent_at
                          ? <RelativeDateFormatter date={request.sent_at} />
                          : "Fecha desconocida"}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusDetails.bgColor} ${statusDetails.textColor} ${
                        statusDetails.pulse ? 'signed-text-glow font-bold' : ''
                      } ml-2 flex-shrink-0`}
                    >
                      <statusDetails.icon className="h-3 w-3 mr-1" />
                      {statusDetails.label}
                    </span>
                  </div>

                  {/* Barra de progreso compacta */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Progreso</span>
                      <span>{statusDetails.progressWidth}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div 
                        className={`h-1.5 rounded-full transition-all duration-500 ${
                          request.status === 'completed' || request.status === 'signed' || request.status === 'returned' 
                            ? 'bg-green-500 progress-shine' 
                            : request.status === 'sent' 
                              ? 'bg-blue-500' 
                              : 'bg-yellow-500'
                        }`}
                        style={{ width: statusDetails.progressWidth }}
                      ></div>
                    </div>
                  </div>

                  {/* Info del usuario compacta */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-gray-200 flex-shrink-0">
                        <span className="text-xs font-medium leading-none text-gray-800">{initials}</span>
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">
                          {customer ? `${customer.first_name || ""} ${customer.last_name || ""}`.trim() : "Desconocido"}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{customer?.email || "Sin email"}</p>
                      </div>
                    </div>
                    {document && (
                      <p className="text-xs text-gray-500 truncate ml-2">{document.file_name}</p>
                    )}
                  </div>

                  {/* Botones de acción compactos */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="h-7 px-2 text-xs"
                      >
                        <Link href={`/documents/${request.id}`}>
                          <Eye className="h-3 w-3 mr-1" />
                          Detalles
                        </Link>
                      </Button>
                      
                      {document && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDocument(document, request)}
                            className="h-7 px-2 text-xs"
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            Ver PDF
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditDocument(document.id)}
                            className="h-7 px-2 text-xs"
                          >
                            <Edit3 className="h-3 w-3 mr-1" />
                            Editar
                          </Button>
                        </>
                      )}
                    </div>
                    
                    <DeleteSigningRequestButton 
                      signingRequestId={request.id} 
                      title={request.title} 
                      onDeleted={loadRequests}
                    />
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Modal de visualización de documentos */}
      <DocumentViewerModal
        isOpen={viewerModal.isOpen}
        onClose={() => setViewerModal(prev => ({ ...prev, isOpen: false }))}
        documentId={viewerModal.documentId}
        documentName={viewerModal.documentName}
        token={viewerModal.token}
        requestId={viewerModal.requestId}
      />
    </div>
  )
}
