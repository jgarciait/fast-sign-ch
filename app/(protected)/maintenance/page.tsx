"use client"

import { useState, useEffect } from "react"
import { AlertTriangle, CheckCircle, Clock, Wrench, Info, Bug, AlertCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"

interface BugReport {
  id: number
  title: string
  description: string
  severity: "high" | "medium" | "low"
  status: "identified" | "investigating" | "fixing" | "testing" | "completed" | "discarded"
  affectedFeatures: string[]
  estimatedFix?: string
}

const bugReports: BugReport[] = [
  {
    id: 1,
    title: "Detección incorrecta de dimensiones en documentos escaneados",
    description: "Identificada la causa: una librería de JavaScript calcula de forma incorrecta las dimensiones en documentos escaneados (tanto portrait como landscape). Esto provoca desalineación al guardar/posicionar firmas. Estamos trabajando en un ajuste definitivo.",
    severity: "high",
    status: "fixing",
    affectedFeatures: ["Firmar Documentos", "Guardar Firmas", "Documentos Escaneados"],
    estimatedFix: "Próximos días"
  },
  {
    id: 2,
    title: "Firmas en documentos horizontales (landscape)",
    description: "Corregido. El problema de colocación en documentos en orientación horizontal fue solucionado.",
    severity: "high",
    status: "completed",
    affectedFeatures: ["Firmar Documentos", "Orientación de Documentos", "Coordenadas de Firma"],
    estimatedFix: "—"
  },
  {
    id: 3,
    title: "Issues en documentos merge con páginas de diferentes dimensiones",
    description: "Descartado. El merge funciona correctamente; la causa real estaba en documentos escaneados y no en el proceso de merge.",
    severity: "low",
    status: "discarded",
    affectedFeatures: ["Merge PDF"],
    estimatedFix: "—"
  },
  {
    id: 4,
    title: "Mantener firma - funcionalidad",
    description: "Solucionado. La firma seleccionada se reutiliza de manera continua entre páginas hasta que el usuario la cambie o la limpie.",
    severity: "low",
    status: "completed",
    affectedFeatures: ["Firmas Guardadas", "Reutilización de Firmas"],
    estimatedFix: "—"
  }
]

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case "high":
      return "bg-red-100 text-red-800 border-red-200"
    case "medium":
      return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case "low":
      return "bg-blue-100 text-blue-800 border-blue-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "identified":
      return "bg-blue-100 text-blue-800"
    case "investigating":
      return "bg-yellow-100 text-yellow-800"
    case "fixing":
      return "bg-orange-100 text-orange-800"
    case "testing":
      return "bg-green-100 text-green-800"
    case "completed":
      return "bg-green-100 text-green-800"

      default:
      return "bg-gray-100 text-gray-800"
  }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case "identified":
      return <Bug className="h-4 w-4" />
    case "investigating":
      return <AlertTriangle className="h-4 w-4" />
    case "fixing":
      return <Wrench className="h-4 w-4" />
    case "testing":
      return <CheckCircle className="h-4 w-4" />
    case "completed":
      return <CheckCircle className="h-4 w-4" />
    default:
      return <Clock className="h-4 w-4" />
  }
}

const getStatusText = (status: string) => {
  switch (status) {
    case "identified":
      return "Identificado"
    case "investigating":
      return "Investigando"
    case "fixing":
      return "Corrigiendo"
    case "testing":
      return "Probando"
    case "completed":
      return "Corregido"
    default:
      return status
  }
}

export default function MaintenancePage() {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const highSeverityBugs = bugReports.filter(bug => bug.severity === "high")
  const totalBugs = bugReports.length
  const completedBugs = bugReports.filter((bug: BugReport) => bug.status === 'completed').length
  const discardedBugs = bugReports.filter((bug: BugReport) => bug.status === 'discarded').length
  const pendingBugs = bugReports.filter((bug: BugReport) => bug.status !== 'completed' && bug.status !== 'discarded').length

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <div className="flex items-center space-x-3 mb-2">
          <Wrench className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Mantenimiento del Sistema</h1>
        </div>
        <p className="text-gray-600">Estado actual de correcciones y mejoras en progreso</p>
        <p className="text-sm text-gray-500 mt-1">
          Última actualización: {currentTime.toLocaleString('es-ES')}
        </p>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <Bug className="h-5 w-5 mr-2 text-red-500" />
              Issues Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{pendingBugs}</div>
            <p className="text-sm text-gray-600 mt-1">
              {highSeverityBugs.length} de alta prioridad
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
              Completados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{completedBugs}</div>
            <p className="text-sm text-gray-600 mt-1">Soluciones desplegadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <Clock className="h-5 w-5 mr-2 text-gray-700" />
              Descartados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-700">{discardedBugs}</div>
            <p className="text-sm text-gray-600 mt-1">Issues descartados</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Alert */}
      <Alert className="mb-8 border-blue-200 bg-blue-50">
        <Info className="h-4 w-4" />
        <AlertTitle className="text-blue-900">Actualizaciones recientes</AlertTitle>
        <AlertDescription className="text-blue-800">
          • Se corrigió la colocación de firmas en documentos <strong>horizontales (landscape)</strong>.<br/>
          • Se identificó la causa del error de <strong>detección de dimensiones</strong> (afecta documentos escaneados); la causa está en una librería de JavaScript. <strong>Estaremos corrigiéndolo en los próximos días</strong>.<br/>
          • La funcionalidad <strong>“Mantener firma”</strong> fue solucionada y ahora reutiliza la última firma seleccionada.
        </AlertDescription>
      </Alert>

      {/* Progress Overview */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center">
            <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
            Progreso General de Correcciones
          </CardTitle>
          <CardDescription>
            Estado actual del proceso de corrección de bugs críticos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Problemas de Detección de Dimensiones (escaneados)</span>
                <span>45%</span>
              </div>
              <Progress value={45} className="h-2" />
              <p className="text-xs text-gray-600 mt-1">
                Causa encontrada en librería de JavaScript; aplicaremos fix estable en los próximos días
              </p>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Firmas en documentos horizontales (landscape)</span>
                <span>100%</span>
              </div>
              <Progress value={100} className="h-2" indicatorClassName="bg-green-600" />
              <p className="text-xs text-gray-600 mt-1">Corregido</p>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Mantener Firma - Funcionalidad</span>
                <span>100%</span>
              </div>
              <Progress value={100} className="h-2" indicatorClassName="bg-green-600" />
              <p className="text-xs text-gray-600 mt-1">
                Solucionado: la firma seleccionada se reutiliza hasta que el usuario la cambie o la limpie
              </p>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Navegación a expedientes desde documentos archivados</span>
                <span>100%</span>
              </div>
              <Progress value={100} className="h-2" indicatorClassName="bg-green-600" />
              <p className="text-xs text-gray-600 mt-1">
                Ahora el nombre del expediente es clickeable en la pestaña "Archivados en Expedientes"
              </p>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Flujo de envío por Email</span>
                <span>100%</span>
              </div>
              <Progress value={100} className="h-2" indicatorClassName="bg-green-600" />
              <p className="text-xs text-gray-600 mt-1">
                Selecciona el ícono verde de Email para mapear, luego usa el botón azul "Continuar" para enviar a firma
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bug Reports */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold mb-4">Reportes de Problemas Conocidos</h2>
        
        {[
          ...bugReports.filter((b: any) => (b.status as any) === 'completed'),
          ...bugReports.filter((b: any) => (b.status as any) !== 'completed')
        ].map((bug: any) => (
          <Card key={bug.id} className={`border-l-4 ${(bug.status as any) === 'completed' ? 'border-l-green-500' : (bug.status as any) === 'discarded' ? 'border-l-gray-400' : 'border-l-red-400'}`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center">
                    <AlertCircle className="h-5 w-5 mr-2 text-red-500" />
                    Bug #{bug.id}: {bug.title}
                  </CardTitle>
                  <CardDescription className="mt-2">
                    {bug.description}
                  </CardDescription>
                </div>
                <div className="flex flex-col items-end space-y-2 ml-4">
                  <Badge 
                    variant="outline" 
                    className={getSeverityColor(bug.severity)}
                  >
                    {bug.severity === "high" ? "Alta" : bug.severity === "medium" ? "Media" : "Baja"} Prioridad
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className={getStatusColor(bug.status)}
                  >
                    <span className="flex items-center">
                      {getStatusIcon(bug.status)}
                      <span className="ml-1">{getStatusText(bug.status)}</span>
                    </span>
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-2">Características Afectadas:</h4>
                  <div className="flex flex-wrap gap-2">
                    {bug.affectedFeatures.map((feature: string, index: number) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                {bug.estimatedFix && (
                  <div className="flex items-center text-sm">
                    <Clock className="h-4 w-4 mr-2 text-blue-500" />
                    <span className="text-gray-600">
                      Tiempo estimado de corrección: <span className="font-medium">{bug.estimatedFix}</span>
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Footer Information */}
      <Card className="mt-8 bg-gray-50 border-gray-200">
        <CardContent className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Información del Equipo de Desarrollo</h3>
          <div className="text-gray-700 space-y-2 text-sm">
            <p>
              <strong>Estado actual:</strong> El equipo está dedicando tiempo completo a la resolución de estos problemas críticos.
            </p>
            <p>
              <strong>Proceso:</strong> Cada corrección pasa por un proceso riguroso de testing antes del deployment.
            </p>
            <p>
              <strong>Comunicación:</strong> Esta página se actualiza regularmente con el progreso más reciente.
            </p>
            <p className="mt-4 p-3 bg-blue-50 border-l-4 border-blue-400 rounded">
              <strong>Nota:</strong> Agradecemos tu paciencia mientras trabajamos en estas mejoras importantes. 
              Si experimentas alguno de estos problemas, por favor documenta los pasos específicos para ayudarnos en el proceso de corrección.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
