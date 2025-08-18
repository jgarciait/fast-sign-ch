-- Fix archived column to have proper default and not be nullable
-- First, update any NULL values to false
UPDATE documents SET archived = FALSE WHERE archived IS NULL;

-- Then alter the column to set default and make it not nullable
ALTER TABLE documents ALTER COLUMN archived SET DEFAULT FALSE;
ALTER TABLE documents ALTER COLUMN archived SET NOT NULL;

-- Also ensure document_type has proper default for existing records
UPDATE documents SET document_type = 'email' WHERE document_type IS NULL;
