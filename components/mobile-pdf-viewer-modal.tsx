"use client"

import React from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { VisuallyHidden } from "@/components/ui/visually-hidden"
import { X } from "lucide-react"

interface MobilePDFViewerModalProps {
  isOpen: boolean
  onClose: () => void
  documentUrl?: string
  documentName?: string
}

export default function MobilePDFViewerModal({ 
  isOpen, 
  onClose, 
  documentUrl, 
  documentName 
}: MobilePDFViewerModalProps) {
  if (!documentUrl) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-full max-h-full h-screen w-screen p-0 gap-0" hideCloseButton>
        <VisuallyHidden>
          <DialogTitle>
            Visor de PDF: {documentName || "Documento"}
          </DialogTitle>
        </VisuallyHidden>
        <div className="relative flex flex-col h-full bg-white">
          {/* Header with close button only */}
          <div className="absolute top-4 right-4 z-50">
            <Button
              onClick={onClose}
              variant="secondary"
              size="icon"
              className="h-10 w-10 rounded-full bg-white shadow-lg border hover:bg-gray-50"
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Cerrar</span>
            </Button>
          </div>

          {/* PDF Viewer - Full screen */}
          <div className="flex-1 w-full h-full relative">
            <iframe
              src={documentUrl}
              title={documentName || "Documento"}
              className="absolute inset-0 w-full h-full border-0"
              style={{ 
                minHeight: '100vh',
                minWidth: '100vw',
                background: '#525659'
              }}
              onError={(e) => {
                console.error('Error loading PDF in iframe:', e)
                console.error('PDF URL:', documentUrl)
              }}
              onLoad={(e) => {
                console.log('PDF loaded successfully in iframe')
                console.log('PDF URL:', documentUrl)
                console.log('Iframe element:', e.target)
              }}
              sandbox="allow-scripts allow-same-origin allow-forms"
              loading="eager"
            />
            
            {/* Debug overlay - remove this after testing */}
            <div className="absolute top-16 left-4 bg-black bg-opacity-75 text-white p-2 rounded text-xs max-w-xs break-all z-40">
              <div>URL: {documentUrl}</div>
              <div>Name: {documentName}</div>
            </div>
            
            {/* Alternative: Direct link button */}
            <div className="absolute bottom-4 right-4 z-40">
              <Button
                onClick={() => window.open(documentUrl, '_blank')}
                variant="secondary"
                size="sm"
                className="bg-white shadow-lg border hover:bg-gray-50"
              >
                Abrir en Nueva Pestaña
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
