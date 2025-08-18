"use client"

import { useState } from "react"
import { X, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { saveIntegrationSettings } from "@/app/actions/integration-actions"

interface Endpoint {
  id: string
  name: string
  description: string
  method: string
  endpoint: string
  required: boolean
  isAuth?: boolean
}

interface AddIntegrationModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const

export default function AddIntegrationModal({ isOpen, onClose, onSuccess }: AddIntegrationModalProps) {
  const [integrationName, setIntegrationName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [apiUrl, setApiUrl] = useState('')
  const [apiUser, setApiUser] = useState('')
  const [apiPassword, setApiPassword] = useState('')
  const [endpoints, setEndpoints] = useState<Endpoint[]>([
    {
      id: 'auth_endpoint',
      name: 'Authentication',
      description: 'Authentication endpoint',
      method: 'POST',
      endpoint: '/token',
      required: true,
      isAuth: true
    }
  ])
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const addEndpoint = () => {
    const newEndpoint: Endpoint = {
      id: `endpoint_${Date.now()}`,
      name: '',
      description: '',
      method: 'GET',
      endpoint: '',
      required: false,
      isAuth: false
    }
    setEndpoints([...endpoints, newEndpoint])
  }

  const removeEndpoint = (endpointId: string) => {
    setEndpoints(endpoints.filter(ep => ep.id !== endpointId))
  }

  const updateEndpoint = (endpointId: string, field: keyof Endpoint, value: string | boolean) => {
    setEndpoints(endpoints.map(ep => 
      ep.id === endpointId ? { ...ep, [field]: value } : ep
    ))
  }

  const handleSave = async () => {
    setIsLoading(true)
    try {
      // Validation
      if (!integrationName.trim()) {
        toast({
          title: "Validation Error",
          description: "Integration name is required.",
          variant: "destructive",
        })
        return
      }

      if (!apiUrl.trim() || !apiUser.trim() || !apiPassword.trim()) {
        toast({
          title: "Validation Error",
          description: "API URL, User, and Password are required.",
          variant: "destructive",
        })
        return
      }

      // Validate endpoints
      for (const endpoint of endpoints) {
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
      const hasAuthEndpoint = endpoints.some(ep => ep.isAuth === true)
      if (!hasAuthEndpoint) {
        toast({
          title: "Validation Error",
          description: "At least one authentication endpoint is required.",
          variant: "destructive",
        })
        return
      }

      // Create integration name from user input (sanitize it)
      const sanitizedName = integrationName.toLowerCase().replace(/[^a-z0-9]/g, '_')

      await saveIntegrationSettings({
        integration_name: sanitizedName,
        settings: {
          api_url: apiUrl,
          api_user: apiUser,
          api_password: apiPassword,
          display_name: displayName || integrationName,
          endpoints: endpoints
        },
        is_enabled: false,
      })

      toast({
        title: "Integration added",
        description: `${displayName || integrationName} integration has been added successfully.`,
      })
      
      // Reset form
      setIntegrationName('')
      setDisplayName('')
      setApiUrl('')
      setApiUser('')
      setApiPassword('')
      setEndpoints([{
        id: 'auth_endpoint',
        name: 'Authentication',
        description: 'Authentication endpoint',
        method: 'POST',
        endpoint: '/token',
        required: true,
        isAuth: true
      }])
      
      onSuccess()
      onClose()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add integration.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    // Reset form
    setIntegrationName('')
    setDisplayName('')
    setApiUrl('')
    setApiUser('')
    setApiPassword('')
    setEndpoints([{
      id: 'auth_endpoint',
      name: 'Authentication',
      description: 'Authentication endpoint',
      method: 'POST',
      endpoint: '/token',
      required: true,
      isAuth: true
    }])
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Integration</DialogTitle>
          <DialogDescription>
            Configure a new API integration with custom endpoints
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Basic Information</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="integrationName">Integration Name *</Label>
                <Input
                  id="integrationName"
                  value={integrationName}
                  onChange={(e) => setIntegrationName(e.target.value)}
                  placeholder="e.g., aquarius_software"
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Used internally (will be sanitized)
                </p>
              </div>
              
              <div>
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g., Aquarius Software"
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Human-readable name (optional)
                </p>
              </div>
            </div>
          </div>

          {/* API Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">API Configuration</h3>
            
            <div>
              <Label htmlFor="apiUrl">API Base URL *</Label>
              <Input
                id="apiUrl"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://api.example.com"
                className="mt-1"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="apiUser">API User *</Label>
                <Input
                  id="apiUser"
                  value={apiUser}
                  onChange={(e) => setApiUser(e.target.value)}
                  placeholder="your-api-username"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="apiPassword">API Password *</Label>
                <Input
                  id="apiPassword"
                  type="password"
                  value={apiPassword}
                  onChange={(e) => setApiPassword(e.target.value)}
                  placeholder="your-api-password"
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* Endpoints Configuration */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">API Endpoints</h3>
              <Button onClick={addEndpoint} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Endpoint
              </Button>
            </div>
            
            <div className="space-y-4">
              {endpoints.map((endpoint) => (
                <div key={endpoint.id} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Input
                        value={endpoint.name}
                        onChange={(e) => updateEndpoint(endpoint.id, 'name', e.target.value)}
                        placeholder="Endpoint Name"
                        className="w-48"
                      />
                      {endpoint.isAuth && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          AUTH
                        </span>
                      )}
                    </div>
                    
                    {!endpoint.required && (
                      <Button
                        onClick={() => removeEndpoint(endpoint.id)}
                        size="sm"
                        variant="outline"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Method</Label>
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
                    
                    <div>
                      <Label>Endpoint Path</Label>
                      <Input
                        value={endpoint.endpoint}
                        onChange={(e) => updateEndpoint(endpoint.id, 'endpoint', e.target.value)}
                        placeholder="/api/endpoint"
                      />
                    </div>
                    
                    <div className="flex items-end space-x-2">
                      <label className="flex items-center space-x-2 text-sm">
                        <input
                          type="checkbox"
                          checked={endpoint.isAuth || false}
                          onChange={(e) => updateEndpoint(endpoint.id, 'isAuth', e.target.checked)}
                          disabled={endpoint.required}
                        />
                        <span>Is Auth Endpoint</span>
                      </label>
                    </div>
                  </div>
                  
                  <div>
                    <Label>Description</Label>
                    <Input
                      value={endpoint.description}
                      onChange={(e) => updateEndpoint(endpoint.id, 'description', e.target.value)}
                      placeholder="Endpoint description"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleCancel} variant="outline">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Adding..." : "Add Integration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
