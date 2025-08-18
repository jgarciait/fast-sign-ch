-- Check available documents for signature mapping
-- Run this in your Supabase SQL Editor to see what documents are available

-- 1. Check total documents in the system
SELECT 
    'Total Documents' as category,
    COUNT(*) as count
FROM documents
WHERE archived = false 
    AND file_path IS NOT NULL

UNION ALL

-- 2. Check documents that have signature mappings
SELECT 
    'Documents with Signature Mappings' as category,
    COUNT(DISTINCT d.id) as count
FROM documents d
INNER JOIN document_signature_mappings dsm ON d.id = dsm.document_id
WHERE d.archived = false

UNION ALL

-- 3. Check documents that are part of signing requests
SELECT 
    'Documents in Signing Requests' as category,
    COUNT(DISTINCT d.id) as count
FROM documents d
INNER JOIN signing_requests r ON d.id = r.document_id
WHERE d.archived = false

UNION ALL

-- 4. Check documents available for signature mapping (no mappings, no requests)
SELECT 
    'Available for Signature Mapping' as category,
    COUNT(*) as count
FROM documents d
WHERE d.archived = false 
    AND d.file_path IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM document_signature_mappings dsm 
        WHERE dsm.document_id = d.id
    )
    AND NOT EXISTS (
        SELECT 1 FROM signing_requests r 
        WHERE r.document_id = d.id
    );

-- Show detailed list of available documents
SELECT 
    d.id,
    d.file_name,
    d.file_path,
    d.created_at,
    d.document_type,
    d.status,
    p.email as creator_email,
    CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, '')) as creator_name
FROM documents d
LEFT JOIN profiles p ON d.created_by = p.id
WHERE d.archived = false 
    AND d.file_path IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM document_signature_mappings dsm 
        WHERE dsm.document_id = d.id
    )
    AND NOT EXISTS (
        SELECT 1 FROM signing_requests r 
        WHERE r.document_id = d.id
    )
ORDER BY d.created_at DESC
LIMIT 20;
