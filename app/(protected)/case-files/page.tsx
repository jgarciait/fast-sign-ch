'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import CreateFileRecordModal from '@/components/create-file-record-modal'
import { getActiveFilingSystem, getFileRecords, type FilingSystem, type FileRecord } from '@/app/actions/filing-system-actions'

export default function CaseFilesPage() {
  const [filingSystem, setFilingSystem] = useState<FilingSystem | null>(null)
  const [fileRecords, setFileRecords] = useState<FileRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [sortField, setSortField] = useState<string>('none')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [filterField, setFilterField] = useState<string>('none')
  const [filterValue, setFilterValue] = useState<string>('')
  const [dateFilter, setDateFilter] = useState<string>('')
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 8

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [systemResult, recordsResult] = await Promise.all([
        getActiveFilingSystem(),
        getFileRecords()
      ])
      
      if (!systemResult.error && systemResult.system) {
        setFilingSystem(systemResult.system)
      }
      
      if (!recordsResult.error) {
        setFileRecords(recordsResult.records)
      }
    } catch (error) {
      console.error('Error loading case files data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter and sort records
  const filteredAndSortedRecords = fileRecords
    .filter(record => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const matchesSearch = Object.values(record.valores_json || {}).some(value => 
          String(value).toLowerCase().includes(searchLower)
        )
        if (!matchesSearch) return false
      }
      
      // Field filter
      if (filterField && filterField !== 'none' && filterValue) {
        const fieldValue = record.valores_json?.[filterField]
        if (!fieldValue || !String(fieldValue).toLowerCase().includes(filterValue.toLowerCase())) {
          return false
        }
      }
      
      // Date filter
      if (dateFilter) {
        const recordDate = new Date(record.created_at).toISOString().split('T')[0]
        if (recordDate !== dateFilter) return false
      }
      
      return true
    })
    .sort((a, b) => {
      if (!sortField || sortField === 'none') return 0
      
      let aValue = sortField === 'created_at' ? a.created_at : a.valores_json?.[sortField]
      let bValue = sortField === 'created_at' ? b.created_at : b.valores_json?.[sortField]
      
      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0
      if (aValue == null) return sortOrder === 'asc' ? 1 : -1
      if (bValue == null) return sortOrder === 'asc' ? -1 : 1
      
      // Convert to strings for comparison
      aValue = String(aValue).toLowerCase()
      bValue = String(bValue).toLowerCase()
      
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

  // Calculate pagination
  const totalRecords = filteredAndSortedRecords.length
  const totalPages = Math.ceil(totalRecords / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedRecords = filteredAndSortedRecords.slice(startIndex, endIndex)

  // Reset to first page when search/filter changes and current page is beyond available pages
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1)
    }
  }, [totalRecords, currentPage, totalPages])

  const handleCreateSuccess = () => {
    setShowCreateModal(false)
    loadData()
  }

  const clearSearch = () => {
    setSearchTerm('')
  }

  const clearFilters = () => {
    setSearchTerm('')
    setFilterField('none')
    setFilterValue('')
    setDateFilter('')
    setSortField('none')
    setSortOrder('asc')
    setCurrentPage(1) // Reset to first page when clearing filters
  }

  // Get all unique field keys for table headers
  const getFieldKeys = () => {
    const keys = new Set<string>()
    fileRecords.forEach(record => {
      Object.keys(record.valores_json || {}).forEach(key => keys.add(key))
    })
    return Array.from(keys).sort()
  }

  const fieldKeys = getFieldKeys()

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="h-10 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!filingSystem) {
    return (
      <div className="p-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-5 h-5 bg-[#0d2340] rounded-full flex items-center justify-center">
              <span className="text-white text-xs">!</span>
            </div>
            <div>
              <h3 className="font-medium text-blue-800">No Filing System Available</h3>
              <p className="text-sm text-blue-700 mt-1">
                Create and activate a filing system in Settings → Filing Systems to manage case files.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Compact Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Expedientes</h1>
          <p className="text-sm text-gray-600 mt-1">
            {filingSystem.nombre} • Mostrando {paginatedRecords.length} de {filteredAndSortedRecords.length} expedientes
            {totalPages > 1 && ` (Página ${currentPage} de ${totalPages})`}
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} size="sm" className="h-9">
          <span className="text-lg mr-1">+</span>
          Nuevo Expediente
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border p-4 space-y-4">
        {/* Search Bar */}
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-400 text-sm">🔍</span>
          </div>
          <Input
            placeholder="Buscar expedientes..."
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10 h-9 text-sm focus:ring-2 focus:ring-gray-400 focus:border-gray-500"
          />
          {searchTerm && (
            <button
              onClick={clearSearch}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <span className="text-gray-400 hover:text-gray-600 text-sm">✕</span>
            </button>
          )}
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Sort Field */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Sort By</label>
                                      <Select value={sortField} onValueChange={setSortField}>
               <SelectTrigger className="h-9 text-sm focus:ring-2 focus:ring-gray-400 focus:border-gray-500 data-[state=open]:border-gray-500">
                 <SelectValue placeholder="Select field" />
               </SelectTrigger>
               <SelectContent className="bg-white border border-gray-200">
                 <SelectItem value="none" className="focus:bg-slate-900 focus:text-white data-[highlighted]:bg-slate-900 data-[highlighted]:text-white data-[state=checked]:bg-slate-900 data-[state=checked]:text-white">None</SelectItem>
                 <SelectItem value="created_at" className="focus:bg-slate-900 focus:text-white data-[highlighted]:bg-slate-900 data-[highlighted]:text-white data-[state=checked]:bg-slate-900 data-[state=checked]:text-white">Created Date</SelectItem>
                 {fieldKeys.map((key) => (
                   <SelectItem key={key} value={key} className="focus:bg-slate-900 focus:text-white data-[highlighted]:bg-slate-900 data-[highlighted]:text-white data-[state=checked]:bg-slate-900 data-[state=checked]:text-white">
                     {key}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
          </div>

          {/* Sort Order */}
          {sortField && sortField !== 'none' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Order</label>
                                            <Select value={sortOrder} onValueChange={(value: 'asc' | 'desc') => setSortOrder(value)}>
                 <SelectTrigger className="h-9 text-sm focus:ring-2 focus:ring-gray-400 focus:border-gray-500 data-[state=open]:border-gray-500">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent className="bg-white border border-gray-200">
                   <SelectItem value="asc" className="focus:bg-slate-900 focus:text-white data-[highlighted]:bg-slate-900 data-[highlighted]:text-white data-[state=checked]:bg-slate-900 data-[state=checked]:text-white">A → Z</SelectItem>
                   <SelectItem value="desc" className="focus:bg-slate-900 focus:text-white data-[highlighted]:bg-slate-900 data-[highlighted]:text-white data-[state=checked]:bg-slate-900 data-[state=checked]:text-white">Z → A</SelectItem>
                 </SelectContent>
               </Select>
            </div>
          )}

          {/* Filter Field */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Filter Field</label>
                                      <Select value={filterField} onValueChange={setFilterField}>
               <SelectTrigger className="h-9 text-sm focus:ring-2 focus:ring-gray-400 focus:border-gray-500 data-[state=open]:border-gray-500">
                 <SelectValue placeholder="Select field" />
               </SelectTrigger>
               <SelectContent className="bg-white border border-gray-200">
                 <SelectItem value="none" className="focus:bg-slate-900 focus:text-white data-[highlighted]:bg-slate-900 data-[highlighted]:text-white data-[state=checked]:bg-slate-900 data-[state=checked]:text-white">None</SelectItem>
                 {fieldKeys.map((key) => (
                   <SelectItem key={key} value={key} className="focus:bg-slate-900 focus:text-white data-[highlighted]:bg-slate-900 data-[highlighted]:text-white data-[state=checked]:bg-slate-900 data-[state=checked]:text-white">
                     {key}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
          </div>

          {/* Filter Value */}
          {filterField && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Filter Value</label>
              <Input
                placeholder="Enter value..."
                value={filterValue}
                                 onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterValue(e.target.value)}
                 className="h-9 text-sm focus:ring-2 focus:ring-gray-400 focus:border-gray-500"
              />
            </div>
          )}
        </div>

        {/* Date Filter */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Filter by Date</label>
            <Input
              type="date"
              value={dateFilter}
                             onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateFilter(e.target.value)}
               className="h-9 text-sm focus:ring-2 focus:ring-gray-400 focus:border-gray-500"
            />
          </div>
          
          {/* Clear All Filters */}
          {(searchTerm || sortField || filterField || dateFilter) && (
            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                                 onClick={clearFilters}
                 className="h-9 text-sm hover:bg-gray-50 hover:text-gray-900 focus:ring-2 focus:ring-gray-400 focus:border-gray-500"
              >
                Clear All
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg border shadow-sm">
        {filteredAndSortedRecords.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-gray-400 text-xl">📁</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {fileRecords.length === 0 ? "No case files yet" : "No matching records"}
            </h3>
            <p className="text-gray-600 mb-4">
              {fileRecords.length === 0 
                ? "Create your first case file to get started."
                : searchTerm 
                  ? `No records match "${searchTerm}". Try a different search term.`
                  : "No records found."
              }
            </p>
            {fileRecords.length === 0 ? (
              <Button onClick={() => setShowCreateModal(true)} size="sm">
                <span className="text-lg mr-1">+</span>
                Create First Case File
              </Button>
            ) : searchTerm ? (
              <Button variant="outline" onClick={clearSearch} size="sm">
                Clear Search
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-12 text-center">#</TableHead>
                  {fieldKeys.map((key) => (
                    <TableHead key={key} className="font-medium text-gray-700">
                      {key}
                    </TableHead>
                  ))}
                  <TableHead className="w-32 text-center">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRecords.map((record, index) => (
                  <TableRow 
                    key={record.id} 
                    className="hover:bg-gray-50 hover:text-gray-900 cursor-pointer"
                    onClick={() => window.location.href = `/case-files/${record.id}`}
                  >
                    <TableCell className="text-center text-sm text-gray-500 font-mono">
                      {startIndex + index + 1}
                    </TableCell>
                    {fieldKeys.map((key) => {
                      const value = record.valores_json?.[key]
                      const valueStr = String(value || '')
                      const isMatch = searchTerm && valueStr.toLowerCase().includes(searchTerm.toLowerCase())
                      
                      return (
                        <TableCell key={key} className="max-w-xs">
                          {value !== null && value !== undefined ? (
                            <span className={`text-sm ${isMatch ? 'bg-blue-100 px-1 rounded' : ''}`}>
                              {typeof value === 'boolean' ? (
                                <Badge variant={value ? 'default' : 'secondary'} className="text-xs">
                                  {value ? 'Yes' : 'No'}
                                </Badge>
                              ) : (
                                <span className="truncate block" title={valueStr}>
                                  {valueStr}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-sm">—</span>
                          )}
                        </TableCell>
                      )
                    })}
                    <TableCell className="text-center text-sm text-gray-600">
                      {new Date(record.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: '2-digit'
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-600">
            Mostrando {startIndex + 1} - {Math.min(endIndex, totalRecords)} de {totalRecords} expedientes
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="h-9 px-3 text-sm border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Anterior
            </Button>
            
            <div className="flex items-center gap-1">
              {/* Show page numbers */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = currentPage <= 3 ? i + 1 : currentPage - 2 + i
                if (page > totalPages) return null
                
                return (
                  <Button
                    key={page}
                    variant={page === currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className={`h-9 w-9 text-sm ${
                      page === currentPage 
                        ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700" 
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {page}
                  </Button>
                )
              })}
              
              {totalPages > 5 && currentPage < totalPages - 2 && (
                <>
                  <span className="text-gray-400 px-1">...</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(totalPages)}
                    className="h-9 w-9 text-sm border-gray-200 text-gray-600 hover:bg-gray-50"
                  >
                    {totalPages}
                  </Button>
                </>
              )}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="h-9 px-3 text-sm border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* Search Results Summary */}
      {searchTerm && filteredAndSortedRecords.length > 0 && (
        <div className="text-sm text-gray-600 bg-blue-50 px-3 py-2 rounded border border-blue-200">
          Encontrados {filteredAndSortedRecords.length} expediente{filteredAndSortedRecords.length !== 1 ? 's' : ''} que coinciden con "{searchTerm}"
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateFileRecordModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
          filingSystem={filingSystem}
        />
      )}
    </div>
  )
}
