-- Debug query to see actual document and file_record data

SELECT 
  d.id as document_id,
  d.file_name,
  d.archived,
  d.file_record_id,
  CASE 
    WHEN d.file_record_id IS NOT NULL THEN 'HAS_FILE_RECORD_ID'
    ELSE 'NO_FILE_RECORD_ID'
  END as has_file_record,
  fr.id as actual_file_record_id,
  fr.valores_json,
  CASE 
    WHEN fr.id IS NOT NULL THEN 'FILE_RECORD_EXISTS'
    ELSE 'FILE_RECORD_MISSING'
  END as file_record_status
FROM documents d
LEFT JOIN file_records fr ON d.file_record_id = fr.id
WHERE d.archived = true
ORDER BY d.created_at DESC
LIMIT 5;
