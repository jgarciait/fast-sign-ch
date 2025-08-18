-- Fix storage RLS issue for public-documents bucket
-- Run this in Supabase SQL Editor

-- First, check if the bucket exists and ensure it's properly configured
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

-- Drop ALL existing storage policies to start fresh
DROP POLICY IF EXISTS "authenticated_upload_policy" ON storage.objects;
DROP POLICY IF EXISTS "public_read_policy" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to public-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to public-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access to public-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view public-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete public-documents" ON storage.objects;

-- Create simple, permissive policies for the public-documents bucket
-- Policy 1: Allow authenticated users to upload files
CREATE POLICY "authenticated_users_can_upload" 
ON storage.objects 
FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'public-documents');

-- Policy 2: Allow authenticated users to view files
CREATE POLICY "authenticated_users_can_view" 
ON storage.objects 
FOR SELECT 
TO authenticated 
USING (bucket_id = 'public-documents');

-- Policy 3: Allow public (unauthenticated) users to view files
CREATE POLICY "public_users_can_view" 
ON storage.objects 
FOR SELECT 
TO public 
USING (bucket_id = 'public-documents');

-- Policy 4: Allow authenticated users to update files
CREATE POLICY "authenticated_users_can_update" 
ON storage.objects 
FOR UPDATE 
TO authenticated 
USING (bucket_id = 'public-documents')
WITH CHECK (bucket_id = 'public-documents');

-- Policy 5: Allow authenticated users to delete files
CREATE POLICY "authenticated_users_can_delete" 
ON storage.objects 
FOR DELETE 
TO authenticated 
USING (bucket_id = 'public-documents');

-- Verify the policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;