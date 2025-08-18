"use client"

import { useState, useEffect } from "react"
import { Plus } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import IntegrationCard from "@/components/integration-card"
import RateLimitConfig from "@/components/rate-limit-config"
import AddIntegrationModal from "@/components/add-integration-modal"
import { getIntegrationSettings, type IntegrationSettings } from "@/app/actions/integration-actions"
import InviteUserForm from "@/components/invite-user-form"
import UserList from "@/components/user-list"
import FilingSystemManager from "@/components/filing-system-manager"
import EmbeddedSignaturesManager from "@/components/embedded-signatures-manager"
import SignatureMappingTemplatesManager from "@/components/signature-mapping-templates-manager"

interface IntegrationData {
  id: string
  integration_name: string
  display_name: string
  is_enabled: boolean
  is_configured: boolean
  is_global?: boolean
  is_owner?: boolean
  created_at: string
  updated_at: string
  masked_settings: any
  settings?: any  // For backward compatibility
}

export default function Settings() {
  const [integrations, setIntegrations] = useState<IntegrationData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const { toast } = useToast()

  const loadIntegrations = async () => {
    try {
      const data = await getIntegrationSettings()
      setIntegrations(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load integrations.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadIntegrations()
  }, [])

  const handleAddIntegration = () => {
    setShowAddModal(true)
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Configuraciones</h1>
        <p className="text-gray-600 mt-2">Administra la configuración de tu cuenta e integraciones</p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-7 max-w-6xl">
          <TabsTrigger value="general">Configuración General</TabsTrigger>
          <TabsTrigger value="integrations">Integraciones API</TabsTrigger>
          <TabsTrigger value="rate-limits">Límites de Uso</TabsTrigger>
          <TabsTrigger value="filing-systems">Sistemas de Archivo</TabsTrigger>
          <TabsTrigger value="signatures">Firmas</TabsTrigger>
          <TabsTrigger value="mapping-templates">Plantillas de Mapeo</TabsTrigger>
          <TabsTrigger value="user-management">Gestión de Usuarios</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Account Settings</CardTitle>
                <CardDescription>Manage your account preferences and profile information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">
                    General account settings are coming soon. This will include:
                  </div>
                  <ul className="list-disc list-inside space-y-2 text-sm text-gray-600 ml-4">
                    <li>Profile information management</li>
                    <li>Email notification preferences</li>
                    <li>Security settings</li>
                    <li>Language and timezone preferences</li>
                    <li>Document retention policies</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Configure how you receive notifications</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-600">Notification settings will be available soon.</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="integrations" className="mt-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold">API Integrations</h2>
                <p className="text-gray-600 mt-1">Connect your account with external services and APIs</p>
              </div>
              <Button onClick={handleAddIntegration}>
                <Plus className="w-4 h-4 mr-2" />
                Add New Integration
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="grid gap-6">
                {integrations.length > 0 ? (
                  integrations.map((integration) => (
                    <IntegrationCard key={integration.id} integration={integration} onUpdate={loadIntegrations} />
                  ))
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                        <Plus className="w-6 h-6 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">No integrations configured</h3>
                      <p className="text-gray-600 text-center mb-4 max-w-md">
                        Connect your account with external services to start synchronizing data and automating
                        workflows.
                      </p>
                      <Button onClick={handleAddIntegration}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Your First Integration
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Future integrations placeholder */}
                <Card className="border-dashed border-gray-200 bg-gray-50">
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <div className="text-center">
                      <h3 className="text-lg font-medium text-gray-700 mb-2">More integrations coming soon</h3>
                      <p className="text-gray-500 text-sm">
                        We're working on adding support for more third-party services and APIs.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="rate-limits" className="mt-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold">Rate Limiting</h2>
              <p className="text-gray-600 mt-1">
                Configure API usage limits and monitor consumption for your integrations
              </p>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="grid gap-6">
                {integrations.length > 0 ? (
                  integrations.map((integration) => (
                    <RateLimitConfig key={integration.id} integration={integration} onUpdate={loadIntegrations} />
                  ))
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                        <Plus className="w-6 h-6 text-blue-600" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">No integrations available</h3>
                      <p className="text-gray-600 text-center mb-4 max-w-md">
                        You need to set up an integration first before configuring rate limits.
                      </p>
                      <Button onClick={handleAddIntegration}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Integration First
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Information Card */}
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-medium text-blue-900 mb-2">About Rate Limiting</h3>
                    <div className="text-blue-800 space-y-2 text-sm">
                      <p>
                        Rate limiting helps you control API usage and prevent unexpected costs or service disruptions.
                      </p>
                      <ul className="list-disc list-inside space-y-1 ml-4">
                        <li>Set daily and monthly limits for API requests</li>
                        <li>Monitor real-time usage with progress indicators</li>
                        <li>Receive alerts when approaching limits</li>
                        <li>Disable rate limiting for unlimited usage</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="filing-systems" className="mt-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold">Filing Systems</h2>
              <p className="text-gray-600 mt-1">
                Manage document classification systems and organize your documents by custom metadata
              </p>
            </div>

            <FilingSystemManager />

            {/* Information Card */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-6">
                <h3 className="text-lg font-medium text-blue-900 mb-2">About Filing Systems</h3>
                <div className="text-blue-800 space-y-2 text-sm">
                  <p>
                    Filing Systems allow you to create custom document classification templates with flexible metadata fields.
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Define custom fields (text, numbers, dates, booleans, enums)</li>
                    <li>Create reusable document templates (expedientes)</li>
                    <li>Search and filter documents by custom metadata</li>
                    <li>Only one filing system can be active at a time</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="signatures" className="mt-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold">Signature Management</h2>
              <p className="text-gray-600 mt-1">
                Manage your saved signature templates and customer signatures for quick reuse
              </p>
            </div>

            <EmbeddedSignaturesManager />

            {/* Information Card */}
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-6">
                <h3 className="text-lg font-medium text-green-900 mb-2">About Signature Management</h3>
                <div className="text-green-800 space-y-2 text-sm">
                  <p>
                    Save and organize your signatures for quick reuse across documents and customers.
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Create personal signature templates for your own use</li>
                    <li>Save customer-specific signatures for client documents</li>
                    <li>Set default signatures for faster document signing</li>
                    <li>Support for both canvas-drawn and Wacom pad signatures</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="mapping-templates" className="mt-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold">Plantillas de Mapeo de Firmas</h2>
              <p className="text-gray-600 mt-1">
                Gestiona plantillas reutilizables que definen dónde van las firmas en los documentos
              </p>
            </div>

            <SignatureMappingTemplatesManager />
          </div>
        </TabsContent>

        <TabsContent value="user-management" className="mt-6">
          <div className="space-y-6">
            <InviteUserForm />
            <UserList />
          </div>
        </TabsContent>
      </Tabs>

      <AddIntegrationModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onSuccess={loadIntegrations} />
    </div>
  )
}
