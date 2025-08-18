-- Minimal fix for storage policies
-- Run this in Supabase SQL Editor

-- Ensure the public-documents bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('public-documents', 'public-documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Simple policy to allow authenticated users to upload files
CREATE POLICY "authenticated_upload_policy" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'public-documents');

-- Simple policy to allow public read access
CREATE POLICY "public_read_policy" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'public-documents');
