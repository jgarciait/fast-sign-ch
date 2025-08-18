-- Signature Templates and Customer Linking (Based on existing schema)
-- Creates reusable signature templates and links existing customers to case files

-- 1. Create signature_templates table (reusable signatures for users)
CREATE TABLE IF NOT EXISTS signature_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_name VARCHAR(255) NOT NULL,
  signature_data TEXT NOT NULL, -- Base64 encoded signature image
  signature_type VARCHAR(50) NOT NULL DEFAULT 'canvas', -- 'canvas', 'wacom', 'upload'
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add user_id to existing customers table (if it doesn't exist)
-- The customers table exists but doesn't have user_id, so we add it
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Add customer_id to file_records table to link case files to customers
ALTER TABLE file_records 
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

-- 4. Create customer_signatures table (signatures specific to customers)
CREATE TABLE IF NOT EXISTS customer_signatures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  signature_name VARCHAR(255) NOT NULL,
  signature_data TEXT NOT NULL,
  signature_type VARCHAR(50) NOT NULL DEFAULT 'canvas',
  is_default_for_customer BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_signature_templates_user_id ON signature_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_signature_templates_is_default ON signature_templates(user_id, is_default);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_file_records_customer_id ON file_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_signatures_user_id ON customer_signatures(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_signatures_customer_id ON customer_signatures(customer_id);

-- RLS Policies for signature_templates
ALTER TABLE signature_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own signature templates" ON signature_templates;
DROP POLICY IF EXISTS "Users can insert their own signature templates" ON signature_templates;
DROP POLICY IF EXISTS "Users can update their own signature templates" ON signature_templates;
DROP POLICY IF EXISTS "Users can delete their own signature templates" ON signature_templates;

CREATE POLICY "Users can view their own signature templates" ON signature_templates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own signature templates" ON signature_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own signature templates" ON signature_templates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own signature templates" ON signature_templates
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for customers (add user-based access)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own customers" ON customers;
DROP POLICY IF EXISTS "Users can insert their own customers" ON customers;
DROP POLICY IF EXISTS "Users can update their own customers" ON customers;
DROP POLICY IF EXISTS "Users can delete their own customers" ON customers;

-- Allow users to see customers they created (where user_id matches)
-- Also allow viewing customers that don't have user_id set (legacy data)
CREATE POLICY "Users can view their own customers" ON customers
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert their own customers" ON customers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own customers" ON customers
  FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can delete their own customers" ON customers
  FOR DELETE USING (auth.uid() = user_id OR user_id IS NULL);

-- RLS Policies for customer_signatures
ALTER TABLE customer_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own customer signatures" ON customer_signatures;
DROP POLICY IF EXISTS "Users can insert their own customer signatures" ON customer_signatures;
DROP POLICY IF EXISTS "Users can update their own customer signatures" ON customer_signatures;
DROP POLICY IF EXISTS "Users can delete their own customer signatures" ON customer_signatures;

CREATE POLICY "Users can view their own customer signatures" ON customer_signatures
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own customer signatures" ON customer_signatures
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own customer signatures" ON customer_signatures
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own customer signatures" ON customer_signatures
  FOR DELETE USING (auth.uid() = user_id);

-- Function to ensure only one default signature template per user
CREATE OR REPLACE FUNCTION ensure_single_default_template()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = TRUE THEN
    UPDATE signature_templates 
    SET is_default = FALSE, updated_at = NOW()
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to ensure only one default signature per customer
CREATE OR REPLACE FUNCTION ensure_single_default_customer_signature()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default_for_customer = TRUE THEN
    UPDATE customer_signatures 
    SET is_default_for_customer = FALSE, updated_at = NOW()
    WHERE customer_id = NEW.customer_id AND id != NEW.id;
  END IF;
  
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
DROP TRIGGER IF EXISTS ensure_single_default_template_trigger ON signature_templates;
CREATE TRIGGER ensure_single_default_template_trigger
  BEFORE INSERT OR UPDATE ON signature_templates
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_template();

DROP TRIGGER IF EXISTS ensure_single_default_customer_signature_trigger ON customer_signatures;
CREATE TRIGGER ensure_single_default_customer_signature_trigger
  BEFORE INSERT OR UPDATE ON customer_signatures
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_customer_signature();

-- Comments
COMMENT ON TABLE signature_templates IS 'Reusable signature templates for users';
COMMENT ON TABLE customer_signatures IS 'Signatures specific to customers';
COMMENT ON COLUMN customers.user_id IS 'Links customers to users for access control';
COMMENT ON COLUMN file_records.customer_id IS 'Links case files to customers';
