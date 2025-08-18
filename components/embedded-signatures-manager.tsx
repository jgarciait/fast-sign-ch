"use client"

import React, { useState, useEffect } from "react"
import { Trash2, Star, StarOff, Plus, User, Users } from "lucide-react"
import { 
  getSignatureTemplates, 
  getCustomers, 
  getCustomerSignatures,
  deleteSignatureTemplate,
  updateSignatureTemplate
} from "@/app/actions/signature-templates-actions"
import type { SignatureTemplate, Customer, CustomerSignature } from "@/app/actions/signature-templates-actions"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import EnhancedSignatureModal from "./enhanced-signature-modal"

export default function EmbeddedSignaturesManager() {
  const [activeTab, setActiveTab] = useState<'templates' | 'customers'>('templates')
  const [templates, setTemplates] = useState<SignatureTemplate[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSignatures, setCustomerSignatures] = useState<Record<string, CustomerSignature[]>>({})
  
  const [isLoading, setIsLoading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Load data when component mounts
  useEffect(() => {
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
  }, [])

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

  return (
    <>
      <div className="space-y-6">
        {/* Header with Create Button */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Saved Signatures</h3>
            <p className="text-sm text-gray-600">Manage your signature templates and customer signatures</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Signature
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'templates' | 'customers')}>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="templates" className="flex items-center space-x-2">
              <User className="h-4 w-4" />
              <span>My Templates ({templates.length})</span>
            </TabsTrigger>
            <TabsTrigger value="customers" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>Customer Signatures</span>
            </TabsTrigger>
          </TabsList>

          {/* Templates Tab */}
          <TabsContent value="templates" className="mt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading signatures...</span>
              </div>
            ) : templates.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <User className="h-12 w-12 text-gray-300 mb-4" />
                  <h4 className="text-lg font-medium mb-2">No signature templates saved yet</h4>
                  <p className="text-gray-600 text-center mb-4 max-w-md">
                    Create your first signature template to reuse across documents.
                  </p>
                  <Button onClick={() => setShowCreateModal(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Template
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template) => (
                  <Card key={template.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <CardTitle className="text-base">{template.template_name}</CardTitle>
                            {template.is_default && (
                              <Star className="h-4 w-4 text-blue-600 fill-current" />
                            )}
                          </div>
                          <CardDescription className="capitalize">{template.signature_type}</CardDescription>
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleSetDefaultTemplate(template.id)}
                            className={`p-1 rounded hover:bg-gray-100 ${
                              template.is_default ? 'text-blue-600' : 'text-gray-400'
                            }`}
                            title={template.is_default ? "Remove as default" : "Set as default"}
                          >
                            {template.is_default ? <Star className="h-4 w-4 fill-current" /> : <StarOff className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="p-1 rounded hover:bg-red-100 text-red-500"
                            title="Delete template"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-gray-50 border border-gray-200 rounded p-3 flex justify-center mb-3">
                        <img
                          src={template.signature_data}
                          alt={template.template_name}
                          className="max-h-16 max-w-full"
                        />
                      </div>
                      <div className="text-xs text-gray-500">
                        Created: {new Date(template.created_at).toLocaleDateString()}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Customer Signatures Tab */}
          <TabsContent value="customers" className="mt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading signatures...</span>
              </div>
            ) : customers.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Users className="h-12 w-12 text-gray-300 mb-4" />
                  <h4 className="text-lg font-medium mb-2">No customers found</h4>
                  <p className="text-gray-600 text-center">
                    Customer signatures will appear here once you have customers.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {customers.map((customer) => {
                  const signatures = customerSignatures[customer.id] || []
                  return (
                    <Card key={customer.id}>
                      <CardHeader>
                        <CardTitle className="text-base">
                          {customer.first_name && customer.last_name
                            ? `${customer.first_name} ${customer.last_name}`
                            : customer.email}
                        </CardTitle>
                        <CardDescription>{customer.email}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {signatures.length === 0 ? (
                          <p className="text-gray-500 text-sm">No signatures saved for this customer</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {signatures.map((signature) => (
                              <div
                                key={signature.id}
                                className="border border-gray-200 rounded p-3"
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
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
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
