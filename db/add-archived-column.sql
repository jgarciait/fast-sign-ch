-- Add archived column to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

-- Add document_type column to distinguish Fast Sign documents from regular email-based documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'email';

-- Update existing documents to be 'email' type
UPDATE documents SET document_type = 'email' WHERE document_type IS NULL;

-- Make recipient_email optional for Fast Sign documents
ALTER TABLE documents ALTER COLUMN recipient_email DROP NOT NULL;

-- Add index for better performance on archived and document_type queries
CREATE INDEX IF NOT EXISTS idx_documents_archived ON documents(archived);
CREATE INDEX IF NOT EXISTS idx_documents_document_type ON documents(document_type);

-- Add comment to explain the new columns
COMMENT ON COLUMN documents.archived IS 'Whether the document is archived (hidden from active view)';
COMMENT ON COLUMN documents.document_type IS 'Type of document: email (traditional) or fast_sign (Fast Sign documents)';
