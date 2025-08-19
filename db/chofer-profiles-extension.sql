-- Extension for Chofer Profile Information
-- This adds additional profile data for users who are members of the Choferes group
-- Note: References profiles table (not auth.users directly) which is the standard pattern for this app

-- Table for storing additional chofer profile information
CREATE TABLE IF NOT EXISTS chofer_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Personal Information
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(255), -- Can be different from auth email
    emergency_contact_name VARCHAR(150),
    emergency_contact_phone VARCHAR(20),
    
    -- Professional Information  
    employee_id VARCHAR(50), -- Company employee ID
    license_number VARCHAR(50), -- Driver's license number
    license_expiry DATE, -- License expiration date
    hire_date DATE,
    
    -- Truck Information
    truck_plate VARCHAR(20), -- License plate
    truck_brand VARCHAR(50), -- Ford, Mercedes, etc.
    truck_model VARCHAR(50), -- Model name
    truck_year INTEGER,
    truck_color VARCHAR(30),
    truck_capacity_kg DECIMAL(8,2), -- Cargo capacity in kg
    truck_type VARCHAR(50), -- 'pickup', 'van', 'truck', 'motorcycle'
    
    -- Status and Availability
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'inactive', 'suspended'
    is_available BOOLEAN DEFAULT true, -- Currently available for assignments
    
    -- Address Information
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(10),
    country VARCHAR(100) DEFAULT 'República Dominicana',
    
    -- Additional Information
    notes TEXT, -- Any additional notes about the chofer
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    updated_by UUID REFERENCES profiles(id),
    
    -- Ensure one profile per user
    UNIQUE(user_id)
);

-- Table for chofer documents (licenses, insurance, etc.)
CREATE TABLE IF NOT EXISTS chofer_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chofer_profile_id UUID NOT NULL REFERENCES chofer_profiles(id) ON DELETE CASCADE,
    
    -- Document Information
    document_name VARCHAR(255) NOT NULL,
    document_type VARCHAR(50) NOT NULL, -- 'license', 'insurance', 'registration', 'medical', 'other'
    file_path VARCHAR(500), -- Path to stored document file
    file_name VARCHAR(255),
    file_size INTEGER,
    mime_type VARCHAR(100),
    
    -- Expiry and Status
    issue_date DATE,
    expiry_date DATE,
    -- Note: is_expired is calculated in application layer using: expiry_date < CURRENT_DATE
    -- to avoid PostgreSQL immutable function restrictions with GENERATED columns
    
    -- Status
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'expired', 'pending_renewal'
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    uploaded_by UUID REFERENCES profiles(id)
);

-- Table for tracking chofer availability and schedule
CREATE TABLE IF NOT EXISTS chofer_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chofer_profile_id UUID NOT NULL REFERENCES chofer_profiles(id) ON DELETE CASCADE,
    
    -- Availability Period
    date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    
    -- Availability Status
    availability_type VARCHAR(20) NOT NULL DEFAULT 'available', -- 'available', 'unavailable', 'busy', 'vacation', 'sick'
    reason VARCHAR(255), -- Reason for unavailability
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    
    -- Unique constraint to prevent duplicate entries for same date
    UNIQUE(chofer_profile_id, date)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_chofer_profiles_user_id ON chofer_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_chofer_profiles_status ON chofer_profiles(status);
CREATE INDEX IF NOT EXISTS idx_chofer_profiles_is_available ON chofer_profiles(is_available);
CREATE INDEX IF NOT EXISTS idx_chofer_profiles_employee_id ON chofer_profiles(employee_id);
CREATE INDEX IF NOT EXISTS idx_chofer_profiles_truck_plate ON chofer_profiles(truck_plate);
CREATE INDEX IF NOT EXISTS idx_chofer_documents_chofer_profile ON chofer_documents(chofer_profile_id);
CREATE INDEX IF NOT EXISTS idx_chofer_documents_type ON chofer_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_chofer_documents_expiry ON chofer_documents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_chofer_availability_chofer_profile ON chofer_availability(chofer_profile_id);
CREATE INDEX IF NOT EXISTS idx_chofer_availability_date ON chofer_availability(date);

-- Drop existing triggers if they exist before creating new ones
DROP TRIGGER IF EXISTS update_chofer_profiles_updated_at ON chofer_profiles;
DROP TRIGGER IF EXISTS update_chofer_documents_updated_at ON chofer_documents;
DROP TRIGGER IF EXISTS create_chofer_profile_trigger ON user_group_memberships;

-- Trigger for updated_at on chofer_profiles
CREATE TRIGGER update_chofer_profiles_updated_at 
    BEFORE UPDATE ON chofer_profiles 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Trigger for updated_at on chofer_documents  
CREATE TRIGGER update_chofer_documents_updated_at 
    BEFORE UPDATE ON chofer_documents 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Function to automatically create chofer profile when user is added to choferes group
CREATE OR REPLACE FUNCTION create_chofer_profile_on_group_assignment()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if this is a choferes group assignment
    IF NEW.is_active = true AND EXISTS (
        SELECT 1 FROM groups 
        WHERE id = NEW.group_id 
        AND group_type = 'choferes'
        AND is_active = true
    ) THEN
        -- Only create chofer profile if the user has a profile record
        -- This prevents foreign key constraint errors
        IF EXISTS (SELECT 1 FROM profiles WHERE id = NEW.user_id) THEN
            -- Create chofer profile if it doesn't exist
            INSERT INTO chofer_profiles (user_id, created_by)
            VALUES (NEW.user_id, NEW.assigned_by)
            ON CONFLICT (user_id) DO NOTHING; -- Don't create if already exists
        ELSE
            -- Log a notice that the user doesn't have a profile yet
            RAISE NOTICE 'Cannot create chofer profile for user %: no profile record exists', NEW.user_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to create chofer profile when user is added to choferes group
CREATE TRIGGER create_chofer_profile_trigger 
    AFTER INSERT OR UPDATE ON user_group_memberships 
    FOR EACH ROW EXECUTE PROCEDURE create_chofer_profile_on_group_assignment();

-- Function to get chofer profile with user information
CREATE OR REPLACE FUNCTION get_chofer_with_profile(chofer_user_id UUID)
RETURNS TABLE (
    profile_id UUID,
    user_id UUID,
    email TEXT,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    employee_id VARCHAR(50),
    license_number VARCHAR(50),
    license_expiry DATE,
    truck_plate VARCHAR(20),
    truck_brand VARCHAR(50),
    truck_model VARCHAR(50),
    truck_year INTEGER,
    truck_type VARCHAR(50),
    status VARCHAR(20),
    is_available BOOLEAN,
    address TEXT,
    city VARCHAR(100),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cp.id as profile_id,
        cp.user_id,
        COALESCE(cp.email, p.email) as email,
        cp.first_name,
        cp.last_name,
        cp.phone,
        cp.employee_id,
        cp.license_number,
        cp.license_expiry,
        cp.truck_plate,
        cp.truck_brand,
        cp.truck_model,
        cp.truck_year,
        cp.truck_type,
        cp.status,
        cp.is_available,
        cp.address,
        cp.city,
        cp.created_at,
        cp.updated_at
    FROM chofer_profiles cp
    JOIN profiles p ON cp.user_id = p.id
    WHERE cp.user_id = chofer_user_id;
END;
$$ language 'plpgsql';

-- Function to ensure profile exists before creating chofer profile
-- This can be called manually if the trigger fails due to missing profile
-- Drop existing function first to avoid any conflicts
DROP FUNCTION IF EXISTS ensure_chofer_profile_with_fallback(UUID, UUID);
DROP FUNCTION IF EXISTS ensure_chofer_profile_with_fallback(UUID);

CREATE OR REPLACE FUNCTION ensure_chofer_profile_with_fallback(target_user_id UUID, creator_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    profile_exists BOOLEAN := FALSE;
    user_email TEXT;
BEGIN
    -- Check if profile exists
    SELECT EXISTS(SELECT 1 FROM profiles WHERE id = target_user_id) INTO profile_exists;
    
    IF NOT profile_exists THEN
        -- Try to get user email from auth.users to create profile
        SELECT email INTO user_email FROM auth.users WHERE id = target_user_id;
        
        IF user_email IS NOT NULL THEN
            -- Create missing profile record with available user metadata
            INSERT INTO profiles (id, email, first_name, last_name)
            SELECT 
                target_user_id, 
                au.email,
                COALESCE(au.raw_user_meta_data->>'first_name', ''),
                COALESCE(au.raw_user_meta_data->>'last_name', '')
            FROM auth.users au 
            WHERE au.id = target_user_id
            ON CONFLICT (id) DO NOTHING;
            
            profile_exists := TRUE;
            RAISE NOTICE 'Created missing profile for user % with email %', target_user_id, user_email;
        ELSE
            RAISE NOTICE 'Cannot create profile: user % not found in auth.users', target_user_id;
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Now create chofer profile if profile exists
    IF profile_exists THEN
        INSERT INTO chofer_profiles (user_id, created_by)
        VALUES (target_user_id, creator_id)
        ON CONFLICT (user_id) DO NOTHING;
        
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Function to get all users from auth.users for chofer assignment
-- This function can access the private auth schema
-- Drop existing function first to avoid return type conflicts
DROP FUNCTION IF EXISTS get_all_users_for_chofer_assignment();

CREATE OR REPLACE FUNCTION get_all_users_for_chofer_assignment()
RETURNS TABLE (
    id UUID,
    email VARCHAR(255),
    created_at TIMESTAMPTZ,
    raw_user_meta_data JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        au.id,
        au.email::VARCHAR(255),
        au.created_at,
        au.raw_user_meta_data
    FROM auth.users au
    ORDER BY au.created_at DESC;
END;
$$ language 'plpgsql' SECURITY DEFINER;

COMMENT ON TABLE chofer_profiles IS 'Extended profile information for users in the choferes group';
COMMENT ON TABLE chofer_documents IS 'Documents associated with choferes (licenses, insurance, etc.). Note: is_expired calculated in application layer.';
COMMENT ON TABLE chofer_availability IS 'Availability schedule for choferes';
COMMENT ON COLUMN chofer_profiles.truck_type IS 'Types: pickup, van, truck, motorcycle, other';
COMMENT ON COLUMN chofer_profiles.status IS 'Status: active, inactive, suspended';
COMMENT ON COLUMN chofer_documents.document_type IS 'Types: license, insurance, registration, medical, other';
COMMENT ON FUNCTION ensure_chofer_profile_with_fallback(UUID, UUID) IS 'Ensures both profile and chofer_profile records exist for a user, creating missing profile from auth.users if needed. Returns true if successful.';
COMMENT ON FUNCTION get_all_users_for_chofer_assignment() IS 'Returns all users from private auth.users schema for chofer assignment. Uses SECURITY DEFINER to access private schema.';
