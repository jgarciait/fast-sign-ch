import { Logo } from "@/components/logo"

export default function SignCompletePage() {
  const currentTime = new Date().toLocaleString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-lg w-full p-8 bg-white rounded-lg shadow-lg text-center">
        <div className="mb-6">
          <Logo className="h-16 w-16 mx-auto mb-4" color="#0d2340" />
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">¡Documento Firmado Exitosamente!</h1>
          <p className="text-gray-600 text-lg">
            Su documento ha sido firmado y enviado correctamente. 
            El proceso de firma se ha completado.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-center mb-2">
            <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="font-semibold text-blue-900">Estado del Documento</h3>
          </div>
          <p className="text-sm text-blue-800">
            <strong>Estado:</strong> Firmado<br />
            <strong>Fecha de firma:</strong> {currentTime}<br />
            <strong>Firmas aplicadas:</strong> Todas las firmas requeridas han sido completadas
          </p>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-700">
            <strong>¿Qué sigue ahora?</strong><br />
            • El propietario del documento será notificado automáticamente<br />
            • El documento ha cambiado su estado a "signed" en el sistema<br />
            • Las firmas han sido guardadas de forma segura en la base de datos<br />
            • Puede cerrar esta ventana con seguridad
          </p>
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center justify-center mb-2">
            <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="text-sm font-medium text-gray-700">Proceso de firma completado de forma segura</span>
          </div>
          <p className="text-xs text-gray-500">
            Gracias por usar AQSign para sus necesidades de firma de documentos.
          </p>
        </div>
      </div>
    </div>
  )
}
