-- Groups and Document Assignment System for Choferes (Truck Drivers)
-- This schema supports assigning documents (Conduces) to truck drivers with workflow tracking

-- 1. Groups table - for managing different types of groups (Choferes, etc.)
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    group_type VARCHAR(50) NOT NULL DEFAULT 'choferes', -- 'choferes', 'admin', etc.
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. User Group Memberships - many-to-many relationship between users and groups
CREATE TABLE IF NOT EXISTS user_group_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    role_in_group VARCHAR(50) DEFAULT 'member', -- 'member', 'admin', 'supervisor'
    is_active BOOLEAN NOT NULL DEFAULT true,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by UUID REFERENCES auth.users(id),
    UNIQUE(user_id, group_id)
);

-- 3. Document Assignments (Conduces) - main assignment workflow table
CREATE TABLE IF NOT EXISTS document_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    assigned_to_user_id UUID NOT NULL REFERENCES auth.users(id), -- The chofer
    assigned_by_user_id UUID NOT NULL REFERENCES auth.users(id), -- Who made the assignment
    assignment_type VARCHAR(50) NOT NULL DEFAULT 'conduce', -- 'conduce', 'delivery', etc.
    status VARCHAR(50) NOT NULL DEFAULT 'assigned', -- 'assigned', 'in_progress', 'completed', 'cancelled'
    priority VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
    
    -- Assignment details
    title VARCHAR(255), -- Custom title for the assignment
    description TEXT, -- Assignment description/instructions
    
    -- Delivery information (specific to Conduce)
    delivery_address TEXT,
    client_name VARCHAR(255),
    client_contact VARCHAR(100),
    expected_delivery_date DATE,
    
    -- Tracking dates
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE,
    
    -- Signature requirements
    requires_chofer_signature BOOLEAN DEFAULT true,
    requires_client_signature BOOLEAN DEFAULT true,
    chofer_signed_at TIMESTAMP WITH TIME ZONE,
    client_signed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Assignment Comments - for communication during the assignment process
CREATE TABLE IF NOT EXISTS assignment_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES document_assignments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    comment TEXT NOT NULL,
    comment_type VARCHAR(50) DEFAULT 'general', -- 'general', 'issue', 'update', 'question'
    is_internal BOOLEAN DEFAULT false, -- true for internal comments, false for visible to chofer
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Assignment GPS Tracking - for tracking delivery routes and locations
CREATE TABLE IF NOT EXISTS assignment_gps_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES document_assignments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id), -- Usually the chofer
    
    -- GPS coordinates
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(6, 2), -- GPS accuracy in meters
    altitude DECIMAL(8, 2), -- Altitude in meters
    speed DECIMAL(6, 2), -- Speed in km/h
    heading DECIMAL(5, 2), -- Direction in degrees (0-360)
    
    -- Location details
    address TEXT, -- Reverse geocoded address
    location_type VARCHAR(50) DEFAULT 'tracking', -- 'start', 'waypoint', 'destination', 'tracking'
    notes TEXT,
    
    -- Timing
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Assignment Signature Mappings - for defining where signatures should be placed
CREATE TABLE IF NOT EXISTS assignment_signature_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES document_assignments(id) ON DELETE CASCADE,
    signature_type VARCHAR(50) NOT NULL, -- 'chofer', 'client'
    page_number INTEGER NOT NULL,
    
    -- Signature position (relative to page dimensions)
    x_coordinate DECIMAL(8, 4) NOT NULL, -- X position as percentage of page width (0.0-1.0)
    y_coordinate DECIMAL(8, 4) NOT NULL, -- Y position as percentage of page height (0.0-1.0)
    width DECIMAL(6, 4) DEFAULT 0.15, -- Signature width as percentage of page width
    height DECIMAL(6, 4) DEFAULT 0.08, -- Signature height as percentage of page height
    
    -- Additional signature requirements
    is_required BOOLEAN DEFAULT true,
    label VARCHAR(255), -- Label for the signature field
    placeholder_text VARCHAR(255), -- Text to show before signing
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- 7. Assignment Status History - for tracking status changes
CREATE TABLE IF NOT EXISTS assignment_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES document_assignments(id) ON DELETE CASCADE,
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by UUID NOT NULL REFERENCES auth.users(id),
    change_reason TEXT,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Assignment Files - for additional files related to assignments (photos, receipts, etc.)
CREATE TABLE IF NOT EXISTS assignment_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES document_assignments(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50), -- 'photo', 'receipt', 'signature', 'document'
    file_size INTEGER,
    mime_type VARCHAR(100),
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_groups_name ON groups(name);
CREATE INDEX IF NOT EXISTS idx_groups_type ON groups(group_type);
CREATE INDEX IF NOT EXISTS idx_user_group_memberships_user ON user_group_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_user_group_memberships_group ON user_group_memberships(group_id);
CREATE INDEX IF NOT EXISTS idx_document_assignments_document ON document_assignments(document_id);
CREATE INDEX IF NOT EXISTS idx_document_assignments_assigned_to ON document_assignments(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_document_assignments_assigned_by ON document_assignments(assigned_by_user_id);
CREATE INDEX IF NOT EXISTS idx_document_assignments_status ON document_assignments(status);
CREATE INDEX IF NOT EXISTS idx_document_assignments_assigned_at ON document_assignments(assigned_at);
CREATE INDEX IF NOT EXISTS idx_assignment_comments_assignment ON assignment_comments(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_gps_assignment ON assignment_gps_tracking(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_gps_recorded_at ON assignment_gps_tracking(recorded_at);
CREATE INDEX IF NOT EXISTS idx_assignment_signature_mappings_assignment ON assignment_signature_mappings(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_status_history_assignment ON assignment_status_history(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_files_assignment ON assignment_files(assignment_id);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_document_assignments_updated_at BEFORE UPDATE ON document_assignments FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_assignment_comments_updated_at BEFORE UPDATE ON assignment_comments FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Function to automatically create status history when assignment status changes
CREATE OR REPLACE FUNCTION track_assignment_status_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO assignment_status_history (assignment_id, previous_status, new_status, changed_by)
        VALUES (NEW.id, OLD.status, NEW.status, NEW.assigned_by_user_id);
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER track_assignment_status_changes_trigger 
    AFTER UPDATE ON document_assignments 
    FOR EACH ROW EXECUTE PROCEDURE track_assignment_status_changes();

-- Insert default Choferes group
INSERT INTO groups (name, description, group_type) 
VALUES ('Choferes', 'Grupo de conductores de camiones para entregas', 'choferes')
ON CONFLICT (name) DO NOTHING;
