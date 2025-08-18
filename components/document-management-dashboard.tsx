"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { 
  FileText, 
  Map, 
  Layout, 
  PenTool, 
  Trash2, 
  Eye, 
  Users, 
  AlertTriangle,
  Link2,
  FileX
} from "lucide-react"

interface DocumentWithState {
  id: string
  file_name: string
  file_path: string
  created_at: string
  created_by: string
  creator: {
    full_name: string
    email: string
  }
  state: 'simple' | 'mapped' | 'templated' | 'signed'
  mappings?: any[]
  templates?: any[]
  signatures?: any[]
  signingRequests?: any[]
}

interface DocumentCategories {
  simple: DocumentWithState[]
  mapped: DocumentWithState[]
  templated: DocumentWithState[]
  signed: DocumentWithState[]
}

export default function DocumentManagementDashboard() {
  const [documents, setDocuments] = useState<DocumentCategories>({
    simple: [],
    mapped: [],
    templated: [],
    signed: []
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const loadDocuments = async () => {
    try {
      setLoading(true)
      
      // Load all documents first to get the base data
      const docsResponse = await fetch('/api/documents')
      if (!docsResponse.ok) {
        throw new Error('Error loading documents')
      }
      const docsData = await docsResponse.json()
      const allDocuments = docsData.documents || []

      // For now, let's make a simplified version that determines state based on what we can fetch
      // We'll need to create additional API endpoints for mappings and signatures later
      
      // Create basic categorization
      const categorized: DocumentCategories = {
        simple: [],
        mapped: [],
        templated: [],
        signed: []
      }

      // For now, just categorize as simple documents
      // This will be enhanced once we have the proper API endpoints
      allDocuments.forEach((doc: any) => {
        const docWithState: DocumentWithState = {
          ...doc,
          state: 'simple',
          mappings: [],
          templates: [],
          signatures: [],
          signingRequests: []
        }
        categorized.simple.push(docWithState)
      })

      setDocuments(categorized)
      setError(null)
    } catch (err) {
      console.error('Error loading documents:', err)
      setError(err instanceof Error ? err.message : 'Error loading documents')
    } finally {
      setLoading(false)
    }
  }

  const deleteDocument = async (documentId: string, documentName: string) => {
    try {
      const response = await fetch(`/api/documents?documentId=${documentId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error deleting document')
      }

      await loadDocuments()
      toast({
        title: "Documento eliminado",
        description: `"${documentName}" ha sido eliminado exitosamente.`,
      })
    } catch (error) {
      console.error('Error deleting document:', error)
      toast({
        title: "Error al eliminar documento",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      })
    }
  }

  const removeTemplate = async (templateId: string, templateName: string) => {
    try {
      const response = await fetch(`/api/signature-mapping-templates/${templateId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error removing template')
      }

      await loadDocuments()
      toast({
        title: "Plantilla eliminada",
        description: `"${templateName}" ha sido eliminada exitosamente.`,
      })
    } catch (error) {
      console.error('Error removing template:', error)
      toast({
        title: "Error al eliminar plantilla",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    loadDocuments()
  }, [])

  const getStateIcon = (state: DocumentWithState['state']) => {
    switch (state) {
      case 'simple':
        return <FileText className="h-4 w-4" />
      case 'mapped':
        return <Map className="h-4 w-4" />
      case 'templated':
        return <Layout className="h-4 w-4" />
      case 'signed':
        return <PenTool className="h-4 w-4" />
    }
  }

  const getStateBadge = (state: DocumentWithState['state']) => {
    switch (state) {
      case 'simple':
        return <Badge variant="secondary">Documento Simple</Badge>
      case 'mapped':
        return <Badge variant="outline">Con Mapeo</Badge>
      case 'templated':
        return <Badge variant="default">Con Plantilla</Badge>
      case 'signed':
        return <Badge variant="destructive">Con Firmas</Badge>
    }
  }

  const canDeleteDocument = (doc: DocumentWithState) => {
    return doc.state === 'simple' || doc.state === 'mapped'
  }

  const getDeleteWarning = (doc: DocumentWithState) => {
    if (doc.state === 'templated') {
      return `Este documento tiene ${doc.templates?.length || 0} plantilla(s) asociada(s). Elimina primero las plantillas.`
    }
    if (doc.state === 'signed') {
      return `Este documento tiene ${doc.signatures?.length || 0} firma(s) asociada(s). No se puede eliminar.`
    }
    if (doc.state === 'mapped') {
      return `Este documento tiene mapeo de firmas. ¿Estás seguro de que quieres eliminarlo?`
    }
    return `¿Estás seguro de que quieres eliminar "${doc.file_name}"?`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
        Error: {error}
      </div>
    )
  }

  const totalDocs = Object.values(documents).reduce((sum, docs) => sum + docs.length, 0)

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documentos Simples</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{documents.simple.length}</div>
            <p className="text-xs text-muted-foreground">Sin mapeo ni firmas</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con Mapeo</CardTitle>
            <Map className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{documents.mapped.length}</div>
            <p className="text-xs text-muted-foreground">Mapeados pero sin plantilla</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con Plantillas</CardTitle>
            <Layout className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{documents.templated.length}</div>
            <p className="text-xs text-muted-foreground">Usados como plantillas</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con Firmas</CardTitle>
            <PenTool className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{documents.signed.length}</div>
            <p className="text-xs text-muted-foreground">Documentos firmados</p>
          </CardContent>
        </Card>
      </div>

      {/* Document Categories */}
      <Tabs defaultValue="simple" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="simple">
            <FileText className="h-4 w-4 mr-2" />
            Simples ({documents.simple.length})
          </TabsTrigger>
          <TabsTrigger value="mapped">
            <Map className="h-4 w-4 mr-2" />
            Con Mapeo ({documents.mapped.length})
          </TabsTrigger>
          <TabsTrigger value="templated">
            <Layout className="h-4 w-4 mr-2" />
            Con Plantillas ({documents.templated.length})
          </TabsTrigger>
          <TabsTrigger value="signed">
            <PenTool className="h-4 w-4 mr-2" />
            Con Firmas ({documents.signed.length})
          </TabsTrigger>
        </TabsList>

        {Object.entries(documents).map(([category, docs]) => (
          <TabsContent key={category} value={category} className="space-y-4">
            {docs.length === 0 ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <FileX className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      No hay documentos en esta categoría
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              docs.map((doc: DocumentWithState) => (
                <Card key={doc.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {getStateIcon(doc.state)}
                          <h3 className="font-semibold text-lg">{doc.file_name}</h3>
                          {getStateBadge(doc.state)}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                          <div>
                            <p><strong>Creado por:</strong> {doc.creator.full_name}</p>
                            <p><strong>Fecha:</strong> {new Date(doc.created_at).toLocaleDateString('es-ES')}</p>
                          </div>
                          
                          <div>
                            {doc.mappings && doc.mappings.length > 0 && (
                              <p><strong>Mapeos:</strong> {doc.mappings.length}</p>
                            )}
                            {doc.templates && doc.templates.length > 0 && (
                              <p><strong>Plantillas:</strong> {doc.templates.length}</p>
                            )}
                            {doc.signatures && doc.signatures.length > 0 && (
                              <p><strong>Firmas:</strong> {doc.signatures.length}</p>
                            )}
                            {doc.signingRequests && doc.signingRequests.length > 0 && (
                              <p><strong>Solicitudes:</strong> {doc.signingRequests.length}</p>
                            )}
                          </div>
                        </div>

                        {/* Template Management for Templated Documents */}
                        {doc.state === 'templated' && doc.templates && doc.templates.length > 0 && (
                          <div className="mt-4 p-3 bg-blue-50 rounded-md">
                            <h4 className="font-medium text-sm text-blue-900 mb-2">Plantillas Asociadas:</h4>
                            <div className="space-y-2">
                              {doc.templates.map((template: any) => (
                                <div key={template.id} className="flex items-center justify-between text-sm">
                                  <span className="text-blue-800">{template.name}</span>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-900">
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Eliminar Plantilla</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          ¿Estás seguro de que quieres eliminar la plantilla "{template.name}"? Esta acción no se puede deshacer.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => removeTemplate(template.id, template.name)}
                                          className="bg-red-600 hover:bg-red-700"
                                        >
                                          Eliminar
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-2" />
                          Ver
                        </Button>
                        
                        {canDeleteDocument(doc) ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-900">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Eliminar Documento</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {getDeleteWarning(doc)}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteDocument(doc.id, doc.file_name)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <div className="flex items-center gap-2 text-yellow-600 text-xs">
                            <AlertTriangle className="h-3 w-3" />
                            <span>No se puede eliminar</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Info Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Información sobre Estados de Documentos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Estados de Documentos:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• <strong>Simples:</strong> Documentos subidos sin mapeo ni firmas</li>
                <li>• <strong>Con Mapeo:</strong> Documentos con campos de firma mapeados</li>
                <li>• <strong>Con Plantillas:</strong> Documentos usados como plantillas reutilizables</li>
                <li>• <strong>Con Firmas:</strong> Documentos que han sido firmados</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Reglas de Eliminación:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Los documentos simples se pueden eliminar libremente</li>
                <li>• Los documentos con mapeo requieren confirmación</li>
                <li>• Los documentos con plantillas requieren eliminar las plantillas primero</li>
                <li>• Los documentos con firmas no se pueden eliminar</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 