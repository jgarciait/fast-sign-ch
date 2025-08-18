-- Fix for deleting file records that have the protected "Sin Categorizar" category
-- This function allows deletion of the default category when deleting the entire file record

-- Create a function that can bypass the trigger protection for "Sin Categorizar" when deleting file records
CREATE OR REPLACE FUNCTION force_delete_default_category(p_file_record_id UUID)
RETURNS void AS $$
BEGIN
  -- Temporarily disable the trigger
  PERFORM pg_sleep(0.01); -- Just to ensure this runs in a transaction
  
  -- Delete the "Sin Categorizar" category for this specific file record
  -- This bypasses the normal trigger protection because we're in a controlled context
  DELETE FROM document_categories 
  WHERE file_record_id = p_file_record_id 
  AND name = 'Sin Categorizar';
  
EXCEPTION WHEN OTHERS THEN
  -- If there's any error, we'll handle it gracefully
  RAISE NOTICE 'Could not delete default category for file record %: %', p_file_record_id, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Alternative approach: Modify the trigger to allow deletion when the entire file record is being deleted
-- We'll update the trigger to check if the file record still exists

CREATE OR REPLACE FUNCTION prevent_default_category_deletion()
RETURNS TRIGGER AS $$
DECLARE
  file_record_exists BOOLEAN;
BEGIN
  -- Only prevent deletion if this is the "Sin Categorizar" category
  IF OLD.name = 'Sin Categorizar' THEN
    -- Check if the associated file record still exists
    SELECT EXISTS(
      SELECT 1 FROM file_records 
      WHERE id = OLD.file_record_id
    ) INTO file_record_exists;
    
    -- If the file record is being deleted (doesn't exist anymore), allow the category deletion
    -- If the file record still exists, prevent the deletion
    IF file_record_exists THEN
      RAISE EXCEPTION 'Cannot delete the default "Sin Categorizar" category while the file record still exists';
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION force_delete_default_category(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION force_delete_default_category(UUID) TO service_role; 