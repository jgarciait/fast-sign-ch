-- Add file_record_id column to documents table for case file linking
-- This column links documents to file records in the filing system

-- Add the column with foreign key constraint
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS file_record_id UUID REFERENCES file_records(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_documents_file_record 
ON documents(file_record_id);

-- Add comment for documentation
COMMENT ON COLUMN documents.file_record_id IS 'Links document to a file record in the filing system for organization';
