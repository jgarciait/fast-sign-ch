import { FileText, Loader2 } from "lucide-react"

export default function FastSignDocsLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F8F9FB" }}>
      <div className="text-center">
        <div className="relative mb-6">
          <FileText className="h-16 w-16 text-blue-500 mx-auto" />
          <Loader2 className="h-6 w-6 text-blue-600 animate-spin absolute -bottom-1 -right-1" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Cargando Documentos</h2>
        <p className="text-gray-600">Preparando tu gestión de documentos Fast Sign...</p>
        <div className="w-48 bg-gray-200 rounded-full h-2 mx-auto mt-4">
          <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
        </div>
      </div>
    </div>
  )
} 