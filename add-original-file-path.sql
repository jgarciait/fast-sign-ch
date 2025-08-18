-- Add original_file_path column to documents for versioning (original vs signed)
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS original_file_path text;

-- Helpful index for queries filtering by original_file_path
CREATE INDEX IF NOT EXISTS idx_documents_original_file_path ON documents (original_file_path);

