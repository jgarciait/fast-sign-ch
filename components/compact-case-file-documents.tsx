'use client'

import React, { useState, useEffect, useCallback, memo } from 'react'
import { 
  Search, 
  Maximize2, 
  FileText, 
  Plus,
  MoreVertical,
  Edit3,
  Unlink,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Folder,
  FolderOpen,
  Tag,
  ChevronDown,
  Eye,
  Mail
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import EnhancedCaseFileDocuments from '@/components/enhanced-case-file-documents'
import DocumentViewerModal from '@/components/document-viewer-modal'
import RealtimeDebugPanel from '@/components/realtime-debug-panel'
import useDocumentRealtime from '@/hooks/use-document-realtime'
import { toast } from 'sonner'

interface Document {
  id: string
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  created_at: string
  updated_at: string
  document_type: string
  status?: string
  hasSigned?: boolean
  category_id?: string
  categoryName?: string
  categoryColor?: string
  categoryIcon?: string
  isUncategorized?: boolean
}

interface DocumentCategory {
  id: string
  name: string
  color: string
  icon: string
  description?: string
}

interface CompactCaseFileDocumentsProps {
  fileRecordId: string
  onDocumentAction?: (action: string, documentId: string) => void
  onBulkAction?: (action: string, documentIds: string[]) => void
  readOnly?: boolean
}

function CompactCaseFileDocuments({ 
  fileRecordId, 
  onDocumentAction, 
  onBulkAction,
  readOnly = false 
}: CompactCaseFileDocumentsProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([])
  const [categories, setCategories] = useState<DocumentCategory[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [showExpandedModal, setShowExpandedModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalDocuments, setTotalDocuments] = useState(0)
  
  // Category management state
  const [selectedDocumentForCategory, setSelectedDocumentForCategory] = useState<Document | null>(null)
  const [showCategoryPopover, setShowCategoryPopover] = useState(false)
  const [showCreateCategoryDialog, setShowCreateCategoryDialog] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState('#3B82F6')
  const [newCategoryIcon, setNewCategoryIcon] = useState('folder')
  const [categoryLoading, setCategoryLoading] = useState(false)
  
  // Move document state
  const [showMovePopover, setShowMovePopover] = useState(false)
  const [documentToMove, setDocumentToMove] = useState<Document | null>(null)
  
  // Document viewer state
  const [showViewerModal, setShowViewerModal] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)



  const COMPACT_ITEMS_PER_PAGE = 5

  // Load categories
  const loadCategories = useCallback(async () => {
    try {
      console.log('🔄 CompactCaseFileDocuments: Loading categories for file record:', fileRecordId)
      const response = await fetch(`/api/case-files/${fileRecordId}/categories`)
      if (response.ok) {
        const data = await response.json()
        console.log('🏷️ Categories loaded:', data.categories?.map((c: any) => ({ id: c.id, name: c.name })) || [])
        setCategories(data.categories || [])
      } else {
        console.error('❌ Failed to load categories, response not ok:', response.status)
      }
    } catch (error) {
      console.error('❌ Error loading categories:', error)
    }
  }, [fileRecordId])

  // Load all documents once (without search parameter)
  const loadDocuments = useCallback(async (skipLoading = false) => {
    if (!skipLoading) {
      setLoading(true)
    }
    try {
      console.log('🔄 CompactCaseFileDocuments: Loading documents for file record:', fileRecordId)
      // Load all documents without search filter - we'll filter client-side
      const response = await fetch(`/api/case-files/${fileRecordId}/documents-simple?page=1&limit=1000&search=`)
      
      if (response.ok) {
        const data = await response.json()
        console.log('📄 Documents loaded:', data.documents?.map((d: any) => ({ 
          id: d.id, 
          name: d.file_name, 
          categoryId: d.category_id,
          categoryName: d.categoryName,
          isUncategorized: d.isUncategorized
        })) || [])
        setDocuments(data.documents || [])
        setTotalDocuments(data.total || 0)
      } else {
        console.warn('⚠️ API response not ok, using fallback')
        // Fallback: use the existing filing system action
        const { getDocumentsByFileRecord } = await import('@/app/actions/filing-system-actions')
        const result = await getDocumentsByFileRecord(fileRecordId)
        
        if (result.documents) {
          const allDocs = result.documents
          console.log('📄 Documents loaded (fallback):', allDocs.map((d: any) => ({ 
            id: d.id, 
            name: d.file_name, 
            categoryId: d.category_id,
            categoryName: d.categoryName,
            isUncategorized: d.isUncategorized
          })))
          setDocuments(allDocs)
          setTotalDocuments(allDocs.length)
        }
      }
    } catch (error) {
      console.error('❌ Error loading documents:', error)
      toast.error('Error al cargar los documentos')
    } finally {
      if (!skipLoading) {
        setLoading(false)
      }
    }
  }, [fileRecordId])

  // Realtime callbacks
  const handleDocumentRealtimeUpdate = useCallback((updatedDocument: any) => {
    console.log('🔄 CompactCaseFileDocuments: Realtime document update received:', updatedDocument)
    console.log('🔄 Document update details:', {
      documentId: updatedDocument.id,
      categoryId: updatedDocument.category_id,
      fileName: updatedDocument.file_name,
      isUncategorized: !updatedDocument.category_id
    })
    
    // Get current categories and update documents in a single operation
    setCategories(currentCategories => {
      console.log('🏷️ Current categories available:', currentCategories.map(c => ({ id: c.id, name: c.name })))
      const category = currentCategories.find(cat => cat.id === updatedDocument.category_id)
      console.log('🔍 Found matching category:', category ? { id: category.id, name: category.name } : 'NOT FOUND')
      
      // Update documents with both the realtime data and category enrichment
      setDocuments(prevDocs => {
        const docIndex = prevDocs.findIndex(doc => doc.id === updatedDocument.id)
        console.log('📄 Document index in current docs:', docIndex)
        
        if (docIndex !== -1) {
          const enrichedDocument = {
            ...prevDocs[docIndex],
            ...updatedDocument,
            categoryName: category?.name,
            categoryColor: category?.color,
            categoryIcon: category?.icon,
            isUncategorized: !updatedDocument.category_id
          }
          
          console.log('✨ Enriched document:', {
            id: enrichedDocument.id,
            fileName: enrichedDocument.file_name,
            categoryId: enrichedDocument.category_id,
            categoryName: enrichedDocument.categoryName,
            isUncategorized: enrichedDocument.isUncategorized
          })
          
          const newDocs = [...prevDocs]
          newDocs[docIndex] = enrichedDocument
          return newDocs
        }
        return prevDocs
      })
      
      return currentCategories // Don't change categories state
    })
    
    // Always show toast for realtime updates from other users
    toast.info('Documento actualizado en tiempo real')
  }, []) // Remove categoryLoading dependency to prevent re-renders

  const handleCategoryRealtimeUpdate = useCallback((updatedCategory: any) => {
    console.log('🏷️ CompactCaseFileDocuments: Realtime category update received:', updatedCategory)
    console.log('🏷️ Category update details:', {
      categoryId: updatedCategory.id,
      categoryName: updatedCategory.name,
      categoryColor: updatedCategory.color
    })
    
    setCategories(prevCategories => {
      console.log('🏷️ Current categories before update:', prevCategories.map(c => ({ id: c.id, name: c.name })))
      const categoryIndex = prevCategories.findIndex(cat => cat.id === updatedCategory.id)
      console.log('🔍 Category index found:', categoryIndex)
      
      if (categoryIndex !== -1) {
        const newCategories = [...prevCategories]
        newCategories[categoryIndex] = { ...newCategories[categoryIndex], ...updatedCategory }
        console.log('✅ Updated categories:', newCategories.map(c => ({ id: c.id, name: c.name })))
        return newCategories
      }
      return prevCategories
    })
    
    // Update documents with new category info
    setDocuments(prevDocs => {
      const updatedDocs = prevDocs.map(doc => 
        doc.category_id === updatedCategory.id
          ? {
              ...doc,
              categoryName: updatedCategory.name,
              categoryColor: updatedCategory.color,
              categoryIcon: updatedCategory.icon
            }
          : doc
      )
      console.log('📄 Documents updated with new category info:', 
        updatedDocs.filter(doc => doc.category_id === updatedCategory.id).map(doc => ({
          id: doc.id,
          fileName: doc.file_name,
          categoryName: doc.categoryName
        }))
      )
      return updatedDocs
    })
  }, [])

  const handleCategoryRealtimeDelete = useCallback((deletedCategoryId: string) => {
    console.log('🗑️ Realtime category delete received:', deletedCategoryId)
    
    setCategories(prevCategories => 
      prevCategories.filter(cat => cat.id !== deletedCategoryId)
    )
    
    // Update documents that had this category
    setDocuments(prevDocs => 
      prevDocs.map(doc => 
        doc.category_id === deletedCategoryId
          ? {
              ...doc,
              category_id: undefined,
              categoryName: undefined,
              categoryColor: undefined,
              categoryIcon: undefined,
              isUncategorized: true
            }
          : doc
      )
    )
    
    toast.info('Categoría eliminada - documentos movidos a sin categorizar')
  }, [])

  // Initialize realtime subscription
  useDocumentRealtime({
    fileRecordId,
    componentId: 'compact', // Unique ID to prevent channel conflicts
    onDocumentUpdate: handleDocumentRealtimeUpdate,
    onCategoryUpdate: handleCategoryRealtimeUpdate,
    onCategoryDelete: handleCategoryRealtimeDelete,
    enabled: !readOnly // Only enable realtime if not in read-only mode
  })

  useEffect(() => {
    loadDocuments()
    loadCategories()
  }, [loadDocuments, loadCategories])

  // Filter documents based on search term and handle pagination
  useEffect(() => {
    let filtered = documents
    
    // Apply search filter
    if (searchTerm.trim()) {
      filtered = documents.filter(doc =>
        doc.file_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    setFilteredDocuments(filtered)
  }, [searchTerm, documents])

  // Reset to first page when search changes
  useEffect(() => {
    if (searchTerm.trim()) {
      setCurrentPage(1)
    }
  }, [searchTerm])

  // Calculate pagination values
  const totalPages = Math.ceil(filteredDocuments.length / COMPACT_ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * COMPACT_ITEMS_PER_PAGE
  const paginatedDocuments = filteredDocuments.slice(startIndex, startIndex + COMPACT_ITEMS_PER_PAGE)

  // Handle category assignment
  const handleCategoryAssignment = async (document: Document, categoryId: string | null) => {
    // DEBUG: Log the category assignment request
    console.log('🏷️ Category assignment requested:', {
      documentId: document.id,
      documentName: document.file_name,
      currentCategoryId: document.category_id,
      newCategoryId: categoryId,
      isSettingToNull: categoryId === null,
      isMovingToUncategorized: categoryId === null
    })
    
    setCategoryLoading(true)
    try {
      const response = await fetch(`/api/documents/${document.id}/move-to-category`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId })
      })

      if (!response.ok) {
        throw new Error('Failed to update category')
      }

      // Find category info
      const category = categoryId ? categories.find(cat => cat.id === categoryId) : null

      // Optimistic update - Update document locally (realtime will sync this across clients)
      setDocuments(prevDocs => 
        prevDocs.map(doc => 
          doc.id === document.id 
            ? { 
                ...doc,
                category_id: categoryId || undefined, // Add this field for consistency
                categoryName: category?.name,
                categoryColor: category?.color,
                categoryIcon: category?.icon,
                isUncategorized: !categoryId
              }
            : doc
        )
      )

      toast.success(categoryId ? 'Documento categorizado exitosamente' : 'Documento movido a sin categorizar')
      setShowCategoryPopover(false)
      setSelectedDocumentForCategory(null)
      
      // Note: No need to call loadDocuments() - realtime will handle syncing updates across all clients
    } catch (error) {
      console.error('Error updating category:', error)
      toast.error('Error al actualizar la categoría')
    } finally {
      setCategoryLoading(false)
    }
  }

  // Handle move document
  const handleMoveDocument = async (document: Document, categoryId: string | null) => {
    setCategoryLoading(true)
    try {
      const response = await fetch(`/api/documents/${document.id}/move-to-category`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId })
      })

      if (!response.ok) {
        throw new Error('Failed to move document')
      }

      const responseData = await response.json()
      
      // DEBUG: Check the API response
      console.log('✅ Move document API response:', {
        documentId: document.id,
        requestedCategoryId: categoryId,
        responseCategoryId: responseData.document?.category_id,
        isNullRequested: categoryId === null,
        isNullInResponse: responseData.document?.category_id === null
      })

      // Find category info
      const category = categoryId ? categories.find(cat => cat.id === categoryId) : null

      // Update document locally
      setDocuments(prevDocs => 
        prevDocs.map(doc => 
          doc.id === document.id 
            ? { 
                ...doc, 
                category_id: categoryId || undefined,
                categoryName: category?.name,
                categoryColor: category?.color,
                categoryIcon: category?.icon,
                isUncategorized: !categoryId
              }
            : doc
        )
      )

      toast.success('Documento movido exitosamente')
      setShowMovePopover(false)
      setDocumentToMove(null)
      
      // Add a small delay before refreshing to ensure database consistency
      setTimeout(() => {
        console.log('🔄 Refreshing documents after category move...')
        loadDocuments(true)
      }, 500)
    } catch (error) {
      console.error('Error moving document:', error)
      toast.error('Error al mover el documento')
    } finally {
      setCategoryLoading(false)
    }
  }

  // Create new category
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return

    setCategoryLoading(true)
    try {
      const response = await fetch(`/api/case-files/${fileRecordId}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          color: newCategoryColor,
          icon: newCategoryIcon
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create category')
      }

      const result = await response.json()
      const newCategory = result.category

      // Add to categories list
      setCategories(prev => [...prev, {
        id: newCategory.id,
        name: newCategory.name,
        color: newCategory.color,
        icon: newCategory.icon,
        description: newCategory.description
      }])

      // Auto-assign to selected document if any
      if (selectedDocumentForCategory) {
        await handleCategoryAssignment(selectedDocumentForCategory, newCategory.id)
      }

      toast.success('Categoría creada exitosamente')
      setShowCreateCategoryDialog(false)
      setNewCategoryName('')
      setNewCategoryColor('#3B82F6')
      setNewCategoryIcon('folder')
    } catch (error) {
      console.error('Error creating category:', error)
      toast.error('Error al crear la categoría')
    } finally {
      setCategoryLoading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleViewDocument = (document: Document) => {
    setSelectedDocument(document)
    setShowViewerModal(true)
  }



  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-green-600" />
            Documentos Vinculados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {/* Compact View */}
      <Card className="border-slate-200 shadow-sm content-fade-in">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Documentos del Expediente</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {searchTerm ? (
                    `${filteredDocuments.length} de ${documents.length} documentos encontrados`
                  ) : (
                    `${documents.length} documentos totales`
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="bg-blue-100 text-blue-700 border-blue-200 font-medium px-3 py-1">
                {totalDocuments} documento{totalDocuments !== 1 ? 's' : ''}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExpandedModal(true)}
                className="flex items-center gap-2 border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300"
              >
                <Maximize2 className="h-4 w-4" />
                Vista Completa
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4 p-6">
          {/* Enhanced Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por nombre de archivo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 text-sm border-slate-200 focus:border-blue-300 focus:ring-blue-100 bg-white"
            />
          </div>

          {/* Document List */}
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-slate-400" />
              </div>
              <h4 className="text-sm font-medium text-slate-900 mb-2">
                {searchTerm ? 'No se encontraron documentos' : 'No hay documentos del expediente'}
              </h4>
              <p className="text-xs text-slate-500 mb-4">
                {searchTerm 
                  ? 'Intenta con otros términos de búsqueda' 
                  : 'Los documentos aparecerán aquí cuando se agreguen al expediente'
                }
              </p>
              {searchTerm && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchTerm('')}
                  className="text-xs border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Limpiar búsqueda
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <TooltipProvider>
                {paginatedDocuments.map((document) => {
                  
                  return (
                    <div
                      key={document.id}
                      className="group flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-200 hover:bg-blue-50/30 folder-smooth-transition bg-white shadow-sm"
                    >
                      {/* Document Icon */}
                      <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center border ${
                        document.document_type === 'email' 
                          ? 'bg-blue-50 border-blue-100' 
                          : 'bg-blue-50 border-blue-100'
                      }`}>
                        {document.document_type === 'email' ? (
                          <Mail className="h-5 w-5 text-blue-600" />
                        ) : (
                          <FileText className="h-5 w-5 text-blue-600" />
                        )}
                      </div>
                      
                      {/* Document Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm font-semibold text-gray-900 cursor-help leading-tight break-words">
                                {document.file_name}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-md">
                              <p className="break-words text-sm">{document.file_name}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        
                        {/* Status Badges Row */}
                        <div className="flex items-center gap-2 mb-2">
                          {/* Email Document Type Badge */}
                          {document.document_type === 'email' && (
                            <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200 font-medium">
                              <Mail className="h-3 w-3 mr-1" />
                              Email
                            </Badge>
                          )}
                          
                          {/* Signature Status Badge */}
                          {document.hasSigned ? (
                            <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200 font-medium">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Con Firma
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs border-gray-300 text-gray-600 bg-gray-50 font-medium">
                              <XCircle className="h-3 w-3 mr-1" />
                              Sin Firma
                            </Badge>
                          )}
                          
                          {/* Clickable Category Status Badge */}
                          {!readOnly && (
                            <Popover 
                              open={showCategoryPopover && selectedDocumentForCategory?.id === document.id} 
                              onOpenChange={(open) => {
                                setShowCategoryPopover(open)
                                if (open) {
                                  setSelectedDocumentForCategory(document)
                                } else {
                                  setSelectedDocumentForCategory(null)
                                }
                              }}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto p-0 hover:bg-transparent"
                                  onClick={() => {
                                    setSelectedDocumentForCategory(document)
                                    setShowCategoryPopover(true)
                                  }}
                                >
                                  {document.isUncategorized ? (
                                    <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200 font-medium cursor-pointer hover:bg-blue-200 transition-colors">
                                      <AlertCircle className="h-3 w-3 mr-1" />
                                      Sin Categorizar
                                      <ChevronDown className="h-3 w-3 ml-1" />
                                    </Badge>
                                  ) : document.categoryName ? (
                                    <Badge 
                                      variant="outline" 
                                      className="text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity"
                                      style={{ 
                                        borderColor: document.categoryColor || '#6B7280',
                                        color: document.categoryColor || '#6B7280',
                                        backgroundColor: `${document.categoryColor || '#6B7280'}15`
                                      }}
                                    >
                                      <Tag className="h-3 w-3 mr-1" />
                                      {document.categoryName}
                                      <ChevronDown className="h-3 w-3 ml-1" />
                                    </Badge>
                                  ) : (
                                    <Badge className="text-xs bg-gray-100 text-gray-600 border-gray-200 font-medium cursor-pointer hover:bg-gray-200 transition-colors">
                                      <Tag className="h-3 w-3 mr-1" />
                                      Categorizar
                                      <ChevronDown className="h-3 w-3 ml-1" />
                                    </Badge>
                                  )}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 p-0" align="start">
                                <Command>
                                  <CommandInput placeholder="Buscar categoría..." />
                                  <CommandList>
                                    <CommandEmpty>No se encontraron categorías</CommandEmpty>
                                    <CommandGroup>
                                      {/* Uncategorized option */}
                                      <CommandItem
                                        onSelect={() => handleCategoryAssignment(document, null)}
                                        className="cursor-pointer"
                                      >
                                        <AlertCircle className="h-4 w-4 mr-2 text-blue-600" />
                                        <span>Sin Categorizar</span>
                                      </CommandItem>
                                      
                                      {/* Existing categories */}
                                      {categories.map((category) => (
                                        <CommandItem
                                          key={category.id}
                                          onSelect={() => handleCategoryAssignment(document, category.id)}
                                          className="cursor-pointer"
                                        >
                                          <div 
                                            className="w-4 h-4 rounded mr-2 flex items-center justify-center"
                                            style={{ backgroundColor: `${category.color}20`, border: `1px solid ${category.color}` }}
                                          >
                                            <Folder className="h-3 w-3" style={{ color: category.color }} />
                                          </div>
                                          <span>{category.name}</span>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                    
                                    <CommandGroup>
                                      <CommandItem
                                        onSelect={() => {
                                          setShowCategoryPopover(false)
                                          setShowCreateCategoryDialog(true)
                                        }}
                                        className="cursor-pointer text-blue-600"
                                      >
                                        <Plus className="h-4 w-4 mr-2" />
                                        <span>Crear Nueva Categoría</span>
                                      </CommandItem>
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          )}
                          
                          {/* Read-only category display */}
                          {readOnly && (
                            <>
                              {document.isUncategorized ? (
                                <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200 font-medium">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Sin Categorizar
                                </Badge>
                              ) : document.categoryName ? (
                                <Badge 
                                  variant="outline" 
                                  className="text-xs font-medium"
                                  style={{ 
                                    borderColor: document.categoryColor || '#6B7280',
                                    color: document.categoryColor || '#6B7280',
                                    backgroundColor: `${document.categoryColor || '#6B7280'}15`
                                  }}
                                >
                                  <Tag className="h-3 w-3 mr-1" />
                                  {document.categoryName}
                                </Badge>
                              ) : null}
                            </>
                          )}
                        </div>
                        
                        {/* File Metadata */}
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="font-medium">{formatFileSize(document.file_size)}</span>
                          <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                          <span>{new Date(document.created_at).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: '2-digit', 
                            year: 'numeric'
                          })}</span>
                        </div>
                      </div>
                    
                      {/* Actions Menu */}
                      <div className="flex-shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-blue-100"
                            >
                              <MoreVertical className="h-4 w-4 text-gray-600" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem 
                              onClick={() => handleViewDocument(document)}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Documento
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => onDocumentAction?.('edit', document.id)}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Edit3 className="h-4 w-4 mr-2" />
                              Editar Documento
                            </DropdownMenuItem>
                            {!readOnly && (
                              <>
                                <DropdownMenuItem 
                                  onClick={() => onDocumentAction?.('unlink', document.id)}
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                >
                                  <Unlink className="h-4 w-4 mr-2" />
                                  Desvincular
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => onDocumentAction?.('delete', document.id)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Eliminar
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  )
                })}
              </TooltipProvider>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <div className="text-xs font-medium text-slate-600">
                Página {currentPage} de {totalPages}
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="h-8 px-3 text-xs border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 px-3 text-xs border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}

          {/* Advanced Management */}
          <div className="pt-4 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExpandedModal(true)}
              className="w-full text-xs h-9 font-medium text-white bg-[#0d2340] border-[#0d2340] hover:border-[#15345f] hover:bg-[#274f84] hover:text-white transition-colors duration-200"
            >
              <Plus className="h-4 w-4 mr-2 text-white" />
              Ir a Carpetas de Expediente
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Create Category Dialog */}
      <Dialog open={showCreateCategoryDialog} onOpenChange={setShowCreateCategoryDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5 text-blue-600" />
              Crear Nueva Categoría
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre de la categoría</label>
              <Input
                placeholder="Ej: Contratos, Formularios, etc."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="w-full"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Color</label>
              <div className="flex gap-2">
                {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316', '#06B6D4', '#84CC16'].map(color => (
                  <button
                    key={color}
                    className={`w-8 h-8 rounded-full border-2 ${newCategoryColor === color ? 'border-gray-800' : 'border-gray-300'}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewCategoryColor(color)}
                  />
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCreateCategoryDialog(false)}
              disabled={categoryLoading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateCategory}
              disabled={!newCategoryName.trim() || categoryLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {categoryLoading ? 'Creando...' : 'Crear Categoría'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Expanded Modal */}
      <Dialog open={showExpandedModal} onOpenChange={setShowExpandedModal}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-3 bg-white flex flex-col">
          <DialogHeader className="flex-shrink-0 px-3 py-4 bg-white border-b">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Carpetas de Expediente
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 min-h-0 bg-white p-3">
            <EnhancedCaseFileDocuments
              fileRecordId={fileRecordId}
              onOpenViewer={(doc) => {
                setSelectedDocument(doc)
                setShowViewerModal(true)
              }}
              onDocumentAction={(action, documentId) => {
                onDocumentAction?.(action, documentId)
                // Note: No need to call loadDocuments() here since realtime will handle updates automatically
                // Only refresh for actions that don't trigger realtime events
                if (action === 'unlink' || action === 'delete') {
                  // Small delay to allow realtime to process first
                  setTimeout(() => {
                    loadDocuments(true) // Skip loading indicator since this is a background refresh
                  }, 1000)
                }
              }}
              onBulkAction={(action, documentIds) => {
                onBulkAction?.(action, documentIds)
                if (action === 'unlink' || action === 'delete') {
                  // Small delay to allow realtime to process first
                  setTimeout(() => {
                    loadDocuments(true) // Skip loading indicator since this is a background refresh
                  }, 1000)
                }
              }}
              readOnly={readOnly}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Document Viewer Modal */}
      {selectedDocument && (
        <DocumentViewerModal
          isOpen={showViewerModal}
          onClose={() => {
            setShowViewerModal(false)
            setSelectedDocument(null)
          }}
          documentId={selectedDocument.id}
          documentName={selectedDocument.file_name}
        />
      )}

      {/* Realtime Debug Panel - Only show in development */}
      {process.env.NODE_ENV === 'development' && (
        <RealtimeDebugPanel 
          fileRecordId={fileRecordId}
          enabled={!readOnly}
        />
      )}

    </>
  )
}

// Memoize component to prevent unnecessary re-renders that kill realtime connections
export default memo(CompactCaseFileDocuments)
