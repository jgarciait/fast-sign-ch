"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Settings,
  Truck,
  Clock,
  MapPin,
  User,
  FileText,
  AlertCircle,
  Search,
  Filter,
  Edit,
  MoreHorizontal
} from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { getAssignments, updateAssignment } from "@/app/actions/assignment-actions"
import type { AssignmentWithDetails, AssignmentFilters } from "@/types/assignment-types"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import EditAssignmentModal from "@/components/edit-assignment-modal"

export default function AdminAssignmentsDashboard() {
  const [assignments, setAssignments] = useState<AssignmentWithDetails[]>([])
  const [filteredAssignments, setFilteredAssignments] = useState<AssignmentWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [editingAssignment, setEditingAssignment] = useState<AssignmentWithDetails | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)

  useEffect(() => {
    loadAssignments()
  }, [])

  useEffect(() => {
    filterAssignments()
  }, [assignments, searchTerm, statusFilter, priorityFilter, activeTab])

  const loadAssignments = async () => {
    setIsLoading(true)
    try {
      // Always load all assignments, let client-side filtering handle tab logic
      const result = await getAssignments({})
      
      if (result.success && result.data) {
        console.log('📊 ADMIN DASHBOARD: Loaded assignments:', result.data.length)
        setAssignments(result.data)
      } else {
        console.error('📊 ADMIN DASHBOARD: Error loading assignments:', result.error)
        setAssignments([])
      }
    } catch (error) {
      console.error('📊 ADMIN DASHBOARD: Error loading assignments:', error)
      setAssignments([])
    } finally {
      setIsLoading(false)
    }
  }

  const filterAssignments = () => {
    let filtered = assignments

    // Tab filter first
    if (activeTab === "pending") {
      filtered = filtered.filter(assignment => ['assigned', 'in_transit'].includes(assignment.status))
    } else if (activeTab === "completed") {
      filtered = filtered.filter(assignment => ['completed', 'signed'].includes(assignment.status))
    } else if (activeTab === "cancelled") {
      filtered = filtered.filter(assignment => assignment.status === 'cancelled')
    }
    // For "all" tab, show all assignments

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(assignment => 
        assignment.document?.file_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assignment.assigned_to_user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assignment.assigned_to_user?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assignment.assigned_to_user?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assignment.delivery_address?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Status filter (additional filter on top of tab)
    if (statusFilter !== "all") {
      filtered = filtered.filter(assignment => assignment.status === statusFilter)
    }

    // Priority filter
    if (priorityFilter !== "all") {
      filtered = filtered.filter(assignment => assignment.priority === priorityFilter)
    }

    setFilteredAssignments(filtered)
  }

  const handleStatusChange = async (assignmentId: string, newStatus: string) => {
    try {
      const result = await updateAssignment(assignmentId, { status: newStatus as any })
      
      if (result.success) {
        // Refresh assignments
        loadAssignments()
      } else {
        console.error('Error updating assignment status:', result.error)
      }
    } catch (error) {
      console.error('Error updating assignment status:', error)
    }
  }

  const handleEditAssignment = (assignment: AssignmentWithDetails) => {
    setEditingAssignment(assignment)
    setShowEditModal(true)
  }

  const handleCloseEditModal = () => {
    setShowEditModal(false)
    setEditingAssignment(null)
  }

  const handleEditSuccess = () => {
    loadAssignments()
    handleCloseEditModal()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned': return 'bg-blue-100 text-blue-800'
      case 'in_transit': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'signed': return 'bg-emerald-100 text-emerald-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const renderAssignmentCard = (assignment: AssignmentWithDetails) => (
    <Card key={assignment.id} className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {assignment.document?.file_name || 'Documento sin nombre'}
              </div>
            </CardTitle>
            <CardDescription>
              Asignado el {format(new Date(assignment.assigned_at), "d 'de' MMMM, yyyy", { locale: es })}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge className={getStatusColor(assignment.status)}>
              {assignment.status === 'assigned' ? 'Asignado' :
               assignment.status === 'in_transit' ? 'En Tránsito' :
               assignment.status === 'completed' ? 'Completado' :
               assignment.status === 'signed' ? 'Firmado' :
               assignment.status === 'cancelled' ? 'Cancelado' : assignment.status}
            </Badge>
            <Badge className={getPriorityColor(assignment.priority)}>
              {assignment.priority === 'high' ? 'Alta' : 
               assignment.priority === 'medium' ? 'Media' : 'Baja'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <div>
            <span className="text-gray-500">Chofer:</span>
            <div className="font-medium flex items-center">
              <User className="w-4 h-4 mr-2" />
              {assignment.assigned_to_user?.first_name && assignment.assigned_to_user?.last_name
                ? `${assignment.assigned_to_user.first_name} ${assignment.assigned_to_user.last_name}`
                : assignment.assigned_to_user?.email || 'No asignado'}
            </div>
          </div>
          
          <div>
            <span className="text-gray-500">Dirección:</span>
            <div className="font-medium flex items-center">
              <MapPin className="w-4 h-4 mr-2" />
              {assignment.delivery_address || 'No especificada'}
            </div>
          </div>
          
          <div>
            <span className="text-gray-500">Fecha esperada:</span>
            <div className="font-medium flex items-center">
              <Clock className="w-4 h-4 mr-2" />
              {assignment.expected_delivery_date 
                ? format(new Date(assignment.expected_delivery_date), "d MMM yyyy", { locale: es })
                : 'No especificada'}
            </div>
          </div>
        </div>
        
        {assignment.description && (
          <div className="mt-3 p-3 bg-gray-50 rounded-md">
            <span className="text-gray-500 text-sm">Descripción:</span>
            <p className="text-sm mt-1">{assignment.description}</p>
          </div>
        )}
        
        {/* Admin Actions */}
        <div className="mt-4 flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Acciones
                <MoreHorizontal className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleEditAssignment(assignment)}>
                <Edit className="w-4 h-4 mr-2" />
                Editar Entrega
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange(assignment.id, 'assigned')}>
                Marcar como Asignado
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange(assignment.id, 'in_transit')}>
                Marcar como En Tránsito
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange(assignment.id, 'completed')}>
                Marcar como Completado
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange(assignment.id, 'cancelled')}>
                Cancelar Asignación
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  )

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Settings className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-pulse" />
            <p className="text-lg font-medium text-gray-900">Cargando todas las entregas...</p>
          </div>
        </div>
      </div>
    )
  }

  const assignmentCounts = {
    all: assignments.length,
    pending: assignments.filter(a => ['assigned', 'in_transit'].includes(a.status)).length,
    completed: assignments.filter(a => ['completed', 'signed'].includes(a.status)).length,
    cancelled: assignments.filter(a => a.status === 'cancelled').length
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestión de Entregas</h1>
        <p className="text-gray-600">Administra todas las entregas del sistema</p>
      </div>

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <Input
            placeholder="Buscar por documento, chofer o dirección..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="assigned">Asignado</SelectItem>
            <SelectItem value="in_transit">En Tránsito</SelectItem>
            <SelectItem value="completed">Completado</SelectItem>
            <SelectItem value="signed">Firmado</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Prioridad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las prioridades</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="medium">Media</SelectItem>
            <SelectItem value="low">Baja</SelectItem>
          </SelectContent>
        </Select>
        
        <Button onClick={loadAssignments} variant="outline">
          <Filter className="w-4 h-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-gray-900">{assignmentCounts.all}</div>
            <div className="text-sm text-gray-600">Total Entregas</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">{assignmentCounts.pending}</div>
            <div className="text-sm text-gray-600">Pendientes</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{assignmentCounts.completed}</div>
            <div className="text-sm text-gray-600">Completadas</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{assignmentCounts.cancelled}</div>
            <div className="text-sm text-gray-600">Canceladas</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="all">Todas ({assignmentCounts.all})</TabsTrigger>
          <TabsTrigger value="pending">Pendientes ({assignmentCounts.pending})</TabsTrigger>
          <TabsTrigger value="completed">Completadas ({assignmentCounts.completed})</TabsTrigger>
          <TabsTrigger value="cancelled">Canceladas ({assignmentCounts.cancelled})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {filteredAssignments.length > 0 ? (
            <div className="space-y-4">
              {filteredAssignments.map(renderAssignmentCard)}
            </div>
          ) : (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No hay entregas
              </h3>
              <p className="text-gray-600">
                No se encontraron entregas con los filtros actuales.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Assignment Modal */}
      <EditAssignmentModal
        isOpen={showEditModal}
        onClose={handleCloseEditModal}
        assignment={editingAssignment}
        onSuccess={handleEditSuccess}
      />
    </div>
  )
}
