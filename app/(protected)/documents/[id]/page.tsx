import { getRequestById } from "@/app/actions/document-actions"
import { ArrowLeft, Send, Check, Clock, RefreshCw, Eye, CheckCircle } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import ViewSignedDocumentButton from "@/components/view-signed-document-button"
import { createClient } from "@/utils/supabase/server"
import { BUCKET_PUBLIC } from "@/utils/supabase/storage"
import { DateFormatter, RelativeDateFormatter } from "@/components/ui/date-formatter"

// Función para obtener detalles del estado en español (igual que en la página principal)
function getStatusDetails(status: string) {
  switch (status?.toLowerCase()) {
    case 'sent':
      return {
        label: 'Enviado',
        icon: Send,
        bgColor: 'bg-blue-100',
        textColor: 'text-blue-800',
        progressWidth: '33%',
        description: 'Documento enviado al destinatario'
      }
    case 'signed':
      return {
        label: 'Documento Firmado',
        icon: CheckCircle,
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
        progressWidth: '100%',
        description: 'Documento firmado exitosamente',
        pulse: true
      }
    case 'returned':
      return {
        label: 'Documento Firmado',
        icon: CheckCircle,
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
        progressWidth: '100%',
        description: 'Documento firmado y devuelto',
        pulse: true
      }
    case 'pending':
      return {
        label: 'Pendiente',
        icon: Clock,
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-800',
        progressWidth: '10%',
        description: 'Esperando envío'
      }
    default:
      return {
        label: 'Desconocido',
        icon: Clock,
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-800',
        progressWidth: '0%',
        description: 'Estado no definido'
      }
  }
}

// Componente de barra de progreso
function DocumentProgressBar({ status }: { status: string }) {
  const statusDetails = getStatusDetails(status)
  
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>Progreso del documento</span>
        <span>{statusDetails.label}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div 
          className={`h-3 rounded-full transition-all duration-500 ${
            status === 'signed' || status === 'returned' 
              ? 'bg-green-500 progress-shine' 
              : status === 'sent' 
                ? 'bg-blue-500' 
                : 'bg-yellow-500'
          }`}
          style={{ width: statusDetails.progressWidth }}
        ></div>
      </div>
      <div className="text-xs text-gray-500 mt-1">{statusDetails.description}</div>
    </div>
  )
}

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  console.log("DocumentDetailPage: Starting with ID:", id)

  // Add null check and default value
  const result = await getRequestById(id)
  console.log("DocumentDetailPage: getRequestById result:", result)

  // Check if result is undefined or doesn't have a request property
  if (!result || result.error || !result.request) {
    console.error("DocumentDetailPage: Error or no request found:", result?.error || "No data returned")
    return notFound()
  }

  const request = result.request
  console.log("DocumentDetailPage: Request found:", request)

  // Add null checks for nested properties
  const customer = request.customer || {}
  const document = request.document || {}

  // Get Supabase client for getting document URL
  const supabase = await createClient()
  let documentUrl: string | undefined

  // Get document URL if document has a file path
  if (document?.file_path) {
    const { data } = supabase.storage.from(BUCKET_PUBLIC).getPublicUrl(document.file_path)
    documentUrl = data.publicUrl
  }

  // Get status details with null check
  const statusDetails = getStatusDetails(request.status)

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link href="/documents" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Volver a documentos
      </Link>

      <div className={`bg-white border rounded-lg shadow-sm overflow-hidden ${
        statusDetails.pulse ? 'signed-document-pulse signed-border-glow' : ''
      }`}>
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <h1 className="text-2xl font-bold text-gray-900">{request.title || "Documento sin título"}</h1>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusDetails.bgColor} ${statusDetails.textColor} ${
                statusDetails.pulse ? 'signed-text-glow font-bold' : ''
              }`}
            >
              <statusDetails.icon className="h-4 w-4 mr-1" />
              {statusDetails.label}
            </span>
          </div>

          {/* Barra de progreso */}
          <div className="mb-6">
            <DocumentProgressBar status={request.status} />
          </div>
          
          <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Destinatario</dt>
              <dd className="mt-1">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-gray-200">
                      <span className="text-xs font-medium leading-none text-gray-800">
                        {customer.first_name ? customer.first_name.charAt(0) : "?"}
                        {customer.last_name ? customer.last_name.charAt(0) : ""}
                      </span>
                    </span>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">
                      {customer.first_name && customer.last_name
                        ? `${customer.first_name} ${customer.last_name}`
                        : customer.email || "Destinatario desconocido"}
                    </p>
                    {customer.email && (customer.first_name || customer.last_name) && (
                      <p className="text-sm text-gray-500">{customer.email}</p>
                    )}
                  </div>
                </div>
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-gray-500">Documento</dt>
              <dd className="mt-1 flex items-center">
                <svg
                  className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-sm text-gray-900">{document?.file_name || "Documento desconocido"}</span>
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-gray-500">Enviado</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {request.sent_at ? (
                  <>
                    <DateFormatter date={request.sent_at} />
                    <span className="text-gray-500 ml-1">
                      (<RelativeDateFormatter date={request.sent_at} />)
                    </span>
                  </>
                ) : (
                  "Aún no enviado"
                )}
              </dd>
            </div>

            {request.received_at && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Recibido</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  <DateFormatter date={request.received_at} />
                  <span className="text-gray-500 ml-1">
                    (<RelativeDateFormatter date={request.received_at} />)
                  </span>
                </dd>
              </div>
            )}

            {request.signed_at && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Firmado</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  <div className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-1 signed-text-glow" />
                    <span className="font-semibold signed-text-glow">
                      <DateFormatter date={request.signed_at} />
                    </span>
                    <span className="text-gray-500 ml-1">
                      (<RelativeDateFormatter date={request.signed_at} />)
                    </span>
                  </div>
                </dd>
              </div>
            )}

            {request.returned_at && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Documento Firmado</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  <div className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-1 signed-text-glow" />
                    <span className="font-semibold signed-text-glow">
                      <DateFormatter date={request.returned_at} />
                    </span>
                    <span className="text-gray-500 ml-1">
                      (<RelativeDateFormatter date={request.returned_at} />)
                    </span>
                  </div>
                </dd>
              </div>
            )}
                    </dl>

          <div className="mt-6 border-t border-gray-200 pt-6">
            {customer && document && (
              <div className="mb-4">
                <ViewSignedDocumentButton 
                  requestId={request.id} 
                  documentId={document.id} 
                  recipientEmail={customer.email} 
                  status={request.status} 
                />
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-gray-200 pt-6 flex justify-between">
            <Link
              href="/documents"
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Volver a Documentos
            </Link>
            <Link
              href={`/documents/${request.id}/resend`}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reenviar Documento
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
