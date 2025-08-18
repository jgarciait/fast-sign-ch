-- Fix RLS policies for documents table to support both authenticated and anonymous users
-- This solves the "new row violates row-level security policy" error
-- Anonymous users need access for email-based signature links

-- Update RLS policies for documents table
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "All users can view all documents" ON documents;
DROP POLICY IF EXISTS "All users can insert documents" ON documents;
DROP POLICY IF EXISTS "All users can update all documents" ON documents;
DROP POLICY IF EXISTS "All users can delete all documents" ON documents;
DROP POLICY IF EXISTS "Public can view documents" ON documents;
DROP POLICY IF EXISTS "Authenticated users can view documents" ON documents;
DROP POLICY IF EXISTS "Users can view their own documents" ON documents;
DROP POLICY IF EXISTS "Users can insert their own documents" ON documents;
DROP POLICY IF EXISTS "Document creators can update their documents" ON documents;
DROP POLICY IF EXISTS "Document creators can delete their documents" ON documents;

-- New policies for documents supporting both authenticated and anonymous access

-- 1. PUBLIC can view documents (needed for anonymous signature links)
CREATE POLICY "Public can view documents" 
  ON documents FOR SELECT 
  TO public
  USING (true);

-- 2. AUTHENTICATED users can view all documents
CREATE POLICY "Authenticated users can view documents" 
  ON documents FOR SELECT 
  TO authenticated
  USING (true);

-- 3. AUTHENTICATED users can insert documents (using correct column name)
CREATE POLICY "Authenticated users can insert documents" 
  ON documents FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- 4. AUTHENTICATED users can update all documents (global access)
CREATE POLICY "Authenticated users can update documents" 
  ON documents FOR UPDATE 
  TO authenticated
  USING (true);

-- 5. AUTHENTICATED users can delete all documents (global access)
CREATE POLICY "Authenticated users can delete documents" 
  ON documents FOR DELETE 
  TO authenticated
  USING (true);

-- Update comment to reflect the access model
COMMENT ON TABLE documents IS 'Documents are publicly readable (for signature links) and globally editable by authenticated users. Creator info maintained via created_by column.'; 