"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Trash2, Search, ChevronLeft, ChevronRight, Edit, Plus, MoreVertical } from "lucide-react"
import { deleteCustomer, type Customer } from "@/app/actions/customer-actions"
import { toast } from "sonner"
import CustomerModal from "./customer-modal"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/components/ui/use-toast"

interface CustomersListProps {
  initialCustomers: Customer[]
  initialError?: string
}

export default function CustomersList({ initialCustomers, initialError }: CustomersListProps) {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Customer modal states
  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null)
  const [isWideScreen, setIsWideScreen] = useState(false)

  const itemsPerPage = 10

  // Filter customers based on search term
  const filteredCustomers = useMemo(() => {
    if (!searchTerm.trim()) return customers

    const term = searchTerm.toLowerCase()
    return customers.filter(customer => {
      const fullName = `${customer.first_name || ""} ${customer.last_name || ""}`.toLowerCase()
      const email = customer.email.toLowerCase()
      return fullName.includes(term) || email.includes(term)
    })
  }, [customers, searchTerm])

  // Calculate pagination
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentCustomers = filteredCustomers.slice(startIndex, endIndex)

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  // Detectar ancho de pantalla
  useEffect(() => {
    const checkScreenWidth = () => {
      setIsWideScreen(window.innerWidth >= 1600)
    }
    
    checkScreenWidth()
    window.addEventListener('resize', checkScreenWidth)
    
    return () => window.removeEventListener('resize', checkScreenWidth)
  }, [])

  const handleDeleteClick = (customer: Customer) => {
    setCustomerToDelete(customer)
    setDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!customerToDelete) return

    setIsDeleting(true)
    try {
      const result = await deleteCustomer(customerToDelete.id)
      
      if (result.error) {
        toast.error(result.error)
      } else {
        // Remove customer from local state
        setCustomers(prev => prev.filter(c => c.id !== customerToDelete.id))
        toast.success("Contacto eliminado exitosamente")
        
        // Adjust current page if needed
        const newFilteredCount = filteredCustomers.length - 1
        const newTotalPages = Math.ceil(newFilteredCount / itemsPerPage)
        if (currentPage > newTotalPages && newTotalPages > 0) {
          setCurrentPage(newTotalPages)
        }
      }
    } catch (error) {
      toast.error("Error al eliminar el contacto")
    } finally {
      setIsDeleting(false)
      setDeleteModalOpen(false)
      setCustomerToDelete(null)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false)
    setCustomerToDelete(null)
  }

  // Customer modal handlers
  const handleAddCustomer = () => {
    setCustomerToEdit(null)
    setCustomerModalOpen(true)
  }

  const handleEditCustomer = (customer: Customer) => {
    setCustomerToEdit(customer)
    setCustomerModalOpen(true)
  }

  const handleCustomerModalClose = () => {
    setCustomerModalOpen(false)
    setCustomerToEdit(null)
  }

  const handleCustomerSuccess = (updatedCustomer: Customer) => {
    if (customerToEdit) {
      // Update existing customer
      setCustomers(prev => 
        prev.map(c => c.id === updatedCustomer.id ? updatedCustomer : c)
      )
    } else {
      // Add new customer
      setCustomers(prev => [updatedCustomer, ...prev])
    }
  }

  if (initialError) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-md">{initialError}</div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        {/* Search Bar and Add Customer Button */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Buscar contactos por nombre o correo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              onClick={handleAddCustomer}
              className="bg-[#0d2340] text-white py-2 px-4 rounded-md hover:bg-[#1a3a5f] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center justify-center whitespace-nowrap"
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar Contacto
            </button>
          </div>
        </div>

        {/* Results */}
        {customers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay contactos aún</h3>
            <p className="text-gray-500 mb-4">Comienza agregando tu primer contacto</p>
            <button
              onClick={handleAddCustomer}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-[#0d2340] hover:bg-[#1a3a5f] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar Contacto
            </button>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron contactos</h3>
            <p className="text-gray-500">Intenta ajustar tus términos de búsqueda</p>
          </div>
        ) : (
          <>
            {/* Customer Table */}
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <div className="relative">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Nombre
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Correo
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Teléfono
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Creado
                        </th>
                        <th className="sticky right-0 bg-gray-50 px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-l border-gray-200">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {currentCustomers.map((customer) => (
                        <tr key={customer.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {customer.first_name} {customer.last_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {customer.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {customer.telephone || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {customer.created_at ? new Date(customer.created_at).toLocaleDateString() : '-'}
                          </td>
                          <td className="sticky right-0 bg-white px-6 py-4 whitespace-nowrap text-right text-sm font-medium border-l border-gray-200">
                            {isWideScreen ? (
                              // Botones individuales para pantallas anchas (>=1600px)
                              <div className="flex justify-end space-x-2">
                                <button
                                  onClick={() => handleEditCustomer(customer)}
                                  className="text-blue-600 hover:text-blue-900 flex items-center"
                                  title="Editar contacto"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(customer)}
                                  className="text-red-600 hover:text-red-900 flex items-center"
                                  title="Eliminar contacto"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              // Dropdown menu para pantallas menores a 1600px
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="text-gray-600 hover:text-gray-900 p-1">
                                    <MoreVertical className="h-4 w-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem 
                                    onClick={() => handleEditCustomer(customer)}
                                    className="text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Editar Contacto
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => handleDeleteClick(customer)}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Eliminar Contacto
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border rounded-lg">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Mostrando <span className="font-medium">{startIndex + 1}</span> a{" "}
                      <span className="font-medium">
                        {Math.min(endIndex, filteredCustomers.length)}
                      </span>{" "}
                      de <span className="font-medium">{filteredCustomers.length}</span> resultados
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            page === currentPage
                              ? "z-10 bg-blue-50 border-blue-500 text-blue-600"
                              : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                      
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Customer Modal */}
      <CustomerModal
        isOpen={customerModalOpen}
        onClose={handleCustomerModalClose}
        onSuccess={handleCustomerSuccess}
        customer={customerToEdit || undefined}
      />

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && customerToDelete && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mt-4">Eliminar Contacto</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  ¿Estás seguro que quieres eliminar{" "}
                  <span className="font-medium">
                    {customerToDelete.first_name || customerToDelete.last_name
                      ? `${customerToDelete.first_name || ""} ${customerToDelete.last_name || ""}`.trim()
                      : customerToDelete.email}
                  </span>
                  ? Esta acción no se puede deshacer.
                </p>
              </div>
              <div className="flex justify-center space-x-4 mt-4">
                <button
                  onClick={handleDeleteCancel}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-gray-300 text-gray-800 text-sm font-medium rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                >
                  {isDeleting ? "Eliminando..." : "Eliminar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
} 