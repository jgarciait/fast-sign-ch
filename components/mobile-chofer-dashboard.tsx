"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet"
import { 
  Truck,
  Clock,
  MapPin,
  FileText,
  AlertCircle,
  Menu,
  LogOut,
  Navigation,
  CheckCircle,
  XCircle,
  Package,
  RefreshCw,
  Eye
} from "lucide-react"
import { format, isToday, isTomorrow, isYesterday } from "date-fns"
import { es } from "date-fns/locale"
import { getMyAssignments } from "@/app/actions/assignment-actions"
import { updateChoferAssignmentStatus } from "@/app/actions/chofer-workflow-actions"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import type { AssignmentWithDetails } from "@/types/assignment-types"
import { MobileStatusUpdater } from "@/components/mobile-status-updater"
import MobilePDFViewerModal from "@/components/mobile-pdf-viewer-modal"

export default function MobileChoferDashboard() {
  const [assignments, setAssignments] = useState<AssignmentWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showPDFModal, setShowPDFModal] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<{url: string, name: string} | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadAssignments()
  }, [])

  const loadAssignments = async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    
    try {
      const result = await getMyAssignments({})
      
      if (result.success && result.data) {
        setAssignments(result.data)
      } else {
        console.error('Error loading assignments:', result.error)
        setAssignments([])
      }
    } catch (error) {
      console.error('Error loading assignments:', error)
      setAssignments([])
    } finally {
      if (isRefresh) {
        setIsRefreshing(false)
      } else {
        setIsLoading(false)
      }
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  const handleStatusUpdate = async (assignmentId: string, newStatus: string) => {
    try {
      console.log('🚛 MOBILE: Updating status for assignment', assignmentId, 'to', newStatus)
      
      const result = await updateChoferAssignmentStatus(
        assignmentId, 
        newStatus as any,
        `Chofer updated via mobile app`
      )
      
      if (result.success) {
        console.log('🚛 MOBILE: Status update successful, refreshing assignments')
        // Refresh assignments
        await loadAssignments(true)
      } else {
        console.error('🚛 MOBILE: Error updating assignment status:', result.error)
        // TODO: Show user-friendly error message
      }
    } catch (error) {
      console.error('🚛 MOBILE: Error updating assignment status:', error)
      // TODO: Show user-friendly error message
    }
  }

  const openGoogleMaps = (address: string) => {
    if (!address) return
    const encodedAddress = encodeURIComponent(address)
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank')
  }

  const handleViewPDF = (assignment: AssignmentWithDetails) => {
    if (!assignment.document?.id) {
      console.error('No document ID available')
      alert('Error: No se encontró el ID del documento')
      return
    }

    console.log('🚛 MOBILE PDF: Opening document:', {
      id: assignment.document.id,
      name: assignment.document.file_name,
      path: assignment.document.file_path
    })

    // Always use the API endpoint for consistent handling
    const pdfUrl = `/api/pdf/${assignment.document.id}`

    console.log('🚛 MOBILE PDF: Generated URL:', pdfUrl)

    setSelectedDocument({
      url: pdfUrl,
      name: assignment.document.file_name || 'Conduce'
    })
    setShowPDFModal(true)
  }

  const handleClosePDFModal = () => {
    setShowPDFModal(false)
    setSelectedDocument(null)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned': return 'bg-blue-500 text-white'
      case 'in_transit': return 'bg-yellow-500 text-white'
      case 'completed': return 'bg-green-500 text-white'
      case 'signed': return 'bg-emerald-500 text-white'
      case 'cancelled': return 'bg-red-500 text-white'
      default: return 'bg-gray-500 text-white'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'assigned': return <Package className="w-4 h-4" />
      case 'in_transit': return <Truck className="w-4 h-4" />
      case 'completed': return <CheckCircle className="w-4 h-4" />
      case 'signed': return <CheckCircle className="w-4 h-4" />
      case 'cancelled': return <XCircle className="w-4 h-4" />
      default: return <AlertCircle className="w-4 h-4" />
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    if (isToday(date)) return 'Hoy'
    if (isTomorrow(date)) return 'Mañana'
    if (isYesterday(date)) return 'Ayer'
    return format(date, "d MMM", { locale: es })
  }

  const assignmentCounts = {
    total: assignments.length,
    assigned: assignments.filter(a => a.status === 'assigned').length,
    in_transit: assignments.filter(a => a.status === 'in_transit').length,
    completed: assignments.filter(a => ['completed', 'signed'].includes(a.status)).length
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="flex items-center justify-center h-40">
          <div className="text-center">
            <Truck className="w-8 h-8 text-blue-500 mx-auto mb-2 animate-pulse" />
            <p className="text-sm font-medium text-gray-900">Cargando...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Compact Header - Max 20% of screen */}
      <div className="bg-white shadow-sm" style={{ maxHeight: '20vh' }}>
                  <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <Truck className="w-6 h-6 text-blue-600 mr-2" />
                <h1 className="text-lg font-bold text-gray-900">Mis Entregas</h1>
              </div>
              
              <div className="flex gap-2">
                {/* Refresh Button */}
                <Button
                  onClick={() => loadAssignments(true)}
                  disabled={isRefreshing}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
                
                {/* Menu Drawer Trigger */}
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Menu className="w-4 h-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-64">
                    <SheetHeader>
                      <SheetTitle>Menú</SheetTitle>
                    </SheetHeader>
                    <div className="py-4">
                      <Button
                        onClick={handleSignOut}
                        variant="outline"
                        className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Cerrar Sesión
                      </Button>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
            
            {/* Compact Stats */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-blue-50 rounded-lg p-2 border-l-2 border-blue-200">
                <div className="text-lg font-bold text-blue-600">{assignmentCounts.assigned}</div>
                <div className="text-xs text-gray-600 leading-tight">Asignados</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-2 border-l-2 border-yellow-200">
                <div className="text-lg font-bold text-yellow-600">{assignmentCounts.in_transit}</div>
                <div className="text-xs text-gray-600 leading-tight">En Tránsito</div>
              </div>
              <div className="bg-green-50 rounded-lg p-2 border-l-2 border-green-200">
                <div className="text-lg font-bold text-green-600">{assignmentCounts.completed}</div>
                <div className="text-xs text-gray-600 leading-tight">Completados</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 border-l-2 border-gray-200">
                <div className="text-lg font-bold text-gray-600">{assignmentCounts.total}</div>
                <div className="text-xs text-gray-600 leading-tight">Total</div>
              </div>
            </div>
          </div>
      </div>

      {/* Assignments List - Rest of the screen */}
      <div className="px-4 py-4 space-y-3 bg-gray-100">
        {assignments.length > 0 ? (
          assignments.map((assignment) => (
            <Card key={assignment.id} className="bg-white shadow-sm border border-gray-200">
              <CardContent className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center mb-1">
                      <FileText className="w-4 h-4 text-gray-600 mr-1 flex-shrink-0" />
                      <h3 className="font-medium text-gray-900 text-sm truncate">
                        {assignment.document?.file_name || 'Documento'}
                      </h3>
                    </div>
                    <div className="flex items-center text-xs text-gray-500 mb-1">
                      <Clock className="w-3 h-3 mr-1 flex-shrink-0" />
                      <span className="truncate">
                        {assignment.expected_delivery_date 
                          ? formatDate(assignment.expected_delivery_date)
                          : 'Sin fecha'}
                      </span>
                    </div>

                  </div>
                  <div className="flex-shrink-0 ml-2">
                    <Badge className={`${getStatusColor(assignment.status)} text-xs px-2 py-1`}>
                      <div className="flex items-center">
                        {getStatusIcon(assignment.status)}
                        <span className="ml-1">{getStatusText(assignment.status)}</span>
                      </div>
                    </Badge>
                  </div>
                </div>

                {/* Address */}
                {assignment.delivery_address && (
                  <div className="flex items-start mb-3 text-sm text-gray-600">
                    <MapPin className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="flex-1 break-words">{assignment.delivery_address}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2">
                  {/* PDF View Button */}
                  <Button
                    onClick={() => handleViewPDF(assignment)}
                    variant="default"
                    size="sm"
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Ver Conduce
                  </Button>

                  {assignment.delivery_address && (
                    <Button
                      onClick={() => openGoogleMaps(assignment.delivery_address)}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <Navigation className="w-4 h-4 mr-2" />
                      Ver en Mapa
                    </Button>
                  )}
                  
                  <MobileStatusUpdater
                    currentStatus={assignment.status}
                    onStatusChange={(newStatus) => handleStatusUpdate(assignment.id, newStatus)}
                    disabled={isRefreshing}
                  />
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-12">
            <div className="bg-white rounded-lg p-8 mx-4 shadow-sm border border-gray-200">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No hay asignaciones
              </h3>
              <p className="text-gray-600">
                No tienes entregas asignadas en este momento.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* PDF Viewer Modal */}
      <MobilePDFViewerModal
        isOpen={showPDFModal}
        onClose={handleClosePDFModal}
        documentUrl={selectedDocument?.url}
        documentName={selectedDocument?.name}
      />
    </div>
  )
}
