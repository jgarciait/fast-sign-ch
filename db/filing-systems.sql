-- Create filing systems tables for document classification
-- This adds a flexible document filing system without altering existing document/signature tables

-- Create filing_systems table (document classification templates)
CREATE TABLE IF NOT EXISTS filing_systems (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  esquema_json JSONB NOT NULL DEFAULT '{"version": 1, "indices": []}',
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Only one filing system can be active globally (like integrations)
  CONSTRAINT unique_active_filing_system_global UNIQUE(is_active) DEFERRABLE INITIALLY DEFERRED
);

-- Create filing_indices table (individual field definitions)
CREATE TABLE IF NOT EXISTS filing_indices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sistema_id UUID REFERENCES filing_systems(id) ON DELETE CASCADE,
  clave TEXT NOT NULL, -- Internal key (e.g., 'socio_id', 'num_contrato')
  etiqueta TEXT NOT NULL, -- Display label (e.g., 'Número de Socio')
  tipo_dato TEXT NOT NULL CHECK (tipo_dato IN ('string', 'int', 'fecha', 'bool', 'enum')),
  obligatorio BOOLEAN NOT NULL DEFAULT FALSE,
  opciones_enum JSONB, -- For enum types, store available options
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(sistema_id, clave)
);

-- Create file_records table (expedientes - instances of filing systems)
CREATE TABLE IF NOT EXISTS file_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sistema_id UUID REFERENCES filing_systems(id) ON DELETE RESTRICT,
  valores_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add filing system relationship to existing documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_record_id UUID REFERENCES file_records(id) ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_filing_systems_created_by_active ON filing_systems(created_by, is_active);
CREATE INDEX IF NOT EXISTS idx_filing_indices_sistema ON filing_indices(sistema_id, orden);
CREATE INDEX IF NOT EXISTS idx_file_records_created_by_sistema ON file_records(created_by, sistema_id);
CREATE INDEX IF NOT EXISTS idx_file_records_valores_gin ON file_records USING GIN(valores_json);
CREATE INDEX IF NOT EXISTS idx_documents_file_record ON documents(file_record_id);

-- RLS policies for filing_systems (global visibility like integrations)
ALTER TABLE filing_systems ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "All users can view filing systems" ON filing_systems;
DROP POLICY IF EXISTS "Users can insert filing systems" ON filing_systems;
DROP POLICY IF EXISTS "Original creators can update filing systems" ON filing_systems;
DROP POLICY IF EXISTS "Original creators can delete filing systems" ON filing_systems;

-- All authenticated users can view filing systems (global visibility)
CREATE POLICY "All users can view filing systems" 
  ON filing_systems FOR SELECT 
  TO authenticated
  USING (true);

-- Users can insert their own filing systems
CREATE POLICY "Users can insert filing systems" 
  ON filing_systems FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Only original creators can update filing systems
CREATE POLICY "Original creators can update filing systems" 
  ON filing_systems FOR UPDATE 
  TO authenticated
  USING (auth.uid() = created_by);

-- Only original creators can delete filing systems
CREATE POLICY "Original creators can delete filing systems" 
  ON filing_systems FOR DELETE 
  TO authenticated
  USING (auth.uid() = created_by);

-- RLS policies for filing_indices (global visibility)
ALTER TABLE filing_indices ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "All users can view filing indices" ON filing_indices;
DROP POLICY IF EXISTS "Original creators can manage filing indices" ON filing_indices;

-- All authenticated users can view filing indices
CREATE POLICY "All users can view filing indices" 
  ON filing_indices FOR SELECT 
  TO authenticated
  USING (true);

-- Only original filing system creators can manage indices
CREATE POLICY "Original creators can manage filing indices" 
  ON filing_indices FOR ALL 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM filing_systems 
      WHERE filing_systems.id = filing_indices.sistema_id 
      AND filing_systems.created_by = auth.uid()
    )
  );

-- RLS policies for file_records
ALTER TABLE file_records ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own file records" ON file_records;
DROP POLICY IF EXISTS "Users can insert their own file records" ON file_records;
DROP POLICY IF EXISTS "Users can update their own file records" ON file_records;
DROP POLICY IF EXISTS "Users can delete their own file records" ON file_records;

-- Users can view their own file records
CREATE POLICY "Users can view their own file records" 
  ON file_records FOR SELECT 
  TO authenticated
  USING (auth.uid() = created_by);

-- Users can insert their own file records
CREATE POLICY "Users can insert their own file records" 
  ON file_records FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Users can update their own file records
CREATE POLICY "Users can update their own file records" 
  ON file_records FOR UPDATE 
  TO authenticated
  USING (auth.uid() = created_by);

-- Users can delete their own file records
CREATE POLICY "Users can delete their own file records" 
  ON file_records FOR DELETE 
  TO authenticated
  USING (auth.uid() = created_by);

-- Function to ensure only one active filing system globally
CREATE OR REPLACE FUNCTION enforce_single_active_filing_system()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting a filing system as active, deactivate all others globally
  IF NEW.is_active = TRUE THEN
    UPDATE filing_systems 
    SET is_active = FALSE, updated_at = NOW()
    WHERE id != NEW.id 
      AND is_active = TRUE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce single active filing system
DROP TRIGGER IF EXISTS trigger_enforce_single_active_filing_system ON filing_systems;
CREATE TRIGGER trigger_enforce_single_active_filing_system
  BEFORE INSERT OR UPDATE ON filing_systems
  FOR EACH ROW
  EXECUTE FUNCTION enforce_single_active_filing_system();

-- Function to update esquema_json when indices change
CREATE OR REPLACE FUNCTION update_filing_system_schema()
RETURNS TRIGGER AS $$
DECLARE
  schema_json JSONB;
BEGIN
  -- Rebuild the esquema_json from current indices
  SELECT jsonb_build_object(
    'version', 1,
    'indices', COALESCE(jsonb_agg(
      jsonb_build_object(
        'clave', clave,
        'etiqueta', etiqueta,
        'tipo', tipo_dato,
        'obligatorio', obligatorio,
        'opciones', CASE WHEN tipo_dato = 'enum' THEN opciones_enum ELSE NULL END,
        'orden', orden
      ) ORDER BY orden
    ), '[]'::jsonb)
  ) INTO schema_json
  FROM filing_indices 
  WHERE sistema_id = COALESCE(NEW.sistema_id, OLD.sistema_id);
  
  -- Update the filing system's esquema_json
  UPDATE filing_systems 
  SET esquema_json = schema_json, updated_at = NOW()
  WHERE id = COALESCE(NEW.sistema_id, OLD.sistema_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update schema when indices change
DROP TRIGGER IF EXISTS trigger_update_filing_system_schema ON filing_indices;
CREATE TRIGGER trigger_update_filing_system_schema
  AFTER INSERT OR UPDATE OR DELETE ON filing_indices
  FOR EACH ROW
  EXECUTE FUNCTION update_filing_system_schema();

-- Comments for documentation
COMMENT ON TABLE filing_systems IS 'Document classification templates that define how documents should be organized';
COMMENT ON TABLE filing_indices IS 'Individual field definitions for each filing system template';
COMMENT ON TABLE file_records IS 'Instances of filing systems (expedientes) that contain actual document metadata';
COMMENT ON COLUMN documents.file_record_id IS 'Links documents to file records (expedientes) for classification';
