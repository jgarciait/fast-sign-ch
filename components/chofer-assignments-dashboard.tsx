"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { 
  CalendarIcon,
  Truck,
  Clock,
  MapPin,
  User,
  FileText,
  AlertCircle
} from "lucide-react"
import { format, isToday, isTomorrow, isYesterday, startOfDay, endOfDay } from "date-fns"
import { es } from "date-fns/locale"
import DocumentStatusUpdater from "@/components/document-status-updater"
import { getMyAssignments } from "@/app/actions/assignment-actions"
import type { AssignmentWithDetails } from "@/types/assignment-types"

type AssignmentsByDate = Record<string, AssignmentWithDetails[]>

export default function ChoferAssignmentsDashboard() {
  const [assignments, setAssignments] = useState<AssignmentWithDetails[]>([])
  const [assignmentsByDate, setAssignmentsByDate] = useState<AssignmentsByDate>({})
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("today")

  useEffect(() => {
    loadAssignments()
  }, [])

  useEffect(() => {
    // Organize assignments by date
    const grouped: AssignmentsByDate = {}
    console.log('🚛 DESKTOP CHOFER DASHBOARD: Organizing assignments by date:', assignments.length)
    
    assignments.forEach(assignment => {
      console.log('🚛 CHOFER DASHBOARD: Processing assignment:', assignment.id, 'expected_delivery_date:', assignment.expected_delivery_date)
      
      if (assignment.expected_delivery_date) {
        // Use date string directly as key to avoid timezone conversion
        const dateKey = assignment.expected_delivery_date // Already in 'yyyy-MM-dd' format
        console.log('🚛 CHOFER DASHBOARD: Assignment date key:', dateKey, 'for assignment:', assignment.id)
        if (!grouped[dateKey]) {
          grouped[dateKey] = []
        }
        grouped[dateKey].push(assignment)
      } else {
        // Show assignments without dates in "today" section for now
        console.log('🚛 CHOFER DASHBOARD: Assignment without date, adding to today:', assignment.id)
        
        const todayKey = format(new Date(), 'yyyy-MM-dd')
        console.log('🚛 CHOFER DASHBOARD: Using today key:', todayKey)
        
        if (!grouped[todayKey]) {
          grouped[todayKey] = []
        }
        grouped[todayKey].push(assignment)
      }
    })
    
    console.log('🚛 CHOFER DASHBOARD: Final grouped assignments:', grouped)
    setAssignmentsByDate(grouped)
  }, [assignments])

  const loadAssignments = async () => {
    setIsLoading(true)
    try {
      // Debug: Show current user info and date
      console.log('🚛 CHOFER DASHBOARD: Current time:', new Date().toISOString())
      console.log('🚛 CHOFER DASHBOARD: Today key:', format(new Date(), 'yyyy-MM-dd'))
      
      console.log('🚛 CHOFER DASHBOARD: Loading assignments for current user')
      
      // Load ALL assignments for this chofer (not just pending ones)
      const result = await getMyAssignments({})
      
      console.log('🚛 CHOFER DASHBOARD: Raw API result:', result)

      console.log('🚛 CHOFER DASHBOARD: getMyAssignments result:', result)

      if (result.success && result.data) {
        console.log('🚛 DESKTOP CHOFER DASHBOARD: Setting assignments:', result.data.length, 'assignments')
        console.log('🚛 DESKTOP CHOFER DASHBOARD: Assignment details:', result.data.map(a => ({
          id: a.id,
          status: a.status,
          file_name: a.document?.file_name,
          assigned_to_user_id: a.assigned_to_user_id
        })))
        setAssignments(result.data)
      } else {
        console.error('🚛 DESKTOP Error loading assignments:', result.error)
        setAssignments([])
      }
    } catch (error) {
      console.error('Error loading assignments:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getAssignmentsForDate = (date: Date): AssignmentWithDetails[] => {
    const dateKey = format(date, 'yyyy-MM-dd')
    return assignmentsByDate[dateKey] || []
  }

  const getTodayAssignments = () => {
    const today = new Date()
    console.log('🚛 CHOFER DASHBOARD: getTodayAssignments - Today:', today, 'Key:', format(today, 'yyyy-MM-dd'))
    return getAssignmentsForDate(today)
  }
  
  const getTomorrowAssignments = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    console.log('🚛 CHOFER DASHBOARD: getTomorrowAssignments - Tomorrow:', tomorrow, 'Key:', format(tomorrow, 'yyyy-MM-dd'))
    return getAssignmentsForDate(tomorrow)
  }

  const getDateLabel = (date: Date): string => {
    if (isToday(date)) return "Hoy"
    if (isTomorrow(date)) return "Mañana"
    if (isYesterday(date)) return "Ayer"
    return format(date, "dd 'de' MMMM", { locale: es })
  }

  const getStatusCount = (status: string) => {
    const count = assignments.filter(assignment => assignment.status === status).length
    console.log(`🚛 DESKTOP DASHBOARD: Status ${status} count: ${count}`)
    console.log(`🚛 DESKTOP DASHBOARD: All assignment statuses:`, assignments.map(a => ({ id: a.id, status: a.status, file_name: a.document?.file_name })))
    return count
  }

  const handleStatusUpdate = (assignmentId: string, newStatus: string) => {
    setAssignments(prev => 
      prev.map(assignment => 
        assignment.id === assignmentId 
          ? { ...assignment, status: newStatus }
          : assignment
      )
    )
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'assigned': return 'bg-blue-100 text-blue-800'
      case 'in_transit': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'signed': return 'bg-emerald-100 text-emerald-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
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

  const renderAssignmentCard = (assignment: AssignmentWithDetails) => {
    const document = assignment.document
    const status = assignment.status || 'assigned'
    
    return (
      <Card key={assignment.id} className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg font-semibold mb-1">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  {document?.file_name || document?.title || 'Documento sin título'}
                </div>
              </CardTitle>
              
              {assignment.client_name && (
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <User className="w-4 h-4" />
                  Cliente: {assignment.client_name}
                </div>
              )}
              
              {assignment.delivery_address && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="w-4 h-4" />
                  {assignment.delivery_address}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Badge className={getStatusBadgeColor(assignment.status)}>
                {getStatusText(assignment.status)}
              </Badge>
              <DocumentStatusUpdater
                documentId={document?.id || ''}
                documentName={document?.file_name || 'Documento'}
                currentStatus={status}
                onStatusUpdate={(newStatus) => handleStatusUpdate(assignment.id, newStatus)}
              />
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Fecha esperada:</span>
              <div className="font-medium">
                {assignment.expected_delivery_date 
                  ? (() => {
                      // Parse date as local date to avoid timezone conversion
                      const [year, month, day] = assignment.expected_delivery_date.split('-')
                      return format(new Date(parseInt(year), parseInt(month) - 1, parseInt(day)), "dd 'de' MMMM 'de' yyyy", { locale: es })
                    })()
                  : 'Sin fecha'
                }
              </div>
            </div>
            
            <div>
              <span className="text-gray-500">Prioridad:</span>
              <div className="font-medium">
                <Badge 
                  className={
                    assignment.priority === 'high' ? 'bg-red-100 text-red-800' :
                    assignment.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }
                >
                  {assignment.priority === 'high' ? 'Alta' : 
                   assignment.priority === 'medium' ? 'Media' : 'Baja'}
                </Badge>
              </div>
            </div>
          </div>
          
          {assignment.notes && (
            <div className="mt-3 p-3 bg-gray-50 rounded-md">
              <span className="text-gray-500 text-sm">Notas:</span>
              <p className="text-sm mt-1">{assignment.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Truck className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-pulse" />
            <p className="text-lg font-medium text-gray-900">Cargando entregas...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Mis Entregas</h1>
        <p className="text-gray-600">Gestiona tus entregas y actualiza el estatus de los documentos</p>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-blue-600">{getStatusCount('assigned')}</p>
            <p className="text-sm text-gray-600">Asignados</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <Truck className="w-8 h-8 text-orange-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-orange-600">{getStatusCount('in_transit')}</p>
            <p className="text-sm text-gray-600">En Tránsito</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <FileText className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-green-600">{getStatusCount('completed') + getStatusCount('signed')}</p>
            <p className="text-sm text-gray-600">Completados</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-red-600">{getStatusCount('cancelled')}</p>
            <p className="text-sm text-gray-600">Cancelados</p>
          </CardContent>
        </Card>
      </div>

      {/* Assignments by Date */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="today">Hoy ({getTodayAssignments().length})</TabsTrigger>
          <TabsTrigger value="tomorrow">Mañana ({getTomorrowAssignments().length})</TabsTrigger>
          <TabsTrigger value="calendar">Calendario</TabsTrigger>
        </TabsList>
        
        <TabsContent value="today" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Entregas para Hoy</CardTitle>
              <CardDescription>
                {getTodayAssignments().length} entregas programadas para hoy
              </CardDescription>
            </CardHeader>
            <CardContent>
              {getTodayAssignments().length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No tienes entregas para hoy</p>
                </div>
              ) : (
                getTodayAssignments().map(renderAssignmentCard)
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="tomorrow" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Entregas para Mañana</CardTitle>
              <CardDescription>
                {getTomorrowAssignments().length} entregas programadas para mañana
              </CardDescription>
            </CardHeader>
            <CardContent>
              {getTomorrowAssignments().length === 0 ? (
                <div className="text-center py-8">
                  <Truck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No tienes entregas para mañana</p>
                </div>
              ) : (
                getTomorrowAssignments().map(renderAssignmentCard)
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="calendar" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Seleccionar Fecha</CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  className="rounded-md border"
                  locale={es}
                />
              </CardContent>
            </Card>
            
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{getDateLabel(selectedDate)}</CardTitle>
                <CardDescription>
                  {getAssignmentsForDate(selectedDate).length} entregas programadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {getAssignmentsForDate(selectedDate).length === 0 ? (
                  <div className="text-center py-8">
                    <CalendarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No tienes entregas para esta fecha</p>
                  </div>
                ) : (
                  getAssignmentsForDate(selectedDate).map(renderAssignmentCard)
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
