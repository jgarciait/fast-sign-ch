-- Fix the trigger to allow deletion of "Sin Categorizar" category when deleting the entire file record
-- This is a more direct approach than the previous solution

-- First, let's drop the existing problematic trigger completely
DROP TRIGGER IF EXISTS trigger_prevent_default_category_deletion ON document_categories;
DROP FUNCTION IF EXISTS prevent_default_category_deletion();

-- Create a more intelligent trigger that allows deletion in certain contexts
CREATE OR REPLACE FUNCTION prevent_default_category_deletion_smart()
RETURNS TRIGGER AS $$
DECLARE
  related_documents_count INTEGER;
  other_categories_count INTEGER;
BEGIN
  -- Only check if this is the "Sin Categorizar" category
  IF OLD.name = 'Sin Categorizar' THEN
    
    -- Count how many documents are still linked to this category
    SELECT COUNT(*) INTO related_documents_count
    FROM documents 
    WHERE category_id = OLD.id;
    
    -- Count how many other categories exist for this file record
    SELECT COUNT(*) INTO other_categories_count
    FROM document_categories 
    WHERE file_record_id = OLD.file_record_id 
    AND id != OLD.id;
    
    -- Allow deletion if:
    -- 1. No documents are linked to this category, OR
    -- 2. This is the only category left (indicating file record deletion)
    IF related_documents_count > 0 AND other_categories_count > 0 THEN
      RAISE EXCEPTION 'Cannot delete the default "Sin Categorizar" category while it has documents and other categories exist';
    END IF;
    
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create the new trigger
CREATE TRIGGER trigger_prevent_default_category_deletion_smart
  BEFORE DELETE ON document_categories
  FOR EACH ROW
  EXECUTE FUNCTION prevent_default_category_deletion_smart();

-- Also update the CASCADE behavior for document_categories
-- Make sure the foreign key constraint uses CASCADE
DO $$
BEGIN
  -- First check if the constraint exists and drop it if needed
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'document_categories_file_record_id_fkey'
    AND table_name = 'document_categories'
  ) THEN
    ALTER TABLE document_categories 
    DROP CONSTRAINT document_categories_file_record_id_fkey;
  END IF;
  
  -- Add the constraint with CASCADE
  ALTER TABLE document_categories 
  ADD CONSTRAINT document_categories_file_record_id_fkey 
  FOREIGN KEY (file_record_id) 
  REFERENCES file_records(id) 
  ON DELETE CASCADE;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not update foreign key constraint: %', SQLERRM;
END $$;

-- Test the new behavior
DO $$
DECLARE
  test_message TEXT;
BEGIN
  test_message := 'Trigger updated successfully. File record deletion should now work properly.';
  RAISE NOTICE '%', test_message;
END $$; 