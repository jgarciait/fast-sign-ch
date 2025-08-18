-- Test query to check if documents have file_record_id and what data is in valores_json

-- Check documents with file_record_id
SELECT 
  d.id as document_id,
  d.file_name,
  d.archived,
  d.file_record_id,
  fr.id as file_record_id_actual,
  fr.valores_json,
  fs.nombre as sistema_nombre
FROM documents d
LEFT JOIN file_records fr ON d.file_record_id = fr.id
LEFT JOIN filing_systems fs ON fr.sistema_id = fs.id
WHERE d.archived = true
ORDER BY d.created_at DESC
LIMIT 10;

-- Check file_records and their valores_json structure
SELECT 
  fr.id,
  fr.valores_json,
  fs.nombre as sistema_nombre,
  fr.created_at
FROM file_records fr
LEFT JOIN filing_systems fs ON fr.sistema_id = fs.id
ORDER BY fr.created_at DESC
LIMIT 10;
