-- Tabla para plantillas de mapeo de firmas
CREATE TABLE signature_mapping_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES profiles(id),
    signature_fields JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array de campos de firma con posiciones
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla para mapeos de firma específicos de documentos
CREATE TABLE document_signature_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    template_id UUID REFERENCES signature_mapping_templates(id), -- Opcional, si se basó en una plantilla
    signature_fields JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array de campos de firma con posiciones específicas para este documento
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(document_id) -- Un documento solo puede tener un mapeo
);

-- Índices para mejor rendimiento
CREATE INDEX idx_signature_mapping_templates_created_by ON signature_mapping_templates(created_by);
CREATE INDEX idx_signature_mapping_templates_active ON signature_mapping_templates(is_active);
CREATE INDEX idx_document_signature_mappings_document_id ON document_signature_mappings(document_id);
CREATE INDEX idx_document_signature_mappings_template_id ON document_signature_mappings(template_id);
CREATE INDEX idx_document_signature_mappings_created_by ON document_signature_mappings(created_by);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_signature_mapping_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para actualizar updated_at
CREATE TRIGGER update_signature_mapping_templates_updated_at
    BEFORE UPDATE ON signature_mapping_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_signature_mapping_updated_at();

CREATE TRIGGER update_document_signature_mappings_updated_at
    BEFORE UPDATE ON document_signature_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_signature_mapping_updated_at();

-- Comentarios para documentar la estructura
COMMENT ON TABLE signature_mapping_templates IS 'Plantillas reutilizables para mapeo de campos de firma';
COMMENT ON TABLE document_signature_mappings IS 'Mapeos específicos de campos de firma para documentos individuales';
COMMENT ON COLUMN signature_mapping_templates.signature_fields IS 'Array JSON con campos de firma: [{"id": "field1", "page": 1, "x": 100, "y": 200, "width": 200, "height": 80, "relativeX": 0.2, "relativeY": 0.3, "label": "Firma del Cliente"}]';
COMMENT ON COLUMN document_signature_mappings.signature_fields IS 'Array JSON con campos de firma específicos para este documento, mismo formato que las plantillas';
