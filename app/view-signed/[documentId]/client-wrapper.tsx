"use client"

import PdfAnnotationEditor from "@/components/pdf-annotation-editor"
import { useToast } from "@/hooks/use-toast"

interface ClientWrapperProps {
  documentUrl: string
  documentName: string
  documentId: string
  annotations: any[]
  token: string
}

export default function ClientWrapper({
  documentUrl,
  documentName,
  documentId,
  annotations,
  token,
}: ClientWrapperProps) {
  const { toast } = useToast()

  const handleBack = () => {
    window.history.back()
  }

  const handleSave = async (newAnnotations: any[]) => {
    try {
      console.log("Saving annotations in view-signed mode:", {
        documentId,
        token: token ? "present" : "missing",
        annotationCount: newAnnotations.length
      })

      // Separate signatures from text annotations  
      const signatures = newAnnotations.filter(ann => ann.type === 'signature')
      const textAnnotations = newAnnotations.filter(ann => ann.type !== 'signature')

      console.log("Separated annotations:", {
        signatures: signatures.length,
        textAnnotations: textAnnotations.length
      })

      // Save signatures to document_signatures table
      for (const signature of signatures) {
        // Calculate relative width and height based on page dimensions
        // Default page dimensions for US Letter size (612x792 points)
        const defaultPageWidth = 612
        const defaultPageHeight = 792
        
        // Calculate relative dimensions if not already present
        const relativeWidth = signature.relativeWidth || (signature.width / defaultPageWidth)
        const relativeHeight = signature.relativeHeight || (signature.height / defaultPageHeight)
        
        const signatureResponse = await fetch(`/api/documents/${documentId}/signature`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            signatureDataUrl: signature.imageData,
            signatureSource: signature.signatureSource || 'canvas',
            token: token,
            position: {
              x: signature.x,
              y: signature.y,
              width: signature.width,
              height: signature.height,
              page: signature.page,
              relativeX: signature.relativeX,
              relativeY: signature.relativeY,
              relativeWidth: relativeWidth,
              relativeHeight: relativeHeight
            }
          }),
        })

        if (!signatureResponse.ok) {
          const errorText = await signatureResponse.text()
          console.error("Failed to save signature:", errorText)
          throw new Error(`Failed to save signature: ${errorText}`)
        }
      }

      // Save text annotations to document_annotations table
      if (textAnnotations.length > 0) {
        const annotationResponse = await fetch(`/api/annotations/${documentId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            annotations: textAnnotations,
            token: token
          }),
        })

        if (!annotationResponse.ok) {
          const errorText = await annotationResponse.text()
          console.error("Failed to save text annotations:", errorText)
          throw new Error(`Failed to save text annotations: ${errorText}`)
        }
      }

      toast({
        title: "Cambios guardados",
        description: "Las anotaciones y firmas se han guardado correctamente.",
      })

      console.log("Successfully saved all annotations")
      
    } catch (error) {
      console.error("Error saving annotations:", error)
      toast({
        title: "Error al guardar",
        description: error instanceof Error ? error.message : "No se pudieron guardar los cambios. Inténtalo de nuevo.",
        variant: "destructive"
      })
      throw error
    }
  }

  return (
    <div className="h-full">
      <PdfAnnotationEditor
        documentUrl={documentUrl}
        documentName={documentName}
        documentId={documentId}
        onBack={handleBack}
        onSave={handleSave}
        initialAnnotations={annotations}
        token={token}
        readOnly={false}
      />
    </div>
  )
}
