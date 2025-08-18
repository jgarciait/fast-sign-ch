"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2, X } from "lucide-react"
import { deleteDocument } from "@/app/actions/document-actions"

export default function DeleteDocumentButton({ 
  requestId, 
  title, 
  onDeleted 
}: { 
  requestId: string; 
  title: string; 
  onDeleted?: () => void 
}) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    setIsDeleting(true)
    setError(null)
    setShowConfirmModal(false)

    try {
      const result = await deleteDocument(requestId)

      if (result.error) {
        setError(result.error)
      } else {
        // Call the callback if provided, otherwise fallback to router.refresh()
        if (onDeleted) {
          onDeleted()
        } else {
          router.refresh()
        }
      }
    } catch (err) {
      setError("Ocurrió un error inesperado")
      console.error("Error deleting document:", err)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div>
      <button
        onClick={() => setShowConfirmModal(true)}
        disabled={isDeleting}
        className="inline-flex items-center text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
        title="Eliminar documento"
      >
        {isDeleting ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4 text-red-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Eliminando...
          </>
        ) : (
          <>
            <Trash2 className="h-4 w-4 mr-1" />
            Eliminar
          </>
        )}
      </button>
      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Confirmar Eliminación</h3>
              <button onClick={() => setShowConfirmModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que quieres eliminar "{title}"? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
