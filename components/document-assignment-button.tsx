"use client"

import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Truck, UserPlus } from "lucide-react"
import AssignmentModal from "./assignment-modal"

interface DocumentAssignmentButtonProps {
  documentId: string
  documentName?: string
  disabled?: boolean
  variant?: 'dropdown' | 'button'
  className?: string
  onAssignmentCreated?: (assignmentId: string) => void
}

export default function DocumentAssignmentButton({
  documentId,
  documentName,
  disabled = false,
  variant = 'dropdown',
  className = "",
  onAssignmentCreated
}: DocumentAssignmentButtonProps) {
  const [showModal, setShowModal] = useState(false)

  const handleAssignmentSuccess = (assignmentId: string) => {
    setShowModal(false)
    onAssignmentCreated?.(assignmentId)
  }

  if (variant === 'dropdown') {
    return (
      <>
        <DropdownMenuItem 
          onClick={() => setShowModal(true)}
          disabled={disabled}
          className="text-green-600 hover:text-green-700 hover:bg-green-50"
        >
          <Truck className="h-4 w-4 mr-2" />
          Asignar a Chofer
        </DropdownMenuItem>

        <AssignmentModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          documentId={documentId}
          documentName={documentName}
          onAssignmentCreated={handleAssignmentSuccess}
        />
      </>
    )
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowModal(true)}
        disabled={disabled}
        className={className || "text-orange-600 hover:text-white hover:bg-orange-600 transition-colors"}
      >
        <Truck className="h-3 w-3" />
        <span className="text-xs leading-none">Asignar</span>
      </Button>

      <AssignmentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        documentId={documentId}
        documentName={documentName}
        onAssignmentCreated={handleAssignmentSuccess}
      />
    </>
  )
}

// Export a specific dropdown version for easy use
export function AssignDocumentDropdownItem({ 
  documentId, 
  documentName, 
  disabled,
  onAssignmentCreated 
}: Omit<DocumentAssignmentButtonProps, 'variant'>) {
  return (
    <DocumentAssignmentButton
      documentId={documentId}
      documentName={documentName}
      disabled={disabled}
      variant="dropdown"
      onAssignmentCreated={onAssignmentCreated}
    />
  )
}

// Export a specific button version for easy use
export function AssignDocumentButton({ 
  documentId, 
  documentName, 
  disabled,
  className,
  onAssignmentCreated 
}: Omit<DocumentAssignmentButtonProps, 'variant'>) {
  return (
    <DocumentAssignmentButton
      documentId={documentId}
      documentName={documentName}
      disabled={disabled}
      variant="button"
      className={className}
      onAssignmentCreated={onAssignmentCreated}
    />
  )
}
