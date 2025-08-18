"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Upload, Check, ChevronRight, ArrowLeft, FileText, Search, Plus, Layout, Trash2, MoreVertical, Eye, Edit, Edit2 } from "lucide-react"
import { sendDocument } from "@/app/actions/document-actions"
import CustomerSelector from "./customer-selector"
import { useToast } from "@/hooks/use-toast"
import SimpleDocumentViewer, { SignatureField } from "@/components/simple-document-viewer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"
import PdfAnnotationEditor from "@/components/pdf-annotation-editor"
import { Label } from "@/components/ui/label"

type FormStep = "source" | "upload" | "mapping" | "preview" | "details" | "recipient" | "review"
type DocumentSource = "upload" | "existing" | "template"

type FormData = {
  source: DocumentSource
  file: File | null
  existingDocumentId: string | null
  templateId: string | null
  subject: string
  message: string
  recipient: string
  first_name: string
  last_name: string
  telephone: string
  postal_address: string
  filePath?: string
  fileUrl?: string
  signatureFields?: any[]
}

interface ExistingDocument {
  id: string
  file_name: string
  file_url: string
  created_at: string
  status: string
  created_by: string
  creator?: {
    full_name: string
    email: string
  }
  mapping?: {
    id: string
    hasMappings: boolean
    signatureFieldsCount: number
    mappedAt: string
    isTemplate: boolean
  }
}

interface SignatureMappingTemplate {
  id: string
  name: string
  description?: string
  signature_fields?: SignatureField[]
  created_at: string
  document_mapping_id?: string
  actualDocumentId?: string
}

export default function SendToSignForm() {
  const searchParams = useSearchParams()
  // Check if we have a direct document URL to skip to mapping step
  const urlDocumentId = searchParams.get('documentId')
  const [currentStep, setCurrentStep] = useState<FormStep>(urlDocumentId ? "mapping" : "source")
  const [formData, setFormData] = useState<FormData>({
    source: "upload",
    file: null,
    existingDocumentId: null,
    templateId: null,
    subject: "Documento para Revisión y Firma",
    message:
      "Por favor, revise y firme este documento lo antes posible. Si tiene alguna pregunta, no dude en contactarme.",
    recipient: "",
    first_name: "",
    last_name: "",
    telephone: "",
    postal_address: "",
  })
  const [isUploading, setIsUploading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [processingMessage, setProcessingMessage] = useState<string>("")
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [documentUrl, setDocumentUrl] = useState<string | null>(null)
  const [documentName, setDocumentName] = useState<string>("")
  const [existingAnnotations, setExistingAnnotations] = useState<any[]>([])
  
  // Direct document loading from URL - Show modal immediately if documentId in URL
  const [isLoadingDirectDocument, setIsLoadingDirectDocument] = useState(!!urlDocumentId)
  const [directDocumentId, setDirectDocumentId] = useState<string | null>(urlDocumentId)
  
  // Data for existing documents and templates
  const [existingDocuments, setExistingDocuments] = useState<ExistingDocument[]>([])
  const [templates, setTemplates] = useState<SignatureMappingTemplate[]>([])
  const [loadingDocuments, setLoadingDocuments] = useState(false)
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [showMappingModal, setShowMappingModal] = useState(!!urlDocumentId)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [templateDescription, setTemplateDescription] = useState("")
  const [currentMappingFields, setCurrentMappingFields] = useState<SignatureField[]>([])
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<SignatureMappingTemplate | null>(null)
  const [previewDocumentUrl, setPreviewDocumentUrl] = useState<string | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<SignatureMappingTemplate | null>(null)
  const [showTemplateSelectionModal, setShowTemplateSelectionModal] = useState(false)
  const [saveAsTemplate, setSaveAsTemplate] = useState(false)
  const [templateSearchTerm, setTemplateSearchTerm] = useState("")

  const [showExistingDocumentModal, setShowExistingDocumentModal] = useState(false)
  const [existingDocumentSearchTerm, setExistingDocumentSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [documentsPerPage] = useState(5)
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null)
  const showUserDocumentsOnly = true // Siempre mostrar solo documentos del usuario logueado
  
  // Delete confirmation modal state
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<{ id: string; name: string } | null>(null)
  
  // Remove mapping confirmation modal state
  const [showRemoveMappingModal, setShowRemoveMappingModal] = useState(false)
  const [documentToRemoveMapping, setDocumentToRemoveMapping] = useState<{ id: string; name: string } | null>(null)
  const [removingMappingDocumentId, setRemovingMappingDocumentId] = useState<string | null>(null)
  
  // Template pagination state
  const [currentTemplatePage, setCurrentTemplatePage] = useState(1)
  const [templatesPerPage] = useState(3)
  
  const router = useRouter()
  const { toast } = useToast()

  // Load document directly from URL parameter
  const loadDirectDocument = async (urlDocumentId: string) => {
    setIsLoadingDirectDocument(true)
    
    try {
      // Load the specific document
      const response = await fetch(`/api/documents?documentId=${urlDocumentId}`)
      
      if (!response.ok) {
        throw new Error('Document not found')
      }
      
      const data = await response.json()
      const documents = data.documents || []
      
      if (documents.length === 0) {
        throw new Error('Document not found')
      }
      
      const document = documents[0]
      
      // Load existing mappings if available
      let existingMappings: any[] = []
      try {
        const mappingResponse = await fetch(`/api/documents/${urlDocumentId}/signature-mapping`)
        if (mappingResponse.ok) {
          const mappingData = await mappingResponse.json()
          existingMappings = mappingData.mapping?.signature_fields || []
        }
      } catch (mappingError) {
        // Continue without existing mappings
      }
      
      // Set up the form state for direct document access
      setFormData(prev => ({
        ...prev,
        source: "existing",
        existingDocumentId: document.id,
        fileUrl: document.file_url,
        filePath: document.file_name,
        signatureFields: existingMappings
      }))
      
      // Set document state
      setDocumentId(document.id)
      setDocumentUrl(document.file_url)
      setDocumentName(document.file_name)
      setExistingAnnotations([])
      
      // Modal is already open, just ensure mapping step is set
      setCurrentStep("mapping")
      
    } catch (error) {
      console.error('Error loading direct document:', error)
      // On error, reset to source step and close modal
      setCurrentStep("source")
      setShowMappingModal(false)
      setDirectDocumentId(null)
    } finally {
      setIsLoadingDirectDocument(false)
    }
  }

  // Check for documentId parameter and pre-load document
  useEffect(() => {
    const documentId = searchParams.get('documentId')
    if (documentId && directDocumentId === documentId) {
      // Use the direct document loading function
      loadDirectDocument(documentId)
    }
  }, []) // Run once on mount

  // Load a specific document by ID and its existing signatures
  const loadDocumentById = async (documentId: string) => {
    try {
      // Load document details
      const documentResponse = await fetch(`/api/documents?documentId=${documentId}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!documentResponse.ok) {
        throw new Error('Failed to load document')
      }

      const documentData = await documentResponse.json()
      const documents = documentData.documents || []
      
      if (documents.length === 0) {
        toast({
          title: "Documento no encontrado",
          description: "No se pudo cargar el documento especificado.",
          variant: "destructive"
        })
        return
      }

      const document = documents[0]

      // For re-mapping in sent-to-sign, we should NOT load existing signatures from document_signatures
      // We only want to load signature mappings from document_signature_mappings if any exist
      let existingMappings: any[] = []
      try {
        // Load only mapping fields, not signed signatures
        const mappingResponse = await fetch(`/api/documents/${documentId}/signature-mapping`)
        if (mappingResponse.ok) {
          const mappingData = await mappingResponse.json()
          existingMappings = mappingData.mapping?.signature_fields || []
        }
      } catch (mappingError) {
        console.warn('Could not load existing mappings:', mappingError)
        // Continue without existing mappings
      }

      // Pre-select this document and move to mapping step
      setFormData(prev => ({
        ...prev,
        source: "existing",
        existingDocumentId: document.id,
        fileUrl: document.file_url,
        filePath: document.file_name,
        signatureFields: existingMappings // Store existing signature field mappings only
      }))
      
      // Set the document state variables for mapping interface
      setDocumentId(document.id)
      setDocumentUrl(document.file_url)
      setDocumentName(document.file_name)
      setExistingAnnotations([]) // Don't show existing signatures - only mapping fields
      setCurrentStep("mapping")
      
      toast({
        title: "Documento cargado",
        description: `${document.file_name} ha sido pre-cargado para envío por email. ${existingMappings.length > 0 ? `Se encontraron ${existingMappings.length} campos de mapeo existentes.` : ''}`
      })

    } catch (error) {
      console.error('Error loading document by ID:', error)
      toast({
        title: "Error",
        description: "No se pudo cargar el documento. Intenta nuevamente.",
        variant: "destructive"
      })
    }
  }

  // Load existing documents - USE SAME LOGIC AS loadDocumentsForModal
  const loadExistingDocuments = async (search?: string) => {
    setLoadingDocuments(true)
    try {
      const params = new URLSearchParams({
        availableOnly: 'true',
        userOnly: showUserDocumentsOnly.toString(),
        limit: '100'
      })
      
      if (search?.trim()) {
        params.set('search', search.trim())
      }
      
      const url = `/api/documents?${params.toString()}`
      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        setExistingDocuments(data.documents || [])
      } else {
        const errorText = await response.text()
        console.error('Failed to load existing documents:', {
          status: response.status,
          statusText: response.statusText,
          response: errorText
        })
        setExistingDocuments([])
      }
    } catch (error) {
      console.error('Error loading existing documents:', error)
      setExistingDocuments([])
    } finally {
      setLoadingDocuments(false)
    }
  }

  // Load documents for modal (only available documents without mappings/signatures)
  const loadDocumentsForModal = async (search?: string) => {
    setLoadingDocuments(true)
    try {
      const params = new URLSearchParams({
        availableOnly: 'true',
        userOnly: showUserDocumentsOnly.toString(),
        limit: '100'
      })
      
      if (search?.trim()) {
        params.set('search', search.trim())
      }
      
      const url = `/api/documents?${params.toString()}`
      const response = await fetch(url, {
        credentials: 'include', // Incluir cookies de sesión
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        
        // Debug: Log the documents received from API
        console.log('=== FRONTEND DEBUG ===')
        console.log('Documents received from API:', data.documents?.length || 0)
        if (data.documents && data.documents.length > 0) {
          data.documents.slice(0, 3).forEach((doc: any, index: number) => {
            console.log(`Document ${index + 1}:`, {
              id: doc.id,
              name: doc.file_name,
              created_by: doc.created_by,
              creator_email: doc.creator?.email,
              creator_name: doc.creator?.full_name
            })
          })
        }
        
        // Ensure we set the filtered documents directly from API
        setExistingDocuments(data.documents || [])
      } else {
        const errorText = await response.text()
        console.error('Failed to load documents:', {
          status: response.status,
          statusText: response.statusText,
          url: url,
          response: errorText
        })
        setExistingDocuments([])
        toast({
          title: "Error al cargar documentos",
          description: `Error ${response.status}: ${response.statusText}`,
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error loading documents for modal:', error)
      setExistingDocuments([])
      toast({
        title: "Error de conexión",
        description: "No se pudo conectar con el servidor",
        variant: "destructive"
      })
    } finally {
      setLoadingDocuments(false)
    }
  }

  // Load signature mapping templates
  const loadTemplates = async () => {
    setLoadingTemplates(true)
    try {
      const response = await fetch('/api/signature-mapping-templates')
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates || [])
      }
    } catch (error) {
      console.error('Error loading templates:', error)
    } finally {
      setLoadingTemplates(false)
    }
  }



  useEffect(() => {
    if (currentStep === "source" && !directDocumentId) {
      // Only load templates on source step, not existing documents
      // Skip this if we're loading a direct document
      loadTemplates()
    }
  }, [currentStep, directDocumentId])

  // Handle search with debouncing
  useEffect(() => {
    if (formData.source === "existing") {
      const timeoutId = setTimeout(() => {
        loadExistingDocuments(searchTerm || undefined)
      }, 300) // 300ms debounce

      return () => clearTimeout(timeoutId)
    }
  }, [searchTerm, formData.source])

  // Load documents when modal opens or filter changes
  useEffect(() => {
    if (showExistingDocumentModal) {
      setExistingDocumentSearchTerm("")
      setCurrentPage(1)
      loadDocumentsForModal()
    }
  }, [showExistingDocumentModal])

  // Handle search in modal with debouncing (skip if search term is empty to avoid duplicate initial load)
  useEffect(() => {
    if (!showExistingDocumentModal || existingDocumentSearchTerm === "") return

    const timeoutId = setTimeout(() => {
      loadDocumentsForModal(existingDocumentSearchTerm)
      setCurrentPage(1) // Reset to first page when search changes
    }, 300) // 300ms debounce

    return () => clearTimeout(timeoutId)
  }, [existingDocumentSearchTerm])

  // Reset template page when modal opens or search changes
  useEffect(() => {
    if (showTemplateSelectionModal) {
      setCurrentTemplatePage(1)
    }
  }, [showTemplateSelectionModal])

  useEffect(() => {
    setCurrentTemplatePage(1)
  }, [templateSearchTerm])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({
        ...formData,
        file: e.target.files[0],
      })
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFormData({
        ...formData,
        file: e.dataTransfer.files[0],
      })
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handleRecipientChange = (value: string) => {
    setFormData({
      ...formData,
      recipient: value,
    })
  }

  const handleSourceChange = (source: DocumentSource) => {
    setFormData({
      ...formData,
      source,
      file: null,
      existingDocumentId: null,
      templateId: null,
      signatureFields: [], // Clear signature fields when changing source
    })
    setDocumentId(null)
    setDocumentUrl(null)
    setDocumentName("")
    
    // Auto-navigate for upload source
    if (source === "upload") {
      setCurrentStep("upload")
    }
  }

  const handleExistingDocumentSelect = async (documentId: string) => {
    const document = existingDocuments.find(d => d.id === documentId)
    if (!document) return

    try {
      // Load existing mapping if present
      const mappingResponse = await fetch(`/api/documents/${documentId}/signature-mapping`)
      let mappedFields: any[] = []
      if (mappingResponse.ok) {
        const mappingData = await mappingResponse.json()
        mappedFields = mappingData.mapping?.signature_fields || []
      }

      setFormData({
        ...formData,
        existingDocumentId: documentId,
        signatureFields: mappedFields,
      })
      setDocumentId(documentId)
      setDocumentUrl(document.file_url)
      setDocumentName(document.file_name)
    } catch (err) {
      // Fallback: proceed without preloaded mapping
      setFormData({
        ...formData,
        existingDocumentId: documentId,
        signatureFields: [],
      })
      setDocumentId(documentId)
      setDocumentUrl(document.file_url)
      setDocumentName(document.file_name)
    }
  }

  const handleExistingDocumentSelectFromModal = async (documentId: string) => {
    const document = existingDocuments.find(d => d.id === documentId)
    if (!document) return

    try {
      // Load existing mapping for the selected document
      const mappingResponse = await fetch(`/api/documents/${documentId}/signature-mapping`)
      let mappedFields: any[] = []
      if (mappingResponse.ok) {
        const mappingData = await mappingResponse.json()
        mappedFields = mappingData.mapping?.signature_fields || []
      }

      setFormData({
        ...formData,
        existingDocumentId: documentId,
        signatureFields: mappedFields,
      })
      setDocumentId(documentId)
      setDocumentUrl(document.file_url)
      setDocumentName(document.file_name)
    } catch (err) {
      setFormData({
        ...formData,
        existingDocumentId: documentId,
        signatureFields: [],
      })
      setDocumentId(documentId)
      setDocumentUrl(document.file_url)
      setDocumentName(document.file_name)
    } finally {
      setShowExistingDocumentModal(false)
      setCurrentStep("mapping")
    }
  }

  const handleDeleteDocument = (documentId: string, documentName: string) => {
    setDocumentToDelete({ id: documentId, name: documentName })
    setShowDeleteConfirmModal(true)
  }

  const confirmDeleteDocument = async () => {
    if (!documentToDelete) return

    setDeletingDocumentId(documentToDelete.id)
    setShowDeleteConfirmModal(false)
    
    try {
      const response = await fetch(`/api/documents?documentId=${documentToDelete.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al eliminar documento')
      }

      toast({
        title: "Documento eliminado",
        description: "El documento ha sido eliminado exitosamente",
      })

      // Reload documents
      await loadDocumentsForModal(existingDocumentSearchTerm || undefined)
    } catch (error) {
      console.error('Error deleting document:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al eliminar el documento",
        variant: "destructive"
      })
    } finally {
      setDeletingDocumentId(null)
      setDocumentToDelete(null)
    }
  }

  const handleTemplateSelect = async (templateId: string) => {
    const template = templates.find(t => t.id === templateId)
    if (template) {
      try {
        // Create a new document from the template
        const response = await fetch(`/api/signature-mapping-templates/${templateId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'create_document'
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to create document from template')
        }

        const data = await response.json()
        const newDocument = data.document

        if (!newDocument) {
          throw new Error('No document returned from template creation')
        }

        // Set form data with the new document
        setFormData(prev => ({
          ...prev,
          source: "template",
          templateId,
          existingDocumentId: newDocument.id,
          signatureFields: template.signature_fields || [],
          filePath: newDocument.file_path,
          fileUrl: newDocument.file_url
        }))
        
        // Skip mapping step and go directly to details (step 3)
        setCurrentStep("details")
        setDocumentId(newDocument.id)
        setDocumentUrl(newDocument.file_url)
        setDocumentName(newDocument.file_name)

        toast({
          title: "Documento creado desde plantilla",
          description: `Se ha creado una copia de "${newDocument.template_name}" para enviar.`,
        })
      } catch (error) {
        console.error('Error creating document from template:', error)
        toast({
          title: "Error", 
          description: error instanceof Error ? error.message : "Failed to create document from template",
          variant: "destructive",
        })
      }
    }
  }

  const handleNext = async () => {
    if (currentStep === "upload") {
      await handleUpload()
    } else if (currentStep === "mapping") {
      // For template workflow, go to preview first
      if (formData.source === "template" && formData.templateId) {
        const template = templates.find(t => t.id === formData.templateId)
        if (template) {
          setPreviewTemplate(template)
          setCurrentStep("preview")
        } else {
          setCurrentStep("details")
        }
      } else {
        setCurrentStep("details")
      }
    } else if (currentStep === "preview") {
      setCurrentStep("details")
    } else if (currentStep === "details") {
      setCurrentStep("recipient")
    } else if (currentStep === "recipient") {
      setCurrentStep("review")
    }
  }

  const handleBack = () => {
    if (currentStep === "upload") {
      setCurrentStep("source")
      // Clear the source selection to allow re-selection
      setFormData(prev => ({ ...prev, source: "upload" }))
    } else if (currentStep === "mapping") {
      if (formData.source === "existing") {
        setCurrentStep("source")
      } else {
        setCurrentStep("upload")
      }
    } else if (currentStep === "preview") {
      setCurrentStep("mapping")
    } else if (currentStep === "details") {
      if (formData.source === "template" && previewTemplate) {
        setCurrentStep("preview")
      } else {
      setCurrentStep("mapping")
      }
    } else if (currentStep === "recipient") {
      setCurrentStep("details")
    } else if (currentStep === "review") {
      setCurrentStep("recipient")
    }
  }

  const handleUpload = async () => {
    if (!formData.file) {
      setUploadError("No file selected")
      return
    }

    setIsUploading(true)
    setUploadError(null)

    try {
      // Create a FormData object for the file upload
      const uploadFormData = new FormData()
      uploadFormData.append("file", formData.file)

      // Use the API route for upload
      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: uploadFormData,
      })

      if (!uploadResponse.ok) {
        let errorMessage = "Upload failed"
        const contentType = uploadResponse.headers.get("content-type")
        if (contentType && contentType.includes("application/json")) {
          try {
            const errorData = await uploadResponse.json()
            errorMessage = errorData?.error || `Upload failed with status ${uploadResponse.status}`
          } catch (parseError) {
            console.error("Error parsing error response:", parseError)
            errorMessage = `Upload failed with status ${uploadResponse.status}`
          }
        } else {
          if (uploadResponse.status === 413) {
            errorMessage = "File too large. Maximum size is 50MB."
          } else if (uploadResponse.status === 400) {
            errorMessage = "Invalid file. Please check the file type and try again."
          } else {
            errorMessage = `Upload failed. Please try again. (Status: ${uploadResponse.status})`
          }
        }
        throw new Error(errorMessage)
      }

      const uploadResult = await uploadResponse.json()
      if (!uploadResult || !uploadResult.path || !uploadResult.url) {
        throw new Error("Failed to get file path or URL after upload")
      }

      // For template workflow, don't create document record yet, go to preview
      if (formData.source === "template") {
        setDocumentUrl(uploadResult.url)
        setDocumentName(formData.file.name)
        setFormData(prev => ({
          ...prev,
          filePath: uploadResult.path,
          fileUrl: uploadResult.url
        }))
        
        // Set the template and go directly to preview
        if (formData.templateId) {
          const template = templates.find(t => t.id === formData.templateId)
          if (template && template.signature_fields) {
            setPreviewTemplate(template)
            setCurrentStep("preview")
          } else {
            setCurrentStep("details")
          }
        } else {
          setCurrentStep("details")
        }
        return
      }

      // Create document record to get document ID
      const documentFormData = new FormData()
      documentFormData.append("filePath", uploadResult.path)
      documentFormData.append("fileUrl", uploadResult.url)
      documentFormData.append("fileName", formData.file.name)
      documentFormData.append("fileSize", formData.file.size.toString())
      documentFormData.append("fileType", formData.file.type)
      documentFormData.append("createOnly", "true") // Flag to only create document, not send
      documentFormData.append("source", formData.source) // Add source field
      
      // Add placeholder values for required fields
      documentFormData.append("subject", "Document for Signature Mapping")
      documentFormData.append("message", "Document prepared for signature mapping")
      documentFormData.append("recipient", "") // Empty recipient for createOnly mode

      const createResult = await sendDocument(documentFormData)
      if (createResult && createResult.error) {
        throw new Error(createResult.error)
      }

      if (!createResult || !createResult.documentId) {
        throw new Error("Failed to create document")
      }

      // Store document info for mapping step
      setDocumentId(createResult.documentId)
      setDocumentUrl(uploadResult.url)
      setDocumentName(formData.file.name)
      setFormData(prev => ({
        ...prev,
        source: "existing",
        existingDocumentId: createResult.documentId,
        filePath: uploadResult.path,
        fileUrl: uploadResult.url,
        signatureFields: [], // Clear signature fields for new document upload
      }))

      setCurrentStep("mapping")
    } catch (error) {
      console.error("Error uploading document:", error)
      setUploadError(error instanceof Error ? error.message : "An unexpected error occurred")
    } finally {
      setIsUploading(false)
    }
  }

  const handleSaveMapping = async (fields: SignatureField[]) => {
    // For template workflow, create document now with mapping
    if (formData.source === "template" && !documentId) {
      try {
        const documentFormData = new FormData()
        documentFormData.append("filePath", formData.filePath!)
        documentFormData.append("fileUrl", formData.fileUrl!)
        documentFormData.append("fileName", formData.file!.name)
        documentFormData.append("fileSize", formData.file!.size.toString())
        documentFormData.append("fileType", formData.file!.type)
        documentFormData.append("createOnly", "true")
        documentFormData.append("subject", "Document for Signature Mapping")
        documentFormData.append("message", "Document prepared for signature mapping")
        documentFormData.append("recipient", "")

        const createResult = await sendDocument(documentFormData)
        if (createResult && createResult.error) {
          throw new Error(createResult.error)
        }

        if (!createResult || !createResult.documentId) {
          throw new Error("Failed to create document")
        }

        setDocumentId(createResult.documentId)
        
        // CRITICAL: Update formData to mark this as existing document
        setFormData(prev => ({
          ...prev,
          source: "existing",
          existingDocumentId: createResult.documentId
        }))
        
      } catch (error) {
        throw new Error("Failed to create document for template")
      }
    }

    if (!documentId) {
      throw new Error("Document ID not available")
    }

    const response = await fetch(`/api/documents/${documentId}/signature-mapping`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        signature_fields: fields
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || "Failed to save signature mapping")
    }

    setFormData(prev => ({
      ...prev,
      signatureFields: fields
    }))
  }

  const handleSaveAsTemplate = async (name: string, description: string, fields: SignatureField[]) => {
    try {
      // First save the document mapping if not already saved
      if (!documentId) {
        throw new Error('Se requiere ID del documento para guardar como plantilla')
      }

      // Save the signature mapping first
      const mappingResponse = await fetch(`/api/documents/${documentId}/signature-mapping`, {
        method: 'POST',
      headers: {
          'Content-Type': 'application/json',
      },
      body: JSON.stringify({
          signature_fields: fields
        }),
      })

      if (!mappingResponse.ok) {
        const error = await mappingResponse.json()
        throw new Error(error.error || 'Error al guardar el mapeo de firmas')
      }

      // Create template with signature fields (current schema)
      const templateResponse = await fetch('/api/signature-mapping-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name,
          description: description,
          signature_fields: fields,
          document_id: documentId
        }),
      })

      if (!templateResponse.ok) {
        const error = await templateResponse.json()
        throw new Error(error.error || 'Error al guardar la plantilla')
      }

      const { template } = await templateResponse.json()
      
      toast({
        title: "Plantilla guardada",
        description: `La plantilla "${name}" ha sido guardada para uso futuro.`,
      })

      return template
    } catch (error) {
      console.error('Error saving template:', error)
      toast({
        title: "Error al guardar plantilla",
        description: error instanceof Error ? error.message : "Error al guardar la plantilla",
        variant: "destructive",
      })
      throw error
    }
  }

  const handleUpdateTemplate = async (templateId: string, name: string, description: string, fields: SignatureField[]) => {
    try {
      const response = await fetch(`/api/signature-mapping-templates/${templateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name,
          description: description,
        signature_fields: fields
      }),
    })

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al actualizar la plantilla')
      }

      const { template } = await response.json()
      
      toast({
        title: "Plantilla actualizada",
        description: `La plantilla "${name}" ha sido actualizada exitosamente.`,
      })

      return template
    } catch (error) {
      console.error('Error updating template:', error)
      toast({
        title: "Error al actualizar plantilla",
        description: error instanceof Error ? error.message : "Error al actualizar la plantilla",
        variant: "destructive",
      })
      throw error
    }
  }

  const handleTemplateSave = async () => {
    if (!templateName.trim()) {
      toast({
        title: "Nombre de plantilla requerido",
        description: "Por favor ingresa un nombre para tu plantilla.",
        variant: "destructive",
      })
      return
    }

    try {
      await handleSaveAsTemplate(templateName, templateDescription, currentMappingFields)
      
      // Update form data with the signature fields
      setFormData(prev => ({
        ...prev,
        signatureFields: currentMappingFields
      }))
      
      // Close template modal
      setShowTemplateModal(false)
      setTemplateName("")
      setTemplateDescription("")
      setCurrentMappingFields([])
      
      toast({
        title: "Plantilla guardada exitosamente",
        description: `Se configuraron ${currentMappingFields.length} campo${currentMappingFields.length !== 1 ? 's' : ''} de firma y se guardó como plantilla "${templateName}".`,
      })
    } catch (error) {
      // Error already handled in handleSaveAsTemplate
    }
  }

  const handleTemplateSkip = () => {
    // Update form data with the signature fields without saving template
    setFormData(prev => ({
      ...prev,
      signatureFields: currentMappingFields
    }))
    
    // Close template modal
    setShowTemplateModal(false)
    setTemplateName("")
    setTemplateDescription("")
    setCurrentMappingFields([])
    setSaveAsTemplate(false)
    setSaveAsTemplate(false)
    
    toast({
      title: "Configuración completada",
      description: `Se configuraron ${currentMappingFields.length} campo${currentMappingFields.length !== 1 ? 's' : ''} de firma exitosamente.`,
    })
  }

  const handleEditMapping = async () => {
    setIsPreviewMode(false)
    
    // Get the template and its associated document
    if (formData.templateId) {
      const template = templates.find(t => t.id === formData.templateId)
      if (template) {
        // Get the document ID from the template
        const docId = await getTemplateDocumentId(template)
        if (docId) {
          // Fetch document details directly from API
          try {
            const response = await fetch(`/api/documents?documentId=${docId}`)
            if (!response.ok) {
              throw new Error('Failed to fetch document details')
            }
            
            const data = await response.json()
            const document = data.documents?.[0]
            
            if (document) {
              // Set the editing template and open the modal
              setEditingTemplate(template)
              setDocumentId(docId)
              setDocumentUrl(document.file_url)
              setDocumentName(document.file_name)
              setShowMappingModal(true)
              return
            }
          } catch (error) {
            console.error('Error fetching document details for editing:', error)
          }
        }
      }
    }
    
    // Fallback: just change step if template data is not available
    setCurrentStep("mapping")
  }

  const handlePreviewMapping = () => {
    setIsPreviewMode(true)
    if (formData.templateId) {
      const template = templates.find(t => t.id === formData.templateId)
      if (template && template.signature_fields) {
        setPreviewTemplate(template)
        setCurrentStep("preview")
      }
    }
  }

  const handleDeleteTemplate = async (template: SignatureMappingTemplate) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar la plantilla "${template.name}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/signature-mapping-templates/${template.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al eliminar la plantilla')
      }

      // Reload templates
      await loadTemplates()
      
      // If this was the selected template, clear the selection
      if (formData.templateId === template.id) {
        setFormData(prev => ({ ...prev, templateId: null, signatureFields: [] }))
      }

      // Clear editing state if this was the template being edited
      if (editingTemplate && editingTemplate.id === template.id) {
        setEditingTemplate(null)
      }

      toast({
        title: "Plantilla eliminada",
        description: `La plantilla "${template.name}" ha sido eliminada exitosamente.`,
      })
    } catch (error) {
      console.error('Error deleting template:', error)
      toast({
        title: "Error al eliminar plantilla",
        description: error instanceof Error ? error.message : "Error al eliminar la plantilla",
        variant: "destructive",
      })
    }
  }

  const handleEditTemplate = async (template: SignatureMappingTemplate) => {
    try {
      // Close the template selection modal first
      setShowTemplateSelectionModal(false)
      
      // Get document ID associated with this template
      const docId = await getTemplateDocumentId(template)
      if (docId) {
        // Fetch document details directly from API
        try {
          const response = await fetch(`/api/documents?documentId=${docId}`)
          if (!response.ok) {
            throw new Error('Failed to fetch document details')
          }
          
          const data = await response.json()
          const document = data.documents?.[0]
          
          if (document) {
            // Set the editing template and open the mapping modal
            setEditingTemplate(template)
            setDocumentId(docId)
            setDocumentUrl(document.file_url)
            setDocumentName(document.file_name)
            setShowMappingModal(true)
            return
          }
        } catch (error) {
          console.error('Error fetching document details:', error)
        }
      }
      
      // If we get here, something went wrong
      toast({
        title: "Error",
        description: "No se pudo encontrar el documento asociado a esta plantilla",
        variant: "destructive",
      })
    } catch (error) {
      console.error("Error opening template for editing:", error)
      toast({
        title: "Error",
        description: "Error al abrir la plantilla para edición",
        variant: "destructive",
      })
    }
  }

  const handleRemoveMapping = (documentId: string, documentName: string) => {
    setDocumentToRemoveMapping({ id: documentId, name: documentName })
    setShowRemoveMappingModal(true)
  }

  const confirmRemoveMapping = async () => {
    if (!documentToRemoveMapping) return

    setRemovingMappingDocumentId(documentToRemoveMapping.id)
    try {
      const response = await fetch(`/api/documents/${documentToRemoveMapping.id}/signature-mapping`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al remover el mapeo')
      }

      toast({
        title: "Mapeo removido",
        description: `El mapeo de "${documentToRemoveMapping.name}" ha sido removido exitosamente.`,
      })

      // Reload documents to reflect changes
      await loadDocumentsForModal()
      
      // Close modal and clear state
      setShowRemoveMappingModal(false)
      setDocumentToRemoveMapping(null)
    } catch (error) {
      console.error('Error removing document mapping:', error)
      toast({
        title: "Error al remover mapeo",
        description: error instanceof Error ? error.message : "Error al remover el mapeo del documento",
        variant: "destructive",
      })
    } finally {
      setRemovingMappingDocumentId(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    setUploadError(null)

    if (!formData.recipient) {
      setUploadError("El correo electrónico del destinatario es requerido")
      return
    }

    if (!formData.signatureFields || formData.signatureFields.length === 0) {
      // Try to reload signature fields from server as a last resort
      if (documentId) {
        try {
          const response = await fetch(`/api/documents/${documentId}/signature-mapping`)
          if (response.ok) {
            const data = await response.json()
            const existingFields = data?.mapping?.signature_fields || []
            if (existingFields.length > 0) {
              setFormData(prev => ({ ...prev, signatureFields: existingFields }))
              setTimeout(() => handleSubmit(e), 100)
              return
            }
          }
        } catch (error) {
          // Silent fallback
        }
      }
      
      setUploadError("El documento debe tener al menos un campo de firma mapeado antes de enviar")
      return
    }

    setIsProcessing(true)
    setProcessingMessage("Procesando su documento...")
    setUploadError(null)

    try {
      // Create form data for document creation server action
      setProcessingMessage("Preparando documento para firmar...")
      const documentFormData = new FormData()
      documentFormData.append("subject", formData.subject)
      documentFormData.append("message", formData.message)
      documentFormData.append("recipient", formData.recipient)
      documentFormData.append("source", formData.source) // Add source field

      if (formData.source === "existing" && formData.existingDocumentId) {
        // For existing documents, we need to get the file info
        const existingDoc = existingDocuments.find(d => d.id === formData.existingDocumentId)
        if (existingDoc) {
          documentFormData.append("existingDocumentId", formData.existingDocumentId)
          documentFormData.append("fileUrl", existingDoc.file_url)
          documentFormData.append("fileName", existingDoc.file_name)
        }
      } else if (formData.source === "template" && formData.existingDocumentId) {
        // For template documents, use the template's document
        documentFormData.append("existingDocumentId", formData.existingDocumentId)
        documentFormData.append("fileUrl", formData.fileUrl!)
        documentFormData.append("fileName", documentName)
      } else {
        // For uploaded documents
        documentFormData.append("filePath", formData.filePath!)
        documentFormData.append("fileUrl", formData.fileUrl!)
        documentFormData.append("fileName", documentName)
        if (formData.file) {
          documentFormData.append("fileSize", formData.file.size.toString())
          documentFormData.append("fileType", formData.file.type)
        }
      }

      // Add customer fields if provided
      if (formData.first_name) documentFormData.append("first_name", formData.first_name)
      if (formData.last_name) documentFormData.append("last_name", formData.last_name)
      if (formData.telephone) documentFormData.append("telephone", formData.telephone)
      if (formData.postal_address) documentFormData.append("postal_address", formData.postal_address)

      // Add signature fields if available
      if (formData.signatureFields && formData.signatureFields.length > 0) {
        documentFormData.append("signatureFields", JSON.stringify(formData.signatureFields))
      }

      // Call server action to create document record
      setProcessingMessage("Sending email to recipient...")
      const result = await sendDocument(documentFormData)

      // Check if result exists and has an error property
      if (result && result.error) {
        console.error("Document creation error:", result.error)
        throw new Error(result.error)
      }

      if (!result || !result.success) {
        console.error("Invalid result from sendDocument:", result)
        throw new Error("Failed to send document")
      }

      // Reset form and redirect
      setFormData({
        source: "upload",
        file: null,
        existingDocumentId: null,
        templateId: null,
        subject: "Document for Review and Sign",
        message:
          "Please review and sign this document at your earliest convenience. If you have any questions, feel free to contact me.",
        recipient: "",
        first_name: "",
        last_name: "",
        telephone: "",
        postal_address: "",
      })

      // Show success toast
      toast({
        title: "Document sent successfully!",
        description: `A signing link has been sent to ${formData.recipient}. The document is now available for signature.`,
        duration: 5000,
      })

      // Use window.location for a hard redirect to ensure page loads
      setTimeout(() => {
        window.location.href = "/documents"
      }, 1000) // Small delay to show the toast
    } catch (error) {
      console.error("Error sending document:", error)
      setUploadError(error instanceof Error ? error.message : "An unexpected error occurred")
    } finally {
      setIsProcessing(false)
    }
  }

  const filteredDocuments = existingDocuments.filter(doc => 
    doc.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (doc.creator?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Filtered documents for the modal with search and pagination
  const filteredDocumentsForModal = existingDocuments.filter(doc =>
    doc.file_name.toLowerCase().includes(existingDocumentSearchTerm.toLowerCase()) ||
    (doc.creator?.full_name || '').toLowerCase().includes(existingDocumentSearchTerm.toLowerCase())
  )
  
  // Show only latest 5 documents if no search term
  const documentsToShow = existingDocumentSearchTerm 
    ? filteredDocumentsForModal 
    : filteredDocumentsForModal.slice(0, 20) // Show more documents but still limit
  
  const totalPages = Math.ceil(documentsToShow.length / documentsPerPage)
  const paginatedDocuments = documentsToShow.slice(
    (currentPage - 1) * documentsPerPage,
    currentPage * documentsPerPage
  )

  const canProceedFromSource = () => {
    if (formData.source === "upload") return true
    if (formData.source === "existing") return !!formData.existingDocumentId
    if (formData.source === "template") return !!formData.templateId
    return false
  }

  const getTemplateDocumentId = async (template: SignatureMappingTemplate): Promise<string | null> => {
    if (!template.document_mapping_id) return null
    
    try {
      const response = await fetch(`/api/documents?mappingId=${template.document_mapping_id}`)
      if (!response.ok) return null
      
      const data = await response.json()
      return data.documentId || null
    } catch (error) {
      console.error('Error getting template document ID:', error)
      return null
    }
  }

  const handleEditMappedDocument = async (document: ExistingDocument) => {
    if (!document.mapping?.hasMappings) return
    
    try {
      // Get existing mapping data
      const response = await fetch(`/api/documents/${document.id}/signature-mapping`)
      if (!response.ok) {
        throw new Error('Error al cargar mapeo existente')
      }
      
      const data = await response.json()
      const existingFields = data.mapping?.signature_fields || []
      
      // Set form data
      setFormData(prev => ({
        ...prev,
        source: "existing",
        existingDocumentId: document.id,
        signatureFields: existingFields
      }))
      
      // Set document info
      setDocumentId(document.id)
      setDocumentUrl(document.file_url)
      setDocumentName(document.file_name)
      
      // Close the modal and open mapping editor
      setShowExistingDocumentModal(false)
      setCurrentMappingFields(existingFields)
      setShowMappingModal(true)
      
      toast({
        title: "Editando mapeo existente",
        description: `Abriendo editor para "${document.file_name}" con ${existingFields.length} campos de firma.`,
      })
    } catch (error) {
      console.error('Error loading mapped document:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al cargar el documento mapeado",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 md:mb-10">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 md:mb-3">Enviar para Firmar</h1>
          <p className="text-base md:text-lg text-gray-600 hidden sm:block">Elija una fuente de documento y configure el mapeo de firmas</p>
        </div>

        {isLoadingDirectDocument ? (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 md:p-8">
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 text-blue-600 mb-6">
                <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <g>
                    <circle cx="12" cy="3" r="1">
                      <animate id="spinner_page_7Z73" begin="0;spinner_page_tKsu.end-0.5s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73"></animate>
                    </circle>
                    <circle cx="16.50" cy="4.21" r="1">
                      <animate id="spinner_page_Wd87" begin="spinner_page_7Z73.begin+0.1s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73"></animate>
                    </circle>
                    <circle cx="7.50" cy="4.21" r="1">
                      <animate id="spinner_page_tKsu" begin="spinner_page_9Qlc.begin+0.1s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73"></animate>
                    </circle>
                    <circle cx="19.79" cy="7.50" r="1">
                      <animate id="spinner_page_lMMO" begin="spinner_page_Wd87.begin+0.1s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73"></animate>
                    </circle>
                    <circle cx="4.21" cy="7.50" r="1">
                      <animate id="spinner_page_9Qlc" begin="spinner_page_Khxv.begin+0.1s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73"></animate>
                    </circle>
                    <circle cx="21.00" cy="12.00" r="1">
                      <animate id="spinner_page_5L9t" begin="spinner_page_lMMO.begin+0.1s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73"></animate>
                    </circle>
                    <circle cx="3.00" cy="12.00" r="1">
                      <animate id="spinner_page_Khxv" begin="spinner_page_ld6P.begin+0.1s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73"></animate>
                    </circle>
                    <circle cx="19.79" cy="16.50" r="1">
                      <animate id="spinner_page_BfTD" begin="spinner_page_5L9t.begin+0.1s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73"></animate>
                    </circle>
                    <circle cx="4.21" cy="16.50" r="1">
                      <animate id="spinner_page_ld6P" begin="spinner_page_XyBs.begin+0.1s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73"></animate>
                    </circle>
                    <circle cx="16.50" cy="19.79" r="1">
                      <animate id="spinner_page_7gAK" begin="spinner_page_BfTD.begin+0.1s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73"></animate>
                    </circle>
                    <circle cx="7.50" cy="19.79" r="1">
                      <animate id="spinner_page_XyBs" begin="spinner_page_HiSl.begin+0.1s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73"></animate>
                    </circle>
                    <circle cx="12" cy="21" r="1">
                      <animate id="spinner_page_HiSl" begin="spinner_page_7gAK.begin+0.1s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73"></animate>
                    </circle>
                    <animateTransform attributeName="transform" type="rotate" dur="6s" values="360 12 12;0 12 12" repeatCount="indefinite"></animateTransform>
                  </g>
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-2">Cargando documento</h2>
              <p className="text-muted-foreground text-center max-w-md">
                Estamos preparando el documento para el mapeo de firmas. Esto solo tomará un momento.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Progress steps - Responsive design */}
            <div className="mb-6 md:mb-10">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
          {/* Desktop horizontal stepper */}
          <div className="hidden md:flex items-center justify-between">
            <div className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-200 ${
                  currentStep === "source" ||
                  currentStep === "upload" ||
                  currentStep === "mapping" ||
                  currentStep === "details" ||
                  currentStep === "recipient" ||
                  currentStep === "review"
                    ? "bg-blue-600 border-blue-600 text-white shadow-md"
                    : "bg-gray-100 border-gray-300 text-gray-500"
                }`}
              >
                {(formData.source === "existing" && formData.existingDocumentId) || 
                 (formData.source === "template" && formData.templateId) || 
                 (formData.source === "upload" && formData.file) ? <Check size={16} /> : <span className="font-semibold text-sm">1</span>}
              </div>
              <div className="ml-3">
                <div className="font-medium text-gray-900 text-sm">Fuente</div>
              </div>
            </div>
            <div className="flex-1 h-0.5 bg-gradient-to-r from-gray-300 to-gray-200 mx-4"></div>
            <div className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-200 ${
                  currentStep === "mapping" || currentStep === "preview" || currentStep === "details" || currentStep === "recipient" || currentStep === "review"
                    ? "bg-blue-600 border-blue-600 text-white shadow-md"
                    : "bg-gray-100 border-gray-300 text-gray-500"
                }`}
              >
                {formData.signatureFields && formData.signatureFields.length > 0 ? <Check size={16} /> : <span className="font-semibold text-sm">2</span>}
              </div>
              <div className="ml-3">
                <div className="font-medium text-gray-900 text-sm">Firmas</div>
              </div>
            </div>
            <div className="flex-1 h-0.5 bg-gradient-to-r from-gray-300 to-gray-200 mx-4"></div>
            <div className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-200 ${
                  currentStep === "preview" || currentStep === "details" || currentStep === "recipient" || currentStep === "review"
                    ? "bg-blue-600 border-blue-600 text-white shadow-md"
                    : "bg-gray-100 border-gray-300 text-gray-500"
                }`}
              >
                <span className="font-semibold text-sm">3</span>
              </div>
              <div className="ml-3">
                <div className="font-medium text-gray-900 text-sm">Email</div>
              </div>
            </div>
            <div className="flex-1 h-0.5 bg-gradient-to-r from-gray-300 to-gray-200 mx-4"></div>
            <div className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-200 ${
                  currentStep === "recipient" || currentStep === "review" ? "bg-blue-600 border-blue-600 text-white shadow-md" : "bg-gray-100 border-gray-300 text-gray-500"
                }`}
              >
                <span className="font-semibold text-sm">4</span>
              </div>
              <div className="ml-3">
                <div className="font-medium text-gray-900 text-sm">Destinatario</div>
              </div>
            </div>
            <div className="flex-1 h-0.5 bg-gradient-to-r from-gray-300 to-gray-200 mx-4"></div>
            <div className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-200 ${
                  currentStep === "review" ? "bg-blue-600 border-blue-600 text-white shadow-md" : "bg-gray-100 border-gray-300 text-gray-500"
                }`}
              >
                <span className="font-semibold text-sm">5</span>
              </div>
              <div className="ml-3">
                <div className="font-medium text-gray-900 text-sm">Enviar</div>
              </div>
            </div>
          </div>

          {/* Mobile vertical stepper */}
          <div className="md:hidden">
            <div className="flex items-center justify-center space-x-2">
              <div
                className={`flex items-center justify-center w-6 h-6 rounded-full border transition-all duration-200 ${
                  currentStep === "source" ||
                  currentStep === "upload" ||
                  currentStep === "mapping" ||
                  currentStep === "details" ||
                  currentStep === "recipient" ||
                  currentStep === "review"
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-gray-100 border-gray-300 text-gray-500"
                }`}
              >
                {(formData.source === "existing" && formData.existingDocumentId) || 
                 (formData.source === "template" && formData.templateId) || 
                 (formData.source === "upload" && formData.file) ? <Check size={12} /> : <span className="font-semibold text-xs">1</span>}
              </div>
              <div className="w-8 h-0.5 bg-gray-200"></div>
              <div
                className={`flex items-center justify-center w-6 h-6 rounded-full border transition-all duration-200 ${
                  currentStep === "mapping" || currentStep === "preview" || currentStep === "details" || currentStep === "recipient" || currentStep === "review"
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-gray-100 border-gray-300 text-gray-500"
                }`}
              >
                {formData.signatureFields && formData.signatureFields.length > 0 ? <Check size={12} /> : <span className="font-semibold text-xs">2</span>}
              </div>
              <div className="w-8 h-0.5 bg-gray-200"></div>
              <div
                className={`flex items-center justify-center w-6 h-6 rounded-full border transition-all duration-200 ${
                  currentStep === "preview" || currentStep === "details" || currentStep === "recipient" || currentStep === "review"
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-gray-100 border-gray-300 text-gray-500"
                }`}
              >
                <span className="font-semibold text-xs">3</span>
              </div>
              <div className="w-8 h-0.5 bg-gray-200"></div>
              <div
                className={`flex items-center justify-center w-6 h-6 rounded-full border transition-all duration-200 ${
                  currentStep === "recipient" || currentStep === "review" ? "bg-blue-600 border-blue-600 text-white" : "bg-gray-100 border-gray-300 text-gray-500"
                }`}
              >
                <span className="font-semibold text-xs">4</span>
              </div>
              <div className="w-8 h-0.5 bg-gray-200"></div>
              <div
                className={`flex items-center justify-center w-6 h-6 rounded-full border transition-all duration-200 ${
                  currentStep === "review" ? "bg-blue-600 border-blue-600 text-white" : "bg-gray-100 border-gray-300 text-gray-500"
                }`}
              >
                <span className="font-semibold text-xs">5</span>
              </div>
            </div>
            {/* Current step title for mobile */}
            <div className="text-center mt-3">
              <div className="font-medium text-gray-900 text-sm">
                {currentStep === "source" && "Elegir Fuente"}
                {(currentStep === "upload" || currentStep === "mapping") && "Mapear Firmas"}
                {(currentStep === "preview" || currentStep === "details") && "Mensaje Email"}
                {currentStep === "recipient" && "Destinatario"}
                {currentStep === "review" && "Revisar y Enviar"}
              </div>
            </div>
          </div>
        </div>
      </div>
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 md:p-8">
          {currentStep === "source" && (
          <div>
            <div className="text-center mb-6 md:mb-8">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2 md:mb-3">Elegir Fuente del Documento</h2>
              <p className="text-gray-600 text-base md:text-lg hidden sm:block">Seleccione cómo desea proporcionar el documento para firmar</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
              {/* Upload New Document */}
              <div
                className={`group relative rounded-xl border-2 p-4 md:p-6 cursor-pointer transition-all duration-300 hover:shadow-lg ${
                  formData.source === "upload"
                    ? "border-blue-500 bg-blue-50 shadow-md"
                    : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                }`}
                onClick={() => {
                  handleSourceChange("upload")
                  setCurrentStep("upload")
                }}
              >
                <div className="flex flex-col items-center text-center">
                  <div className={`p-2 md:p-3 rounded-full mb-3 md:mb-4 transition-colors ${
                    formData.source === "upload" 
                      ? "bg-blue-100" 
                      : "bg-gray-100 group-hover:bg-blue-100"
                  }`}>
                    <Upload className={`h-6 w-6 md:h-8 md:w-8 ${
                      formData.source === "upload" 
                        ? "text-blue-600" 
                        : "text-gray-600 group-hover:text-blue-600"
                    }`} />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2 text-base md:text-lg">Subir Documento</h3>
                  <p className="text-gray-600 text-xs md:text-sm leading-relaxed hidden sm:block">Subir un archivo PDF para crear mapeo de firmas</p>
                </div>
                {formData.source === "upload" && (
                  <div className="absolute top-4 right-4">
                    <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}
              </div>

              {/* Use Existing Document */}
              <div
                className={`group relative rounded-xl border-2 p-4 md:p-6 cursor-pointer transition-all duration-300 hover:shadow-lg ${
                  formData.source === "existing"
                    ? "border-blue-500 bg-blue-50 shadow-md"
                    : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                }`}
                onClick={() => {
                  handleSourceChange("existing")
                  setShowExistingDocumentModal(true)
                }}
              >
                <div className="flex flex-col items-center text-center">
                  <div className={`p-2 md:p-3 rounded-full mb-3 md:mb-4 transition-colors ${
                    formData.source === "existing" 
                      ? "bg-blue-100" 
                      : "bg-gray-100 group-hover:bg-blue-100"
                  }`}>
                    <FileText className={`h-6 w-6 md:h-8 md:w-8 ${
                      formData.source === "existing" 
                        ? "text-blue-600" 
                        : "text-gray-600 group-hover:text-blue-600"
                    }`} />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2 text-base md:text-lg">Documento Existente</h3>
                  <p className="text-gray-600 text-xs md:text-sm leading-relaxed hidden sm:block">Seleccionar de documentos previamente subidos</p>
                </div>
                {formData.source === "existing" && (
                  <div className="absolute top-4 right-4">
                    <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}
              </div>


            </div>



          </div>
        )}

        {currentStep === "upload" && (
          <div>
            <div className="text-center mb-6 md:mb-8">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2 md:mb-3">Subir Documento</h2>
              <p className="text-gray-600 text-base md:text-lg hidden sm:block">
                Suba el documento que desea que sea firmado
              </p>
            </div>

            <div
              className="border-2 border-dashed border-gray-300 rounded-xl p-6 md:p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all duration-300 group"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => document.getElementById("file-upload")?.click()}
            >
              <input id="file-upload" type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />

              <div className="flex flex-col items-center">
                <div className="p-3 md:p-4 bg-gray-100 rounded-full mb-4 md:mb-6 group-hover:bg-blue-100 transition-colors">
                  <Upload className="h-8 w-8 md:h-12 md:w-12 text-gray-500 group-hover:text-blue-600" />
                </div>
                <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-1 md:mb-2">Arrastre y suelte su archivo aquí</h3>
                <p className="text-gray-600 mb-3 md:mb-4 text-sm md:text-base">o haga clic para seleccionar</p>
                <div className="text-xs md:text-sm text-gray-500 bg-gray-100 px-3 md:px-4 py-1 md:py-2 rounded-lg">
                  PDF • Máx. 10MB
                </div>
                {formData.file && (
                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-center">
                      <FileText className="h-5 w-5 text-blue-600 mr-2" />
                      <span className="text-blue-900 font-medium">{formData.file.name}</span>
                    </div>
                    <p className="text-sm text-blue-600 mt-1">
                      {(formData.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                )}
              </div>
            </div>

            {uploadError && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex items-center">
                  <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center mr-3">
                    <span className="text-red-600 text-sm font-bold">!</span>
                  </div>
                  <p className="text-red-800 font-medium">{uploadError}</p>
                </div>
              </div>
            )}

            <div className="mt-6 md:mt-8 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0">
              <Button 
                variant="outline" 
                onClick={handleBack} 
                className="w-full sm:w-auto px-4 md:px-6 py-2 md:py-3 border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl font-medium flex items-center justify-center"
              >
                <ArrowLeft size={16} className="mr-2" /> Atrás
              </Button>
              <Button
                onClick={handleNext}
                disabled={!formData.file || isUploading}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 md:px-8 py-2 md:py-3 text-base md:text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                size="lg"
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 md:h-5 md:w-5 border-b-2 border-white mr-2"></div>
                    Subiendo...
                  </>
                ) : (
                  <>
                    Continuar <ChevronRight size={16} className="ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {currentStep === "mapping" && documentId && documentUrl && (
          <div>
            <h2 className="text-xl font-semibold mb-2">Mapear Campos de Firma</h2>
            <p className="text-muted-foreground mb-6">Haga clic en el documento para agregar campos de firma donde los destinatarios deben firmar</p>

            <div className="bg-muted p-4 rounded-md mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-medium">{documentName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {formData.signatureFields?.length || 0} campos de firma mapeados
                  </p>
                </div>
                <Button
                  onClick={() => setShowMappingModal(true)}
                  className="flex items-center"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Mapear Firmas
                </Button>
              </div>
              
              {formData.signatureFields && formData.signatureFields.length > 0 && (
                <div className="text-sm text-green-600">
                  ✓ El documento ha sido mapeado con campos de firma
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack} className="flex items-center">
                <ArrowLeft size={16} className="mr-1" /> Atrás
              </Button>
              <Button
                onClick={handleNext}
                disabled={!formData.signatureFields || formData.signatureFields.length === 0}
                className="flex items-center"
              >
                Siguiente <ChevronRight size={16} className="ml-1" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === "preview" && previewTemplate && documentUrl && (
          <div>
            <h2 className="text-xl font-semibold mb-2">Preview Template Mapping</h2>
            <p className="text-muted-foreground mb-6">Review the signature field positions from the template. You can edit them if needed.</p>

            <div className="bg-muted p-4 rounded-md mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-medium">{documentName}</h3>
                  <p className="text-sm text-muted-foreground">
                    Template: {previewTemplate.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {previewTemplate.signature_fields?.length || 0} signature fields from template
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleEditMapping}
                    className="flex items-center"
                  >
                    Edit Mapping
                  </Button>
                  <Button
                    onClick={() => setShowMappingModal(true)}
                    className="flex items-center"
                  >
                    View Document
                  </Button>
                </div>
              </div>
              
              <div className="text-sm text-green-600">
                ✓ Template applied with {previewTemplate.signature_fields?.length || 0} signature fields
              </div>
              
              {previewTemplate.description && (
                <div className="mt-2 text-sm text-muted-foreground">
                  <span className="font-medium">Template Description:</span> {previewTemplate.description}
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack} className="flex items-center">
                <ArrowLeft size={16} className="mr-1" /> Back
              </Button>
              <Button
                onClick={handleNext}
                className="flex items-center"
              >
                Continue <ChevronRight size={16} className="ml-1" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === "details" && (
          <div>
            <h2 className="text-xl font-semibold mb-2">Email Message</h2>
            <p className="text-muted-foreground mb-6">Add a title and message for the recipient</p>

            <div className="space-y-4">
              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-foreground mb-1">
                  Subject
                </label>
                <input
                  id="subject"
                  name="subject"
                  type="text"
                  value={formData.subject}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors"
                />
                <p className="mt-1 text-sm text-muted-foreground">
                  This will be the subject of the email sent to the recipient
                </p>
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-foreground mb-1">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={5}
                  value={formData.message}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors"
                ></textarea>
                <p className="mt-1 text-sm text-muted-foreground">
                  This message will be included in the email to the recipient
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={handleBack} className="flex items-center">
                <ArrowLeft size={16} className="mr-1" /> Back
              </Button>
              <Button onClick={handleNext} className="flex items-center">
                Next <ChevronRight size={16} className="ml-1" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === "recipient" && (
          <div>
            <h2 className="text-xl font-semibold mb-2">Seleccionar Destinatario</h2>
            <p className="text-muted-foreground mb-6">Elige quién firmará este documento</p>

            <CustomerSelector value={formData.recipient} onChange={handleRecipientChange} />

            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={handleBack} className="flex items-center">
                <ArrowLeft size={16} className="mr-1" /> Atrás
              </Button>
              <Button
                onClick={handleNext}
                disabled={!formData.recipient}
                className="flex items-center"
              >
                Siguiente <ChevronRight size={16} className="ml-1" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === "review" && (
          <div>
            <h2 className="text-xl font-semibold mb-2">Revisar y Enviar</h2>
            <p className="text-muted-foreground mb-6">Revisa tu documento e información del destinatario antes de enviar</p>

            {uploadError && <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md">{uploadError}</div>}

            <div className="space-y-6">
              <div className="bg-muted p-4 rounded-md">
                <h3 className="font-medium mb-2">Documento</h3>
                <div className="flex items-center mb-2">
                  <FileText className="h-5 w-5 text-muted-foreground mr-2" />
                  <span>{documentName}</span>
                </div>
                <div className="text-sm text-muted-foreground mb-2">
                  <span className="font-medium">Origen:</span> {
                    formData.source === "upload" ? "Recién subido" :
                    formData.source === "existing" ? "Documento existente" :
                    "Basado en plantilla"
                  }
                </div>
                {formData.signatureFields && formData.signatureFields.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">Campos de firma:</span> {formData.signatureFields.length} mapeados
                  </div>
                )}
              </div>

              <div className="bg-muted p-4 rounded-md">
                <h3 className="font-medium mb-2">Mensaje de Correo</h3>
                <div className="mb-2">
                  <span className="font-medium">Asunto:</span> {formData.subject}
                </div>
                <div>
                  <span className="font-medium">Mensaje:</span>
                  <p className="mt-1 whitespace-pre-line">{formData.message}</p>
                </div>
              </div>

              <div className="bg-muted p-4 rounded-md">
                <h3 className="font-medium mb-2">Destinatario</h3>
                <div>
                  <span className="font-medium">Correo:</span> {formData.recipient}
                </div>
                {(formData.first_name || formData.last_name) && (
                  <div>
                    <span className="font-medium">Nombre:</span> {formData.first_name} {formData.last_name}
                  </div>
                )}
                {formData.telephone && (
                  <div>
                    <span className="font-medium">Teléfono:</span> {formData.telephone}
                  </div>
                )}
                {formData.postal_address && (
                  <div>
                    <span className="font-medium">Dirección:</span> {formData.postal_address}
                  </div>
                )}
              </div>
            </div>

            {isProcessing && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
                  <h3 className="text-xl font-semibold mb-2">Procesando Documento</h3>
                  <p className="text-muted-foreground">{processingMessage}</p>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={handleBack} className="flex items-center">
                <ArrowLeft size={16} className="mr-1" /> Atrás
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isProcessing}
              >
                {isProcessing ? "Enviando..." : "Enviar Documento"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Signature Mapping Modal */}
      {showMappingModal && !!documentId && !!documentUrl && (
        <Dialog open={showMappingModal} onOpenChange={(open) => {
          setShowMappingModal(open)
          if (!open) {
            // Clear preview state when closing
            if (previewTemplate) {
              setPreviewTemplate(null)
              setPreviewDocumentUrl(null)
            }
            // Clear editing state when closing
            if (editingTemplate) {
              setEditingTemplate(null)
            }

            // Ensure the mapping status UI updates in real time when closing
            // by reloading mapping from server, in case realtime is delayed
            if (documentId) {
              fetch(`/api/documents/${documentId}/signature-mapping`)
                .then(r => r.ok ? r.json() : null)
                .then(data => {
                  const existingFields = data?.mapping?.signature_fields || []
                  setFormData(prev => ({ ...prev, signatureFields: existingFields }))
                })
                .catch(() => {})
            }
          }
        }}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0">
            <div className="h-full flex flex-col">
              <DialogHeader className="p-4 border-b">
                <DialogTitle>
                  {previewTemplate 
                    ? `Vista previa de plantilla: ${previewTemplate.name}` 
                    : editingTemplate 
                      ? `Editar plantilla: ${editingTemplate.name}` 
                      : `Mapear campos de firma - ${documentName}`
                  }
                </DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-hidden">
                {isLoadingDirectDocument ? (
                  <div className="flex flex-col items-center justify-center h-full py-20">
                    <div className="w-16 text-blue-600 mb-6">
                      <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <g>
                          <circle cx="12" cy="3" r="1">
                            <animate id="spinner_7Z73" begin="0;spinner_tKsu.end-0.5s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73"></animate>
                          </circle>
                          <circle cx="16.50" cy="4.21" r="1">
                            <animate id="spinner_Wd87" begin="spinner_7Z73.begin+0.1s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73"></animate>
                          </circle>
                          <circle cx="7.50" cy="4.21" r="1">
                            <animate id="spinner_tKsu" begin="spinner_9Qlc.begin+0.1s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73"></animate>
                          </circle>
                          <circle cx="19.79" cy="7.50" r="1">
                            <animate id="spinner_lMMO" begin="spinner_Wd87.begin+0.1s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73"></animate>
                          </circle>
                          <circle cx="4.21" cy="7.50" r="1">
                            <animate id="spinner_9Qlc" begin="spinner_Khxv.begin+0.1s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73"></animate>
                          </circle>
                          <circle cx="21.00" cy="12.00" r="1">
                            <animate id="spinner_5L9t" begin="spinner_lMMO.begin+0.1s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73"></animate>
                          </circle>
                          <circle cx="3.00" cy="12.00" r="1">
                            <animate id="spinner_Khxv" begin="spinner_ld6P.begin+0.1s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73"></animate>
                          </circle>
                          <circle cx="19.79" cy="16.50" r="1">
                            <animate id="spinner_BfTD" begin="spinner_5L9t.begin+0.1s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73"></animate>
                          </circle>
                          <circle cx="4.21" cy="16.50" r="1">
                            <animate id="spinner_ld6P" begin="spinner_XyBs.begin+0.1s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73"></animate>
                          </circle>
                          <circle cx="16.50" cy="19.79" r="1">
                            <animate id="spinner_7gAK" begin="spinner_BfTD.begin+0.1s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73"></animate>
                          </circle>
                          <circle cx="7.50" cy="19.79" r="1">
                            <animate id="spinner_XyBs" begin="spinner_HiSl.begin+0.1s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73"></animate>
                          </circle>
                          <circle cx="12" cy="21" r="1">
                            <animate id="spinner_HiSl" begin="spinner_7gAK.begin+0.1s" attributeName="r" calcMode="spline" dur="0.6s" values="1;2;1" keySplines=".27,.42,.37,.99;.53,0,.61,.73"></animate>
                          </circle>
                          <animateTransform attributeName="transform" type="rotate" dur="6s" values="360 12 12;0 12 12" repeatCount="indefinite"></animateTransform>
                        </g>
                      </svg>
                    </div>
                    <h2 className="text-xl font-semibold mb-2">Cargando documento</h2>
                    <p className="text-muted-foreground text-center max-w-md">
                      Estamos preparando el documento para el mapeo de firmas. Esto solo tomará un momento.
                    </p>
                  </div>
                ) : (
                  <PdfAnnotationEditor
                    documentUrl={documentUrl || `/api/pdf/${documentId}`}
                    documentName={documentName || ''}
                    documentId={documentId || ''}
                    onBack={() => {
                    setShowMappingModal(false)
                    if (previewTemplate) {
                      setPreviewTemplate(null)
                      setPreviewDocumentUrl(null)
                    }
                    if (editingTemplate) {
                      setEditingTemplate(null)
                    }
                  }}
                  mappingMode={true}
                  previewMode={!!previewTemplate}
                  readOnly={false}
                  onContinue={async () => {
                    // Ensure we have the latest mapping data before continuing
                    if (documentId) {
                      try {
                        const response = await fetch(`/api/documents/${documentId}/signature-mapping`)
                        if (response.ok) {
                          const data = await response.json()
                          const existingFields = data?.mapping?.signature_fields || []
                          setFormData(prev => ({ ...prev, signatureFields: existingFields }))
                        }
                      } catch (error) {
                        // Silent fallback
                      }
                    }
                    
                    // Close the mapping modal
                    setShowMappingModal(false)
                    
                    // Clear preview/editing states
                    if (previewTemplate) {
                      setPreviewTemplate(null)
                      setPreviewDocumentUrl(null)
                    }
                    if (editingTemplate) {
                      setEditingTemplate(null)
                    }
                    
                    // Move to the details step (email step)
                    setCurrentStep("details")
                  }}
                  onSave={async (annotations: any[]) => {
                    try {
                      // Convert annotations to signature fields
                      const signatureFields: SignatureField[] = annotations
                        .filter(ann => ann.type === "signature")
                        .map((ann, index) => ({
                          id: ann.id || `field-${Date.now()}-${index}`,
                          page: ann.page || 1,
                          x: ann.x || 0,
                          y: ann.y || 0,
                          width: ann.width || 150,
                          height: ann.height || 75,
                          relativeX: ann.relativeX || (ann.x || 0) / 800, // Fallback calculation
                          relativeY: ann.relativeY || (ann.y || 0) / 1000, // Fallback calculation
                          relativeWidth: ann.relativeWidth || (ann.width || 150) / 800, // Fallback calculation
                          relativeHeight: ann.relativeHeight || (ann.height || 75) / 1000, // Fallback calculation
                          label: ann.label || `Signature ${index + 1}`
                        }))

                      if (signatureFields.length === 0) {
                        toast({
                          title: "Sin campos de firma",
                          description: "Agrega al menos un campo de firma antes de guardar.",
                          variant: "destructive",
                        })
                        return
                      }

                      // If editing a template, update it directly
                      if (editingTemplate) {
                        await handleUpdateTemplate(
                          editingTemplate.id,
                          editingTemplate.name,
                          editingTemplate.description || '',
                          signatureFields
                        )
                        
                        // Reload templates to get updated data
                        await loadTemplates()
                        
                        // Close modal and clear editing state
                        setShowMappingModal(false)
                        setEditingTemplate(null)
                        
                        return
                      }

                      // For new mappings, save and update local state
                      await handleSaveMapping(signatureFields)

                      // Update local state
                      setCurrentMappingFields(signatureFields)
                      setFormData(prev => ({ 
                        ...prev, 
                        signatureFields: signatureFields
                      }))
                      
                      // Don't close modal or advance step automatically - 
                      // let the user click "Continuar" to control the flow
                      
                      // Optionally allow saving as template (user can still choose)
                      // setShowTemplateModal(true)
                      // setTemplateName(documentName.replace(/\.[^/.]+$/, ""))
                    } catch (error) {
                      // Error suppressed from console
                      toast({
                        title: "Error al guardar campos de firma",
                        description: error instanceof Error ? error.message : "No se pudo guardar el mapeo de firmas",
                        variant: "destructive",
                      })
                    }
                  }}
                  initialAnnotations={
                    // Editable signature fields only (including previously saved mapping fields)
                    (formData.signatureFields || [])
                      .map(field => ({
                        id: field.id,
                        type: "signature" as const,
                        x: field.x,
                        y: field.y,
                        width: field.width,
                        height: field.height,
                        page: field.page,
                        relativeX: field.relativeX,
                        relativeY: field.relativeY,
                        relativeWidth: field.relativeWidth,
                        relativeHeight: field.relativeHeight,
                        content: field.label,
                        timestamp: new Date().toISOString(),
                        readOnly: false,
                        isExistingSignature: false // Override to make fields draggable
                      }))
                  }
                  token={undefined}
                  hideSaveButton={false}
                />
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Template Save Modal */}
      {showTemplateModal && (
        <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-gray-900">Mapeo de Firmas Completado</DialogTitle>
              <DialogDescription className="text-gray-600">
                Se han configurado {currentMappingFields.length} campo{currentMappingFields.length !== 1 ? 's' : ''} de firma correctamente.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* Success indicator */}
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-green-900">Configuración Lista</p>
                  <p className="text-sm text-green-700">
                    {currentMappingFields.length} campo{currentMappingFields.length !== 1 ? 's' : ''} de firma configurado{currentMappingFields.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Template save checkbox */}
              <div className="space-y-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveAsTemplate}
                    onChange={(e) => setSaveAsTemplate(e.target.checked)}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 mt-0.5"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Guardar como plantilla para uso futuro (opcional)</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Las plantillas te permiten reutilizar esta configuración de firmas en documentos similares.
                    </p>
                  </div>
                </label>

                {/* Template fields - only shown when checkbox is checked */}
                {saveAsTemplate && (
                  <div className="ml-8 space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div>
                      <Label htmlFor="template-name" className="text-sm font-medium text-gray-700 mb-1 block">
                        Nombre de la Plantilla *
                      </Label>
                      <Input
                        id="template-name"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        className="w-full"
                        placeholder="Ej: Contrato de Trabajo, Acuerdo de Servicio..."
                        autoFocus
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="template-description" className="text-sm font-medium text-gray-700 mb-1 block">
                        Descripción (Opcional)
                      </Label>
                      <textarea
                        id="template-description"
                        value={templateDescription}
                        onChange={(e) => setTemplateDescription(e.target.value)}
                        className="w-full min-h-[80px] px-3 py-2 text-sm border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Describe cuándo usar esta plantilla (tipo de documento, situación específica, etc.)"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <DialogFooter className="gap-3">
              {saveAsTemplate ? (
                <>
                  <Button 
                    variant="outline"
                    onClick={handleTemplateSkip}
                    className="flex-1"
                  >
                    Continuar sin Guardar
                  </Button>
                  <Button 
                    onClick={handleTemplateSave}
                    disabled={!templateName.trim()}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Guardar Plantilla
                  </Button>
                </>
              ) : (
                <Button 
                  onClick={handleTemplateSkip}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  Continuar
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Template Selection Modal */}
      {showTemplateSelectionModal && (() => {
        // Filter and sort templates
        const filteredTemplates = templates
          .filter(template => 
            template.name?.toLowerCase().includes(templateSearchTerm.toLowerCase())
          )
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) // Most recent first
        
        // Paginate templates
        const startIndex = (currentTemplatePage - 1) * templatesPerPage
        const endIndex = startIndex + templatesPerPage
        const paginatedTemplates = filteredTemplates.slice(startIndex, endIndex)
        const totalPages = Math.ceil(filteredTemplates.length / templatesPerPage)

        return (
          <Dialog open={showTemplateSelectionModal} onOpenChange={setShowTemplateSelectionModal}>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
              <DialogHeader>
                <DialogTitle>Seleccionar Plantilla de Firmas</DialogTitle>
                <DialogDescription>
                  Elige una plantilla de mapeo de firmas preconfigurada
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar plantillas por nombre..."
                  value={templateSearchTerm}
                  onChange={(e) => setTemplateSearchTerm(e.target.value)}
                  className="pl-10 bg-white border-white/20 focus:border-blue-400"
                />
              </div>
              
              <div className="max-h-96 overflow-y-auto space-y-2">
                {loadingTemplates ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-sm text-muted-foreground mt-3">Cargando plantillas...</p>
                  </div>
                ) : paginatedTemplates.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-400 text-4xl mb-4">📋</div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No se encontraron plantillas
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {templateSearchTerm ? `Sin resultados para "${templateSearchTerm}"` : "No hay plantillas disponibles en este momento."}
                    </p>
                  </div>
                ) : (
                  paginatedTemplates.map((template) => (
                      <div
                        key={template.id}
                        className="group relative border-2 border-gray-200 rounded-xl p-5 hover:border-blue-400 hover:shadow-lg transition-all duration-300 cursor-pointer bg-gradient-to-br from-white to-gray-50 hover:from-blue-50 hover:to-white"
                        onClick={() => {
                          handleTemplateSelect(template.id)
                          setShowTemplateSelectionModal(false)
                        }}
                      >
                        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                            Clic para seleccionar
                          </div>
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-lg text-gray-900 group-hover:text-blue-700 transition-colors">{template.name}</h4>
                              <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                                  {template.signature_fields?.length || 0} campos de firma
                                </span>
                                <span>•</span>
                                <span>Creado {new Date(template.created_at).toLocaleDateString('es-ES')}</span>
                              </div>
                            </div>
                          </div>
                          
                          {template.description && (
                            <p className="text-sm text-gray-600 mb-3 ml-[60px]">{template.description}</p>
                          )}
                          
                          <div className="flex gap-2 ml-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditTemplate(template)
                              }}
                              className="h-8 px-3 text-xs hover:bg-amber-100 hover:text-amber-600 transition-colors"
                              title="Editar Plantilla"
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteTemplate(template)
                              }}
                              className="h-8 px-3 text-xs text-gray-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                              title="Eliminar Plantilla"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Eliminar
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
              
              {/* Template Pagination */}
              {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Mostrando {((currentTemplatePage - 1) * templatesPerPage) + 1} a {Math.min(currentTemplatePage * templatesPerPage, filteredTemplates.length)} de {filteredTemplates.length} plantillas
                    </p>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentTemplatePage(prev => Math.max(prev - 1, 1))}
                        disabled={currentTemplatePage === 1}
                      >
                        Anterior
                      </Button>
                      <span className="text-sm">
                        Página {currentTemplatePage} de {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentTemplatePage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentTemplatePage === totalPages}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                )}
            </div>
          </DialogContent>
        </Dialog>
        )
      })()}

      {/* Existing Documents Selection Modal */}
      {showExistingDocumentModal && (
        <Dialog open={showExistingDocumentModal} onOpenChange={setShowExistingDocumentModal}>
          <DialogContent className="w-full max-w-[700px] h-[90vh] max-h-none flex flex-col">
            <DialogHeader className="flex-shrink-0 border-b border-gray-200 pb-4">
              <DialogTitle>Seleccionar Documento Disponible</DialogTitle>
              <DialogDescription>
                Elige un documento para enviar a firmar. Los documentos mapeados pueden editarse o enviarse directamente.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col flex-1 space-y-2 overflow-hidden">
              <div className="flex gap-2 flex-shrink-0">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar documentos disponibles..."
                    value={existingDocumentSearchTerm}
                    onChange={(e) => {
                      const value = e.target.value
                      setExistingDocumentSearchTerm(value)
                      setCurrentPage(1) // Reset to first page when searching
                      
                      // If user clears search, reload all documents immediately
                      if (value === "") {
                        loadDocumentsForModal()
                      }
                    }}
                    className="pl-10 focus:border-blue-300 focus:ring-0 focus:outline-none focus:shadow-none outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    style={{ boxShadow: 'none', outline: 'none' }}
                  />
                </div>
                {/* Removido el toggle - siempre mostrar solo documentos del usuario */}
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                {loadingDocuments ? (
                  <div className="flex flex-col items-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <p className="text-sm text-muted-foreground mt-3">Cargando documentos...</p>
                  </div>
                ) : paginatedDocuments.length === 0 ? (
                  <div className="flex flex-col items-center py-4">
                    <div className="text-gray-400 text-4xl mb-4">📄</div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No se encontraron documentos
                    </h3>
                    <p className="text-sm text-muted-foreground text-center">
                      {existingDocumentSearchTerm ? 
                        `Sin resultados para "${existingDocumentSearchTerm}"` : 
                        "No hay documentos disponibles en este momento."
                      }
                    </p>
                  </div>
                ) : (
                  paginatedDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="border rounded-lg p-3 hover:border-blue-300 hover:shadow-sm transition-all duration-200 bg-white"
                    >
                      {/* Header Row */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-sm truncate">{doc.file_name}</h4>
                            {doc.mapping?.hasMappings && (
                              <Badge variant="secondary" className="text-xs px-2 py-0.5 flex-shrink-0">
                                {doc.mapping.signatureFieldsCount} campo{doc.mapping.signatureFieldsCount !== 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>
                          
                          {/* Creator and Date Info */}
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <span className="font-medium text-gray-700">
                              {doc.creator?.email || doc.creator?.full_name || `Usuario ID: ${doc.created_by?.slice(0, 8)}...`}
                            </span>
                            <span>•</span>
                            <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                            {doc.mapping?.hasMappings && (
                              <>
                                <span>•</span>
                                <span className="text-blue-600">Mapeado {new Date(doc.mapping.mappedAt).toLocaleDateString()}</span>
                              </>
                            )}
                          </div>
                        </div>
                        
                        {/* Status and Delete Button */}
                        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                          <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                            doc.status === 'completed' ? 'bg-green-100 text-green-800' :
                            doc.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {doc.status === 'completed' ? 'Completado' : 
                             doc.status === 'pending' ? 'Pendiente' : doc.status}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteDocument(doc.id, doc.file_name)
                            }}
                            disabled={deletingDocumentId === doc.id}
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            title="Eliminar documento"
                          >
                            {deletingDocumentId === doc.id ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-500"></div>
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                      
                      {/* Action Buttons Row */}
                      <div className="flex gap-2 pt-2 border-t border-gray-100">
                        {doc.mapping?.hasMappings ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditMappedDocument(doc)}
                              className="h-7 text-xs px-3 flex-1"
                            >
                              <Edit2 className="h-3 w-3 mr-1" />
                              Editar Mapeo
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleExistingDocumentSelectFromModal(doc.id)}
                              className="h-7 text-xs px-3 flex-1"
                            >
                              Usar para Enviar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRemoveMapping(doc.id, doc.file_name)
                              }}
                              disabled={removingMappingDocumentId === doc.id}
                              className="h-7 text-xs px-3 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300"
                              title="Remover mapeo de firma"
                            >
                              {removingMappingDocumentId === doc.id ? (
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-500 mr-1"></div>
                              ) : (
                                <Trash2 className="h-3 w-3 mr-1" />
                              )}
                              Remover Mapeo
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleExistingDocumentSelectFromModal(doc.id)}
                            className="h-7 text-xs px-3 w-full"
                          >
                            Crear Mapeo
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t flex-shrink-0">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {((currentPage - 1) * documentsPerPage) + 1} a {Math.min(currentPage * documentsPerPage, documentsToShow.length)} de {documentsToShow.length} documentos
                  </p>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      Anterior
                    </Button>
                    <span className="text-sm">
                      Página {currentPage} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </div>
            

          </DialogContent>
        </Dialog>
      )}



      {/* Delete Confirmation Modal - Higher z-index to appear above document selection modal */}
      <div className="confirmation-modal-high">
        <AlertDialog open={showDeleteConfirmModal} onOpenChange={setShowDeleteConfirmModal}>
          <AlertDialogContent className="confirmation-modal-high">
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar Documento</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Estás seguro de que quieres eliminar "{documentToDelete?.name}"? Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setShowDeleteConfirmModal(false)
                setDocumentToDelete(null)
              }}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteDocument}
                className="bg-red-600 hover:bg-red-700"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Remove Mapping Confirmation Modal */}
      <div className="confirmation-modal-high">
        <AlertDialog open={showRemoveMappingModal} onOpenChange={setShowRemoveMappingModal}>
          <AlertDialogContent className="confirmation-modal-high">
            <AlertDialogHeader>
              <AlertDialogTitle>Remover Mapeo de Firmas</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Estás seguro de que quieres remover el mapeo de firmas de "{documentToRemoveMapping?.name}"? 
                El documento se mantendrá, pero se eliminará toda la configuración de campos de firma.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setShowRemoveMappingModal(false)
                setDocumentToRemoveMapping(null)
              }}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmRemoveMapping}
                className="bg-red-600 hover:bg-red-700"
                disabled={!!removingMappingDocumentId}
              >
                {removingMappingDocumentId ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Removiendo...
                  </>
                ) : (
                  'Remover Mapeo'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
          </>
        )}
      </div>
    </div>
  )
}
