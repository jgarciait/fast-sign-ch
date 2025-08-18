-- Add document categories system for case files
-- This enables folder-like organization with drag & drop capabilities

-- 1. Create document_categories table for dynamic folder structure
CREATE TABLE IF NOT EXISTS document_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_record_id UUID NOT NULL REFERENCES file_records(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#3B82F6', -- Default blue color
    icon TEXT DEFAULT 'folder', -- Icon name for UI
    parent_category_id UUID REFERENCES document_categories(id) ON DELETE CASCADE, -- For nested folders
    sort_order INTEGER DEFAULT 0,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique category names per file record at the same level
    CONSTRAINT unique_category_name_per_level UNIQUE (file_record_id, name, parent_category_id)
);

-- 2. Add category_id column to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES document_categories(id) ON DELETE SET NULL;

-- 3. Add metadata column for additional document properties in case files
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS case_file_metadata JSONB DEFAULT '{}';

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_category_id ON documents(category_id);
CREATE INDEX IF NOT EXISTS idx_documents_file_record_id ON documents(file_record_id);
CREATE INDEX IF NOT EXISTS idx_documents_case_file_metadata ON documents USING GIN(case_file_metadata);
CREATE INDEX IF NOT EXISTS idx_document_categories_file_record_id ON document_categories(file_record_id);
CREATE INDEX IF NOT EXISTS idx_document_categories_parent_id ON document_categories(parent_category_id);

-- 5. Create view for document hierarchy with categories
CREATE OR REPLACE VIEW case_file_documents_with_categories AS
SELECT 
    d.id,
    d.file_name,
    d.file_path,
    d.file_size,
    d.file_type,
    d.created_at,
    d.updated_at,
    d.file_record_id,
    d.category_id,
    d.case_file_metadata,
    d.document_type,
    d.status,
    dc.name as category_name,
    dc.color as category_color,
    dc.icon as category_icon,
    dc.parent_category_id,
    -- Create breadcrumb path for nested categories
    CASE 
        WHEN dc.parent_category_id IS NOT NULL THEN
            (SELECT string_agg(parent.name, ' > ' ORDER BY parent.sort_order) 
             FROM document_categories parent 
             WHERE parent.id = dc.parent_category_id) || ' > ' || dc.name
        ELSE dc.name
    END as category_path,
    -- Count of documents in each category
    (SELECT COUNT(*) FROM documents d2 WHERE d2.category_id = dc.id) as documents_in_category
FROM documents d
LEFT JOIN document_categories dc ON d.category_id = dc.id
WHERE d.file_record_id IS NOT NULL;

-- 6. Function to get category hierarchy for a file record
CREATE OR REPLACE FUNCTION get_category_hierarchy(p_file_record_id UUID)
RETURNS TABLE(
    category_id UUID,
    category_name TEXT,
    category_color TEXT,
    category_icon TEXT,
    parent_id UUID,
    level INTEGER,
    path TEXT,
    document_count BIGINT
) AS $$
WITH RECURSIVE category_tree AS (
    -- Base case: root categories
    SELECT 
        dc.id,
        dc.name,
        dc.color,
        dc.icon,
        dc.parent_category_id,
        0 as level,
        dc.name as path,
        (SELECT COUNT(*) FROM documents WHERE category_id = dc.id) as doc_count
    FROM document_categories dc
    WHERE dc.file_record_id = p_file_record_id 
    AND dc.parent_category_id IS NULL
    
    UNION ALL
    
    -- Recursive case: child categories
    SELECT 
        dc.id,
        dc.name,
        dc.color,
        dc.icon,
        dc.parent_category_id,
        ct.level + 1,
        ct.path || ' > ' || dc.name,
        (SELECT COUNT(*) FROM documents WHERE category_id = dc.id) as doc_count
    FROM document_categories dc
    INNER JOIN category_tree ct ON dc.parent_category_id = ct.id
    WHERE dc.file_record_id = p_file_record_id
)
SELECT 
    id as category_id,
    name as category_name,
    color as category_color,
    icon as category_icon,
    parent_category_id as parent_id,
    level,
    path,
    doc_count as document_count
FROM category_tree
ORDER BY level, name;
$$ LANGUAGE sql;

-- 7. Function to move document to category
CREATE OR REPLACE FUNCTION move_document_to_category(
    p_document_id UUID,
    p_category_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE documents 
    SET 
        category_id = p_category_id,
        updated_at = NOW()
    WHERE id = p_document_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 8. Function to bulk unlink documents from case file
CREATE OR REPLACE FUNCTION bulk_unlink_documents_from_case_file(
    p_document_ids UUID[]
) RETURNS INTEGER AS $$
DECLARE
    unlinked_count INTEGER := 0;
BEGIN
    UPDATE documents 
    SET 
        file_record_id = NULL,
        category_id = NULL,
        case_file_metadata = '{}',
        updated_at = NOW()
    WHERE id = ANY(p_document_ids)
    AND file_record_id IS NOT NULL;
    
    GET DIAGNOSTICS unlinked_count = ROW_COUNT;
    RETURN unlinked_count;
END;
$$ LANGUAGE plpgsql;

-- 9. Add some default categories for common document types
INSERT INTO document_categories (file_record_id, name, description, color, icon, created_by)
SELECT DISTINCT 
    fr.id,
    'Contratos',
    'Documentos contractuales y acuerdos',
    '#10B981',
    'file-text',
    fr.created_by
FROM file_records fr
WHERE NOT EXISTS (
    SELECT 1 FROM document_categories dc 
    WHERE dc.file_record_id = fr.id AND dc.name = 'Contratos'
)
ON CONFLICT (file_record_id, name, parent_category_id) DO NOTHING;

INSERT INTO document_categories (file_record_id, name, description, color, icon, created_by)
SELECT DISTINCT 
    fr.id,
    'Formularios',
    'Formularios y documentos informativos',
    '#F59E0B',
    'clipboard',
    fr.created_by
FROM file_records fr
WHERE NOT EXISTS (
    SELECT 1 FROM document_categories dc 
    WHERE dc.file_record_id = fr.id AND dc.name = 'Formularios'
)
ON CONFLICT (file_record_id, name, parent_category_id) DO NOTHING;

INSERT INTO document_categories (file_record_id, name, description, color, icon, created_by)
SELECT DISTINCT 
    fr.id,
    'Firmados',
    'Documentos firmados y completados',
    '#8B5CF6',
    'check-circle',
    fr.created_by
FROM file_records fr
WHERE NOT EXISTS (
    SELECT 1 FROM document_categories dc 
    WHERE dc.file_record_id = fr.id AND dc.name = 'Firmados'
)
ON CONFLICT (file_record_id, name, parent_category_id) DO NOTHING;

-- 10. Create trigger to automatically categorize documents based on filename patterns
CREATE OR REPLACE FUNCTION auto_categorize_document()
RETURNS TRIGGER AS $$
DECLARE
    contract_category_id UUID;
    signed_category_id UUID;
    form_category_id UUID;
BEGIN
    -- Only auto-categorize if document is linked to a case file and no category is set
    IF NEW.file_record_id IS NOT NULL AND NEW.category_id IS NULL THEN
        
        -- Check if filename indicates it's a signed document
        IF NEW.file_name ILIKE 'SIGNED_%' OR NEW.file_name ILIKE '%_signed%' THEN
            SELECT id INTO signed_category_id 
            FROM document_categories 
            WHERE file_record_id = NEW.file_record_id AND name = 'Firmados'
            LIMIT 1;
            
            IF signed_category_id IS NOT NULL THEN
                NEW.category_id := signed_category_id;
            END IF;
            
        -- Check if filename indicates it's a contract
        ELSIF NEW.file_name ILIKE '%contrato%' OR NEW.file_name ILIKE '%contract%' THEN
            SELECT id INTO contract_category_id 
            FROM document_categories 
            WHERE file_record_id = NEW.file_record_id AND name = 'Contratos'
            LIMIT 1;
            
            IF contract_category_id IS NOT NULL THEN
                NEW.category_id := contract_category_id;
            END IF;
            
        -- Check if filename indicates it's a form
        ELSIF NEW.file_name ILIKE '%form%' OR NEW.file_name ILIKE '%formulario%' THEN
            SELECT id INTO form_category_id 
            FROM document_categories 
            WHERE file_record_id = NEW.file_record_id AND name = 'Formularios'
            LIMIT 1;
            
            IF form_category_id IS NOT NULL THEN
                NEW.category_id := form_category_id;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_categorize_document
    BEFORE INSERT OR UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION auto_categorize_document();

-- 11. Add RLS policies for document categories
ALTER TABLE document_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view categories for accessible file records" ON document_categories
    FOR SELECT USING (
        file_record_id IN (
            SELECT id FROM file_records 
            WHERE created_by = auth.uid() 
            OR assigned_to_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage categories for their file records" ON document_categories
    FOR ALL USING (
        file_record_id IN (
            SELECT id FROM file_records 
            WHERE created_by = auth.uid() 
            OR assigned_to_user_id = auth.uid()
        )
    );
