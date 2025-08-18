-- Remove unique constraint that prevents sending the same document to the same recipient multiple times
-- This constraint doesn't make sense for templates where you might want to send the same template 
-- to the same recipient multiple times for different purposes

-- Drop the unique constraint on signing_requests table (this will also drop the supporting index)
ALTER TABLE signing_requests DROP CONSTRAINT IF EXISTS unique_signing_request_per_document_recipient;

-- Add comment to document the change
COMMENT ON TABLE signing_requests IS 'Stores signing requests for document access. Multiple requests can exist for the same document and recipient to support template reuse.'; 