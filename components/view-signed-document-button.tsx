"use client"

import { Eye } from "lucide-react"
import Link from "next/link"

interface ViewSignedDocumentButtonProps {
  requestId: string
  documentId: string
  recipientEmail: string
  status: string
  className?: string
}

export default function ViewSignedDocumentButton({
  requestId,
  documentId,
  recipientEmail,
  status,
  className = "",
}: ViewSignedDocumentButtonProps) {
  // Solo mostrar para documentos firmados o devueltos
  const canViewSigned = status === "signed" || status === "returned"

  if (!canViewSigned) {
    return null
  }

  // Crear token para ver el documento firmado (email codificado en base64)
  const viewToken = Buffer.from(recipientEmail).toString("base64")

  // Agregar animación de pulso para documentos firmados
  const pulseAnimation = status === "signed" || status === "returned" 
    ? "signed-document-pulse signed-border-glow px-3 py-1 rounded-full" 
    : ""

  return (
    <Link
      href={`/view-signed/${documentId}?token=${viewToken}&requestId=${requestId}`}
      className={`inline-flex items-center text-sm font-bold signed-text-glow hover:text-green-800 transition-all duration-300 ${pulseAnimation} ${className}`}
      title="Ver documento con firmas"
    >
      <Eye className="h-4 w-4 mr-1" />
      <span className="font-bold">Ver Documento Firmado</span>
    </Link>
  )
}
