-- Migration: Rename user_id to created_by in documents table
-- This makes it clearer that the column represents who created the document,
-- not who owns it (since access is now global)

BEGIN;

-- Rename the column in the documents table
ALTER TABLE documents RENAME COLUMN user_id TO created_by;

-- Update any indexes that reference the old column name
-- (Check if there are any indexes on user_id first)
-- DROP INDEX IF EXISTS idx_documents_user_id;
-- CREATE INDEX idx_documents_created_by ON documents(created_by);

-- Update any foreign key constraints if they exist
-- (The schema shows user_id doesn't have foreign key constraints, so this may not be needed)

-- Update RLS policies if they reference the old column name
-- Since we're using global access now, the RLS policies should already be updated
-- but we should check if any policies still reference user_id

COMMIT;
