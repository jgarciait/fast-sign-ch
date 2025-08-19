// TypeScript types for Chofer Profiles System

export interface ChoferProfile {
  id: string
  user_id: string
  
  // Personal Information
  first_name?: string
  last_name?: string
  phone?: string
  email?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  
  // Professional Information  
  employee_id?: string
  license_number?: string
  license_expiry?: string // Date string
  hire_date?: string // Date string
  
  // Truck Information
  truck_plate?: string
  truck_brand?: string
  truck_model?: string
  truck_year?: number
  truck_color?: string
  truck_capacity_kg?: number
  truck_type?: 'pickup' | 'van' | 'truck' | 'motorcycle' | 'other'
  
  // Status and Availability
  status: 'active' | 'inactive' | 'suspended'
  is_available: boolean
  
  // Address Information
  address?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
  
  // Additional Information
  notes?: string
  
  // Metadata
  created_at: string
  updated_at: string
  created_by?: string
  updated_by?: string
}

export interface ChoferDocument {
  id: string
  chofer_profile_id: string
  
  // Document Information
  document_name: string
  document_type: 'license' | 'insurance' | 'registration' | 'medical' | 'other'
  file_path?: string
  file_name?: string
  file_size?: number
  mime_type?: string
  
  // Expiry and Status
  issue_date?: string // Date string
  expiry_date?: string // Date string
  is_expired?: boolean
  
  // Status
  status: 'active' | 'expired' | 'pending_renewal'
  
  // Metadata
  created_at: string
  updated_at: string
  uploaded_by?: string
}

export interface ChoferAvailability {
  id: string
  chofer_profile_id: string
  
  // Availability Period
  date: string // Date string (YYYY-MM-DD)
  start_time?: string // Time string (HH:mm)
  end_time?: string // Time string (HH:mm)
  
  // Availability Status
  availability_type: 'available' | 'unavailable' | 'busy' | 'vacation' | 'sick'
  reason?: string
  
  // Metadata
  created_at: string
  created_by?: string
}

// Extended type with user information for display
export interface ChoferWithProfile extends ChoferProfile {
  // User information from profiles table
  auth_email?: string
  auth_first_name?: string
  auth_last_name?: string
  full_name?: string // Computed from first_name + last_name (either chofer or auth profile)
  
  // Related data
  documents?: ChoferDocument[]
  documents_count?: number
  expired_documents_count?: number
  
  // Group membership info
  role_in_group?: 'member' | 'admin' | 'supervisor'
  assigned_at?: string // When added to choferes group
  assigned_by?: string
  
  // Current assignment status
  current_assignments_count?: number
  last_assignment_date?: string
  
  // Availability
  today_availability?: ChoferAvailability
  next_available_date?: string
}

// Form types for creating/updating
export interface CreateChoferProfileRequest {
  user_id: string
  first_name?: string
  last_name?: string
  phone?: string
  email?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  employee_id?: string
  license_number?: string
  license_expiry?: string
  hire_date?: string
  truck_plate?: string
  truck_brand?: string
  truck_model?: string
  truck_year?: number
  truck_color?: string
  truck_capacity_kg?: number
  truck_type?: 'pickup' | 'van' | 'truck' | 'motorcycle' | 'other'
  address?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
  notes?: string
}

export interface UpdateChoferProfileRequest {
  first_name?: string | undefined
  last_name?: string | undefined
  phone?: string | undefined
  email?: string | undefined
  emergency_contact_name?: string | undefined
  emergency_contact_phone?: string | undefined
  employee_id?: string | undefined
  license_number?: string | undefined
  license_expiry?: string | undefined
  hire_date?: string | undefined
  truck_plate?: string | undefined
  truck_brand?: string | undefined
  truck_model?: string | undefined
  truck_year?: number | undefined
  truck_color?: string | undefined
  truck_capacity_kg?: number | undefined
  truck_type?: 'pickup' | 'van' | 'truck' | 'motorcycle' | 'other' | undefined
  status?: 'active' | 'inactive' | 'suspended'
  is_available?: boolean
  address?: string | undefined
  city?: string | undefined
  state?: string | undefined
  postal_code?: string | undefined
  country?: string
  notes?: string | undefined
}

export interface CreateChoferDocumentRequest {
  chofer_profile_id: string
  document_name: string
  document_type: 'license' | 'insurance' | 'registration' | 'medical' | 'other'
  file_path?: string
  file_name?: string
  file_size?: number
  mime_type?: string
  issue_date?: string
  expiry_date?: string
}

export interface CreateChoferAvailabilityRequest {
  chofer_profile_id: string
  date: string
  start_time?: string
  end_time?: string
  availability_type: 'available' | 'unavailable' | 'busy' | 'vacation' | 'sick'
  reason?: string
}

// API Response types
export interface ChoferResponse {
  success: boolean
  data?: ChoferWithProfile
  error?: string
}

export interface ChoferesResponse {
  success: boolean
  data?: ChoferWithProfile[]
  total?: number
  error?: string
}

// Filter and search types
export interface ChoferFilters {
  status?: string[]
  truck_type?: string[]
  is_available?: boolean
  city?: string
  has_expired_documents?: boolean
  search?: string // Search by name, email, employee_id, truck_plate
}

export interface ChoferPaginationParams {
  page?: number
  limit?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

// User selection for adding to choferes group
export interface AvailableUser {
  id: string
  email?: string
  first_name?: string
  last_name?: string
  full_name?: string // Computed field
  created_at: string
  // Already a chofer
  is_chofer?: boolean
  chofer_profile?: ChoferProfile
}

// Truck type options with Spanish labels
export const TruckTypeOptions = [
  { value: 'pickup', label: 'Pickup' },
  { value: 'van', label: 'Camioneta' },
  { value: 'truck', label: 'Camión' },
  { value: 'motorcycle', label: 'Motocicleta' },
  { value: 'other', label: 'Otro' }
] as const

// Status options with Spanish labels
export const StatusOptions = [
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
  { value: 'suspended', label: 'Suspendido' }
] as const

// Document type options with Spanish labels
export const DocumentTypeOptions = [
  { value: 'license', label: 'Licencia de Conducir' },
  { value: 'insurance', label: 'Seguro' },
  { value: 'registration', label: 'Registro de Vehículo' },
  { value: 'medical', label: 'Certificado Médico' },
  { value: 'other', label: 'Otro' }
] as const

// Availability type options with Spanish labels
export const AvailabilityTypeOptions = [
  { value: 'available', label: 'Disponible' },
  { value: 'unavailable', label: 'No Disponible' },
  { value: 'busy', label: 'Ocupado' },
  { value: 'vacation', label: 'Vacaciones' },
  { value: 'sick', label: 'Enfermo' }
] as const

// Utility functions
export function getChoferFullName(chofer: ChoferProfile | ChoferWithProfile): string {
  // Try chofer profile names first
  let firstName = chofer.first_name || ''
  let lastName = chofer.last_name || ''
  
  // If chofer profile doesn't have names, try auth profile names
  if (!firstName && !lastName && 'auth_first_name' in chofer) {
    firstName = (chofer as ChoferWithProfile).auth_first_name || ''
    lastName = (chofer as ChoferWithProfile).auth_last_name || ''
  }
  
  const fullName = `${firstName} ${lastName}`.trim()
  
  // Only return name if we actually have meaningful content
  // This prevents returning just spaces or empty strings
  if (fullName && fullName.length > 1) {
    return fullName
  }
  
  // Return empty string if no name found
  // This allows caller to use fallback logic (like showing email)
  return ''
}

export function getChoferDisplayInfo(chofer: ChoferWithProfile): string {
  const name = getChoferFullName(chofer)
  const parts = [name]
  
  if (chofer.employee_id) parts.push(`ID: ${chofer.employee_id}`)
  if (chofer.truck_plate) parts.push(`Placa: ${chofer.truck_plate}`)
  
  return parts.join(' • ')
}

export function getTruckDisplayName(chofer: ChoferProfile): string {
  const parts = []
  
  if (chofer.truck_brand) parts.push(chofer.truck_brand)
  if (chofer.truck_model) parts.push(chofer.truck_model)
  if (chofer.truck_year) parts.push(chofer.truck_year.toString())
  if (chofer.truck_plate) parts.push(`(${chofer.truck_plate})`)
  
  return parts.join(' ') || 'Sin información de vehículo'
}

export function getStatusDisplayName(status: string): string {
  const statusOption = StatusOptions.find(opt => opt.value === status)
  return statusOption?.label || status
}

export function getTruckTypeDisplayName(truckType: string): string {
  const typeOption = TruckTypeOptions.find(opt => opt.value === truckType)
  return typeOption?.label || truckType
}

export function isChoferAvailable(chofer: ChoferWithProfile): boolean {
  return chofer.status === 'active' && chofer.is_available
}

export function isDocumentExpired(document: ChoferDocument): boolean {
  if (!document.expiry_date) return false
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
  return document.expiry_date < today
}

export function getExpiredDocumentsCount(documents: ChoferDocument[]): number {
  return documents.filter(doc => isDocumentExpired(doc)).length
}
