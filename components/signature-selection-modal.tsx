"use client"

import React, { useState, useEffect } from "react"
import { X, Plus, Star, Pen } from "lucide-react"
import SavedSignaturesManager from "./saved-signatures-manager"
import EnhancedSignatureModal from "./enhanced-signature-modal"
import { getSignatureTemplates, getDefaultSignatureTemplate } from "@/app/actions/signature-templates-actions"
import type { SignatureTemplate } from "@/app/actions/signature-templates-actions"

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
  const [isLoading, setIsLoading] = useState(false)

  // Load signatures when modal opens
  useEffect(() => {
    if (!isOpen) return

    const loadSignatures = async () => {
      setIsLoading(true)
      try {
        // Load default signature
        const defaultResult = await getDefaultSignatureTemplate()
        if (!defaultResult.error && defaultResult.template) {
          setDefaultSignature(defaultResult.template)
        }

        // Load recent signatures (up to 3 most recent)
        const templatesResult = await getSignatureTemplates()
        if (!templatesResult.error) {
          const recent = templatesResult.templates
            .filter(t => !t.is_default) // Exclude default from recent list
            .slice(0, 3)
          setRecentSignatures(recent)
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

  const handleUseSignature = (signature: SignatureTemplate) => {
    onComplete(signature.signature_data, signature.signature_type as 'canvas' | 'wacom')
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
                          <img
                            src={signature.signature_data}
                            alt={signature.template_name}
                            className="h-6 max-w-20 object-contain"
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
