"use client"

import React, { useState, useEffect } from "react"
import { X, Trash2, Edit, User, Users, Plus, Star, StarOff } from "lucide-react"
import { 
  getSignatureTemplates, 
  getCustomers, 
  getCustomerSignatures,
  deleteSignatureTemplate,
  updateSignatureTemplate,
  createSignatureTemplate,
  createCustomerSignature
} from "@/app/actions/signature-templates-actions"
import type { SignatureTemplate, Customer, CustomerSignature } from "@/app/actions/signature-templates-actions"
import { toast } from "sonner"
import EnhancedSignatureModal from "./enhanced-signature-modal"

interface SavedSignaturesManagerProps {
  isOpen: boolean
  onClose: () => void
  onSelectSignature?: (signatureData: string, signatureType: 'template' | 'customer') => void
}

export default function SavedSignaturesManager({ 
  isOpen, 
  onClose, 
  onSelectSignature 
}: SavedSignaturesManagerProps) {
  const [activeTab, setActiveTab] = useState<'templates' | 'customers'>('templates')
  const [templates, setTemplates] = useState<SignatureTemplate[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSignatures, setCustomerSignatures] = useState<Record<string, CustomerSignature[]>>({})
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("")
  
  const [isLoading, setIsLoading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<SignatureTemplate | null>(null)

  // Load data when modal opens
  useEffect(() => {
    if (!isOpen) return

    const loadData = async () => {
      setIsLoading(true)
      try {
        // Load templates
        const templatesResult = await getSignatureTemplates()
        if (templatesResult.error) {
          console.error("Error loading templates:", templatesResult.error)
        } else {
          setTemplates(templatesResult.templates)
        }

        // Load customers
        const customersResult = await getCustomers()
        if (customersResult.error) {
          console.error("Error loading customers:", customersResult.error)
        } else {
          setCustomers(customersResult.customers)
          
          // Load signatures for each customer
          const signaturesMap: Record<string, CustomerSignature[]> = {}
          for (const customer of customersResult.customers) {
            const signaturesResult = await getCustomerSignatures(customer.id)
            if (!signaturesResult.error) {
              signaturesMap[customer.id] = signaturesResult.signatures
            }
          }
          setCustomerSignatures(signaturesMap)
        }
      } catch (error) {
        console.error("Error loading data:", error)
        toast.error("Error loading saved signatures")
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [isOpen])

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("Are you sure you want to delete this signature template?")) return

    try {
      const result = await deleteSignatureTemplate(templateId)
      if (result.error) {
        toast.error(`Error deleting template: ${result.error}`)
      } else {
        toast.success("Template deleted successfully")
        setTemplates(prev => prev.filter(t => t.id !== templateId))
      }
    } catch (error) {
      console.error("Error deleting template:", error)
      toast.error("An unexpected error occurred")
    }
  }

  const handleSetDefaultTemplate = async (templateId: string) => {
    try {
      // First, remove default from all templates
      const updatePromises = templates.map(template => 
        updateSignatureTemplate(template.id, { is_default: template.id === templateId })
      )
      
      await Promise.all(updatePromises)
      
      // Update local state
      setTemplates(prev => prev.map(t => ({ ...t, is_default: t.id === templateId })))
      toast.success("Default template updated")
    } catch (error) {
      console.error("Error setting default template:", error)
      toast.error("Error updating default template")
    }
  }

  const handleSelectTemplate = (template: SignatureTemplate) => {
    if (onSelectSignature) {
      onSelectSignature(template.signature_data, 'template')
      onClose()
    }
  }

  const handleSelectCustomerSignature = (signature: CustomerSignature) => {
    if (onSelectSignature) {
      onSelectSignature(signature.signature_data, 'customer')
      onClose()
    }
  }

  const handleCreateSignature = (dataUrl: string, source: 'canvas' | 'wacom') => {
    // The enhanced signature modal handles saving internally
    setShowCreateModal(false)
    
    // Reload templates to show the new one
    setTimeout(async () => {
      const templatesResult = await getSignatureTemplates()
      if (!templatesResult.error) {
        setTemplates(templatesResult.templates)
      }
    }, 500)
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-full max-h-[90vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
            <h3 className="text-lg font-medium">Saved Signatures</h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center space-x-1"
              >
                <Plus className="h-4 w-4" />
                <span>New Signature</span>
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 flex-shrink-0">
            <button
              onClick={() => setActiveTab('templates')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${
                activeTab === 'templates'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <User className="h-4 w-4" />
              <span>My Templates ({templates.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('customers')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${
                activeTab === 'customers'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Customer Signatures</span>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading signatures...</span>
              </div>
            ) : (
              <>
                {/* Templates Tab */}
                {activeTab === 'templates' && (
                  <div className="space-y-4">
                    {templates.length === 0 ? (
                      <div className="text-center py-8">
                        <User className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 mb-4">No signature templates saved yet</p>
                        <button
                          onClick={() => setShowCreateModal(true)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center space-x-1 mx-auto"
                        >
                          <Plus className="h-4 w-4" />
                          <span>Create Your First Template</span>
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {templates.map((template) => (
                          <div
                            key={template.id}
                            className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors cursor-pointer"
                            onClick={() => handleSelectTemplate(template)}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <h4 className="font-medium text-gray-900">{template.template_name}</h4>
                                  {template.is_default && (
                                    <Star className="h-4 w-4 text-blue-600 fill-current" />
                                  )}
                                </div>
                                <p className="text-sm text-gray-500 capitalize">{template.signature_type}</p>
                              </div>
                              <div className="flex items-center space-x-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleSetDefaultTemplate(template.id)
                                  }}
                                  className={`p-1 rounded hover:bg-gray-100 ${
                                    template.is_default ? 'text-blue-600' : 'text-gray-400'
                                  }`}
                                  title={template.is_default ? "Remove as default" : "Set as default"}
                                >
                                  {template.is_default ? <Star className="h-4 w-4 fill-current" /> : <StarOff className="h-4 w-4" />}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteTemplate(template.id)
                                  }}
                                  className="p-1 rounded hover:bg-red-100 text-red-500"
                                  title="Delete template"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            <div className="bg-gray-50 border border-gray-200 rounded p-2 flex justify-center">
                              <img
                                src={template.signature_data}
                                alt={template.template_name}
                                className="max-h-16 max-w-full"
                              />
                            </div>
                            <div className="mt-2 text-xs text-gray-500">
                              Created: {new Date(template.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Customer Signatures Tab */}
                {activeTab === 'customers' && (
                  <div className="space-y-4">
                    {customers.length === 0 ? (
                      <div className="text-center py-8">
                        <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No customers found</p>
                      </div>
                    ) : (
                      customers.map((customer) => {
                        const signatures = customerSignatures[customer.id] || []
                        return (
                          <div key={customer.id} className="border border-gray-200 rounded-lg">
                            <div className="p-4 border-b border-gray-100 bg-gray-50">
                              <h4 className="font-medium text-gray-900">
                                {customer.first_name && customer.last_name
                                  ? `${customer.first_name} ${customer.last_name}`
                                  : customer.email}
                              </h4>
                              <p className="text-sm text-gray-500">{customer.email}</p>
                            </div>
                            <div className="p-4">
                              {signatures.length === 0 ? (
                                <p className="text-gray-500 text-sm">No signatures saved for this customer</p>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {signatures.map((signature) => (
                                    <div
                                      key={signature.id}
                                      className="border border-gray-200 rounded p-3 hover:border-gray-300 transition-colors cursor-pointer"
                                      onClick={() => handleSelectCustomerSignature(signature)}
                                    >
                                      <div className="flex items-start justify-between mb-2">
                                        <div>
                                          <h5 className="font-medium text-sm text-gray-900">{signature.signature_name}</h5>
                                          <p className="text-xs text-gray-500 capitalize">{signature.signature_type}</p>
                                        </div>
                                        {signature.is_default_for_customer && (
                                          <Star className="h-3 w-3 text-blue-600 fill-current" />
                                        )}
                                      </div>
                                      <div className="bg-gray-50 border border-gray-200 rounded p-2 flex justify-center">
                                        <img
                                          src={signature.signature_data}
                                          alt={signature.signature_name}
                                          className="max-h-12 max-w-full"
                                        />
                                      </div>
                                      <div className="mt-1 text-xs text-gray-500">
                                        Created: {new Date(signature.created_at).toLocaleDateString()}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Create Signature Modal */}
      <EnhancedSignatureModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onComplete={handleCreateSignature}
        showSaveOptions={true}
      />
    </>
  )
}
