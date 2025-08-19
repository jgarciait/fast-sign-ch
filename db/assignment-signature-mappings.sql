-- Tabla para mapeos de firma específicos de asignaciones
-- Esta tabla almacena las posiciones de los campos de firma para cada asignación

CREATE TABLE IF NOT EXISTS assignment_signature_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL REFERENCES document_assignments(id) ON DELETE CASCADE,
    signature_type TEXT NOT NULL CHECK (signature_type IN ('chofer', 'client')),
    page_number INTEGER NOT NULL CHECK (page_number >= 1),
    
    -- Coordenadas como porcentajes (0.0-1.0) para compatibilidad con diferentes tamaños de pantalla
    x_coordinate DECIMAL(10,8) NOT NULL CHECK (x_coordinate >= 0 AND x_coordinate <= 1),
    y_coordinate DECIMAL(10,8) NOT NULL CHECK (y_coordinate >= 0 AND y_coordinate <= 1),
    width DECIMAL(10,8) NOT NULL DEFAULT 0.15 CHECK (width > 0 AND width <= 1),
    height DECIMAL(10,8) NOT NULL DEFAULT 0.08 CHECK (height > 0 AND height <= 1),
    
    -- Configuración del campo de firma
    is_required BOOLEAN NOT NULL DEFAULT true,
    label TEXT,
    placeholder_text TEXT,
    
    -- Metadatos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES profiles(id),
    
    -- Índices únicos para evitar duplicados
    UNIQUE(assignment_id, signature_type, page_number, x_coordinate, y_coordinate)
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_assignment_signature_mappings_assignment_id 
    ON assignment_signature_mappings(assignment_id);

CREATE INDEX IF NOT EXISTS idx_assignment_signature_mappings_signature_type 
    ON assignment_signature_mappings(signature_type);

CREATE INDEX IF NOT EXISTS idx_assignment_signature_mappings_created_by 
    ON assignment_signature_mappings(created_by);

-- Comentarios para documentación
COMMENT ON TABLE assignment_signature_mappings IS 'Almacena las posiciones de los campos de firma para asignaciones específicas';
COMMENT ON COLUMN assignment_signature_mappings.signature_type IS 'Tipo de firma: chofer o client';
COMMENT ON COLUMN assignment_signature_mappings.x_coordinate IS 'Posición X como porcentaje del ancho de la página (0.0-1.0)';
COMMENT ON COLUMN assignment_signature_mappings.y_coordinate IS 'Posición Y como porcentaje del alto de la página (0.0-1.0)';
COMMENT ON COLUMN assignment_signature_mappings.width IS 'Ancho del campo como porcentaje del ancho de la página (0.0-1.0)';
COMMENT ON COLUMN assignment_signature_mappings.height IS 'Alto del campo como porcentaje del alto de la página (0.0-1.0)';

-- RLS (Row Level Security) para seguridad
ALTER TABLE assignment_signature_mappings ENABLE ROW LEVEL SECURITY;

-- Política para que los usuarios solo vean mapeos de sus propias asignaciones
CREATE POLICY "Users can view signature mappings for their assignments" ON assignment_signature_mappings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM document_assignments da 
            WHERE da.id = assignment_signature_mappings.assignment_id 
            AND (da.assigned_to_user_id = auth.uid() OR da.assigned_by_user_id = auth.uid())
        )
    );

-- Política para que solo los creadores de asignaciones puedan crear mapeos
CREATE POLICY "Assignment creators can create signature mappings" ON assignment_signature_mappings
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM document_assignments da 
            WHERE da.id = assignment_signature_mappings.assignment_id 
            AND da.assigned_by_user_id = auth.uid()
        )
    );

-- Política para que solo los creadores de asignaciones puedan actualizar mapeos
CREATE POLICY "Assignment creators can update signature mappings" ON assignment_signature_mappings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM document_assignments da 
            WHERE da.id = assignment_signature_mappings.assignment_id 
            AND da.assigned_by_user_id = auth.uid()
        )
    );

-- Política para que solo los creadores de asignaciones puedan eliminar mapeos
CREATE POLICY "Assignment creators can delete signature mappings" ON assignment_signature_mappings
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM document_assignments da 
            WHERE da.id = assignment_signature_mappings.assignment_id 
            AND da.assigned_by_user_id = auth.uid()
        )
    );
