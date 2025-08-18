"use client"

import { useState, useEffect } from "react"
import { Eye, EyeOff, Settings, Trash2, TestTube, CheckCircle, XCircle, Clock, Plus, X, ChevronDown } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { useToast } from "@/hooks/use-toast"
import JsonViewer from "@/components/json-viewer"
import { 
  saveIntegrationSettings, 
  toggleIntegration, 
  deleteIntegration, 
  getIntegrationStatistics,
  getUnmaskedIntegrationSettings,
  type IntegrationSettings,
  type IntegrationStatistics
} from "@/app/actions/integration-actions"
import { 
  testAquariusConnection,
  testSelectiveEndpoints,
  type AquariusTestResult
} from "@/app/actions/aquarius-api-actions"

interface Endpoint {
  id: string
  name: string
  description: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  endpoint: string
  required?: boolean
  isAuth?: boolean
}

interface IntegrationCardProps {
  integration: IntegrationSettings & {
    id: string
    created_at: string
    updated_at: string
    is_global?: boolean
    is_owner?: boolean
    is_configured?: boolean
    display_name?: string
    masked_settings?: any
  }
  onUpdate: () => void
}

interface IntegrationField {
  key: string
  label: string
  type: string
  required: boolean
  placeholder: string
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const

export default function IntegrationCard({ integration, onUpdate }: IntegrationCardProps) {
  // Helper function to get settings data safely
  const getSettings = () => {
    if (integration.settings) {
      return integration.settings
    }
    // For global integrations, we might only have masked_settings
    if (integration.masked_settings) {
      return integration.masked_settings
    }
    return {}
  }

  const [isEditing, setIsEditing] = useState(false)
  const [isEnabled, setIsEnabled] = useState(integration.is_enabled)
  const [isLoading, setIsLoading] = useState(false)
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})
  const [formData, setFormData] = useState(getSettings())
  const [integrationName, setIntegrationName] = useState(integration.integration_name)
  const [displayName, setDisplayName] = useState(integration.display_name || getSettings()?.display_name || '')
  const [statistics, setStatistics] = useState<IntegrationStatistics | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [testResults, setTestResults] = useState<Record<string, AquariusTestResult> | null>(null)
  const [selectedEndpoints, setSelectedEndpoints] = useState<string[]>([])
  const [showTestModal, setShowTestModal] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [realSettings, setRealSettings] = useState<any>(null)
  const [loadingRealSettings, setLoadingRealSettings] = useState(false)
  const { toast } = useToast()

  // Define basic fields (non-endpoint fields)
  const fields: IntegrationField[] = [
    {
      key: "api_url",
      label: "API Base URL",
      type: "password",
      required: true,
      placeholder: "https://asp.aquariusimaging.com/AquariusWebAPI"
    },
    {
      key: "api_user",
      label: "API User",
      type: "password",
      required: true,
      placeholder: "your-api-username"
    },
    {
      key: "api_password",
      label: "API Password",
      type: "password",
      required: true,
      placeholder: "your-api-password"
    }
  ]

  // Initialize endpoints array if not present and load real settings on mount for editing
  useEffect(() => {
    const initializeData = async () => {
      const settings = getSettings()
      console.log("IntegrationCard initializeData - integration.id:", integration.id)
      console.log("IntegrationCard initializeData - settings from getSettings():", settings)
      console.log("IntegrationCard initializeData - integration.masked_settings:", integration.masked_settings)
      console.log("IntegrationCard initializeData - integration.settings:", integration.settings)
      
      // Always start with the masked settings to show endpoints immediately
      setFormData(settings)
      
      // For owners, also preload real settings for when they edit password fields
      // But always show endpoints from masked_settings regardless of ownership
      if (integration.is_owner && !realSettings) {
        try {
          console.log("Loading unmasked settings for owner...")
          const unmaskedData = await getUnmaskedIntegrationSettings(integration.id)
          console.log("Unmasked data received:", unmaskedData)
          console.log("Unmasked settings:", unmaskedData.settings)
          console.log("Unmasked settings endpoints:", unmaskedData.settings?.endpoints)
          setRealSettings(unmaskedData.settings)
          
          // Update formData with endpoints from unmasked data while keeping masked values for passwords
          if (unmaskedData.settings?.endpoints) {
            setFormData(prevFormData => ({
              ...prevFormData,
              endpoints: unmaskedData.settings.endpoints
            }))
            console.log("Updated formData with endpoints from unmasked settings")
          }
        } catch (error) {
          console.error("Error preloading real settings:", error)
          // Continue with masked settings - this is fine
        }
      }
    }
    
    initializeData()
  }, [integration.id, integration.is_owner, realSettings])

  // Load statistics when component mounts or integration changes
  useEffect(() => {
    const loadStatistics = async () => {
      if (!integration.id) return
      
      setStatsLoading(true)
      try {
        const stats = await getIntegrationStatistics(integration.id)
        setStatistics(stats)
      } catch (error) {
        console.error("Error loading statistics:", error)
        setStatistics({
          success_rate: 0,
          total_calls_this_month: 0,
          total_calls_last_7_days: 0,
          daily_rate_limit: 4000,
          current_daily_usage: 0,
          avg_response_time_ms: 0
        })
      } finally {
        setStatsLoading(false)
      }
    }

    loadStatistics()
  }, [integration.id])

  // Initialize selected endpoints - always include auth endpoints
  useEffect(() => {
    if (formData.endpoints && Array.isArray(formData.endpoints)) {
      const authEndpoints = formData.endpoints
        .filter((ep: Endpoint) => ep.isAuth === true)
        .map((ep: Endpoint) => ep.id)
      setSelectedEndpoints(authEndpoints)
    }
  }, [formData.endpoints])

  const togglePasswordVisibility = async (fieldKey: string) => {
    const isCurrentlyShowing = showPasswords[fieldKey]
    
    // If we're about to show the password and don't have real settings yet, load them
    if (!isCurrentlyShowing && !realSettings && !loadingRealSettings) {
      setLoadingRealSettings(true)
      try {
        console.log("Loading real settings for integration:", integration.id)
        const unmaskedData = await getUnmaskedIntegrationSettings(integration.id)
        console.log("Unmasked data received:", unmaskedData)
        setRealSettings(unmaskedData.settings)
      } catch (error) {
        console.error("Error loading real settings:", error)
        toast({
          title: "Error",
          description: "Failed to load configuration details.",
          variant: "destructive",
        })
        setLoadingRealSettings(false)
        return
      }
      setLoadingRealSettings(false)
    }

    setShowPasswords((prev: any) => ({
      ...prev,
      [fieldKey]: !prev[fieldKey]
    }))
  }

  const handleToggleEnabled = async (enabled: boolean) => {
    setIsLoading(true)
    try {
      await toggleIntegration(integration.integration_name, enabled)
      setIsEnabled(enabled)
      toast({
        title: "Integration updated",
        description: `${integration.integration_name} has been ${enabled ? 'enabled' : 'disabled'}.`,
      })
      onUpdate()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update integration status.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsLoading(true)
    try {
      // Validate integration name
      if (!integrationName.trim()) {
        toast({
          title: "Validation Error",
          description: "Integration name is required.",
          variant: "destructive",
        })
        return
      }

      // Validate required fields
      const missingFields = fields
        .filter(field => field.required && !formData[field.key])
        .map(field => field.label)

      if (missingFields.length > 0) {
        toast({
          title: "Validation Error",
          description: `Please fill in required fields: ${missingFields.join(', ')}`,
          variant: "destructive",
        })
        return
      }

      // Validate endpoints
      if (!formData.endpoints || !Array.isArray(formData.endpoints) || formData.endpoints.length === 0) {
        toast({
          title: "Validation Error",
          description: "At least one endpoint is required.",
          variant: "destructive",
        })
        return
      }

      // Validate each endpoint
      for (const endpoint of formData.endpoints) {
        if (!endpoint.name || !endpoint.method || !endpoint.endpoint) {
          toast({
            title: "Validation Error",
            description: "All endpoints must have a name, method, and endpoint path.",
            variant: "destructive",
          })
          return
        }
      }

      // Ensure there's at least one auth endpoint
      const hasAuthEndpoint = formData.endpoints.some((ep: Endpoint) => ep.isAuth === true)
      if (!hasAuthEndpoint) {
        toast({
          title: "Validation Error",
          description: "At least one authentication endpoint is required.",
          variant: "destructive",
        })
        return
      }

      // Create sanitized integration name
      const sanitizedName = integrationName.toLowerCase().replace(/[^a-z0-9]/g, '_')
      
      await saveIntegrationSettings({
        integration_name: sanitizedName,
        settings: {
          ...formData,
          display_name: displayName || integrationName
        },
        is_enabled: integration.is_enabled,
      })

      toast({
        title: "Success",
        description: "Integration settings saved successfully.",
      })
      
      setIsEditing(false)
      onUpdate()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save integration settings.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete the ${getDisplayName()} integration? This action cannot be undone.`
    )
    
    if (!confirmed) return

    setIsLoading(true)
    try {
      await deleteIntegration(integration.integration_name)
      toast({
        title: "Integration deleted",
        description: `${getDisplayName()} integration has been removed.`,
      })
      onUpdate()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete integration.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleTestConnection = async () => {
    // Check if basic credentials are configured
    if (!formData.api_url || !formData.api_user || !formData.api_password) {
      toast({
        title: "Configuration Required",
        description: "Please configure API URL, username, and password before testing.",
        variant: "destructive",
      })
      return
    }

    // Check if we have endpoints to test
    if (!selectedEndpoints || selectedEndpoints.length === 0) {
      toast({
        title: "No Endpoints Selected",
        description: "Please select at least one endpoint to test.",
        variant: "destructive",
      })
      return
    }

    setIsTesting(true)
    setShowTestModal(true)
    setTestResults(null)

    try {
      const results = await testSelectiveEndpoints(integration.id, selectedEndpoints)
      setTestResults(results)
      
      // Refresh statistics after test (new API calls were logged)
      const stats = await getIntegrationStatistics(integration.id)
      setStatistics(stats)
      
    } catch (error) {
      toast({
        title: "Test Failed",
        description: "Failed to run API tests. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsTesting(false)
    }
  }

  const handleEndpointSelection = (endpointId: string, checked: boolean) => {
    const endpoint = formData.endpoints?.find((ep: Endpoint) => ep.id === endpointId)
    
    // Don't allow unchecking auth endpoints
    if (endpoint?.isAuth && !checked) {
      toast({
        title: "Authentication Required",
        description: "Authentication endpoints cannot be deselected as they are required for testing.",
        variant: "destructive",
      })
      return
    }

    setSelectedEndpoints(prev => 
      checked 
        ? [...prev, endpointId]
        : prev.filter(id => id !== endpointId)
    )
  }

  const addEndpoint = () => {
    const newEndpoint: Endpoint = {
      id: `endpoint_${Date.now()}`,
      name: '',
      description: '',
      method: 'POST',
      endpoint: '',
      required: false
    }
    
    setFormData(prev => ({
      ...prev,
      endpoints: [...(prev.endpoints || []), newEndpoint]
    }))
  }

  const removeEndpoint = (endpointId: string) => {
    setFormData(prev => ({
      ...prev,
      endpoints: (prev.endpoints || []).filter((ep: Endpoint) => ep.id !== endpointId)
    }))
    // Also remove from selected endpoints
    setSelectedEndpoints(prev => prev.filter(id => id !== endpointId))
  }

  const updateEndpoint = (endpointId: string, field: keyof Endpoint, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      endpoints: (prev.endpoints || []).map((ep: Endpoint) => 
        ep.id === endpointId ? { ...ep, [field]: value } : ep
      )
    }))
  }

  const getDisplayName = () => {
    // Use display name from the new data structure, then fall back to settings, then formatted name
    if (integration.display_name) {
      return integration.display_name
    }
    const settings = getSettings()
    if (settings?.display_name) {
      return settings.display_name
    }
    
    switch (integration.integration_name) {
      case 'aquarius_software':
        return 'Aquarius Software'
      default:
        return integration.integration_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString()
  }

  const isConfigured = formData.api_url && formData.api_user && formData.api_password && 
                      formData.endpoints && formData.endpoints.length > 0

  const availableEndpoints = formData.endpoints || []
  const authEndpoints = availableEndpoints.filter((ep: Endpoint) => ep.isAuth === true)
  const otherEndpoints = availableEndpoints.filter((ep: Endpoint) => ep.isAuth !== true)

  return (
    <>
      <Card className="w-full">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="integration-details" className="border-0">
            {/* Custom header with Switch outside of AccordionTrigger */}
            <div className="px-6 py-4 flex items-center justify-between border-b">
              <div className="flex items-center space-x-3 flex-1">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Settings className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <div className="text-lg font-semibold">{getDisplayName()}</div>
                    <Badge variant="secondary" className="text-xs">
                      Global
                    </Badge>
                    {!integration.is_owner && (
                      <Badge variant="outline" className="text-xs">
                        Shared
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">
                    Shared API integration available to all users
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                {isConfigured && (
                  <div
                    onClick={handleTestConnection}
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 cursor-pointer"
                  >
                    <TestTube className="w-4 h-4" />
                    <span>{isTesting ? 'Testing...' : 'Test API'}</span>
                  </div>
                )}
                {/* Show status indicator for all users, but only allow owners to toggle */}
                {integration.is_owner ? (
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={handleToggleEnabled}
                    disabled={isLoading}
                  />
                ) : (
                  <Badge variant={isEnabled ? "default" : "secondary"} className="text-xs">
                    {isEnabled ? "Active" : "Inactive"}
                  </Badge>
                )}
                <AccordionTrigger className="p-0 hover:no-underline">
                </AccordionTrigger>
              </div>
            </div>
            
            <AccordionContent className="px-6 pb-6">
              <div className="space-y-6">
                {/* Statistics Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-sm text-gray-600">Success rate</div>
                    {statsLoading ? (
                      <div className="text-2xl font-semibold text-gray-400">--</div>
                    ) : (
                      <div className="text-2xl font-semibold text-green-600">
                        {statistics?.success_rate.toFixed(1)}%
                      </div>
                    )}
                    <div className="text-xs text-gray-500">last 7 days</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-600">API calls</div>
                    {statsLoading ? (
                      <div className="text-2xl font-semibold text-gray-400">--</div>
                    ) : (
                      <div className="text-2xl font-semibold text-blue-600">
                        {formatNumber(statistics?.total_calls_this_month || 0)}
                      </div>
                    )}
                    <div className="text-xs text-gray-500">this month</div>
                  </div>
                </div>

                {/* Additional Statistics Row */}
                {!statsLoading && statistics && (
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                    <div className="text-center">
                      <div className="text-sm text-gray-600">Last 7 days</div>
                      <div className="text-lg font-semibold text-indigo-600">
                        {formatNumber(statistics.total_calls_last_7_days)}
                      </div>
                      <div className="text-xs text-gray-500">API calls</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-gray-600">Avg response</div>
                      <div className="text-lg font-semibold text-purple-600">
                        {statistics.avg_response_time_ms > 0 ? `${statistics.avg_response_time_ms.toFixed(0)}ms` : '--'}
                      </div>
                      <div className="text-xs text-gray-500">response time</div>
                    </div>
                  </div>
                )}

                {/* Test Endpoint Selection */}
                {!isEditing && isConfigured && availableEndpoints.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-medium">Select Endpoints to Test</h3>
                    <div className="space-y-2">
                      {/* Authentication Endpoints - Always Required */}
                      {authEndpoints.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-gray-700">Authentication (Required)</div>
                          {authEndpoints.map((endpoint: Endpoint) => (
                            <div key={endpoint.id} className="flex items-center space-x-3 p-2 border rounded-lg bg-blue-50">
                              <Checkbox
                                id={`test-${endpoint.id}`}
                                checked={selectedEndpoints.includes(endpoint.id)}
                                onCheckedChange={(checked) => handleEndpointSelection(endpoint.id, checked as boolean)}
                                disabled={true} // Auth endpoints are always selected
                              />
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <Badge variant="outline">{endpoint.method}</Badge>
                                  <span className="font-medium">{endpoint.name}</span>
                                  <Badge variant="default" className="text-xs">Auth</Badge>
                                </div>
                                <div className="text-sm text-gray-600">
                                  <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
                                    {endpoint.endpoint}
                                  </code>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Other Endpoints - Optional */}
                      {otherEndpoints.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-gray-700">Other Endpoints (Optional)</div>
                          {otherEndpoints.map((endpoint: Endpoint) => (
                            <div key={endpoint.id} className="flex items-center space-x-3 p-2 border rounded-lg">
                              <Checkbox
                                id={`test-${endpoint.id}`}
                                checked={selectedEndpoints.includes(endpoint.id)}
                                onCheckedChange={(checked) => handleEndpointSelection(endpoint.id, checked as boolean)}
                              />
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <Badge variant="outline">{endpoint.method}</Badge>
                                  <span className="font-medium">{endpoint.name}</span>
                                  {endpoint.required && (
                                    <Badge variant="secondary" className="text-xs">Required</Badge>
                                  )}
                                </div>
                                <div className="text-sm text-gray-600">
                                  <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
                                    {endpoint.endpoint}
                                  </code>
                                </div>
                                {endpoint.description && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {endpoint.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Configuration Fields */}
                {isEditing ? (
                  <div className="space-y-6">
                    {/* Integration Info */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Integration Information</h3>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="integrationName">
                            Integration Name <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="integrationName"
                            value={integrationName}
                            onChange={(e) => setIntegrationName(e.target.value)}
                            placeholder="e.g., aquarius_software"
                          />
                          <p className="text-xs text-gray-500">
                            Used internally (will be sanitized)
                          </p>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="displayName">Display Name</Label>
                          <Input
                            id="displayName"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="e.g., Aquarius Software"
                          />
                          <p className="text-xs text-gray-500">
                            Friendly name for the UI
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Basic Configuration */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Basic Configuration</h3>
                      {fields.map((field) => (
                        <div key={field.key} className="space-y-2">
                          <Label htmlFor={field.key}>
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                          </Label>
                          <div className="relative">
                            <Input
                              id={field.key}
                              type={field.type === "password" && !showPasswords[field.key] ? "password" : "text"}
                              value={
                                field.type === "password" && showPasswords[field.key] && realSettings?.[field.key]
                                  ? realSettings[field.key]
                                  : formData[field.key] || ""
                              }
                              onChange={(e) => {
                                const newValue = e.target.value
                                setFormData((prev: any) => ({ ...prev, [field.key]: newValue }))
                                // If we're showing real values, also update realSettings
                                if (showPasswords[field.key] && realSettings) {
                                  setRealSettings((prev: any) => ({ ...prev, [field.key]: newValue }))
                                }
                              }}
                              placeholder={field.placeholder}
                            />
                            {field.type === "password" && (
                              <button
                                type="button"
                                onClick={() => togglePasswordVisibility(field.key)}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                {showPasswords[field.key] ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Endpoints Configuration */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">API Endpoints</h3>
                        <Button onClick={addEndpoint} size="sm" variant="outline">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Endpoint
                        </Button>
                      </div>
                      
                      {formData.endpoints && formData.endpoints.length > 0 ? (
                        <div className="space-y-4">
                          {formData.endpoints.map((endpoint: Endpoint, index: number) => (
                            <div key={endpoint.id} className="border rounded-lg p-4 space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium">Endpoint {index + 1}</h4>
                                <Button 
                                  onClick={() => removeEndpoint(endpoint.id)}
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Name</Label>
                                  <Input
                                    value={endpoint.name}
                                    onChange={(e) => updateEndpoint(endpoint.id, 'name', e.target.value)}
                                    placeholder="e.g., Get Document Types"
                                  />
                                </div>
                                
                                <div className="space-y-2">
                                  <Label>HTTP Method</Label>
                                  <Select 
                                    value={endpoint.method} 
                                    onValueChange={(value) => updateEndpoint(endpoint.id, 'method', value)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {HTTP_METHODS.map((method) => (
                                        <SelectItem key={method} value={method}>
                                          {method}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <Label>Endpoint Path</Label>
                                <Input
                                  value={endpoint.endpoint}
                                  onChange={(e) => updateEndpoint(endpoint.id, 'endpoint', e.target.value)}
                                  placeholder="e.g., /api/Documents"
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label>Description (Optional)</Label>
                                <Textarea
                                  value={endpoint.description || ''}
                                  onChange={(e) => updateEndpoint(endpoint.id, 'description', e.target.value)}
                                  placeholder="Describe what this endpoint does..."
                                  rows={2}
                                />
                              </div>
                              
                              <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`required-${endpoint.id}`}
                                    checked={endpoint.required || false}
                                    onCheckedChange={(checked) => updateEndpoint(endpoint.id, 'required', checked as boolean)}
                                  />
                                  <Label htmlFor={`required-${endpoint.id}`} className="text-sm">
                                    Required for integration
                                  </Label>
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`auth-${endpoint.id}`}
                                    checked={endpoint.isAuth || false}
                                    onCheckedChange={(checked) => updateEndpoint(endpoint.id, 'isAuth', checked as boolean)}
                                  />
                                  <Label htmlFor={`auth-${endpoint.id}`} className="text-sm">
                                    Authentication endpoint
                                  </Label>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <p>No endpoints configured yet.</p>
                          <p className="text-sm">Add endpoints to define API functionality.</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Configuration Summary */}
                    <div className="space-y-3">
                      <h3 className="text-lg font-medium">Configuration Summary</h3>
                      <div className="space-y-2">
                        {fields.map((field) => (
                          <div key={field.key} className="flex justify-between items-center">
                            <Label className="text-sm font-medium">{field.label}</Label>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-500">
                                {field.type === "password" ? (
                                  loadingRealSettings ? (
                                    "Loading..."
                                  ) : showPasswords[field.key] && realSettings?.[field.key] ? (
                                    realSettings[field.key]
                                  ) : formData[field.key] ? (
                                    "••••••••••••"
                                  ) : (
                                    "Not configured"
                                  )
                                ) : (
                                  formData[field.key] || "Not configured"
                                )}
                              </span>
                              {field.type === "password" && formData[field.key] && (
                                <button
                                  onClick={() => togglePasswordVisibility(field.key)}
                                  className="text-gray-400 hover:text-gray-600"
                                  disabled={loadingRealSettings}
                                >
                                  {loadingRealSettings ? (
                                    <Clock className="w-4 h-4 animate-spin" />
                                  ) : showPasswords[field.key] ? (
                                    <EyeOff className="w-4 h-4" />
                                  ) : (
                                    <Eye className="w-4 h-4" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Endpoints Display */}
                      {(() => {
                        console.log("Rendering endpoints section - formData:", formData)
                        console.log("Rendering endpoints section - formData.endpoints:", formData.endpoints)
                        console.log("Rendering endpoints section - endpoints length:", formData.endpoints?.length)
                        return null
                      })()}
                      {formData.endpoints && formData.endpoints.length > 0 && (
                        <div className="space-y-3">
                          <h3 className="text-lg font-medium">API Endpoints ({formData.endpoints.length})</h3>
                          <div className="space-y-2">
                            {formData.endpoints.map((endpoint: Endpoint, index: number) => (
                              <div key={endpoint.id} className="border rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center space-x-2">
                                    <Badge variant="outline">{endpoint.method}</Badge>
                                    <span className="font-medium">{endpoint.name}</span>
                                    {endpoint.required && (
                                      <Badge variant="secondary" className="text-xs">Required</Badge>
                                    )}
                                    {endpoint.isAuth && (
                                      <Badge variant="default" className="text-xs">Auth</Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="text-sm text-gray-600 mb-1">
                                  <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                                    {endpoint.endpoint}
                                  </code>
                                </div>
                                {endpoint.description && (
                                  <div className="text-xs text-gray-500">
                                    {endpoint.description}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons - Only show for owners */}
                {integration.is_owner && (
                  <div className="flex justify-between pt-4 border-t border-gray-100">
                    <div className="flex space-x-2">
                      {isEditing ? (
                        <>
                          <Button onClick={handleSave} disabled={isLoading}>
                            Save Changes
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => {
                              setIsEditing(false)
                              setFormData(getSettings())
                            }}
                            disabled={isLoading}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button 
                          variant="outline" 
                          onClick={() => setIsEditing(true)}
                          disabled={isLoading}
                        >
                          Configure
                        </Button>
                      )}
                    </div>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={handleDelete}
                      disabled={isLoading}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Remove Integration
                    </Button>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>

      {/* Test Results Modal */}
      <Dialog open={showTestModal} onOpenChange={setShowTestModal}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>API Connection Test Results</DialogTitle>
            <DialogDescription>
              Testing connection to {getDisplayName()} API using your configured credentials.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {isTesting ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="text-gray-600">Testing selected API endpoints...</span>
                </div>
              </div>
            ) : testResults ? (
              <>
                {/* Dynamic Test Results */}
                {Object.entries(testResults).map(([endpointId, result]) => {
                  const endpoint = formData.endpoints?.find((ep: Endpoint) => ep.id === endpointId)
                  const endpointName = endpoint?.name || endpointId
                  
                  return (
                    <div key={endpointId} className={`border rounded-lg p-4 ${endpoint?.isAuth ? 'bg-blue-50' : ''}`}>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium flex items-center space-x-2">
                          <span>{endpointName}</span>
                          {result.success ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600" />
                          )}
                          {endpoint?.isAuth && (
                            <Badge variant="default" className="text-xs">Auth</Badge>
                          )}
                        </h3>
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">{result.responseTime}ms</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge variant={result.success ? "default" : "destructive"}>
                          {result.success ? "Success" : "Failed"}
                        </Badge>
                        {endpoint && (
                          <Badge variant="outline">
                            {endpoint.method}
                          </Badge>
                        )}
                        {endpoint?.endpoint && (
                          <code className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">
                            {endpoint.endpoint}
                          </code>
                        )}
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-2">{result.message}</p>
                      
                      {result.error && (
                        <div className="text-xs text-destructive mt-2 p-2 bg-destructive/10 rounded">
                          {result.error}
                        </div>
                      )}

                      {/* JSON Response Viewer */}
                      {result.rawResponse && (
                        <div className="mt-3">
                          <JsonViewer 
                            data={result.rawResponse}
                            title={`Response (${result.statusCode || 'N/A'})`}
                            statusCode={result.statusCode}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
