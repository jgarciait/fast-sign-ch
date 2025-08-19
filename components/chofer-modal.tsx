"use client"

import React, { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { DatePicker } from "@/components/ui/date-picker"
import { 
  User,
  Phone,
  Mail,
  MapPin,
  Truck,
  Save,
  AlertTriangle,
  Info
} from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"

import { 
  updateChoferProfile, 
  createChoferProfile 
} from "@/app/actions/chofer-actions"
import type { 
  ChoferWithProfile, 
  UpdateChoferProfileRequest,
  CreateChoferProfileRequest
} from "@/types/chofer-types"
import { 
  TruckTypeOptions, 
  StatusOptions, 
  getChoferFullName 
} from "@/types/chofer-types"

interface ChoferModalProps {
  isOpen: boolean
  onClose: () => void
  chofer: ChoferWithProfile | null
  onChoferUpdated: (chofer: ChoferWithProfile) => void
}

export default function ChoferModal({
  isOpen,
  onClose,
  chofer,
  onChoferUpdated
}: ChoferModalProps) {
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("personal")
  
  // Form data
  const [formData, setFormData] = useState<UpdateChoferProfileRequest>({})
  const [licenseExpiryDate, setLicenseExpiryDate] = useState<Date>()
  const [hireDateValue, setHireDateValue] = useState<Date>()

  // Initialize form data when modal opens or chofer changes
  useEffect(() => {
    if (isOpen && chofer) {
      setFormData({
        first_name: chofer.first_name || '',
        last_name: chofer.last_name || '',
        phone: chofer.phone || '',
        email: chofer.email || '',
        emergency_contact_name: chofer.emergency_contact_name || '',
        emergency_contact_phone: chofer.emergency_contact_phone || '',
        employee_id: chofer.employee_id || '',
        license_number: chofer.license_number || '',
        license_expiry: chofer.license_expiry || '',
        hire_date: chofer.hire_date || '',
        truck_plate: chofer.truck_plate || '',
        truck_brand: chofer.truck_brand || '',
        truck_model: chofer.truck_model || '',
        truck_year: chofer.truck_year || undefined,
        truck_color: chofer.truck_color || '',
        truck_capacity_kg: chofer.truck_capacity_kg || undefined,
        truck_type: chofer.truck_type || undefined,
        status: chofer.status,
        is_available: chofer.is_available,
        address: chofer.address || '',
        city: chofer.city || '',
        state: chofer.state || '',
        postal_code: chofer.postal_code || '',
        country: chofer.country || 'República Dominicana',
        notes: chofer.notes || '',
      })
      
      // Set dates
      if (chofer.license_expiry) {
        setLicenseExpiryDate(new Date(chofer.license_expiry))
      }
      if (chofer.hire_date) {
        setHireDateValue(new Date(chofer.hire_date))
      }
      
      setActiveTab("personal")
    } else if (!isOpen) {
      // Reset form when modal closes
      setFormData({})
      setLicenseExpiryDate(undefined)
      setHireDateValue(undefined)
      setActiveTab("personal")
    }
  }, [isOpen, chofer])

  const handleInputChange = (field: keyof UpdateChoferProfileRequest, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleDateSelect = (field: 'license_expiry' | 'hire_date', date: Date | undefined) => {
    if (field === 'license_expiry') {
      setLicenseExpiryDate(date)
      setFormData(prev => ({
        ...prev,
        license_expiry: date ? format(date, 'yyyy-MM-dd') : ''
      }))
    } else if (field === 'hire_date') {
      setHireDateValue(date)
      setFormData(prev => ({
        ...prev,
        hire_date: date ? format(date, 'yyyy-MM-dd') : ''
      }))
    }
  }

  const handleSubmit = async () => {
    if (!chofer) return

    setLoading(true)
    try {
      let result

      if (chofer.id) {
        // Update existing chofer
        result = await updateChoferProfile(chofer.id, formData)
      } else {
        // Create new chofer profile (this case might not happen in current flow)
        const createData: CreateChoferProfileRequest = {
          user_id: chofer.user_id,
          ...formData
        }
        result = await createChoferProfile(createData)
      }

      if (result.success && result.data) {
        toast.success(`Perfil de ${getChoferFullName(result.data)} actualizado correctamente`)
        onChoferUpdated(result.data)
        onClose()
      } else {
        toast.error(result.error || "Error al actualizar el perfil")
      }
    } catch (error) {
      console.error("Error updating chofer:", error)
      toast.error("Error inesperado al actualizar el perfil")
    } finally {
      setLoading(false)
    }
  }

  if (!chofer) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-4xl h-[95vh] max-h-[600px] sm:max-h-[700px] md:max-h-[800px] lg:max-h-[90vh] flex flex-col overflow-hidden m-2 sm:m-6">
        <DialogHeader className="flex-shrink-0 pb-2">
          <DialogTitle className="flex items-center space-x-2">
            <User className="h-5 w-5 text-blue-600" />
            <span className="text-lg">
              {chofer.id ? 'Editar' : 'Completar'} Perfil de Chofer
            </span>
          </DialogTitle>
          <DialogDescription className="text-sm">
            {chofer.id 
              ? `Actualiza la información de ${getChoferFullName(chofer)}`
              : `Completa la información del nuevo chofer ${getChoferFullName(chofer)}`
            }
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 flex-shrink-0">
            <TabsTrigger value="personal" className="text-xs sm:text-sm">Personal</TabsTrigger>
            <TabsTrigger value="professional" className="text-xs sm:text-sm">Laboral</TabsTrigger>
            <TabsTrigger value="vehicle" className="text-xs sm:text-sm">Vehículo</TabsTrigger>
            <TabsTrigger value="location" className="text-xs sm:text-sm">Ubicación</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4 min-h-0 pr-1">
            {/* Personal Information Tab */}
            <TabsContent value="personal" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <User className="h-5 w-5" />
                    <span>Información Personal</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">Nombre *</Label>
                      <Input
                        id="first_name"
                        value={formData.first_name || ''}
                        onChange={(e) => handleInputChange('first_name', e.target.value)}
                        placeholder="Nombre del chofer"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Apellido *</Label>
                      <Input
                        id="last_name"
                        value={formData.last_name || ''}
                        onChange={(e) => handleInputChange('last_name', e.target.value)}
                        placeholder="Apellido del chofer"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Teléfono</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="phone"
                          value={formData.phone || ''}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          placeholder="(809) 000-0000"
                          className="pl-9"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="email"
                          type="email"
                          value={formData.email || ''}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          placeholder="chofer@ejemplo.com"
                          className="pl-9"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      <span>Contacto de Emergencia</span>
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="emergency_contact_name">Nombre del Contacto</Label>
                        <Input
                          id="emergency_contact_name"
                          value={formData.emergency_contact_name || ''}
                          onChange={(e) => handleInputChange('emergency_contact_name', e.target.value)}
                          placeholder="Nombre completo"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="emergency_contact_phone">Teléfono del Contacto</Label>
                        <Input
                          id="emergency_contact_phone"
                          value={formData.emergency_contact_phone || ''}
                          onChange={(e) => handleInputChange('emergency_contact_phone', e.target.value)}
                          placeholder="(809) 000-0000"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Professional Information Tab */}
            <TabsContent value="professional" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Información Laboral</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="employee_id">ID de Empleado</Label>
                      <Input
                        id="employee_id"
                        value={formData.employee_id || ''}
                        onChange={(e) => handleInputChange('employee_id', e.target.value)}
                        placeholder="CH-001"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hire_date">Fecha de Contratación</Label>
                      <DatePicker
                        date={hireDateValue}
                        onDateChange={(date) => handleDateSelect('hire_date', date)}
                        placeholder="Seleccionar fecha"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium">Licencia de Conducir</h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="license_number">Número de Licencia</Label>
                        <Input
                          id="license_number"
                          value={formData.license_number || ''}
                          onChange={(e) => handleInputChange('license_number', e.target.value)}
                          placeholder="000000000"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="license_expiry">Fecha de Vencimiento</Label>
                        <DatePicker
                          date={licenseExpiryDate}
                          onDateChange={(date) => handleDateSelect('license_expiry', date)}
                          placeholder="Seleccionar fecha"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="status">Estado</Label>
                      <Select
                        value={formData.status || ''}
                        onValueChange={(value) => handleInputChange('status', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar estado" />
                        </SelectTrigger>
                        <SelectContent>
                          {StatusOptions.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="is_available">Disponibilidad</Label>
                      <Select
                        value={formData.is_available?.toString() || ''}
                        onValueChange={(value) => handleInputChange('is_available', value === 'true')}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar disponibilidad" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Disponible</SelectItem>
                          <SelectItem value="false">No Disponible</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Vehicle Information Tab */}
            <TabsContent value="vehicle" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <Truck className="h-5 w-5" />
                    <span>Información del Vehículo</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="truck_plate">Placa del Vehículo</Label>
                      <Input
                        id="truck_plate"
                        value={formData.truck_plate || ''}
                        onChange={(e) => handleInputChange('truck_plate', e.target.value.toUpperCase())}
                        placeholder="A000000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="truck_type">Tipo de Vehículo</Label>
                      <Select
                        value={formData.truck_type || ''}
                        onValueChange={(value) => handleInputChange('truck_type', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {TruckTypeOptions.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="truck_brand">Marca</Label>
                      <Input
                        id="truck_brand"
                        value={formData.truck_brand || ''}
                        onChange={(e) => handleInputChange('truck_brand', e.target.value)}
                        placeholder="Toyota, Ford, etc."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="truck_model">Modelo</Label>
                      <Input
                        id="truck_model"
                        value={formData.truck_model || ''}
                        onChange={(e) => handleInputChange('truck_model', e.target.value)}
                        placeholder="Hilux, F-150, etc."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="truck_year">Año</Label>
                      <Input
                        id="truck_year"
                        type="number"
                        min="1990"
                        max={new Date().getFullYear()}
                        value={formData.truck_year || ''}
                        onChange={(e) => handleInputChange('truck_year', parseInt(e.target.value) || undefined)}
                        placeholder="2020"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="truck_color">Color</Label>
                      <Input
                        id="truck_color"
                        value={formData.truck_color || ''}
                        onChange={(e) => handleInputChange('truck_color', e.target.value)}
                        placeholder="Blanco, Azul, etc."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="truck_capacity_kg">Capacidad de Carga (kg)</Label>
                      <Input
                        id="truck_capacity_kg"
                        type="number"
                        min="0"
                        value={formData.truck_capacity_kg || ''}
                        onChange={(e) => handleInputChange('truck_capacity_kg', parseFloat(e.target.value) || undefined)}
                        placeholder="1000"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Location Information Tab */}
            <TabsContent value="location" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <MapPin className="h-5 w-5" />
                    <span>Información de Ubicación</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">Dirección</Label>
                    <Textarea
                      id="address"
                      value={formData.address || ''}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      placeholder="Dirección completa..."
                      className="min-h-16"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">Ciudad</Label>
                      <Input
                        id="city"
                        value={formData.city || ''}
                        onChange={(e) => handleInputChange('city', e.target.value)}
                        placeholder="Santo Domingo"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">Provincia</Label>
                      <Input
                        id="state"
                        value={formData.state || ''}
                        onChange={(e) => handleInputChange('state', e.target.value)}
                        placeholder="Distrito Nacional"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="postal_code">Código Postal</Label>
                      <Input
                        id="postal_code"
                        value={formData.postal_code || ''}
                        onChange={(e) => handleInputChange('postal_code', e.target.value)}
                        placeholder="10000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">País</Label>
                      <Input
                        id="country"
                        value={formData.country || ''}
                        onChange={(e) => handleInputChange('country', e.target.value)}
                        placeholder="República Dominicana"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notas Adicionales</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes || ''}
                      onChange={(e) => handleInputChange('notes', e.target.value)}
                      placeholder="Información adicional sobre el chofer..."
                      className="min-h-20"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="flex-shrink-0 flex flex-col sm:flex-row gap-2 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={onClose} 
            disabled={loading}
            className="w-full sm:w-auto order-2 sm:order-1"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto order-1 sm:order-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Guardar Cambios
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
