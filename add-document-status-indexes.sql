-- Add indexes for document status queries to improve performance
-- These indexes will help with the new status system in fast-sign-docs

-- Only drop and recreate the specific composite indexes that we're optimizing
DROP INDEX IF EXISTS idx_documents_email_fastsign_archived_created;
DROP INDEX IF EXISTS idx_documents_type_archived_created_by;

-- Index for document_signature_mappings by document_id
-- This will speed up queries checking if a document has mappings
CREATE INDEX IF NOT EXISTS idx_document_signature_mappings_document_id 
ON document_signature_mappings(document_id);

-- Index for signing_requests by document_id
-- This will speed up queries checking if a document has signing requests
CREATE INDEX IF NOT EXISTS idx_signing_requests_document_id 
ON signing_requests(document_id);

-- Index for signing_requests by document_id and signed_at
-- This will speed up queries checking if a document has completed signing requests
CREATE INDEX IF NOT EXISTS idx_signing_requests_document_id_signed_at 
ON signing_requests(document_id, signed_at);

-- Index for document_signatures by document_id
-- This will speed up queries checking if a document has signatures
CREATE INDEX IF NOT EXISTS idx_document_signatures_document_id 
ON document_signatures(document_id);

-- Index for document_annotations by document_id
-- This will speed up queries checking if a document has annotation signatures
CREATE INDEX IF NOT EXISTS idx_document_annotations_document_id 
ON document_annotations(document_id);

-- Index for documents by document_type and archived for fast-sign-docs queries
-- This will speed up the main document listing queries
CREATE INDEX IF NOT EXISTS idx_documents_type_archived_created 
ON documents(document_type, archived, created_at DESC);

-- Index for documents supporting both email and fast_sign types in fast-sign-docs
-- This will speed up queries when showing both types of documents
CREATE INDEX IF NOT EXISTS idx_documents_email_fastsign_archived_created 
ON documents(archived, created_at DESC) 
WHERE document_type IN ('email', 'fast_sign');

-- Index for documents by created_by for user-specific queries
-- This will speed up queries when filtering by user
CREATE INDEX IF NOT EXISTS idx_documents_created_by 
ON documents(created_by);

-- Composite index for documents filtering by type, archived, and created_by
-- This will speed up queries when filtering by user and showing only their documents
CREATE INDEX IF NOT EXISTS idx_documents_type_archived_created_by 
ON documents(document_type, archived, created_by, created_at DESC);

-- Index for signature_mapping_templates by document_mapping_id
-- This will speed up template usage checking
CREATE INDEX IF NOT EXISTS idx_signature_mapping_templates_document_mapping_id 
ON signature_mapping_templates(document_mapping_id);

-- Analyze tables to update statistics after creating indexes
ANALYZE document_signature_mappings;
ANALYZE signing_requests;
ANALYZE document_signatures;
ANALYZE document_annotations;
ANALYZE documents;
ANALYZE signature_mapping_templates; 