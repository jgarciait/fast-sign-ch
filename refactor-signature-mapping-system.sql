-- Refactor signature mapping system to eliminate redundancy
-- Templates will reference document mappings instead of duplicating signature fields

-- Step 1: Add reference to document_signature_mappings in templates table
ALTER TABLE signature_mapping_templates 
ADD COLUMN document_mapping_id uuid REFERENCES document_signature_mappings(id);

-- Step 2: Add flag to mark document mappings as templates
ALTER TABLE document_signature_mappings 
ADD COLUMN is_template boolean DEFAULT false;

-- Step 3: Migrate existing data - match templates to their corresponding document mappings
-- This assumes templates and mappings can be matched by signature_fields content
UPDATE signature_mapping_templates smt
SET document_mapping_id = dsm.id
FROM document_signature_mappings dsm
WHERE smt.signature_fields = dsm.signature_fields
AND smt.created_by = dsm.created_by;

-- Step 4: Mark the referenced document mappings as templates
UPDATE document_signature_mappings
SET is_template = true
WHERE id IN (
    SELECT document_mapping_id 
    FROM signature_mapping_templates 
    WHERE document_mapping_id IS NOT NULL
);

-- Step 5: Remove the redundant signature_fields column from templates
ALTER TABLE signature_mapping_templates 
DROP COLUMN signature_fields;

-- Step 6: Make document_mapping_id required for templates
ALTER TABLE signature_mapping_templates 
ALTER COLUMN document_mapping_id SET NOT NULL;

-- Step 7: Add indexes for better performance
CREATE INDEX idx_signature_mapping_templates_document_mapping_id 
ON signature_mapping_templates(document_mapping_id);

CREATE INDEX idx_document_signature_mappings_is_template 
ON document_signature_mappings(is_template);

-- Step 8: Create a view for easy template querying with all necessary data
CREATE OR REPLACE VIEW signature_templates_view AS
SELECT 
    smt.id as template_id,
    smt.name as template_name,
    smt.description as template_description,
    smt.created_by,
    smt.is_active,
    smt.created_at as template_created_at,
    smt.updated_at as template_updated_at,
    dsm.id as mapping_id,
    dsm.document_id,
    dsm.signature_fields,
    dsm.created_at as mapping_created_at,
    d.file_name as document_file_name,
    d.file_path as document_file_path
FROM signature_mapping_templates smt
JOIN document_signature_mappings dsm ON smt.document_mapping_id = dsm.id
JOIN documents d ON dsm.document_id = d.id
WHERE smt.is_active = true;

-- Step 9: Add function to create template from existing document mapping
CREATE OR REPLACE FUNCTION create_template_from_mapping(
    mapping_id uuid,
    template_name text,
    template_description text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
    template_id uuid;
    user_id uuid;
BEGIN
    -- Get the user who created the mapping
    SELECT created_by INTO user_id 
    FROM document_signature_mappings 
    WHERE id = mapping_id;
    
    -- Mark the mapping as a template
    UPDATE document_signature_mappings 
    SET is_template = true 
    WHERE id = mapping_id;
    
    -- Create the template entry
    INSERT INTO signature_mapping_templates (name, description, created_by, document_mapping_id)
    VALUES (template_name, template_description, user_id, mapping_id)
    RETURNING id INTO template_id;
    
    RETURN template_id;
END;
$$ LANGUAGE plpgsql;

-- Step 10: Add function to rename template
CREATE OR REPLACE FUNCTION rename_template(
    template_id uuid,
    new_name text,
    new_description text DEFAULT NULL
) RETURNS boolean AS $$
BEGIN
    UPDATE signature_mapping_templates 
    SET name = new_name,
        description = COALESCE(new_description, description),
        updated_at = now()
    WHERE id = template_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;
