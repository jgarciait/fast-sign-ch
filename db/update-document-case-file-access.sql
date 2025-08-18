-- Major changes to document and case file management
-- 1. Documents: Everyone can see documents, but creator is identified
-- 2. Case Files (file_records): Add assignment capability and update access policies

-- Add assigned_to_user_id column to file_records for case assignment
ALTER TABLE file_records 
ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index for performance on assigned cases
CREATE INDEX IF NOT EXISTS idx_file_records_assigned_to ON file_records(assigned_to_user_id);

-- Add comment for documentation
COMMENT ON COLUMN file_records.assigned_to_user_id IS 'User assigned to handle this case file. NULL means unassigned.';

-- Update RLS policies for documents to allow global visibility while maintaining creator identification
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Drop existing document policies
DROP POLICY IF EXISTS "Users can view their own documents" ON documents;
DROP POLICY IF EXISTS "Users can insert their own documents" ON documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON documents;

-- New policies: All authenticated users can view documents, but creator identification is maintained
CREATE POLICY "All authenticated users can view documents" 
  ON documents FOR SELECT 
  TO authenticated
  USING (true);

-- Users can still only insert their own documents (creator identification)
CREATE POLICY "Users can insert their own documents" 
  ON documents FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Only creators can update their documents
CREATE POLICY "Document creators can update their documents" 
  ON documents FOR UPDATE 
  TO authenticated
  USING (auth.uid() = created_by);

-- Only creators can delete their documents
CREATE POLICY "Document creators can delete their documents" 
  ON documents FOR DELETE 
  TO authenticated
  USING (auth.uid() = created_by);

-- Update RLS policies for file_records (case files) to allow assignment-based access
ALTER TABLE file_records ENABLE ROW LEVEL SECURITY;

-- Drop existing file_records policies
DROP POLICY IF EXISTS "Users can view their own file records" ON file_records;
DROP POLICY IF EXISTS "Users can insert their own file records" ON file_records;
DROP POLICY IF EXISTS "Users can update their own file records" ON file_records;
DROP POLICY IF EXISTS "Users can delete their own file records" ON file_records;

-- New policies: Users can access file records they created OR are assigned to
CREATE POLICY "Users can view file records they created or are assigned to" 
  ON file_records FOR SELECT 
  TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = assigned_to_user_id);

-- Only creators can insert file records
CREATE POLICY "Users can insert their own file records" 
  ON file_records FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Creators and assigned users can update file records
CREATE POLICY "Users can update file records they created or are assigned to" 
  ON file_records FOR UPDATE 
  TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = assigned_to_user_id);

-- Only creators can delete file records
CREATE POLICY "Users can delete their own file records" 
  ON file_records FOR DELETE 
  TO authenticated
  USING (auth.uid() = created_by);

-- Update RLS policies for filing_systems
ALTER TABLE filing_systems ENABLE ROW LEVEL SECURITY;

-- Drop existing filing_systems policies if they exist
DROP POLICY IF EXISTS "Users can view their own filing systems" ON filing_systems;
DROP POLICY IF EXISTS "Users can insert their own filing systems" ON filing_systems;
DROP POLICY IF EXISTS "Users can update their own filing systems" ON filing_systems;
DROP POLICY IF EXISTS "Users can delete their own filing systems" ON filing_systems;

-- New policies for filing_systems - only creators can manage them
CREATE POLICY "Users can view their own filing systems" 
  ON filing_systems FOR SELECT 
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own filing systems" 
  ON filing_systems FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own filing systems" 
  ON filing_systems FOR UPDATE 
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own filing systems" 
  ON filing_systems FOR DELETE 
  TO authenticated
  USING (auth.uid() = created_by);

-- Update RLS policies for requests
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

-- Drop existing request policies
DROP POLICY IF EXISTS "Users can view their own requests" ON requests;
DROP POLICY IF EXISTS "Users can insert their own requests" ON requests;
DROP POLICY IF EXISTS "Users can update their own requests" ON requests;
DROP POLICY IF EXISTS "Users can delete their own requests" ON requests;

-- New policies: All authenticated users can view requests, but only creators can modify
CREATE POLICY "All authenticated users can view requests" 
  ON requests FOR SELECT 
  TO authenticated
  USING (true);

-- Only creators can insert requests
CREATE POLICY "Users can insert their own requests" 
  ON requests FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Only creators can update requests
CREATE POLICY "Request creators can update their requests" 
  ON requests FOR UPDATE 
  TO authenticated
  USING (auth.uid() = created_by);

-- Only creators can delete requests
CREATE POLICY "Request creators can delete their requests" 
  ON requests FOR DELETE 
  TO authenticated
  USING (auth.uid() = created_by);

-- Update RLS policies for customers to allow global visibility
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Drop existing customer policies
DROP POLICY IF EXISTS "Users can view their own customers" ON customers;
DROP POLICY IF EXISTS "Users can insert their own customers" ON customers;
DROP POLICY IF EXISTS "Users can update their own customers" ON customers;
DROP POLICY IF EXISTS "Users can delete their own customers" ON customers;

-- New policies: All authenticated users can view customers, creators can modify
CREATE POLICY "All authenticated users can view customers" 
  ON customers FOR SELECT 
  TO authenticated
  USING (true);

-- Users can insert customers
CREATE POLICY "Users can insert customers" 
  ON customers FOR INSERT 
  TO authenticated
  WITH CHECK (true);

-- Users can update customers
CREATE POLICY "Users can update customers" 
  ON customers FOR UPDATE 
  TO authenticated
  USING (true);

-- Users can delete customers (this might be restricted further if needed)
CREATE POLICY "Users can delete customers" 
  ON customers FOR DELETE 
  TO authenticated
  USING (true);

-- Update RLS policies for signing_requests to work with the new document access model
ALTER TABLE signing_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing signing_requests policies
DROP POLICY IF EXISTS "Document creators can manage signing requests for their documents" ON signing_requests;
DROP POLICY IF EXISTS "Public can view signing requests" ON signing_requests;

-- Document creators can manage signing requests for their documents
CREATE POLICY "Document creators can manage signing requests for their documents" 
  ON signing_requests FOR ALL 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents 
      WHERE documents.id = signing_requests.document_id 
      AND documents.created_by = auth.uid()
    )
  );

-- Keep the public policy for viewing signing requests (needed for unauthenticated signing)
-- This policy should already exist, but let's ensure it's there
DROP POLICY IF EXISTS "Public can view signing requests" ON signing_requests;
CREATE POLICY "Public can view signing requests" 
  ON signing_requests FOR SELECT 
  TO public
  USING (true);

-- Create a helper function to get case file assignment info
CREATE OR REPLACE FUNCTION get_file_record_access_info(p_file_record_id UUID, p_user_id UUID)
RETURNS TABLE (
  can_view BOOLEAN,
  can_edit BOOLEAN,
  is_creator BOOLEAN,
  is_assigned BOOLEAN
) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (fr.created_by = p_user_id OR fr.assigned_to_user_id = p_user_id) as can_view,
    (fr.created_by = p_user_id OR fr.assigned_to_user_id = p_user_id) as can_edit,
    (fr.created_by = p_user_id) as is_creator,
    (fr.assigned_to_user_id = p_user_id) as is_assigned
  FROM file_records fr
  WHERE fr.id = p_file_record_id;
END;
$$ LANGUAGE plpgsql;

-- Create a helper function to get document creator info
CREATE OR REPLACE FUNCTION get_document_creator_info(p_document_id UUID)
RETURNS TABLE (
  creator_user_id UUID,
  creator_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.created_by as creator_user_id,
    COALESCE(p.first_name || ' ' || p.last_name, 'Unknown User') as creator_name,
    d.created_at
  FROM documents d
  LEFT JOIN profiles p ON d.created_by = p.id
  WHERE d.id = p_document_id;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON FUNCTION get_file_record_access_info IS 'Helper function to check user access permissions for case files';
COMMENT ON FUNCTION get_document_creator_info IS 'Helper function to get document creator information for display purposes';

-- Create indexes for better performance on the new access patterns
CREATE INDEX IF NOT EXISTS idx_documents_created_by_created_at ON documents(created_by, created_at);
CREATE INDEX IF NOT EXISTS idx_file_records_created_by_assigned ON file_records(created_by, assigned_to_user_id);

-- Final comments
COMMENT ON TABLE documents IS 'Documents are globally visible to all authenticated users, but only creators can modify them';
COMMENT ON TABLE file_records IS 'Case files can be assigned to users. Creators and assigned users can view/edit, only creators can delete';
