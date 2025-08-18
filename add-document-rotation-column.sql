-- Add rotation column to documents table to track cumulative rotations
-- This allows the single rotation button to work properly

ALTER TABLE documents 
ADD COLUMN rotation INTEGER DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN documents.rotation IS 'Cumulative rotation in degrees (0, 90, 180, 270)';

-- Update existing documents to have 0 rotation
UPDATE documents SET rotation = 0 WHERE rotation IS NULL;
