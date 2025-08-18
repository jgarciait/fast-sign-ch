-- Storage policies for public-documents bucket
-- Note: Run these one by one in the Supabase SQL Editor

-- First, ensure the bucket exists and is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'public-documents', 
  'public-documents', 
  true, 
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated uploads to public-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to public-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access to public-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view public-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete public-documents" ON storage.objects;

-- Policy 1: Allow authenticated users to INSERT (upload) files to public-documents bucket
CREATE POLICY "Allow authenticated uploads to public-documents" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'public-documents');

-- Policy 2: Allow authenticated users to SELECT (view) files in public-documents bucket
CREATE POLICY "Allow authenticated users to view public-documents" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (bucket_id = 'public-documents');

-- Policy 3: Allow public (unauthenticated) users to SELECT (view) files in public-documents bucket
CREATE POLICY "Allow public access to public-documents" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'public-documents');

-- Policy 4: Allow authenticated users to UPDATE files in public-documents bucket
CREATE POLICY "Allow authenticated updates to public-documents" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'public-documents')
WITH CHECK (bucket_id = 'public-documents');

-- Policy 5: Allow authenticated users to DELETE files in public-documents bucket
CREATE POLICY "Allow authenticated users to delete public-documents" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'public-documents');
