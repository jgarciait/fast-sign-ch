-- Migration to update archived status based on file_record_id linkage
-- Documents linked to file_records should be archived=true
-- Documents not linked to file_records should be archived=false

-- This migration ensures consistency between the archived field and file_record_id linkage

BEGIN;

-- Update documents that are linked to file_records to be archived
UPDATE documents 
SET archived = true, 
    updated_at = NOW()
WHERE file_record_id IS NOT NULL 
  AND (archived IS NULL OR archived = false);

-- Update documents that are not linked to file_records to be unarchived  
UPDATE documents 
SET archived = false, 
    updated_at = NOW()
WHERE file_record_id IS NULL 
  AND (archived IS NULL OR archived = true);

-- Add comment to explain the relationship
COMMENT ON COLUMN documents.archived IS 'Indicates if document is archived in expedientes. Should be true when file_record_id is set, false when null.';

-- Create a trigger to automatically maintain this relationship going forward
CREATE OR REPLACE FUNCTION update_document_archived_status()
RETURNS TRIGGER AS $$
BEGIN
    -- When file_record_id is set, ensure archived is true
    IF NEW.file_record_id IS NOT NULL THEN
        NEW.archived = true;
    -- When file_record_id is null, ensure archived is false
    ELSIF NEW.file_record_id IS NULL THEN
        NEW.archived = false;
    END IF;
    
    -- Always update the timestamp
    NEW.updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that fires before INSERT or UPDATE on documents table
DROP TRIGGER IF EXISTS trigger_update_document_archived_status ON documents;
CREATE TRIGGER trigger_update_document_archived_status
    BEFORE INSERT OR UPDATE OF file_record_id
    ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_document_archived_status();

-- Verify the migration results
-- Count documents by archive status
DO $$
DECLARE
    archived_count INTEGER;
    unarchived_count INTEGER;
    linked_count INTEGER;
    unlinked_count INTEGER;
BEGIN
    -- Count archived documents
    SELECT COUNT(*) INTO archived_count FROM documents WHERE archived = true;
    
    -- Count unarchived documents  
    SELECT COUNT(*) INTO unarchived_count FROM documents WHERE archived = false;
    
    -- Count linked documents
    SELECT COUNT(*) INTO linked_count FROM documents WHERE file_record_id IS NOT NULL;
    
    -- Count unlinked documents
    SELECT COUNT(*) INTO unlinked_count FROM documents WHERE file_record_id IS NULL;
    
    -- Display results
    RAISE NOTICE 'Migration Results:';
    RAISE NOTICE 'Archived documents: %', archived_count;
    RAISE NOTICE 'Unarchived documents: %', unarchived_count;
    RAISE NOTICE 'Documents linked to expedientes: %', linked_count;
    RAISE NOTICE 'Documents not linked to expedientes: %', unlinked_count;
    
    -- Verify consistency
    IF archived_count = linked_count AND unarchived_count = unlinked_count THEN
        RAISE NOTICE 'SUCCESS: Archive status is consistent with file_record_id linkage';
    ELSE
        RAISE WARNING 'WARNING: Inconsistency detected between archived status and file_record_id linkage';
    END IF;
END $$;

COMMIT;
