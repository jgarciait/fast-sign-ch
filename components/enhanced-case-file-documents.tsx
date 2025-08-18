'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { 
  Search, 
  FolderOpen, 
  File, 
  MoreVertical, 
  Trash2, 
  Unlink, 
  Edit3,
  Plus,
  Folder,
  FileText,
  CheckCircle,
  XCircle,
  Move,
  Tag,
  Settings,
  ArrowLeft,
  Download,
  Eye,
  Mail
} from 'lucide-react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator } from '@/components/ui/context-menu'
import { useRouter } from 'next/navigation'
import DocumentViewerModal from "./document-viewer-modal"
import useDocumentRealtime from '@/hooks/use-document-realtime'

interface DocumentCategory {
  id: string
  name: string
  description?: string
  color: string
  icon: string
  parentCategoryId?: string
  sortOrder: number
  documentCount: number
}

interface Document {
  id: string
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  created_at: string
  updated_at: string
  status: string
  document_type: string
  category_id?: string
  categoryName?: string
  categoryColor?: string
  categoryIcon?: string
  hasSigned?: boolean
  isUncategorized?: boolean
}

interface EnhancedCaseFileDocumentsProps {
  fileRecordId: string
  onDocumentAction?: (action: string, documentId: string) => void
  onBulkAction?: (action: string, documentIds: string[]) => void
  readOnly?: boolean
  // Optional: when provided, delegate opening the viewer modal to parent
  onOpenViewer?: (document: Document) => void
}

// Animated Folder SVG Component
const AnimatedFolder = ({ color, isOpen, isHovered }: { color: string, isOpen: boolean, isHovered: boolean }) => (
  <div className="relative w-16 h-16 flex items-center justify-center">
    <svg 
      width="48" 
      height="48" 
      viewBox="0 0 24 24" 
      className={`transition-all duration-300 ${isOpen ? 'scale-110' : 'scale-100'} ${isHovered ? 'drop-shadow-lg' : ''}`}
    >
      {/* Folder back */}
      <path
        d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"
        fill={color}
        className={`transition-all duration-300 ${isOpen ? 'opacity-70' : 'opacity-100'}`}
      />
      
      {/* Folder front (animated when opening) */}
      <path
        d="M20 6H12l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"
        fill={isOpen ? `${color}DD` : color}
        className={`transition-all duration-300 ${isOpen ? 'transform -translate-y-1 rotate-12' : ''}`}
        style={{
          transformOrigin: 'bottom left'
        }}
      />
      
      {/* Opening glow effect */}
      {isOpen && (
        <>
          <path
            d="M4 8v10h16V8H4z"
            fill="url(#folderGlow)"
            className="animate-pulse"
          />
          <defs>
            <linearGradient id="folderGlow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.3" />
            </linearGradient>
          </defs>
        </>
      )}
      
      {/* Sparkle effects when opening */}
      {isOpen && (
        <>
          <circle cx="8" cy="10" r="1" fill="#60A5FA" className="animate-ping" />
          <circle cx="16" cy="12" r="0.5" fill="#3B82F6" className="animate-pulse" />
          <circle cx="12" cy="14" r="0.8" fill="#1D4ED8" className="animate-bounce" />
        </>
      )}
    </svg>
    
    {/* Background glow when opening */}
    {isOpen && (
      <div className="absolute inset-0 bg-gradient-to-br from-blue-200 to-blue-300 rounded-lg opacity-40 animate-pulse blur-sm" />
    )}
    
    {/* Floating document icon when dragging over */}
    {isHovered && (
      <div className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded border-2 border-blue-400 flex items-center justify-center animate-bounce">
        <FileText className="h-3 w-3 text-blue-600" />
      </div>
    )}
  </div>
)

export default function EnhancedCaseFileDocuments({ 
  fileRecordId, 
  onDocumentAction, 
  onBulkAction,
  readOnly = false,
  onOpenViewer
}: EnhancedCaseFileDocumentsProps) {
  const router = useRouter()
  
  // State management
  const [documents, setDocuments] = useState<Document[]>([])
  const [categories, setCategories] = useState<DocumentCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [uncategorizedDocuments, setUncategorizedDocuments] = useState<Document[]>([])
  const [categoryDocuments, setCategoryDocuments] = useState<Document[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredCategories, setFilteredCategories] = useState<DocumentCategory[]>([])
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  
  // Modal states
  const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false)
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false)
  const [showDeleteCategoryModal, setShowDeleteCategoryModal] = useState(false)

  const [showMoveModal, setShowMoveModal] = useState(false)
  const [showViewerModal, setShowViewerModal] = useState(false)
  
  // Form states
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState('#3B82F6')
  const [newCategoryIcon, setNewCategoryIcon] = useState('folder')
  const [editingCategory, setEditingCategory] = useState<DocumentCategory | null>(null)
  const [categoryToDelete, setCategoryToDelete] = useState<DocumentCategory | null>(null)
  const [documentToMove, setDocumentToMove] = useState<Document | null>(null)
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)

  // Load data
  const loadDocuments = useCallback(async (skipLoading = false) => {
    if (!skipLoading) setLoading(true)
    
    try {
      const response = await fetch(`/api/case-files/${fileRecordId}/documents-simple?page=1&limit=100&search=`)
      if (response.ok) {
        const data = await response.json()
        const allDocs = data.documents || []
        
        setDocuments(allDocs)
        
        // Separate uncategorized documents
        const uncategorized = allDocs.filter((doc: Document) => !doc.category_id || doc.isUncategorized)
        console.log('📄 LoadDocuments - Total docs:', allDocs.length, 'Uncategorized:', uncategorized.length)
        console.log('📄 LoadDocuments - Uncategorized documents:', uncategorized.map((d: Document) => ({ id: d.id, name: d.file_name, category_id: d.category_id, isUncategorized: d.isUncategorized })))
        setUncategorizedDocuments(uncategorized)
        
        // If a category is selected, filter documents for that category
        if (selectedCategory) {
          const categoryDocs = allDocs.filter((doc: Document) => doc.category_id === selectedCategory)
          console.log('🔄 Updating category documents for category:', selectedCategory, 'Found:', categoryDocs.length)
          setCategoryDocuments(categoryDocs)
        }
      }
    } catch (error) {
      console.error('Error loading documents:', error)
      toast.error('Error al cargar documentos')
    } finally {
      if (!skipLoading) setLoading(false)
    }
  }, [fileRecordId, selectedCategory])

  const loadCategories = useCallback(async () => {
    try {
      const response = await fetch(`/api/case-files/${fileRecordId}/categories`)
      if (response.ok) {
        const data = await response.json()
        const categoriesWithCounts = (data.categories || []).map((cat: any) => ({
          ...cat,
          documentCount: documents.filter(doc => doc.category_id === cat.id).length
        }))
        setCategories(categoriesWithCounts)
      }
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }, [fileRecordId, documents])

  // Realtime callbacks
  const handleDocumentRealtimeUpdate = useCallback((updatedDocument: any) => {
    console.log('🔄 Enhanced: Realtime document update received:', updatedDocument)
    
    setDocuments(prevDocs => {
      const docIndex = prevDocs.findIndex(doc => doc.id === updatedDocument.id)
      if (docIndex !== -1) {
        // Find category info to enrich the document
        const category = categories.find(cat => cat.id === updatedDocument.category_id)
        
        const enrichedDocument: Document = {
          ...prevDocs[docIndex],
          ...updatedDocument,
          categoryName: category?.name,
          categoryColor: category?.color,
          categoryIcon: category?.icon,
          isUncategorized: !updatedDocument.category_id
        }
        
        const newDocs = [...prevDocs]
        newDocs[docIndex] = enrichedDocument
        
        // Update uncategorized documents state
        if (!updatedDocument.category_id) {
          // Moving TO uncategorized - add to uncategorized (only if not already there)
          setUncategorizedDocuments(prev => {
            const alreadyExists = prev.some(doc => doc.id === updatedDocument.id)
            return alreadyExists ? prev.map(doc => doc.id === updatedDocument.id ? enrichedDocument : doc) : [...prev, enrichedDocument]
          })
        } else {
          // Moving FROM uncategorized - remove from uncategorized
          setUncategorizedDocuments(prev => prev.filter(doc => doc.id !== updatedDocument.id))
        }
        
        // Update category documents if we're in category view
        if (selectedCategory) {
          if (selectedCategory === updatedDocument.category_id) {
            // Moving to current category
            setCategoryDocuments(prev => {
              const alreadyExists = prev.some(doc => doc.id === updatedDocument.id)
              return alreadyExists ? prev.map(doc => doc.id === updatedDocument.id ? enrichedDocument : doc) : [...prev, enrichedDocument]
            })
          } else {
            // Moving away from current category
            setCategoryDocuments(prev => prev.filter(doc => doc.id !== updatedDocument.id))
          }
        }
        
        return newDocs
      }
      return prevDocs
    })
    
    // Show toast notification
    toast.success('Documento actualizado en tiempo real')
  }, [categories, selectedCategory])

  const handleCategoryRealtimeUpdate = useCallback((updatedCategory: any) => {
    console.log('🏷️ Enhanced: Realtime category update received:', updatedCategory)
    
    setCategories(prevCategories => {
      const categoryIndex = prevCategories.findIndex(cat => cat.id === updatedCategory.id)
      if (categoryIndex !== -1) {
        const newCategories = [...prevCategories]
        newCategories[categoryIndex] = { ...newCategories[categoryIndex], ...updatedCategory }
        return newCategories
      }
      return prevCategories
    })
    
    // Update documents with new category info
    setDocuments(prevDocs => 
      prevDocs.map(doc => 
        doc.category_id === updatedCategory.id
          ? {
              ...doc,
              categoryName: updatedCategory.name,
              categoryColor: updatedCategory.color,
              categoryIcon: updatedCategory.icon
            }
          : doc
      )
    )
    
    // Update uncategorized documents with new category info
    setUncategorizedDocuments(prevDocs => 
      prevDocs.map(doc => 
        doc.category_id === updatedCategory.id
          ? {
              ...doc,
              categoryName: updatedCategory.name,
              categoryColor: updatedCategory.color,
              categoryIcon: updatedCategory.icon
            }
          : doc
      )
    )
    
    // Update category documents with new category info
    setCategoryDocuments(prevDocs => 
      prevDocs.map(doc => 
        doc.category_id === updatedCategory.id
          ? {
              ...doc,
              categoryName: updatedCategory.name,
              categoryColor: updatedCategory.color,
              categoryIcon: updatedCategory.icon
            }
          : doc
      )
    )
  }, [])

  const handleCategoryRealtimeDelete = useCallback((deletedCategoryId: string) => {
    console.log('🗑️ Enhanced: Realtime category delete received:', deletedCategoryId)
    
    setCategories(prevCategories => 
      prevCategories.filter(cat => cat.id !== deletedCategoryId)
    )
    
    // Update documents that had this category
    const updateDocuments = (docs: Document[]) => 
      docs.map(doc => 
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
    
    setDocuments(prevDocs => updateDocuments(prevDocs))
    setCategoryDocuments(prevDocs => updateDocuments(prevDocs))
    
    // Move documents from deleted category to uncategorized
    const documentsToMoveToUncategorized = documents.filter(doc => doc.category_id === deletedCategoryId)
    if (documentsToMoveToUncategorized.length > 0) {
      setUncategorizedDocuments(prev => [
        ...prev,
        ...documentsToMoveToUncategorized.map(doc => ({
          ...doc,
          category_id: undefined,
          categoryName: undefined,
          categoryColor: undefined,
          categoryIcon: undefined,
          isUncategorized: true
        }))
      ])
    }
    
    // If we're viewing the deleted category, switch to uncategorized view
    if (selectedCategory === deletedCategoryId) {
      setSelectedCategory(null)
    }
    
    toast.info('Categoría eliminada - documentos movidos a sin categorizar')
  }, [documents, selectedCategory])

  // Initialize realtime subscription
  useDocumentRealtime({
    fileRecordId,
    componentId: 'enhanced', // Unique ID to prevent channel conflicts
    onDocumentUpdate: handleDocumentRealtimeUpdate,
    onCategoryUpdate: handleCategoryRealtimeUpdate,
    onCategoryDelete: handleCategoryRealtimeDelete,
    enabled: !readOnly // Only enable realtime if not in read-only mode
  })

  // Filter categories and documents based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredCategories(categories)
      setFilteredDocuments(uncategorizedDocuments)
    } else {
      // Filter documents first
      const filteredDocs = documents.filter(document =>
        document.file_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredDocuments(filteredDocs)
      
      // Filter categories: include categories that match by name OR contain matching documents  
      const filteredCats = categories.filter(category => {
        const nameMatches = category.name.toLowerCase().includes(searchTerm.toLowerCase())
        const hasMatchingDocs = filteredDocs.some(doc => doc.category_id === category.id)
        return nameMatches || hasMatchingDocs
      })
      setFilteredCategories(filteredCats)
    }
  }, [categories, documents, uncategorizedDocuments, searchTerm])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  // Handle drag and drop
  const onDragEnd = async (result: any) => {
    const { destination, source, draggableId, type } = result
    
    setDragOverFolder(null) // Clear drag over state
    
    // Delay clearing isDragging to prevent transition glitches
    setTimeout(() => {
      setIsDragging(false)
    }, 100)
    
    if (!destination) return
    
    // Handle category reordering
    if (type === 'CATEGORY') {
      const newCategories = Array.from(categories)
      const [reorderedCategory] = newCategories.splice(source.index, 1)
      newCategories.splice(destination.index, 0, reorderedCategory)
      
      // Update local state immediately for smooth UX
      setCategories(newCategories)
      
      // Update sort order on server
      await handleReorderCategories(newCategories)
      return
    }
    
    // Handle document movement
    if (type === 'DOCUMENT') {
      console.log('Drag result:', { source: source.droppableId, destination: destination.droppableId, draggableId })
      
      // Moving from uncategorized to a category
      if (source.droppableId === 'uncategorized' && destination.droppableId.startsWith('category-')) {
        const categoryId = destination.droppableId.replace('category-', '')
        console.log('Moving document from uncategorized to category:', draggableId, categoryId)
        await handleMoveDocument(draggableId, categoryId)
        return
      }
      
      // Moving from category to uncategorized
      if (source.droppableId.startsWith('category-') && destination.droppableId === 'uncategorized') {
        console.log('Moving document from category to uncategorized:', draggableId)
        await handleMoveDocument(draggableId, null)
        return
      }
      
      // Moving between categories
      if (source.droppableId.startsWith('category-') && destination.droppableId.startsWith('category-')) {
        const sourceCategoryId = source.droppableId.replace('category-', '')
        const destCategoryId = destination.droppableId.replace('category-', '')
        
        // Only move if different categories
        if (sourceCategoryId !== destCategoryId) {
          console.log('Moving document between categories:', draggableId, 'from', sourceCategoryId, 'to', destCategoryId)
          await handleMoveDocument(draggableId, destCategoryId)
        }
        return
      }
      
      // If none of the above conditions match, log for debugging
      console.warn('Unhandled drag operation:', { source: source.droppableId, destination: destination.droppableId })
    }
  }

  const onDragUpdate = (update: any) => {
    const { destination } = update
    setIsDragging(true)
    
    if (destination) {
      console.log('🎯 Drag update - hovering over:', destination.droppableId)
      
      if (destination.droppableId.startsWith('category-')) {
        const categoryId = destination.droppableId.replace('category-', '')
        setDragOverFolder(categoryId)
      } else {
        setDragOverFolder(null)
      }
    } else {
      setDragOverFolder(null)
    }
  }

  const handleMoveDocument = async (documentId: string, categoryId: string | null) => {
    // Optimistic update - Update UI immediately
    const documentToMove = documents.find(doc => doc.id === documentId) || 
                           categoryDocuments.find(doc => doc.id === documentId) ||
                           uncategorizedDocuments.find(doc => doc.id === documentId)
    
    if (!documentToMove) {
      console.error('Document not found for move operation:', documentId)
      return
    }

    console.log('🔄 Enhanced: Moving document:', {
      documentId, 
      documentName: documentToMove.file_name,
      fromCategory: documentToMove.category_id, 
      toCategory: categoryId,
      isMovingToUncategorized: categoryId === null
    })

    // Create updated document
    const updatedDocument: Document = {
      ...documentToMove,
      category_id: categoryId || undefined,
      categoryName: categoryId ? categories.find(c => c.id === categoryId)?.name : undefined,
      categoryColor: categoryId ? categories.find(c => c.id === categoryId)?.color : undefined,
      categoryIcon: categoryId ? categories.find(c => c.id === categoryId)?.icon : undefined,
      isUncategorized: !categoryId
    }

    // Update local state immediately for smooth UX
    const updatedDocuments = documents.map(doc => 
      doc.id === documentId ? updatedDocument : doc
    )
    setDocuments(updatedDocuments)

    // Update uncategorized documents state
    if (categoryId) {
      // Moving TO a category - remove from uncategorized
      setUncategorizedDocuments(prev => prev.filter(doc => doc.id !== documentId))
    } else {
      // Moving TO uncategorized - add to uncategorized (only if not already there)
      setUncategorizedDocuments(prev => {
        const alreadyExists = prev.some(doc => doc.id === documentId)
        return alreadyExists ? prev : [...prev, updatedDocument]
      })
    }

    // Update category documents if we're in category view
    if (selectedCategory) {
      if (selectedCategory === categoryId) {
        // Moving to current category - add to category documents (only if not already there)
        setCategoryDocuments(prev => {
          const alreadyExists = prev.some(doc => doc.id === documentId)
          return alreadyExists ? prev : [...prev, updatedDocument]
        })
      } else {
        // Moving away from current category - remove from category documents
        setCategoryDocuments(prev => prev.filter(doc => doc.id !== documentId))
      }
    }

    try {
      console.log('📤 Sending move request to API:', { documentId, categoryId })
      
      const response = await fetch(`/api/documents/${documentId}/move-to-category`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId })
      })

      console.log('📥 API response status:', response.status)

      if (response.ok) {
        const responseData = await response.json()
        console.log('✅ Move successful:', responseData)
        
        const categoryName = categoryId ? categories.find(c => c.id === categoryId)?.name : 'Sin Categorizar'
        toast.success(`Documento movido a ${categoryName}`)
        
        console.log('✅ Move completed - realtime will handle sync across clients')
        
        // If we're in category view and document was moved away, ensure we update the view
        if (selectedCategory && selectedCategory !== categoryId) {
          console.log('🔄 Updating category view - removing document from current category view')
          const updatedCategoryDocs = categoryDocuments.filter(doc => doc.id !== documentId)
          setCategoryDocuments(updatedCategoryDocs)
        }
        
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('❌ Server error moving document:', errorData)
        toast.error(`Error al mover documento: ${errorData.error || 'Error desconocido'}`)
        
        // Revert optimistic update on error
        await loadDocuments(true)
      }
    } catch (error) {
      console.error('❌ Network error moving document:', error)
      toast.error('Error de conexión al mover documento')
      
      // Revert optimistic update on error
      await loadDocuments(true)
    }
  }

  // Category management
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return

    try {
      const response = await fetch(`/api/case-files/${fileRecordId}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCategoryName,
          color: newCategoryColor,
          icon: newCategoryIcon
        })
      })

      if (response.ok) {
        const newCategory = await response.json()
        console.log('✅ Nueva categoría creada:', newCategory)
        
        // Update local state immediately for instant UI feedback
        setCategories(prevCategories => [
          ...prevCategories,
          {
            ...newCategory.category,
            documentCount: 0 // New category starts with 0 documents
          }
        ])
        
        toast.success('Carpeta creada exitosamente')
        setShowCreateCategoryModal(false)
        resetCategoryForm()
        
        // Also refresh to ensure consistency
        loadCategories()
      } else {
        toast.error('Error al crear carpeta')
      }
    } catch (error) {
      console.error('Error creating category:', error)
      toast.error('Error al crear carpeta')
    }
  }

  const handleEditCategory = (category: DocumentCategory) => {
    setEditingCategory(category)
    setNewCategoryName(category.name)
    setNewCategoryColor(category.color)
    setNewCategoryIcon(category.icon)
    setShowEditCategoryModal(true)
  }

  const handleUpdateCategory = async () => {
    if (!editingCategory || !newCategoryName.trim()) return

    try {
      const response = await fetch(`/api/case-files/${fileRecordId}/categories/${editingCategory.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCategoryName,
          color: newCategoryColor,
          icon: newCategoryIcon
        })
      })

      if (response.ok) {
        const updatedCategoryData = await response.json()
        console.log('✅ Categoría actualizada:', updatedCategoryData)
        
        // Update local state immediately for instant UI feedback
        setCategories(prevCategories => 
          prevCategories.map(cat => 
            cat.id === editingCategory.id 
              ? {
                  ...cat,
                  name: newCategoryName,
                  color: newCategoryColor,
                  icon: newCategoryIcon
                }
              : cat
          )
        )
        
        // Update documents with new category info
        setDocuments(prevDocs => 
          prevDocs.map(doc => 
            doc.category_id === editingCategory.id
              ? {
                  ...doc,
                  categoryName: newCategoryName,
                  categoryColor: newCategoryColor,
                  categoryIcon: newCategoryIcon
                }
              : doc
          )
        )
        
        // Update other states that might contain category info
        setUncategorizedDocuments(prevDocs => 
          prevDocs.map(doc => 
            doc.category_id === editingCategory.id
              ? {
                  ...doc,
                  categoryName: newCategoryName,
                  categoryColor: newCategoryColor,
                  categoryIcon: newCategoryIcon
                }
              : doc
          )
        )
        
        setCategoryDocuments(prevDocs => 
          prevDocs.map(doc => 
            doc.category_id === editingCategory.id
              ? {
                  ...doc,
                  categoryName: newCategoryName,
                  categoryColor: newCategoryColor,
                  categoryIcon: newCategoryIcon
                }
              : doc
          )
        )
        
        toast.success('Carpeta actualizada exitosamente')
        setShowEditCategoryModal(false)
        resetCategoryForm()
        
        // Also refresh to ensure consistency  
        loadCategories()
      } else {
        toast.error('Error al actualizar carpeta')
      }
    } catch (error) {
      console.error('Error updating category:', error)
      toast.error('Error al actualizar carpeta')
    }
  }

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return

    try {
      const response = await fetch(`/api/case-files/${fileRecordId}/categories/${categoryToDelete.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Carpeta eliminada exitosamente')
        setShowDeleteCategoryModal(false)
        setCategoryToDelete(null)
        // Note: Realtime will handle syncing category deletion and document updates
      } else {
        toast.error('Error al eliminar carpeta')
      }
    } catch (error) {
      console.error('Error deleting category:', error)
      toast.error('Error al eliminar carpeta')
    }
  }

  const resetCategoryForm = () => {
    setNewCategoryName('')
    setNewCategoryColor('#3B82F6')
    setNewCategoryIcon('folder')
    setEditingCategory(null)
  }

  // Handle category reordering
  const handleReorderCategories = async (reorderedCategories: DocumentCategory[]) => {
    try {
      const categoryUpdates = reorderedCategories.map((category, index) => ({
        id: category.id,
        sortOrder: index
      }))

      const response = await fetch(`/api/case-files/${fileRecordId}/categories/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: categoryUpdates })
      })

      if (response.ok) {
        toast.success('Orden de carpetas actualizado')
        loadCategories() // Refresh to ensure consistency
      } else {
        toast.error('Error al actualizar orden de carpetas')
        loadCategories() // Revert on error
      }
    } catch (error) {
      console.error('Error reordering categories:', error)
      toast.error('Error al actualizar orden de carpetas')
      loadCategories() // Revert on error
    }
  }

  // Document actions
  const handleEditDocument = (documentId: string) => {
    // Open in new tab to avoid table refresh
    window.open(`/fast-sign/edit/${documentId}`, '_blank')
  }

  const handleViewDocument = (document: Document) => {
    // Prefer delegating to parent when available to avoid nested Dialog issues
    if (typeof onOpenViewer === 'function') {
      onOpenViewer(document)
      return
    }
    setSelectedDocument(document)
    setShowViewerModal(true)
  }

  const handleShowMoveModal = (document: Document) => {
    setDocumentToMove(document)
    setShowMoveModal(true)
  }

  const handleMoveToCategory = async (categoryId: string | null) => {
    if (!documentToMove) return
    
    await handleMoveDocument(documentToMove.id, categoryId)
    setShowMoveModal(false)
    setDocumentToMove(null)
  }

  const handleCategoryClick = (categoryId: string) => {
    console.log('📁 Selecting category:', categoryId)
    setSelectedCategory(categoryId)
    const categoryDocs = documents.filter(doc => doc.category_id === categoryId)
    console.log('📄 Category documents found:', categoryDocs.length)
    setCategoryDocuments(categoryDocs)
  }

  const handleBackToOverview = () => {
    setSelectedCategory(null)
    setCategoryDocuments([])
    // Clear any modal states when going back to overview
    setShowViewerModal(false)
    setSelectedDocument(null)
    setShowMoveModal(false)
    setDocumentToMove(null)
  }

  // Utility functions
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const truncateFileName = (fileName: string, maxLength: number = 70) => {
    // Always return the full filename - no truncation
    return fileName
  }

  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case 'folder': return <Folder className="h-4 w-4" />
      case 'file': return <FileText className="h-4 w-4" />
      default: return <Folder className="h-4 w-4" />
    }
  }

  const colorOptions = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#84CC16']

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }



  // Debug modal states
  console.log('🖼️ ENHANCED: Modal render check - selectedDocument:', selectedDocument?.id, 'showViewerModal:', showViewerModal)
  if (selectedDocument) {
    console.log('🖼️ ENHANCED: Will render DocumentViewerModal with:', {
      isOpen: showViewerModal,
      documentId: selectedDocument.id,
      documentName: selectedDocument.file_name
    })
  }

  // Wrap all drag and drop functionality in a single context
  return (
    <DragDropContext onDragEnd={onDragEnd} onDragUpdate={onDragUpdate}>
      {/* Show category documents view */}
      {selectedCategory ? (() => {
        const category = categories.find(c => c.id === selectedCategory)
        
        return (
          <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleBackToOverview}
                className="text-blue-600 hover:text-blue-700"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver al Explorador
              </Button>
              <div className="flex items-center gap-2">
                <div 
                  className="w-6 h-6 rounded flex items-center justify-center text-white"
                  style={{ backgroundColor: category?.color }}
                >
                  {getCategoryIcon(category?.icon || 'folder')}
                </div>
                <h2 className="text-xl font-semibold">{category?.name}</h2>
                <Badge variant="secondary">{categoryDocuments.length} documentos</Badge>
              </div>
            </div>
          </div>

          {/* Documents List */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Documents Area */}
            <div className="lg:col-span-3">
              <Card>
                <CardContent className="p-6">
                  {categoryDocuments.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2">Carpeta vacía</h3>
                      <p>Arrastra documentos aquí para organizarlos</p>
                    </div>
                  ) : (
                    <Droppable droppableId={`category-${selectedCategory}`} type="DOCUMENT">
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
                          {categoryDocuments.map((document, index) => (
                            <Draggable key={document.id} draggableId={document.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`flex items-center gap-4 p-4 rounded-lg border transition-all cursor-grab active:cursor-grabbing ${
                                    snapshot.isDragging 
                                      ? 'shadow-lg bg-blue-50 border-blue-300 rotate-2 scale-105 z-50' 
                                      : 'hover:bg-gray-50 border-gray-200 hover:shadow-md'
                                  }`}
                                >
                                  <div className="flex-shrink-0">
                                    <div className={`w-10 h-12 rounded flex items-center justify-center ${
                                      document.document_type === 'email' 
                                        ? 'bg-blue-100' 
                                        : 'bg-red-100'
                                    }`}>
                                      {document.document_type === 'email' ? (
                                        <Mail className="h-6 w-6 text-blue-600" />
                                      ) : (
                                        <FileText className="h-6 w-6 text-red-600" />
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="flex-1 min-w-0">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <p className="font-medium text-gray-900 break-words">
                                            {truncateFileName(document.file_name)}
                                          </p>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{document.file_name}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                                      <span>{formatFileSize(document.file_size)}</span>
                                      <span>{new Date(document.created_at).toLocaleDateString()}</span>
                                      
                                      {/* Email Document Type Badge */}
                                      {document.document_type === 'email' && (
                                        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                                          <Mail className="h-3 w-3 mr-1" />
                                          Email
                                        </Badge>
                                      )}
                                      
                                      {document.hasSigned && (
                                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                                          <CheckCircle className="h-3 w-3 mr-1" />
                                          Con Firma
                                        </Badge>
                                      )}
                                      {!document.hasSigned && (
                                        <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                                          <XCircle className="h-3 w-3 mr-1" />
                                          Sin Firma
                                        </Badge>
                                      )}
                                    </div>
                                  </div>

                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => handleViewDocument(document)}>
                                        <Eye className="h-4 w-4 mr-2" />
                                        Ver Documento
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleEditDocument(document.id)}>
                                        <Edit3 className="h-4 w-4 mr-2" />
                                        Editar
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleShowMoveModal(document)}>
                                        <Move className="h-4 w-4 mr-2" />
                                        Mover
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem 
                                        onClick={() => onDocumentAction?.('delete', document.id)}
                                        className="text-red-600"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Eliminar
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Uncategorized Drop Zone */}
            <div className="lg:col-span-1">
              <Card className="h-fit">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Tag className="h-5 w-5 text-orange-600" />
                    <CardTitle className="text-sm">Sin Categorizar</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <Droppable droppableId="uncategorized" type="DOCUMENT">
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`space-y-2 min-h-[300px] p-2 rounded-lg border-2 border-dashed transition-all ${
                          snapshot.isDraggingOver 
                            ? 'border-orange-400 bg-orange-50' 
                            : 'border-gray-200'
                        }`}
                      >
                        {uncategorizedDocuments.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            <Tag className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm font-medium mb-1">¡Excelente organización!</p>
                            <p className="text-xs">Todos los documentos están organizados</p>
                          </div>
                        ) : (
                          uncategorizedDocuments.map((document, index) => (
                            <Draggable key={document.id} draggableId={document.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`p-2 rounded-lg border transition-all cursor-grab active:cursor-grabbing ${
                                    snapshot.isDragging 
                                      ? 'shadow-lg bg-white border-blue-300 rotate-3 scale-105 z-50' 
                                      : 'bg-white hover:bg-gray-50 border-gray-200 hover:shadow-sm'
                                  }`}
                                >
                                  <div className="flex items-start gap-2">
                                    <div className="flex-shrink-0">
                                      <div className={`w-6 h-8 rounded flex items-center justify-center ${
                                        document.document_type === 'email' 
                                          ? 'bg-blue-100' 
                                          : 'bg-red-100'
                                      }`}>
                                        {document.document_type === 'email' ? (
                                          <Mail className="h-4 w-4 text-blue-600" />
                                        ) : (
                                          <FileText className="h-4 w-4 text-red-600" />
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <p className="font-medium text-xs text-gray-900 break-words">
                                              {truncateFileName(document.file_name, 20)}
                                            </p>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>{document.file_name}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                      <p className="text-xs text-gray-500 mt-1">
                                        {formatFileSize(document.file_size)}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))
                        )}
                        {provided.placeholder}
                        
                        {/* Drop zone hint */}
                        {snapshot.isDraggingOver && (
                          <div className="text-center py-4 text-orange-600 text-sm font-medium animate-pulse">
                            <Tag className="h-5 w-5 mx-auto mb-2" />
                            Suelta aquí para quitar categoría
                          </div>
                        )}
                        
                        {/* Empty state with drag hint */}
                        {uncategorizedDocuments.length === 0 && snapshot.isDraggingOver && (
                          <div className="text-center py-8 text-orange-600 animate-pulse">
                            <Tag className="h-8 w-8 mx-auto mb-2" />
                            <p className="text-sm font-medium mb-1">Suelta aquí</p>
                            <p className="text-xs">Para quitar de la carpeta</p>
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
        )
      })() : (
        // Main overview with categories and uncategorized
        <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar documentos y carpetas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-72 pl-10 pr-4 h-10 bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500 shadow-sm"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button 
              onClick={() => setShowCreateCategoryModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 h-10"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nueva Carpeta
            </Button>
          </div>
          
          {/* Search Results Info */}
          {searchTerm && (
            <div className="text-sm text-gray-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              Buscando: "{searchTerm}" | {filteredCategories.length + filteredDocuments.length} resultados
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Panel - Categories (3/4 width) */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-5 w-5 text-blue-600" />
                    <CardTitle>Explorador de Archivos</CardTitle>
                    <Badge variant="secondary">
                      {searchTerm ? `${filteredCategories.length} de ${categories.length} carpetas` : `${categories.length} carpetas`}
                    </Badge>
                  </div>
                  {categories.length > 1 && (
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <div className="grid grid-cols-2 gap-0.5">
                        <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                        <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                        <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                        <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                      </div>
                      <span>Arrastra para reordenar</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Droppable droppableId="categories-reorder" type="CATEGORY" direction="horizontal">
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4"
                    >
                      {filteredCategories.map((category, index) => (
                        <Draggable key={category.id} draggableId={`category-${category.id}`} index={index}>
                          {(draggableProvided, draggableSnapshot) => (
                            <div
                              ref={draggableProvided.innerRef}
                              {...draggableProvided.draggableProps}
                              className={`relative ${
                                draggableSnapshot.isDragging 
                                  ? 'rotate-3 scale-105 z-50 transition-none' 
                                  : isDragging ? 'transition-none' : 'transition-transform duration-200 ease-out'
                              }`}
                            >
                              <Droppable droppableId={`category-${category.id}`} type="DOCUMENT">
                                {(droppableProvided, droppableSnapshot) => (
                                  <div
                                    ref={droppableProvided.innerRef}
                                    {...droppableProvided.droppableProps}
                                    className={`${
                                      droppableSnapshot.isDraggingOver 
                                        ? 'scale-105 z-10 transition-transform duration-200' 
                                        : isDragging ? 'transition-none' : 'transition-transform duration-150 ease-out'
                                    }`}
                                  >
                                    <ContextMenu>
                                      <ContextMenuTrigger asChild>
                                        <Card 
                                          className={`group cursor-pointer hover:shadow-lg ${
                                            droppableSnapshot.isDraggingOver ? 'ring-2 ring-blue-400 bg-blue-50 shadow-xl transition-all duration-200' : 'hover:shadow-md transition-shadow duration-200'
                                          } ${draggableSnapshot.isDragging ? 'shadow-xl bg-white' : ''}`}
                                          onClick={() => handleCategoryClick(category.id)}
                                        >
                                          <CardContent className="p-4 text-center">
                                            {/* Drag Handle */}
                                            <div 
                                              {...draggableProvided.dragHandleProps}
                                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-move p-1.5 rounded-full hover:bg-gray-200/80 backdrop-blur-sm"
                                              title="Arrastra para reordenar carpetas"
                                            >
                                              <div className="grid grid-cols-2 gap-0.5">
                                                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full"></div>
                                                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full"></div>
                                                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full"></div>
                                                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full"></div>
                                                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full"></div>
                                                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full"></div>
                                              </div>
                                            </div>
                                            
                                            <AnimatedFolder 
                                              color={category.color}
                                              isOpen={dragOverFolder === category.id}
                                              isHovered={droppableSnapshot.isDraggingOver}
                                            />
                                            <div className="mt-2">
                                              <h3 className="font-medium text-gray-900 mb-1 text-sm truncate">
                                                {category.name}
                                              </h3>
                                              <p className="text-xs text-gray-500">
                                                {searchTerm 
                                                  ? `${filteredDocuments.filter(doc => doc.category_id === category.id).length} de ${documents.filter(doc => doc.category_id === category.id).length} archivos`
                                                  : `${documents.filter(doc => doc.category_id === category.id).length} archivos`
                                                }
                                              </p>
                                            </div>
                                          </CardContent>
                                        </Card>
                                      </ContextMenuTrigger>
                                      <ContextMenuContent className="w-48">
                                        <ContextMenuItem
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleEditCategory(category)
                                          }}
                                          className="cursor-pointer"
                                        >
                                          <Edit3 className="h-4 w-4 mr-2" />
                                          Editar Carpeta
                                        </ContextMenuItem>
                                        <ContextMenuSeparator />
                                        <ContextMenuItem
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setCategoryToDelete(category)
                                            setShowDeleteCategoryModal(true)
                                          }}
                                          className="cursor-pointer text-red-600 focus:text-red-600"
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Eliminar Carpeta
                                        </ContextMenuItem>
                                      </ContextMenuContent>
                                    </ContextMenu>
                                    {droppableProvided.placeholder}
                                  </div>
                                )}
                              </Droppable>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      
                      {/* Empty search results */}
                      {searchTerm && filteredCategories.length === 0 && filteredDocuments.length === 0 && (
                        <div className="col-span-full text-center py-12 text-gray-500">
                          <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <h3 className="text-lg font-medium mb-2">No se encontraron resultados</h3>
                          <p>No hay carpetas ni documentos que coincidan con "{searchTerm}"</p>
                          <Button 
                            variant="outline" 
                            onClick={() => setSearchTerm('')}
                            className="mt-4"
                          >
                            Limpiar búsqueda
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Uncategorized (1/4 width) */}
          <div className="lg:col-span-1">
            <Card className="h-fit">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Tag className="h-5 w-5 text-orange-600" />
                  <CardTitle className="text-sm">
                    {searchTerm ? 'Documentos Encontrados' : 'Sin Categorizar'}
                  </CardTitle>
                  <Badge variant="secondary">
                    {searchTerm ? filteredDocuments.length : uncategorizedDocuments.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="max-h-[600px] overflow-y-auto">
                <Droppable droppableId="uncategorized" type="DOCUMENT">
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`space-y-2 min-h-[300px] p-2 rounded-lg border-2 border-dashed transition-all ${
                        snapshot.isDraggingOver 
                          ? 'border-orange-400 bg-orange-50' 
                          : 'border-gray-200'
                      }`}
                    >
                      {(searchTerm ? filteredDocuments : uncategorizedDocuments).length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <Tag className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          {searchTerm ? (
                            <>
                              <p className="text-sm font-medium mb-1">Sin resultados</p>
                              <p className="text-xs">No hay documentos que coincidan con "{searchTerm}"</p>
                            </>
                          ) : (
                            <>
                          <p className="text-sm font-medium mb-1">¡Excelente organización!</p>
                          <p className="text-xs">Todos los documentos están organizados</p>
                            </>
                          )}
                        </div>
                      ) : (
                        (searchTerm ? filteredDocuments : uncategorizedDocuments).map((document, index) => (
                          <Draggable key={document.id} draggableId={document.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`group p-2 rounded-lg border transition-all cursor-grab active:cursor-grabbing ${
                                  snapshot.isDragging 
                                    ? 'shadow-lg bg-white border-blue-300 rotate-3 scale-105 z-50' 
                                    : 'bg-white hover:bg-gray-50 border-gray-200 hover:shadow-sm'
                                }`}
                              >
                                <div className="flex items-start gap-2">
                                  <div className="flex-shrink-0">
                                    <div className={`w-6 h-8 rounded flex items-center justify-center ${
                                      document.document_type === 'email' 
                                        ? 'bg-blue-100' 
                                        : 'bg-red-100'
                                    }`}>
                                      {document.document_type === 'email' ? (
                                        <Mail className="h-4 w-4 text-blue-600" />
                                      ) : (
                                        <FileText className="h-4 w-4 text-red-600" />
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <p className="font-medium text-xs text-gray-900 break-words">
                                            {truncateFileName(document.file_name, 20)}
                                          </p>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{document.file_name}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                    <div className="text-xs text-gray-500 mt-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <p>{formatFileSize(document.file_size)}</p>
                                        {document.document_type === 'email' && (
                                          <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">
                                            <Mail className="h-2 w-2 mr-1" />
                                            Email
                                          </Badge>
                                        )}
                                      </div>
                                      {searchTerm && document.categoryName && (
                                        <div className="flex items-center gap-1 mt-1">
                                          <Folder className="h-3 w-3" style={{ color: document.categoryColor }} />
                                          <span>{document.categoryName}</span>
                                  </div>
                                      )}
                                      {searchTerm && !document.categoryName && (
                                        <div className="flex items-center gap-1 mt-1">
                                          <Tag className="h-3 w-3 text-orange-600" />
                                          <span className="text-orange-600">Sin categorizar</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {/* Actions Menu */}
                                  <div className="flex-shrink-0">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-blue-100"
                                        >
                                          <MoreVertical className="h-3 w-3 text-gray-600" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-40">
                                        <DropdownMenuItem onClick={() => handleViewDocument(document)}>
                                          <Eye className="h-3 w-3 mr-2" />
                                          Ver
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleEditDocument(document.id)}>
                                          <Edit3 className="h-3 w-3 mr-2" />
                                          Editar
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem 
                                          onClick={() => onDocumentAction?.('delete', document.id)}
                                          className="text-red-600"
                                        >
                                          <Trash2 className="h-3 w-3 mr-2" />
                                          Eliminar
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                      
                      {/* Drop zone hint */}
                      {snapshot.isDraggingOver && (
                        <div className="text-center py-4 text-orange-600 text-sm font-medium animate-pulse">
                          <Tag className="h-5 w-5 mx-auto mb-2" />
                          Suelta aquí para quitar categoría
                        </div>
                      )}
                      
                      {/* Empty state with drag hint */}
                      {uncategorizedDocuments.length === 0 && snapshot.isDraggingOver && (
                        <div className="text-center py-8 text-orange-600 animate-pulse">
                          <Tag className="h-8 w-8 mx-auto mb-2" />
                          <p className="text-sm font-medium mb-1">Suelta aquí</p>
                          <p className="text-xs">Para quitar de la carpeta</p>
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
                
                <div className="mt-4 pt-4 border-t text-center text-xs text-gray-500">
                  <p>Arrastra documentos a las carpetas</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Create Category Modal */}
        <Dialog open={showCreateCategoryModal} onOpenChange={setShowCreateCategoryModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nueva Carpeta</DialogTitle>
              <DialogDescription>
                Crea una nueva carpeta para organizar tus documentos
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nombre de la carpeta</label>
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Ej: Contratos, Facturas..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">Color</label>
                <div className="flex gap-2 mt-2">
                  {colorOptions.map(color => (
                    <button
                      key={color}
                      className={`w-8 h-8 rounded-full border-2 ${newCategoryColor === color ? 'border-gray-400' : 'border-gray-200'}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewCategoryColor(color)}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => {
                  setShowCreateCategoryModal(false)
                  resetCategoryForm()
                }}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateCategory}>
                  Crear Carpeta
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Category Modal */}
        <Dialog open={showEditCategoryModal} onOpenChange={setShowEditCategoryModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Carpeta</DialogTitle>
              <DialogDescription>
                Modifica los detalles de la carpeta
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nombre de la carpeta</label>
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Ej: Contratos, Facturas..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">Color</label>
                <div className="flex gap-2 mt-2">
                  {colorOptions.map(color => (
                    <button
                      key={color}
                      className={`w-8 h-8 rounded-full border-2 ${newCategoryColor === color ? 'border-gray-400' : 'border-gray-200'}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewCategoryColor(color)}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => {
                  setShowEditCategoryModal(false)
                  resetCategoryForm()
                }}>
                  Cancelar
                </Button>
                <Button onClick={handleUpdateCategory}>
                  Guardar Cambios
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Category Modal */}
        <Dialog open={showDeleteCategoryModal} onOpenChange={setShowDeleteCategoryModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Eliminación de Carpeta</DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-2">
                  <div>¿Estás seguro que deseas eliminar la carpeta <strong>"{categoryToDelete?.name}"</strong>?</div>
                  <div className="text-orange-600 font-medium">
                    • Los {documents.filter(doc => doc.category_id === categoryToDelete?.id).length} documentos en esta carpeta se moverán automáticamente a "Sin Categorizar"
                  </div>
                  <div className="text-sm text-gray-600">
                    Esta acción no se puede deshacer, pero los documentos no se eliminarán.
                  </div>
                </div>
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => {
                setShowDeleteCategoryModal(false)
                setCategoryToDelete(null)
              }}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDeleteCategory}>
                Sí, Eliminar Carpeta
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Move Document Modal */}
        <Dialog open={showMoveModal} onOpenChange={setShowMoveModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mover Documento</DialogTitle>
              <DialogDescription>
                Selecciona la carpeta de destino para "{documentToMove?.file_name}"
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                <Button
                  variant="outline"
                  className="justify-start h-auto p-3"
                  onClick={() => handleMoveToCategory(null)}
                >
                  <Tag className="h-4 w-4 mr-2 text-orange-600" />
                  <div className="text-left">
                    <div className="font-medium">Sin Categorizar</div>
                    <div className="text-xs text-gray-500">Mover a documentos sin categorizar</div>
                  </div>
                </Button>
                {categories.map((category) => (
                  <Button
                    key={category.id}
                    variant="outline"
                    className="justify-start h-auto p-3"
                    onClick={() => handleMoveToCategory(category.id)}
                  >
                    <div 
                      className="w-4 h-4 mr-2 rounded flex items-center justify-center text-white"
                      style={{ backgroundColor: category.color }}
                    >
                      {getCategoryIcon(category.icon)}
                    </div>
                    <div className="text-left">
                      <div className="font-medium">{category.name}</div>
                      <div className="text-xs text-gray-500">
                        {documents.filter(doc => doc.category_id === category.id).length} documentos
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowMoveModal(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>



        {/* Document Viewer Modal */}
        {selectedDocument && (
          <DocumentViewerModal
              isOpen={showViewerModal}
              onClose={() => {
                console.log('🖼️ ENHANCED: Modal onClose called')
                setShowViewerModal(false)
                setSelectedDocument(null)
              }}
              documentId={selectedDocument.id}
              documentName={selectedDocument.file_name}
            />
        )}
      </div>
      )}
    </DragDropContext>
  )
}
