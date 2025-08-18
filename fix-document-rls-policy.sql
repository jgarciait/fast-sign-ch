-- Fix document RLS policy to use created_by instead of user_id
-- Run this in Supabase SQL Editor

-- First, let's check the current document table structure
-- The documents table uses 'created_by' field, not 'user_id'

-- Drop the incorrect policy that uses user_id
DROP POLICY IF EXISTS "All users can insert documents" ON documents;

-- Create the correct policy that uses created_by
CREATE POLICY "All users can insert documents" 
  ON documents FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Verify the current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'documents'
ORDER BY policyname;

-- Also check the table structure to confirm field names
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'documents'
AND column_name IN ('user_id', 'created_by')
ORDER BY column_name;