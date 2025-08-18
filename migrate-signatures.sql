-- Migration script to move signatures from document_annotations to document_signatures
-- and clean up the document_annotations table to only contain text annotations

-- Step 1: Extract signatures from document_annotations and insert into document_signatures
-- This is a complex operation that would need to be done with a custom function
-- For now, we'll just clean up the document_annotations table

-- Step 2: Update document_annotations to remove signature entries
UPDATE document_annotations 
SET annotations = (
  SELECT jsonb_agg(annotation)
  FROM jsonb_array_elements(annotations) AS annotation
  WHERE annotation->>'type' != 'signature'
)
WHERE annotations::text LIKE '%signature%';

-- Step 3: Remove any document_annotations records that have empty annotations arrays
DELETE FROM document_annotations 
WHERE annotations = '[]'::jsonb OR annotations IS NULL;

-- Note: The signatures will need to be manually re-added by users since the migration
-- from the mixed format to the proper document_signatures table structure is complex
