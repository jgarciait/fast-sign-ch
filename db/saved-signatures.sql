-- Saved Signatures Table
-- Allows users to save signatures and link them to case files for reuse

-- Create saved_signatures table
CREATE TABLE IF NOT EXISTS saved_signatures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_record_id UUID REFERENCES file_records(id) ON DELETE SET NULL,
  signature_name VARCHAR(255) NOT NULL,
  signature_data TEXT NOT NULL, -- Base64 encoded signature image
  signature_type VARCHAR(50) NOT NULL DEFAULT 'canvas', -- 'canvas', 'wacom', 'upload'
  client_name VARCHAR(255), -- Optional client name for organization
  description TEXT, -- Optional description
  is_default BOOLEAN DEFAULT FALSE, -- Mark as default signature for user
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT saved_signatures_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT saved_signatures_file_record_id_fkey FOREIGN KEY (file_record_id) REFERENCES file_records(id) ON DELETE SET NULL,
  CONSTRAINT saved_signatures_signature_type_check CHECK (signature_type IN ('canvas', 'wacom', 'upload'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_saved_signatures_user_id ON saved_signatures(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_signatures_file_record_id ON saved_signatures(file_record_id);
CREATE INDEX IF NOT EXISTS idx_saved_signatures_created_at ON saved_signatures(created_at);
CREATE INDEX IF NOT EXISTS idx_saved_signatures_is_default ON saved_signatures(user_id, is_default);

-- RLS Policies for saved_signatures
ALTER TABLE saved_signatures ENABLE ROW LEVEL SECURITY;

-- Users can only see their own saved signatures
CREATE POLICY "Users can view their own saved signatures" ON saved_signatures
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own saved signatures
CREATE POLICY "Users can insert their own saved signatures" ON saved_signatures
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own saved signatures
CREATE POLICY "Users can update their own saved signatures" ON saved_signatures
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own saved signatures
CREATE POLICY "Users can delete their own saved signatures" ON saved_signatures
  FOR DELETE USING (auth.uid() = user_id);

-- Function to ensure only one default signature per user
CREATE OR REPLACE FUNCTION ensure_single_default_signature()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting a signature as default, unset all other defaults for this user
  IF NEW.is_default = TRUE THEN
    UPDATE saved_signatures 
    SET is_default = FALSE, updated_at = NOW()
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  
  -- Update the updated_at timestamp
  NEW.updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to ensure only one default signature per user
DROP TRIGGER IF EXISTS ensure_single_default_signature_trigger ON saved_signatures;
CREATE TRIGGER ensure_single_default_signature_trigger
  BEFORE INSERT OR UPDATE ON saved_signatures
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_signature();

-- Comments for documentation
COMMENT ON TABLE saved_signatures IS 'Stores user signatures that can be reused and linked to case files';
COMMENT ON COLUMN saved_signatures.signature_data IS 'Base64 encoded signature image data';
COMMENT ON COLUMN saved_signatures.signature_type IS 'Type of signature: canvas, wacom, or upload';
COMMENT ON COLUMN saved_signatures.file_record_id IS 'Optional link to case file for organization';
COMMENT ON COLUMN saved_signatures.client_name IS 'Optional client name for better organization';
COMMENT ON COLUMN saved_signatures.is_default IS 'Mark as default signature for quick access';
