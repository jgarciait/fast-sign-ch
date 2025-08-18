-- Test script to verify default category system

-- 1. Check that all file records have a "Sin Categorizar" category
SELECT 
    fr.id as file_record_id,
    CASE 
        WHEN dc.id IS NOT NULL THEN 'HAS DEFAULT CATEGORY'
        ELSE 'MISSING DEFAULT CATEGORY'
    END as status
FROM file_records fr
LEFT JOIN document_categories dc ON fr.id = dc.file_record_id AND dc.name = 'Sin Categorizar'
ORDER BY fr.id;

-- 2. Check that all documents have a valid category_id
SELECT 
    'Documents with NULL category_id' as description,
    COUNT(*) as count
FROM documents 
WHERE category_id IS NULL
UNION ALL
SELECT 
    'Documents with valid category_id' as description,
    COUNT(*) as count
FROM documents 
WHERE category_id IS NOT NULL;

-- 3. Show document distribution by category
SELECT 
    dc.name as category_name,
    dc.color,
    dc.icon,
    COUNT(d.id) as document_count
FROM document_categories dc
LEFT JOIN documents d ON dc.id = d.category_id
GROUP BY dc.name, dc.color, dc.icon
ORDER BY dc.name;

-- 4. Test moving a document to default category (replace with actual document ID)
-- UPDATE documents 
-- SET category_id = (
--     SELECT id FROM document_categories 
--     WHERE name = 'Sin Categorizar' 
--     AND file_record_id = (SELECT file_record_id FROM documents WHERE id = 'YOUR_DOCUMENT_ID')
-- )
-- WHERE id = 'YOUR_DOCUMENT_ID';

-- 5. Verify the system prevents deletion of default category
-- This should fail:
-- DELETE FROM document_categories WHERE name = 'Sin Categorizar' LIMIT 1;
