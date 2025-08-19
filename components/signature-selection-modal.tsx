"use client"

import React, { useState, useEffect } from "react"
import { X, Plus, Star, Pen } from "lucide-react"
import SavedSignaturesManager from "./saved-signatures-manager"
import EnhancedSignatureModal from "./enhanced-signature-modal"
// Using API routes instead of server actions to avoid HTTP 431 errors
// import { getSignatureTemplates, getDefaultSignatureTemplate, getSignatureTemplateData } from "@/app/actions/signature-templates-actions"
import type { SignatureTemplate } from "@/app/actions/signature-templates-actions"

// Component to preview signature with lazy loading
function SignaturePreview({ 
  signature, 
  signatureDataCache, 
  onSignatureDataLoaded,
  className = "h-6 max-w-20 object-contain"
}: { 
  signature: SignatureTemplate
  signatureDataCache: Record<string, string>
  onSignatureDataLoaded: (id: string, data: string) => void
  className?: string
}) {
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // If we already have the data or it's loading, don't fetch again
    if (signatureDataCache[signature.id] || isLoading) return

    // Load signature data on mount using API route
    const loadSignatureData = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/signature-templates/${signature.id}`)
        if (response.ok) {
          const result = await response.json()
          if (result.signature_data) {
            onSignatureDataLoaded(signature.id, result.signature_data)
          }
        } else {
          console.error('Failed to load signature data:', response.statusText)
        }
      } catch (error) {
        console.error('Error loading signature preview:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadSignatureData()
  }, [signature.id, signatureDataCache, onSignatureDataLoaded, isLoading])

  const signatureData = signatureDataCache[signature.id]

  if (isLoading || !signatureData) {
    return (
      <div className={`${className} bg-gray-100 rounded flex items-center justify-center`}>
        <Pen className="h-3 w-3 text-gray-400" />
      </div>
    )
  }

  return (
    <img
      src={signatureData}
      alt={signature.template_name}
      className={className}
    />
  )
}

interface SignatureSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (dataUrl: string, source: 'canvas' | 'wacom') => void
  customerId?: string
}

export default function SignatureSelectionModal({
  isOpen,
  onClose,
  onComplete,
  customerId
}: SignatureSelectionModalProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showSavedModal, setShowSavedModal] = useState(false)
  const [defaultSignature, setDefaultSignature] = useState<SignatureTemplate | null>(null)
  const [recentSignatures, setRecentSignatures] = useState<SignatureTemplate[]>([])
  const [signatureDataCache, setSignatureDataCache] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)

  // Load signatures when modal opens
  useEffect(() => {
    if (!isOpen) return

    const loadSignatures = async () => {
      setIsLoading(true)
      try {
        // Use API route instead of server actions to avoid HTTP 431 errors
        const response = await fetch('/api/signature-templates?includeDefault=true')
        if (response.ok) {
          const data = await response.json()
          
          // Set default signature if exists
          if (data.defaultTemplate) {
            setDefaultSignature(data.defaultTemplate)
            
            // Load signature data for default template
            if (data.defaultTemplate.id) {
              try {
                const signatureResponse = await fetch(`/api/signature-templates/${data.defaultTemplate.id}`)
                if (signatureResponse.ok) {
                  const signatureResult = await signatureResponse.json()
                  if (signatureResult.signature_data) {
                    setDefaultSignature(prev => prev ? { ...prev, signature_data: signatureResult.signature_data } : null)
                  }
                }
              } catch (error) {
                console.error('Error loading default signature data:', error)
              }
            }
          }
          
          // Set recent signatures (excluding default)
          const recent = (data.templates || []).slice(0, 3)
          setRecentSignatures(recent)
          
        } else {
          console.error('Failed to load signature templates:', response.statusText)
        }
      } catch (error) {
        console.error("Error loading signatures:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadSignatures()
  }, [isOpen])

  const handleCreateNew = () => {
    setShowCreateModal(true)
  }

  const handleBrowseAll = () => {
    setShowSavedModal(true)
  }

  const handleUseSignature = async (signature: SignatureTemplate) => {
    // If signature_data is already loaded, use it
    if (signature.signature_data) {
      onComplete(signature.signature_data, signature.signature_type as 'canvas' | 'wacom')
      return
    }

    // Otherwise, load it on demand using API route
    try {
      const response = await fetch(`/api/signature-templates/${signature.id}`)
      if (response.ok) {
        const result = await response.json()
        if (result.signature_data) {
          onComplete(result.signature_data, signature.signature_type as 'canvas' | 'wacom')
        } else {
          console.error('No signature data found')
        }
      } else {
        console.error('Failed to load signature data:', response.statusText)
      }
    } catch (error) {
      console.error('Error loading signature data:', error)
    }
  }

  const handleCreateComplete = (dataUrl: string, source: 'canvas' | 'wacom') => {
    setShowCreateModal(false)
    onComplete(dataUrl, source)
  }

  const handleSavedComplete = (signatureData: string, signatureType: 'template' | 'customer') => {
    setShowSavedModal(false)
    onComplete(signatureData, 'canvas')
  }

  if (!isOpen) return null

  return (
    <>
      {/* Main Selection Modal */}
      {!showCreateModal && !showSavedModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium">Añadir Firma</h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Default/Favorite Signature - Quick Access */}
              {defaultSignature && (
                <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-3">
                  <div className="flex items-center mb-2">
                    <div className="flex items-center">
                      <Star className="h-4 w-4 text-blue-600 fill-current" />
                      <span className="text-sm font-medium text-blue-800">Firma Predeterminada</span>
                    </div>
                  </div>
                  <div 
                    className="flex items-center space-x-3 cursor-pointer hover:bg-blue-100 rounded p-2 transition-colors"
                    onClick={() => handleUseSignature(defaultSignature)}
                  >
                    <div className="bg-white border border-blue-200 rounded p-2 flex-shrink-0">
                      <img
                        src={defaultSignature.signature_data}
                        alt={defaultSignature.template_name}
                        className="h-8 max-w-24 object-contain"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{defaultSignature.template_name}</p>
                      <p className="text-xs text-gray-500 capitalize">{defaultSignature.signature_type}</p>
                    </div>
                    <button className="px-3 py-1 bg-[#0d2340] text-white text-xs rounded hover:bg-[#1a3a5f] transition-colors">
                      Usar
                    </button>
                  </div>
                </div>
              )}

              {/* Recent Signatures - Quick Access */}
              {recentSignatures.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Firmas Recientes</h4>
                  <div className="space-y-2">
                    {recentSignatures.map((signature) => (
                      <div 
                        key={signature.id}
                        className="flex items-center space-x-3 p-2 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => handleUseSignature(signature)}
                      >
                        <div className="bg-gray-50 border border-gray-200 rounded p-1 flex-shrink-0">
                          <SignaturePreview 
                            signature={signature}
                            signatureDataCache={signatureDataCache}
                            onSignatureDataLoaded={(id, data) => {
                              setSignatureDataCache(prev => ({ ...prev, [id]: data }))
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 truncate">{signature.template_name}</p>
                          <p className="text-xs text-gray-500 capitalize">{signature.signature_type}</p>
                        </div>
                        <button className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 transition-colors">
                          Usar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                {/* Create New Signature - Primary Action */}
                <button
                  onClick={handleCreateNew}
                  className="w-full flex items-center justify-center space-x-2 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Pen className="h-4 w-4" />
                  <span>Crear Nueva Firma</span>
                </button>

                {/* Browse All Signatures - Secondary Action */}
                <button
                  onClick={handleBrowseAll}
                  className="w-full flex items-center justify-center space-x-2 p-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Ver Todas las Firmas</span>
                </button>
              </div>

              {/* Loading State */}
              {isLoading && (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-sm text-gray-600">Cargando firmas...</span>
                </div>
              )}

              {/* Empty State */}
              {!isLoading && !defaultSignature && recentSignatures.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500 mb-3">Aún no tienes firmas guardadas</p>
                  <p className="text-xs text-gray-400">Crea tu primera firma para ahorrar tiempo en el futuro</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create New Signature Modal */}
      <EnhancedSignatureModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onComplete={handleCreateComplete}
        customerId={customerId}
        showSaveOptions={true}
      />

      {/* Saved Signatures Manager */}
      <SavedSignaturesManager
        isOpen={showSavedModal}
        onClose={() => setShowSavedModal(false)}
        onSelectSignature={handleSavedComplete}
      />
    </>
  )
}
