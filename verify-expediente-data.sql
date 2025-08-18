-- Query to verify expediente data and naming
-- This will help us see what's in the valores_json and why names aren't showing

-- Check documents with expedientes
SELECT 
    d.id as document_id,
    d.file_name,
    d.archived,
    d.file_record_id,
    fr.id as expediente_id,
    fr.valores_json,
    fs.nombre as sistema_nombre,
    -- Extract possible names from valores_json
    fr.valores_json ->> 'Nombre' as nombre_capital,
    fr.valores_json ->> 'nombre' as nombre_lower,
    fr.valores_json ->> 'name' as name_eng,
    fr.valores_json ->> 'descripcion' as descripcion,
    fr.valores_json ->> 'title' as title,
    -- Show all keys in valores_json
    (SELECT string_agg(key, ', ') FROM jsonb_object_keys(fr.valores_json) as key) as all_keys
FROM documents d
INNER JOIN file_records fr ON d.file_record_id = fr.id
LEFT JOIN filing_systems fs ON fr.sistema_id = fs.id
WHERE d.archived = true
ORDER BY d.created_at DESC
LIMIT 10;

-- Check file_records structure
SELECT 
    fr.id,
    fr.valores_json,
    fs.nombre as sistema_nombre,
    -- Extract possible names
    fr.valores_json ->> 'Nombre' as nombre_capital,
    fr.valores_json ->> 'nombre' as nombre_lower,
    fr.valores_json ->> 'name' as name_eng,
    fr.valores_json ->> 'descripcion' as descripcion,
    -- Show all keys
    (SELECT string_agg(key, ', ') FROM jsonb_object_keys(fr.valores_json) as key) as all_keys,
    fr.created_at
FROM file_records fr
LEFT JOIN filing_systems fs ON fr.sistema_id = fs.id
ORDER BY fr.created_at DESC
LIMIT 10;
