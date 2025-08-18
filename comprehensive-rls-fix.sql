-- Comprehensive RLS Fix for Storage and Document Issues
-- Run this in Supabase SQL Editor to fix the upload errors

-- =============================================================================
-- PART 1: Fix Storage Policies for public-documents bucket
-- =============================================================================

-- Ensure the bucket exists and is properly configured
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'public-documents', 
  'public-documents', 
  true, 
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];

-- Drop ALL existing storage policies to avoid conflicts
DROP POLICY IF EXISTS "authenticated_upload_policy" ON storage.objects;
DROP POLICY IF EXISTS "public_read_policy" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to public-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to public-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access to public-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view public-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete public-documents" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_users_can_upload" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_users_can_view" ON storage.objects;
DROP POLICY IF EXISTS "public_users_can_view" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_users_can_update" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_users_can_delete" ON storage.objects;

-- Create simple, working storage policies
CREATE POLICY "storage_authenticated_upload" 
ON storage.objects 
FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'public-documents');

CREATE POLICY "storage_authenticated_view" 
ON storage.objects 
FOR SELECT 
TO authenticated 
USING (bucket_id = 'public-documents');

CREATE POLICY "storage_public_view" 
ON storage.objects 
FOR SELECT 
TO public 
USING (bucket_id = 'public-documents');

CREATE POLICY "storage_authenticated_update" 
ON storage.objects 
FOR UPDATE 
TO authenticated 
USING (bucket_id = 'public-documents')
WITH CHECK (bucket_id = 'public-documents');

CREATE POLICY "storage_authenticated_delete" 
ON storage.objects 
FOR DELETE 
TO authenticated 
USING (bucket_id = 'public-documents');

-- =============================================================================
-- PART 2: Fix Document Table RLS Policies
-- =============================================================================

-- Drop the incorrect document policy that uses user_id
DROP POLICY IF EXISTS "All users can insert documents" ON documents;

-- Create the correct policy that uses created_by (which is what the code actually uses)
CREATE POLICY "documents_authenticated_insert" 
  ON documents FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Ensure other document policies are correct
DROP POLICY IF EXISTS "All users can view all documents" ON documents;
DROP POLICY IF EXISTS "All users can update all documents" ON documents;
DROP POLICY IF EXISTS "All users can delete all documents" ON documents;

CREATE POLICY "documents_authenticated_view" 
  ON documents FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "documents_authenticated_update" 
  ON documents FOR UPDATE 
  TO authenticated
  USING (true);

CREATE POLICY "documents_authenticated_delete" 
  ON documents FOR DELETE 
  TO authenticated
  USING (true);

-- =============================================================================
-- PART 3: Verification Queries
-- =============================================================================

-- Check storage policies
SELECT 'STORAGE POLICIES' as section, schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects'
AND policyname LIKE '%storage_%'
ORDER BY policyname;

-- Check document policies  
SELECT 'DOCUMENT POLICIES' as section, schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'documents'
AND policyname LIKE '%documents_%'
ORDER BY policyname;

-- Check document table structure
SELECT 'DOCUMENT TABLE STRUCTURE' as section, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'documents'
AND column_name IN ('user_id', 'created_by', 'id')
ORDER BY column_name;

-- Check bucket configuration
SELECT 'BUCKET CONFIG' as section, id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets 
WHERE id = 'public-documents';