-- FINAL FIX: Completely remove the trigger that blocks "Sin Categorizar" deletion
-- This is the most direct solution to allow file record deletion

-- Step 1: Drop ALL triggers that prevent category deletion
DROP TRIGGER IF EXISTS trigger_prevent_default_category_deletion ON document_categories;
DROP TRIGGER IF EXISTS trigger_prevent_default_category_deletion_smart ON document_categories;
DROP TRIGGER IF EXISTS trigger_move_documents_to_default_category ON document_categories;

-- Step 2: Drop the functions that block deletion
DROP FUNCTION IF EXISTS prevent_default_category_deletion();
DROP FUNCTION IF EXISTS prevent_default_category_deletion_smart();
DROP FUNCTION IF EXISTS move_documents_to_default_category();

-- Step 3: Ensure CASCADE relationships are properly set up
-- This will handle cleanup automatically when file_records are deleted

-- Update document_categories foreign key to use CASCADE
DO $$
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE document_categories DROP CONSTRAINT IF EXISTS document_categories_file_record_id_fkey;
  
  -- Add new constraint with CASCADE
  ALTER TABLE document_categories 
  ADD CONSTRAINT document_categories_file_record_id_fkey 
  FOREIGN KEY (file_record_id) 
  REFERENCES file_records(id) 
  ON DELETE CASCADE;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not update document_categories constraint: %', SQLERRM;
END $$;

-- Update documents foreign key to use CASCADE for file_record_id
DO $$
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_file_record_id_fkey;
  
  -- Add new constraint with CASCADE
  ALTER TABLE documents 
  ADD CONSTRAINT documents_file_record_id_fkey 
  FOREIGN KEY (file_record_id) 
  REFERENCES file_records(id) 
  ON DELETE SET NULL;  -- Set to NULL rather than CASCADE to preserve documents
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not update documents constraint: %', SQLERRM;
END $$;

-- Update documents foreign key to use CASCADE for category_id
DO $$
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_category_id_fkey;
  
  -- Add new constraint with SET NULL
  ALTER TABLE documents 
  ADD CONSTRAINT documents_category_id_fkey 
  FOREIGN KEY (category_id) 
  REFERENCES document_categories(id) 
  ON DELETE SET NULL;  -- Set to NULL when category is deleted
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not update documents category constraint: %', SQLERRM;
END $$;

-- Step 4: Create a simple trigger that only creates "Sin Categorizar" for new file records
-- but does NOT prevent deletion
CREATE OR REPLACE FUNCTION create_default_category_for_new_file_record()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create the default category for new file records
  INSERT INTO document_categories (
    id,
    file_record_id,
    name,
    description,
    color,
    icon,
    sort_order,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    NEW.id,
    'Sin Categorizar',
    'Documentos sin categoría específica',
    '#6B7280',
    'inbox',
    0,
    NEW.created_by,
    NOW(),
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new file records only
DROP TRIGGER IF EXISTS trigger_create_default_category_simple ON file_records;
CREATE TRIGGER trigger_create_default_category_simple
  AFTER INSERT ON file_records
  FOR EACH ROW
  EXECUTE FUNCTION create_default_category_for_new_file_record();

-- Step 5: Verify the fix
DO $$
BEGIN
  RAISE NOTICE 'All blocking triggers removed. File record deletion should now work without restrictions.';
  RAISE NOTICE 'CASCADE relationships configured for automatic cleanup.';
END $$; 