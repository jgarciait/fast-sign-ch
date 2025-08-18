-- Update archived status based on file_record_id relationship
-- This ensures consistency between archived field and expediente linking

BEGIN;

-- Step 1: Update documents that have file_record_id to archived = true
UPDATE documents 
SET archived = true, 
    updated_at = NOW()
WHERE file_record_id IS NOT NULL 
  AND (archived IS NULL OR archived = false);

-- Step 2: Update documents that don't have file_record_id to archived = false  
UPDATE documents 
SET archived = false, 
    updated_at = NOW()
WHERE file_record_id IS NULL 
  AND (archived IS NULL OR archived = true);

-- Step 3: Verify the results
DO $$
DECLARE
    archived_count INTEGER;
    unarchived_count INTEGER;
    linked_count INTEGER;
    unlinked_count INTEGER;
    total_documents INTEGER;
BEGIN
    -- Count archived documents
    SELECT COUNT(*) INTO archived_count FROM documents WHERE archived = true;
    
    -- Count unarchived documents  
    SELECT COUNT(*) INTO unarchived_count FROM documents WHERE archived = false;
    
    -- Count linked documents
    SELECT COUNT(*) INTO linked_count FROM documents WHERE file_record_id IS NOT NULL;
    
    -- Count unlinked documents
    SELECT COUNT(*) INTO unlinked_count FROM documents WHERE file_record_id IS NULL;
    
    -- Count total documents
    SELECT COUNT(*) INTO total_documents FROM documents;
    
    -- Display results
    RAISE NOTICE '=== MIGRATION RESULTS ===';
    RAISE NOTICE 'Total documents: %', total_documents;
    RAISE NOTICE 'Archived documents (archived = true): %', archived_count;
    RAISE NOTICE 'Unarchived documents (archived = false): %', unarchived_count;
    RAISE NOTICE 'Documents linked to expedientes (file_record_id IS NOT NULL): %', linked_count;
    RAISE NOTICE 'Documents not linked to expedientes (file_record_id IS NULL): %', unlinked_count;
    
    -- Verify consistency
    IF archived_count = linked_count AND unarchived_count = unlinked_count THEN
        RAISE NOTICE '✅ SUCCESS: Archive status is now consistent with file_record_id linkage';
    ELSE
        RAISE WARNING '❌ WARNING: Inconsistency detected between archived status and file_record_id linkage';
        RAISE WARNING 'Expected: archived_count (%) = linked_count (%), unarchived_count (%) = unlinked_count (%)', 
                     archived_count, linked_count, unarchived_count, unlinked_count;
    END IF;
END $$;

-- Step 4: Show sample of updated records
SELECT 
    'SAMPLE OF UPDATED RECORDS' as info,
    id,
    file_name,
    archived,
    file_record_id,
    CASE 
        WHEN file_record_id IS NOT NULL THEN '✅ Linked to expediente'
        ELSE '❌ Not linked'
    END as status
FROM documents 
ORDER BY updated_at DESC 
LIMIT 10;

COMMIT;
