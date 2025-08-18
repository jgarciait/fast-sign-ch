-- Make filing systems, case files, and documents completely global
-- All entries should be visible to all authenticated users

-- Update RLS policies for filing_systems to be completely global
ALTER TABLE filing_systems ENABLE ROW LEVEL SECURITY;

-- Drop existing filing system policies
DROP POLICY IF EXISTS "All users can view filing systems" ON filing_systems;
DROP POLICY IF EXISTS "Users can insert filing systems" ON filing_systems;
DROP POLICY IF EXISTS "Original creators can update filing systems" ON filing_systems;
DROP POLICY IF EXISTS "Original creators can delete filing systems" ON filing_systems;

-- New global policies for filing systems
CREATE POLICY "All users can view all filing systems" 
  ON filing_systems FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "All users can insert filing systems" 
  ON filing_systems FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "All users can update all filing systems" 
  ON filing_systems FOR UPDATE 
  TO authenticated
  USING (true);

CREATE POLICY "All users can delete all filing systems" 
  ON filing_systems FOR DELETE 
  TO authenticated
  USING (true);

-- Update RLS policies for filing_indices to be completely global
ALTER TABLE filing_indices ENABLE ROW LEVEL SECURITY;

-- Drop existing filing indices policies
DROP POLICY IF EXISTS "All users can view filing indices" ON filing_indices;
DROP POLICY IF EXISTS "Original creators can manage filing indices" ON filing_indices;

-- New global policies for filing indices
CREATE POLICY "All users can view all filing indices" 
  ON filing_indices FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "All users can manage all filing indices" 
  ON filing_indices FOR ALL 
  TO authenticated
  USING (true);

-- Update RLS policies for file_records to be completely global
ALTER TABLE file_records ENABLE ROW LEVEL SECURITY;

-- Drop existing file_records policies
DROP POLICY IF EXISTS "Users can view their own or assigned file records" ON file_records;
DROP POLICY IF EXISTS "Users can insert their own file records" ON file_records;
DROP POLICY IF EXISTS "Users can update their own or assigned file records" ON file_records;
DROP POLICY IF EXISTS "File record creators can delete their file records" ON file_records;

-- New global policies for file records (case files)
CREATE POLICY "All users can view all file records" 
  ON file_records FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "All users can insert file records" 
  ON file_records FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "All users can update all file records" 
  ON file_records FOR UPDATE 
  TO authenticated
  USING (true);

CREATE POLICY "All users can delete all file records" 
  ON file_records FOR DELETE 
  TO authenticated
  USING (true);

-- Documents are already global from previous migration, but let's ensure all related policies are global

-- Update RLS policies for document_signatures to be completely global
ALTER TABLE document_signatures ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "All users can view document signatures" ON document_signatures;
DROP POLICY IF EXISTS "Document creators can insert signatures for their documents" ON document_signatures;
DROP POLICY IF EXISTS "Document creators can update signatures for their documents" ON document_signatures;
DROP POLICY IF EXISTS "Document creators can delete signatures for their documents" ON document_signatures;

-- New global policies for document signatures
CREATE POLICY "All users can view all document signatures" 
  ON document_signatures FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "All users can manage all document signatures" 
  ON document_signatures FOR ALL 
  TO authenticated
  USING (true);

-- Update RLS policies for document_annotations to be completely global
ALTER TABLE document_annotations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "All users can view document annotations" ON document_annotations;
DROP POLICY IF EXISTS "Document creators can insert annotations for their documents" ON document_annotations;
DROP POLICY IF EXISTS "Document creators can update annotations for their documents" ON document_annotations;
DROP POLICY IF EXISTS "Document creators can delete annotations for their documents" ON document_annotations;
DROP POLICY IF EXISTS "Recipients can view their own annotations" ON document_annotations;
DROP POLICY IF EXISTS "Recipients can update their own annotations" ON document_annotations;
DROP POLICY IF EXISTS "Recipients can insert their own annotations" ON document_annotations;

-- New global policies for document annotations
CREATE POLICY "All users can view all document annotations" 
  ON document_annotations FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "All users can manage all document annotations" 
  ON document_annotations FOR ALL 
  TO authenticated
  USING (true);

-- Update RLS policies for signing_requests to be completely global for authenticated users
ALTER TABLE signing_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Document creators can manage signing requests for their documents" ON signing_requests;

-- New global policy for authenticated users (keep public policy for unauthenticated signing)
CREATE POLICY "All users can manage all signing requests" 
  ON signing_requests FOR ALL 
  TO authenticated
  USING (true);

-- Keep the public policy for viewing signing requests (needed for unauthenticated signing)
-- This policy should already exist, but let's ensure it's there
DROP POLICY IF EXISTS "Public can view signing requests" ON signing_requests;
CREATE POLICY "Public can view signing requests" 
  ON signing_requests FOR SELECT 
  TO public
  USING (true);

-- Update RLS policies for documents to be completely global (they should already be global for viewing)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "All authenticated users can view documents" ON documents;
DROP POLICY IF EXISTS "Users can insert their own documents" ON documents;
DROP POLICY IF EXISTS "Document creators can update their documents" ON documents;
DROP POLICY IF EXISTS "Document creators can delete their documents" ON documents;

-- New completely global policies for documents
CREATE POLICY "All users can view all documents" 
  ON documents FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "All users can insert documents" 
  ON documents FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "All users can update all documents" 
  ON documents FOR UPDATE 
  TO authenticated
  USING (true);

CREATE POLICY "All users can delete all documents" 
  ON documents FOR DELETE 
  TO authenticated
  USING (true);

-- Update comments to reflect global access
COMMENT ON TABLE filing_systems IS 'Filing systems are globally visible and editable by all authenticated users';
COMMENT ON TABLE filing_indices IS 'Filing indices are globally visible and editable by all authenticated users';
COMMENT ON TABLE file_records IS 'Case files are globally visible and editable by all authenticated users. Creator and assignment info maintained for reference.';
COMMENT ON TABLE documents IS 'Documents are globally visible and editable by all authenticated users. Creator info maintained for reference.';

-- Update the helper function description
COMMENT ON FUNCTION get_file_record_access_info IS 'Helper function to get case file creator and assignment info (all users have full access)';
COMMENT ON FUNCTION get_document_creator_info IS 'Helper function to get document creator information for display purposes';

-- Final comment
COMMENT ON SCHEMA public IS 'All filing systems, case files, and documents are globally accessible to authenticated users';
