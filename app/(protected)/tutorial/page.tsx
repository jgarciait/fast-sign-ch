import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  FileText, 
  Upload, 
  Edit3, 
  Send, 
  Users, 
  CheckCircle,
  ArrowRight,
  Info,
  Lightbulb,
  Settings,
  FolderOpen
} from "lucide-react"

export default function TutorialPage() {
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Lightbulb className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Tutorial de AQSign</h1>
        </div>
        <p className="text-lg text-gray-600">
          Aprende a usar todas las funcionalidades de la plataforma de firma digital
        </p>
      </div>

      <div className="space-y-8">
        {/* Fast Sign Section */}
        <Card className="border-2 border-blue-200">
          <CardHeader className="bg-blue-50">
            <div className="flex items-center gap-3">
              <Edit3 className="h-6 w-6 text-blue-600" />
              <div>
                <CardTitle className="text-xl text-blue-900">Fast Sign - Firma Rápida</CardTitle>
                <CardDescription className="text-blue-700">
                  Firma documentos de manera rápida y sencilla sin configuraciones complejas
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <span className="bg-blue-100 text-blue-800 w-6 h-6 rounded-full text-sm font-bold flex items-center justify-center">1</span>
                  Subir Documento
                </h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <Upload className="h-4 w-4 text-green-600 mt-1 flex-shrink-0" />
                    <span>Arrastra tu archivo PDF o haz clic para navegarlo</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-1 flex-shrink-0" />
                    <span>El documento se guarda automáticamente para evitar pérdida de datos</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-600 mt-1 flex-shrink-0" />
                    <span>Admite archivos PDF de hasta 50MB</span>
                  </li>
                </ul>

                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 pt-4">
                  <span className="bg-blue-100 text-blue-800 w-6 h-6 rounded-full text-sm font-bold flex items-center justify-center">2</span>
                  Agregar Firmas
                </h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <Edit3 className="h-4 w-4 text-purple-600 mt-1 flex-shrink-0" />
                    <span>Haz clic en cualquier parte del documento para agregar una firma</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Settings className="h-4 w-4 text-purple-600 mt-1 flex-shrink-0" />
                    <span>Redimensiona y mueve las firmas según necesites</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-1 flex-shrink-0" />
                    <span>Las firmas se guardan automáticamente cada segundo</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-center text-gray-500 py-12">
                  <Upload className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium">Fast Sign</p>
                  <p className="text-sm">Arrastra tu PDF aquí para comenzar</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Document Management Section */}
        <Card className="border-2 border-green-200">
          <CardHeader className="bg-green-50">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-green-600" />
              <div>
                <CardTitle className="text-xl text-green-900">Gestión de Documentos</CardTitle>
                <CardDescription className="text-green-700">
                  Administra todos tus documentos Fast Sign desde un solo lugar
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Panel de Control</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-blue-600 mt-1 flex-shrink-0" />
                    <span>Ve todos tus documentos en pestañas "Activos" y "Archivados"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Users className="h-4 w-4 text-purple-600 mt-1 flex-shrink-0" />
                    <span>Toggle "Mostrando solo mis documentos" para filtrar</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Upload className="h-4 w-4 text-blue-600 mt-1 flex-shrink-0" />
                    <span>Botón "Volver a Subir" para crear nuevos documentos</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-center text-gray-500 py-8">
                  <FileText className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium">Panel de Gestión</p>
                  <div className="mt-4 space-y-2">
                    <Badge variant="default">Activos (0)</Badge>
                    <Badge variant="secondary">Archivados (0)</Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Send to Sign Section */}
        <Card className="border-2 border-purple-200">
          <CardHeader className="bg-purple-50">
            <div className="flex items-center gap-3">
              <Send className="h-6 w-6 text-purple-600" />
              <div>
                <CardTitle className="text-xl text-purple-900">Enviar para Firmar</CardTitle>
                <CardDescription className="text-purple-700">
                  Proceso de 5 pasos para enviar documentos a firmar
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex justify-center gap-4 mb-8">
              {[
                { num: "1", label: "Fuente" },
                { num: "2", label: "Firmas" },
                { num: "3", label: "Email" },
                { num: "4", label: "Destinatario" },
                { num: "5", label: "Enviar" }
              ].map((step, index) => (
                <div key={step.num} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                      {step.num}
                    </div>
                    <p className="text-sm font-medium mt-2">{step.label}</p>
                  </div>
                  {index < 4 && <ArrowRight className="h-4 w-4 text-gray-400 mx-2" />}
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="border-2 border-blue-500 bg-blue-50 rounded-lg p-4 text-center">
                <Upload className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <p className="font-medium">Subir Documento</p>
                <p className="text-sm text-gray-600">Sube un archivo PDF para crear mapeo de firmas</p>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="font-medium">Documento Existente</p>
                <p className="text-sm text-gray-600">Selecciona de documentos previamente subidos</p>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <Settings className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="font-medium">Plantilla</p>
                <p className="text-sm text-gray-600">Usa una plantilla preconfigurada</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Signature Mapping Section */}
        <Card className="border-2 border-orange-200">
          <CardHeader className="bg-orange-50">
            <div className="flex items-center gap-3">
              <Settings className="h-6 w-6 text-orange-600" />
              <div>
                <CardTitle className="text-xl text-orange-900">Mapeo de Firmas</CardTitle>
                <CardDescription className="text-orange-700">
                  Configura dónde deben firmar los destinatarios
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Pasos del Mapeo</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <Edit3 className="h-4 w-4 text-blue-600 mt-1 flex-shrink-0" />
                    <span>Haz clic en "Add Field" para agregar campos de firma</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Settings className="h-4 w-4 text-gray-600 mt-1 flex-shrink-0" />
                    <span>Coloca y redimensiona los campos donde se debe firmar</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-1 flex-shrink-0" />
                    <span>Haz clic en "Save Mapping" para guardar</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-center text-gray-500 py-8">
                  <Settings className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium">Editor de Mapeo</p>
                  <div className="flex justify-center gap-2 mt-4">
                    <Badge variant="default" className="text-xs">Add Field</Badge>
                    <Badge variant="outline" className="text-xs">Save Mapping</Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Best Practices */}
        <Card className="border-2 border-yellow-200">
          <CardHeader className="bg-yellow-50">
            <div className="flex items-center gap-3">
              <Lightbulb className="h-6 w-6 text-yellow-600" />
              <div>
                <CardTitle className="text-xl text-yellow-900">Mejores Prácticas</CardTitle>
                <CardDescription className="text-yellow-700">
                  Consejos para usar AQSign eficientemente
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Organización</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <FolderOpen className="h-4 w-4 text-blue-600 mt-1 flex-shrink-0" />
                    <span>Vincula documentos a expedientes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Users className="h-4 w-4 text-purple-600 mt-1 flex-shrink-0" />
                    <span>Mantén actualizada tu lista de contactos</span>
                  </li>
                </ul>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Eficiencia</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-1 flex-shrink-0" />
                    <span>Aprovecha el guardado automático</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Settings className="h-4 w-4 text-orange-600 mt-1 flex-shrink-0" />
                    <span>Crea plantillas reutilizables</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
