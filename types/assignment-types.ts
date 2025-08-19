// TypeScript types for Groups and Assignment System

export interface Group {
  id: string
  name: string
  description?: string
  group_type: string
  is_active: boolean
  created_at: string
  created_by?: string
  updated_at: string
}

export interface UserGroupMembership {
  id: string
  user_id: string
  group_id: string
  role_in_group: 'member' | 'admin' | 'supervisor'
  is_active: boolean
  assigned_at: string
  assigned_by?: string
}

export interface DocumentAssignment {
  id: string
  document_id: string
  assigned_to_user_id: string
  assigned_by_user_id: string
  assignment_type: string
  status: 'assigned' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  
  // Assignment details
  title?: string
  description?: string
  
  // Delivery information
  delivery_address?: string
  client_name?: string
  client_contact?: string
  expected_delivery_date?: string
  
  // Tracking dates
  assigned_at: string
  started_at?: string
  completed_at?: string
  due_date?: string
  
  // Signature requirements
  requires_chofer_signature: boolean
  requires_client_signature: boolean
  chofer_signed_at?: string
  client_signed_at?: string
  
  created_at: string
  updated_at: string
}

export interface AssignmentComment {
  id: string
  assignment_id: string
  user_id: string
  comment: string
  comment_type: 'general' | 'issue' | 'update' | 'question'
  is_internal: boolean
  created_at: string
  updated_at: string
  
  // Join fields (populated from queries)
  user?: {
    id: string
    email?: string
    first_name?: string
    last_name?: string
    full_name?: string // Computed field
  }
}

export interface AssignmentGpsTracking {
  id: string
  assignment_id: string
  user_id: string
  
  // GPS coordinates
  latitude: number
  longitude: number
  accuracy?: number
  altitude?: number
  speed?: number
  heading?: number
  
  // Location details
  address?: string
  location_type: 'start' | 'waypoint' | 'destination' | 'tracking'
  notes?: string
  
  // Timing
  recorded_at: string
  created_at: string
}

export interface AssignmentSignatureMapping {
  id: string
  assignment_id: string
  signature_type: 'chofer' | 'client'
  page_number: number
  
  // Signature position (relative to page dimensions)
  x_coordinate: number // X position as percentage (0.0-1.0)
  y_coordinate: number // Y position as percentage (0.0-1.0)
  width: number // Width as percentage of page width
  height: number // Height as percentage of page height
  
  // Additional signature requirements
  is_required: boolean
  label?: string
  placeholder_text?: string
  
  created_at: string
  created_by?: string
}

export interface AssignmentStatusHistory {
  id: string
  assignment_id: string
  previous_status?: string
  new_status: string
  changed_by: string
  change_reason?: string
  changed_at: string
  
  // Join fields
  changed_by_user?: {
    id: string
    email?: string
    first_name?: string
    last_name?: string
    full_name?: string // Computed field
  }
}

export interface AssignmentFile {
  id: string
  assignment_id: string
  file_name: string
  file_path: string
  file_type?: 'photo' | 'receipt' | 'signature' | 'document'
  file_size?: number
  mime_type?: string
  uploaded_by: string
  description?: string
  is_public: boolean
  created_at: string
  
  // Join fields
  uploaded_by_user?: {
    id: string
    email?: string
    first_name?: string
    last_name?: string
    full_name?: string // Computed field
  }
}

// Extended types with join data for display
export interface AssignmentWithDetails extends DocumentAssignment {
  // Document information
  document?: {
    id: string
    file_name?: string
    title?: string
    file_path?: string
  }
  
  // User information
  assigned_to_user?: {
    id: string
    email?: string
    first_name?: string
    last_name?: string
    full_name?: string // Computed field
  }
  
  assigned_by_user?: {
    id: string
    email?: string
    first_name?: string
    last_name?: string
    full_name?: string // Computed field
  }
  
  // Related data counts
  comments_count?: number
  gps_tracking_count?: number
  files_count?: number
  
  // Latest GPS location
  latest_gps_location?: AssignmentGpsTracking
  
  // Status history
  status_history?: AssignmentStatusHistory[]
}

export interface GroupWithMembers extends Group {
  members?: Array<UserGroupMembership & {
    user?: {
      id: string
      email?: string
      first_name?: string
      last_name?: string
      full_name?: string // Computed field
    }
  }>
  members_count?: number
}

// Form types for creating/updating
export interface CreateAssignmentRequest {
  document_id: string
  assigned_to_user_id: string
  assignment_type?: string
  title?: string
  description?: string
  delivery_address?: string
  client_name?: string
  client_contact?: string
  expected_delivery_date?: string
  due_date?: string
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  requires_chofer_signature?: boolean
  requires_client_signature?: boolean
}

export interface UpdateAssignmentRequest {
  status?: 'assigned' | 'in_progress' | 'completed' | 'cancelled'
  title?: string
  description?: string
  delivery_address?: string
  client_name?: string
  client_contact?: string
  expected_delivery_date?: string
  due_date?: string
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  started_at?: string
  completed_at?: string
  chofer_signed_at?: string
  client_signed_at?: string
}

export interface CreateCommentRequest {
  assignment_id: string
  comment: string
  comment_type?: 'general' | 'issue' | 'update' | 'question'
  is_internal?: boolean
}

export interface CreateGpsTrackingRequest {
  assignment_id: string
  latitude: number
  longitude: number
  accuracy?: number
  altitude?: number
  speed?: number
  heading?: number
  address?: string
  location_type?: 'start' | 'waypoint' | 'destination' | 'tracking'
  notes?: string
  recorded_at?: string
}

export interface CreateSignatureMappingRequest {
  assignment_id: string
  signature_type: 'chofer' | 'client'
  page_number: number
  x_coordinate: number
  y_coordinate: number
  width?: number
  height?: number
  is_required?: boolean
  label?: string
  placeholder_text?: string
}

export interface CreateGroupRequest {
  name: string
  description?: string
  group_type?: string
}

export interface AddUserToGroupRequest {
  user_id: string
  group_id: string
  role_in_group?: 'member' | 'admin' | 'supervisor'
}

// API Response types
export interface AssignmentResponse {
  success: boolean
  data?: AssignmentWithDetails
  error?: string
}

export interface AssignmentsResponse {
  success: boolean
  data?: AssignmentWithDetails[]
  total?: number
  error?: string
}

export interface GroupResponse {
  success: boolean
  data?: GroupWithMembers
  error?: string
}

export interface GroupsResponse {
  success: boolean
  data?: GroupWithMembers[]
  error?: string
}

// Filter and pagination types
export interface AssignmentFilters {
  status?: string[]
  assigned_to_user_id?: string
  assigned_by_user_id?: string
  assignment_type?: string
  priority?: string[]
  date_from?: string
  date_to?: string
  search?: string
}

export interface PaginationParams {
  page?: number
  limit?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

// GPS tracking types for map display
export interface GpsRoute {
  assignment_id: string
  points: AssignmentGpsTracking[]
  total_distance?: number
  total_time?: number
  start_time?: string
  end_time?: string
}

export interface MapMarker {
  id: string
  latitude: number
  longitude: number
  type: 'start' | 'waypoint' | 'destination' | 'current'
  title?: string
  description?: string
  timestamp?: string
}
