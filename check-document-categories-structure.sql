-- Check the structure of document_categories table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'document_categories' 
ORDER BY ordinal_position;

-- Check if there are any existing "Sin Categorizar" categories
SELECT 
    dc.id,
    dc.file_record_id,
    dc.name,
    dc.created_by,
    fr.id as file_record_id_name
FROM document_categories dc
JOIN file_records fr ON dc.file_record_id = fr.id
WHERE dc.name = 'Sin Categorizar'
ORDER BY fr.id;

-- Check documents without category_id
SELECT 
    d.id,
    d.file_name,
    d.file_record_id,
    d.category_id
FROM documents d
WHERE d.category_id IS NULL
LIMIT 10;
