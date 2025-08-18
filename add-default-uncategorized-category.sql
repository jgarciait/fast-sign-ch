-- Add default "Sin Categorizar" category for all existing file records
-- and create a function to automatically create it for new file records

-- First, let's add the default category for all existing file records that don't have one
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
)
SELECT 
  gen_random_uuid(),
  fr.id,
  'Sin Categorizar',
  'Documentos sin categoría específica',
  '#6B7280',
  'inbox',
  0,
  fr.created_by, -- Use the same user who created the file record
  NOW(),
  NOW()
FROM file_records fr
WHERE NOT EXISTS (
  SELECT 1 FROM document_categories dc 
  WHERE dc.file_record_id = fr.id 
  AND dc.name = 'Sin Categorizar'
);

-- Function to automatically create "Sin Categorizar" category for new file records
CREATE OR REPLACE FUNCTION create_default_category_for_file_record()
RETURNS TRIGGER AS $$
BEGIN
  -- Create the default "Sin Categorizar" category for the new file record
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
    NEW.created_by, -- Use the same user who created the file record
    NOW(),
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically create default category for new file records
DROP TRIGGER IF EXISTS trigger_create_default_category ON file_records;
CREATE TRIGGER trigger_create_default_category
  AFTER INSERT ON file_records
  FOR EACH ROW
  EXECUTE FUNCTION create_default_category_for_file_record();

-- Update all existing documents that have category_id = NULL to use the default category
UPDATE documents 
SET category_id = (
  SELECT dc.id 
  FROM document_categories dc 
  WHERE dc.file_record_id = documents.file_record_id 
  AND dc.name = 'Sin Categorizar'
  LIMIT 1
),
updated_at = NOW()
WHERE category_id IS NULL 
AND file_record_id IS NOT NULL;

-- Add constraint to prevent deletion of "Sin Categorizar" category
CREATE OR REPLACE FUNCTION prevent_default_category_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.name = 'Sin Categorizar' THEN
    RAISE EXCEPTION 'Cannot delete the default "Sin Categorizar" category';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_default_category_deletion ON document_categories;
CREATE TRIGGER trigger_prevent_default_category_deletion
  BEFORE DELETE ON document_categories
  FOR EACH ROW
  EXECUTE FUNCTION prevent_default_category_deletion();

-- Function to move documents to default category when a category is deleted
CREATE OR REPLACE FUNCTION move_documents_to_default_category()
RETURNS TRIGGER AS $$
DECLARE
  default_category_id UUID;
BEGIN
  -- Don't allow deletion of "Sin Categorizar" category
  IF OLD.name = 'Sin Categorizar' THEN
    RAISE EXCEPTION 'Cannot delete the default "Sin Categorizar" category';
  END IF;
  
  -- Get the default category ID for this file record
  SELECT id INTO default_category_id
  FROM document_categories 
  WHERE file_record_id = OLD.file_record_id 
  AND name = 'Sin Categorizar'
  LIMIT 1;
  
  -- Move all documents from the deleted category to the default category
  IF default_category_id IS NOT NULL THEN
    UPDATE documents 
    SET category_id = default_category_id,
        updated_at = NOW()
    WHERE category_id = OLD.id;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_move_documents_to_default_category ON document_categories;
CREATE TRIGGER trigger_move_documents_to_default_category
  BEFORE DELETE ON document_categories
  FOR EACH ROW
  EXECUTE FUNCTION move_documents_to_default_category();

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_document_categories_file_record_name 
ON document_categories(file_record_id, name);

-- Verify the changes
SELECT 
  fr.id as file_record_id,
  dc.name as default_category_name,
  dc.color,
  dc.icon,
  COUNT(d.id) as document_count
FROM file_records fr
LEFT JOIN document_categories dc ON fr.id = dc.file_record_id AND dc.name = 'Sin Categorizar'
LEFT JOIN documents d ON dc.id = d.category_id
GROUP BY fr.id, dc.name, dc.color, dc.icon
ORDER BY fr.id;
