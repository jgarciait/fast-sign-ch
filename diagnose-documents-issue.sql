-- Diagnostic script to check documents table structure and RLS policies
-- Run this in Supabase SQL Editor to understand the current state

-- 1. Check documents table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'documents' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check current RLS policies on documents table
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'documents' 
    AND schemaname = 'public';

-- 3. Check if RLS is enabled on documents table
SELECT 
    tablename,
    rowsecurity,
    relname
FROM pg_tables pt
JOIN pg_class pc ON pt.tablename = pc.relname
WHERE pt.tablename = 'documents' 
    AND pt.schemaname = 'public';

-- 4. Test if we can see any documents (this should work if SELECT policies are correct)
SELECT COUNT(*) as document_count FROM documents;

-- 5. Check the auth.users table to see if there are any users
SELECT 
    id,
    email,
    created_at
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;

-- 6. Check if there are any constraints that might cause issues
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'documents' 
    AND tc.table_schema = 'public'; 