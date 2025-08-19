"use client"

import React, { useState, useEffect } from "react"
import { X, Save, User, Users } from "lucide-react"
import SignaturePad from "./signature-pad"
// Using API routes instead of server actions to avoid HTTP 431 errors
// import { createSignatureTemplate, createCustomerSignature, getCustomers } from "@/app/actions/signature-templates-actions"
import type { Customer } from "@/app/actions/signature-templates-actions"
import { toast } from "sonner"
import { processWacomSignature } from "@/utils/wacom-signature-processor"

interface EnhancedSignatureModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (dataUrl: string, source: 'canvas' | 'wacom') => void
  customerId?: string // Optional: if signing for a specific customer
  showSaveOptions?: boolean // Whether to show save options (default: true)
}

export default function EnhancedSignatureModal({ 
  isOpen, 
  onClose, 
  onComplete,
  customerId,
  showSaveOptions = true 
}: EnhancedSignatureModalProps) {
  const [activeTab, setActiveTab] = useState<'canvas' | 'wacom'>('canvas')
  const [wacomSignature, setWacomSignature] = useState<string | null>(null)
  
  // Save options state
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveType, setSaveType] = useState<'template' | 'customer' | 'use'>('use')
  const [templateName, setTemplateName] = useState("")
  const [selectedCustomerId, setSelectedCustomerId] = useState(customerId || "")
  const [customerSignatureName, setCustomerSignatureName] = useState("")
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [currentSignatureData, setCurrentSignatureData] = useState<string>("")
  const [currentSignatureSource, setCurrentSignatureSource] = useState<'canvas' | 'wacom'>('canvas')

  // Load customers when modal opens
  useEffect(() => {
    if (!isOpen || !showSaveOptions) return

    const loadCustomers = async () => {
      setIsLoadingCustomers(true)
      try {
        // Use API route instead of server action to avoid HTTP 431 errors
        const response = await fetch('/api/customers')
        if (response.ok) {
          const data = await response.json()
          setCustomers(data.customers || [])
        } else {
          console.error("Error loading customers:", response.statusText)
        }
      } catch (error) {
        console.error("Error loading customers:", error)
      } finally {
        setIsLoadingCustomers(false)
      }
    }

    loadCustomers()
  }, [isOpen, showSaveOptions])

  // Process Wacom signature using the utility function
  const processWacomSignatureLocal = async (imageDataUrl: string): Promise<string> => {
    try {
      const result = await processWacomSignature(imageDataUrl, {
        maxWidth: 600,
        maxHeight: 300,
        minWidth: 200,
        minHeight: 100,
        transparencyThreshold: 240,
        quality: 0.95
      })
      
      console.log('Wacom signature processed successfully:', {
        originalDimensions: result.originalDimensions,
        finalDimensions: { width: result.width, height: result.height },
        aspectRatio: result.aspectRatio
      })
      
      return result.dataUrl
    } catch (error) {
      console.error('Failed to process Wacom signature:', error)
      return imageDataUrl // Return original if processing fails
    }
  }

  // Handle Wacom signature capture
  useEffect(() => {
    if (!isOpen || activeTab !== 'wacom') return

    const handleWacomMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'wacom-sign' && event.data?.imageSign) {
        console.log("Wacom signature received:", event.data.imageSign)
        
        // Process the signature to make background transparent
        const processedSignature = await processWacomSignatureLocal(event.data.imageSign)
        setWacomSignature(processedSignature)
      }
    }

    window.addEventListener("message", handleWacomMessage)

    return () => {
      window.removeEventListener("message", handleWacomMessage)
    }
  }, [isOpen, activeTab])

  const handleCanvasComplete = (dataUrl: string) => {
    if (dataUrl) {
      if (showSaveOptions) {
        // Show save dialog first
        setCurrentSignatureData(dataUrl)
        setCurrentSignatureSource('canvas')
        setShowSaveDialog(true)
      } else {
        // Apply signature directly
      onComplete(dataUrl, 'canvas')
      }
    } else {
      onClose()
    }
  }

  const handleWacomComplete = () => {
    if (wacomSignature) {
      if (showSaveOptions) {
        // Show save dialog first
        setCurrentSignatureData(wacomSignature)
        setCurrentSignatureSource('wacom')
        setShowSaveDialog(true)
        setWacomSignature(null)
      } else {
        // Apply signature directly
      onComplete(wacomSignature, 'wacom')
      setWacomSignature(null)
      }
    }
  }

  const handleWacomCancel = () => {
    setWacomSignature(null)
    onClose()
  }

  const handleClose = () => {
    setWacomSignature(null)
    setShowSaveDialog(false)
    setCurrentSignatureData("")
    setTemplateName("")
    setCustomerSignatureName("")
    setSelectedCustomerId(customerId || "")
    onClose()
  }

  const handleSaveAndApply = async () => {
    if (!currentSignatureData) return

    setIsSaving(true)
    
    try {
      // Save as personal template
      if (!templateName.trim()) {
        toast.error("Por favor ingresa un nombre para la plantilla")
        setIsSaving(false)
        return
      }

      // Use API route instead of server action
      const response = await fetch('/api/signature-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_name: templateName.trim(),
          signature_data: currentSignatureData,
          signature_type: currentSignatureSource,
          is_default: false // Not default by default
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        toast.error(`Error guardando la plantilla: ${errorData.error || 'Failed to save signature'}`)
        setIsSaving(false)
        return
      }

      const result = await response.json()

      toast.success(`Plantilla "${templateName}" guardada exitosamente!`)

      // Apply the signature
      onComplete(currentSignatureData, currentSignatureSource)
      
      // Reset state
      setShowSaveDialog(false)
      setCurrentSignatureData("")
      setTemplateName("")
      setCustomerSignatureName("")
      
    } catch (error) {
      console.error("Error saving signature:", error)
      toast.error("Error inesperado al guardar la firma")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSkipSaveAndApply = () => {
    // Apply signature without saving
    onComplete(currentSignatureData, currentSignatureSource)
    setShowSaveDialog(false)
    setCurrentSignatureData("")
  }

  if (!isOpen) return null

  // Save dialog
  if (showSaveDialog && showSaveOptions) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="text-lg font-medium">Guardar Firma</h3>
            <button
              onClick={() => setShowSaveDialog(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Signature Preview */}
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <p className="text-sm text-gray-600 mb-2">Vista previa de la firma:</p>
              <div className="bg-white border border-gray-200 rounded p-2 flex justify-center">
                <img 
                  src={currentSignatureData} 
                  alt="Firma" 
                  className="max-h-16 max-w-full"
                />
              </div>
            </div>

            {/* Save as Template Checkbox */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveType === 'template'}
                  onChange={(e) => setSaveType(e.target.checked ? 'template' : 'use')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    Guardar como plantilla personal
                  </span>
                  <p className="text-xs text-gray-600 mt-1">
                    Opcional: Guarda esta firma para reutilizarla rápidamente en el futuro
                  </p>
                </div>
              </label>
            </div>

            {/* Template Name Input - Only shown when checkbox is checked */}
            {saveType === 'template' && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <label htmlFor="templateName" className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de la plantilla *
                </label>
                <input
                  type="text"
                  id="templateName"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: Mi Firma Principal"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  Ingresa un nombre descriptivo para identificar esta firma
                </p>
              </div>
            )}


          </div>

          {/* Footer */}
          <div className="flex justify-end space-x-3 p-4 border-t border-gray-200">
            <button
              onClick={() => setShowSaveDialog(false)}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cancelar
            </button>
            
            {saveType === 'use' ? (
              <button
                onClick={handleSkipSaveAndApply}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center space-x-1"
              >
                <span>Usar Firma</span>
              </button>
            ) : (
              <button
                onClick={handleSaveAndApply}
                disabled={isSaving || (saveType === 'template' && !templateName.trim())}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
              >
                <Save className="h-4 w-4" />
                <span>{isSaving ? "Guardando..." : "Guardar y Usar"}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Main signature modal
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-full max-h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <h3 className="text-lg font-medium">Crear Tu Firma</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 flex-shrink-0">
          <button
            onClick={() => setActiveTab('canvas')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'canvas'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            Dibujar Firma
          </button>
          <button
            onClick={() => setActiveTab('wacom')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'wacom'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            Tableta de Firma Wacom
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'canvas' && (
            <div className="p-4 flex-1 overflow-auto">
              <SignaturePad onComplete={handleCanvasComplete} />
            </div>
          )}

          {activeTab === 'wacom' && (
            <div className="flex flex-col flex-1 overflow-hidden">
              {!wacomSignature ? (
                <>
                  {/* Iframe container with proper scrolling - uses available space */}
                  <div className="flex-1 overflow-auto">
                    <iframe
                      src="https://wacom.aqforms.com/"
                      title="Wacom STU"
                      className="w-full h-full border-0"
                      allow="hid"
                      style={{ height: '100%', minHeight: '600px' }}
                    />
                  </div>
                  <div className="flex justify-end space-x-3 p-4 border-t border-gray-200 flex-shrink-0">
                    <button
                      onClick={handleWacomCancel}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-4 p-4 overflow-auto flex-1">
                  <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                    <p className="text-sm text-green-600 mb-2">✓ Firma capturada exitosamente</p>
                    <div className="bg-white border border-gray-200 rounded p-2 inline-block">
                      <img 
                        src={wacomSignature} 
                        alt="Wacom Signature" 
                        className="max-w-full h-auto"
                        style={{ maxHeight: '150px' }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => setWacomSignature(null)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      Reintentar
                    </button>
                    <button
                      onClick={handleWacomComplete}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/80 focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      Aplicar Firma
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
