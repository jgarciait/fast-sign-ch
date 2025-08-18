"use client"

import { useState, useEffect } from "react"
import { X, Upload, Loader2, CheckCircle, AlertCircle, Search, ChevronDown } from "lucide-react"
import { authenticateAquarius, getAquariusDoctypes, getAquariusQueryDefs, uploadDocumentToAquarius, type AquariusDoctype, type AquariusQueryDefs, type AquariusQueryField } from "@/app/actions/aquarius-api-actions"
import { useToast } from "@/hooks/use-toast"

interface SendToAquariusModalProps {
  isOpen: boolean
  onClose: () => void
  documentId: string
  documentName: string
  token: string
  requestId: string
  onSuccess?: () => void
}

interface IntegrationSetting {
  id: string
  name: string
  display_name?: string
  type: string
  created_at?: string
  is_enabled?: boolean
}

interface DoctypeSelectorProps {
  doctypes: AquariusDoctype
  selectedDoctype: string
  onSelect: (doctype: string) => void
}

function DoctypeSelector({ doctypes, selectedDoctype, onSelect }: DoctypeSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const doctypeEntries = Object.entries(doctypes || {})
  const filteredDoctypes = doctypeEntries.filter(([key, name]) =>
    name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const selectedName = doctypes[selectedDoctype] || ''

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md bg-white text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span className="text-sm">
          {selectedName || "Select document type..."}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search document types..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div className="max-h-48 overflow-y-auto">
            {filteredDoctypes.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">
                No document types found
              </div>
            ) : (
              filteredDoctypes.map(([key, name]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    onSelect(key)
                    setIsOpen(false)
                    setSearchTerm('')
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
                    selectedDoctype === key ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                  }`}
                >
                  {name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function SendToAquariusModal({
  isOpen,
  onClose,
  documentId,
  documentName,
  token,
  requestId,
  onSuccess
}: SendToAquariusModalProps) {
  const [step, setStep] = useState<'checking' | 'integration' | 'doctype' | 'indexdata' | 'uploading' | 'success' | 'error'>('checking')
  const [loading, setLoading] = useState(true)
  const [integrations, setIntegrations] = useState<IntegrationSetting[]>([])
  const [selectedIntegration, setSelectedIntegration] = useState<string>('')
  const [doctypes, setDoctypes] = useState<AquariusDoctype | null>(null)
  const [selectedDoctype, setSelectedDoctype] = useState<string>('')
  const [queryDefs, setQueryDefs] = useState<AquariusQueryDefs | null>(null)
  const [indexData, setIndexData] = useState<Record<string, string>>({})
  const [error, setError] = useState<string>('')
  const [authToken, setAuthToken] = useState<string>('')
  const [uploadResult, setUploadResult] = useState<string>('')
  const { toast } = useToast()

  // Fetch integrations when modal opens
  useEffect(() => {
    if (isOpen && step === 'checking') {
      fetchIntegrations()
    }
  }, [isOpen, step])

  // Auto-authenticate and fetch doctypes when integration is selected
  useEffect(() => {
    if (selectedIntegration && step === 'integration' && !loading) {
      authenticateAndFetchDoctypes()
    }
  }, [selectedIntegration, step])

  // Helper function to show toast notifications
  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    toast({
      title: type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Info',
      description: message,
      variant: type === 'error' ? 'destructive' : 'default',
      action: type === 'success' ? (
        <CheckCircle className="h-5 w-5 text-green-600" />
      ) : type === 'error' ? (
        <AlertCircle className="h-5 w-5 text-red-600" />
      ) : undefined,
    })
  }

  // Helper function to get display name for integration
  const getIntegrationDisplayName = (integration: IntegrationSetting) => {
    if (integration.display_name) {
      return integration.display_name
    }
    
    // Fallback to formatted integration name
    if (integration.name === 'aquarius_software') {
      return 'Aquarius Software'
    }
    
    // Format technical names (snake_case to Title Case)
    return integration.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const fetchIntegrations = async () => {
    try {
      setLoading(true)
      setError('')
      
      const response = await fetch('/api/integrations')
      if (!response.ok) {
        throw new Error('Failed to fetch integrations')
      }
      
      const data = await response.json()
      const aquariusIntegrations = data.filter((integration: IntegrationSetting) => 
        integration.type === 'aquarius' || integration.name === 'aquarius'
      )
      
      setIntegrations(aquariusIntegrations)
      
      if (aquariusIntegrations.length === 0) {
        setStep('checking') // Stay on checking step to show "no integrations" message
      } else {
        setStep('integration')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch integrations')
      setStep('error')
    } finally {
      setLoading(false)
    }
  }

  const handleNext = async () => {
    if (step === 'doctype') {
      await fetchQueryDefinitions()
    } else if (step === 'indexdata') {
      await uploadDocument()
    }
  }

  const authenticateAndFetchDoctypes = async () => {
    try {
      setLoading(true)
      setError('')
      
      // Authenticate
      const authResult = await authenticateAquarius(selectedIntegration)
      if (!authResult.success) {
        throw new Error(authResult.error || 'Authentication failed')
      }
      
      setAuthToken(authResult.token!)
      
      // Fetch doctypes
      const doctypesResult = await getAquariusDoctypes(selectedIntegration, authResult.token!)
      if (!doctypesResult.success) {
        throw new Error(doctypesResult.error || 'Failed to fetch document types')
      }
      
      setDoctypes(doctypesResult.doctypes!)
      setStep('doctype')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to authenticate or fetch document types')
      setStep('error')
    } finally {
      setLoading(false)
    }
  }

  const fetchQueryDefinitions = async () => {
    if (!selectedIntegration || !authToken || !selectedDoctype) return
    
    try {
      setLoading(true)
      setError('')
      
      const queryResult = await getAquariusQueryDefs(selectedIntegration, authToken, selectedDoctype)
      if (!queryResult.success) {
        throw new Error(queryResult.error || 'Failed to fetch field definitions')
      }
      
      setQueryDefs(queryResult.queryDefs!)
      
      // Initialize index data with empty values for user-visible fields
      const initialIndexData: Record<string, string> = {}
      if (queryResult.queryDefs?.queryFields) {
        queryResult.queryDefs.queryFields.forEach(field => {
          // Skip system fields that should be hidden
          if (!shouldHideField(field.fieldName)) {
            // Use the description as the key for user-friendly display
            initialIndexData[field.description] = ''
          }
        })
      }
      setIndexData(initialIndexData)
      setStep('indexdata')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error occurred')
      setStep('error')
    } finally {
      setLoading(false)
    }
  }

  // Helper function to determine if a field should be hidden
  const shouldHideField = (fieldName: string): boolean => {
    const hiddenFields = [
      'Doc_ID',
      'DD_Creation_Date',
      'DD_Created_By', 
      'DD_Index_Date',
      'DD_Indexed_By',
      'DD_Last_Access_Date',
      'DD_Last_Access_By',
      'DD_Page_Count'
    ]
    return hiddenFields.includes(fieldName)
  }

  const uploadDocument = async () => {
    try {
      setLoading(true)
      setStep('uploading')
      setError('')
      
      // Get the signed PDF from the print API
      const printResponse = await fetch(`/api/documents/${documentId}/print?token=${encodeURIComponent(token)}&requestId=${requestId}`)
      if (!printResponse.ok) {
        throw new Error('Failed to generate signed PDF')
      }
      
      const pdfBlob = await printResponse.blob()
      
      // Convert indexData to the format expected by Aquarius
      // The indexData uses description as keys, but Aquarius expects description as fieldName
      const formattedIndexData = Object.entries(indexData).map(([description, value]) => ({
        fieldName: description,  // Use description as fieldName for Aquarius
        value
      }))
      
      // Upload to Aquarius
      const uploadResult = await uploadDocumentToAquarius(
        selectedIntegration,
        authToken,
        selectedDoctype,
        pdfBlob,
        documentName,
        formattedIndexData
      )
      
      console.log('Upload result:', uploadResult)
      
      if (!uploadResult.success) {
        const errorMessage = `Upload failed: ${uploadResult.error}`
        console.log('Upload failed:', errorMessage)
        setError(errorMessage)
        setStep('error')
        
        // Show error toast
        showToast(errorMessage, 'error')
        return
      }
      
      console.log('Upload successful, setting success state')
      const successMessage = `Document "${documentName}" has been successfully uploaded to Aquarius!\n\nDocument ID: ${uploadResult.documentId || 'Generated by Aquarius'}`
      setUploadResult(successMessage)
      setStep('success')
      
      // Show success toast
      showToast(
        `Document "${documentName}" successfully uploaded to Aquarius!`,
        'success'
      )
      
      console.log('Success state set, calling onSuccess callback')
      onSuccess?.()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload document'
      setError(errorMessage)
      setStep('error')
      
      // Show error toast
      showToast(errorMessage, 'error')
    } finally {
      setLoading(false)
    }
  }

  const resetModal = () => {
    setStep('checking')
    setLoading(true)
    setIntegrations([])
    setSelectedIntegration('')
    setDoctypes(null)
    setSelectedDoctype('')
    setQueryDefs(null)
    setIndexData({})
    setError('')
    setAuthToken('')
    setUploadResult('')
  }

  const handleClose = () => {
    resetModal()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            Send to Aquarius Software
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 0: Checking for integrations */}
          {step === 'checking' && (
            <div className="space-y-4">
              {integrations.length === 0 && !error ? (
                loading ? (
                  // Show loader while checking
                  <div className="text-center py-8">
                    <Loader2 className="h-12 w-12 text-blue-500 mx-auto mb-4 animate-spin" />
                    <h3 className="text-lg font-medium mb-2">Checking Integrations</h3>
                    <p className="text-sm text-gray-600">
                      Looking for available Aquarius integrations...
                    </p>
                  </div>
                ) : (
                  // Show no integrations message with settings link
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Aquarius Integration Found</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      You need to configure an Aquarius integration before you can upload documents.
                    </p>
                    <a
                      href="/settings"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      Go to Settings
                    </a>
                  </div>
                )
              ) : null}
            </div>
          )}

          {/* Step 1: Select Integration */}
          {step === 'integration' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  Select the Aquarius integration to use for uploading the signed document.
                </p>
                
                <div className="space-y-2">
                  {integrations.map((integration) => (
                    <label
                      key={integration.id}
                      className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                    >
                      <input
                        type="radio"
                        name="integration"
                        value={integration.id}
                        checked={selectedIntegration === integration.id}
                        onChange={(e) => setSelectedIntegration(e.target.value)}
                        className="text-blue-600"
                        disabled={loading}
                      />
                      <span className="text-sm font-medium">{getIntegrationDisplayName(integration)}</span>
                      {selectedIntegration === integration.id && loading && (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {loading && selectedIntegration && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-sm text-blue-600">Connecting to Aquarius and fetching document types...</p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Document Type */}
          {step === 'doctype' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  Select the document type for: <strong>{documentName}</strong>
                </p>
                
                <DoctypeSelector
                  doctypes={doctypes || {}}
                  selectedDoctype={selectedDoctype}
                  onSelect={setSelectedDoctype}
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Index Data */}
          {step === 'indexdata' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  Fill in the document information for: <strong>{documentName}</strong>
                </p>
                
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {queryDefs?.queryFields?.filter(field => !shouldHideField(field.fieldName)).map((field) => (
                    <div key={field.fieldName} className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">
                        {field.description}
                        {field.maxLength > 0 && (
                          <span className="text-xs text-gray-500 ml-1">
                            (max {field.maxLength} chars)
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={indexData[field.description] || ''}
                        onChange={(e) => {
                          setIndexData(prev => ({
                            ...prev,
                            [field.description]: e.target.value
                          }))
                        }}
                        maxLength={field.maxLength > 0 ? field.maxLength : undefined}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder={`Enter ${field.description.toLowerCase()}...`}
                      />
                    </div>
                  ))}
                </div>

                {queryDefs?.queryFields?.filter(field => !shouldHideField(field.fieldName)).length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500">No additional fields required for this document type.</p>
                  </div>
                )}
              </div>

              {loading && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-sm text-blue-600">Loading field definitions...</p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Uploading */}
          {step === 'uploading' && (
            <div className="text-center py-8">
              <Loader2 className="h-12 w-12 text-blue-500 mx-auto mb-4 animate-spin" />
              <h3 className="text-lg font-medium mb-2">Uploading Document</h3>
              <p className="text-sm text-gray-600">
                Preparing signed document and uploading to Aquarius...
              </p>
            </div>
          )}

          {/* Step 5: Success */}
          {step === 'success' && (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-4 text-green-700">Upload Successful!</h3>
              <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
                <p className="text-sm text-green-800 whitespace-pre-line">{uploadResult}</p>
              </div>
              <p className="text-xs text-gray-500">
                The document has been uploaded to your Aquarius system and is now available for processing.
              </p>
            </div>
          )}

          {/* Step 6: Error */}
          {step === 'error' && (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Upload Failed</h3>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t bg-gray-50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            {step === 'success' ? 'Close' : 'Cancel'}
          </button>
          
          {step === 'doctype' && (
            <button
              onClick={handleNext}
              disabled={loading || !selectedDoctype}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{loading ? 'Loading Fields...' : 'Next'}</span>
            </button>
          )}

          {step === 'indexdata' && (
            <button
              onClick={handleNext}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Upload to Aquarius</span>
            </button>
          )}

          {step === 'error' && (
            <button
              onClick={() => {
                setStep('checking')
                setIntegrations([])
                setSelectedIntegration('')
                setError('')
                setLoading(true)
                fetchIntegrations().finally(() => setLoading(false))
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
