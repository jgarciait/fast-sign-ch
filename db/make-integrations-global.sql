-- Migration to make integrations available to all users
-- This adds support for global integrations that can be used by any user

-- Add a column to mark integrations as global (available to all users)
ALTER TABLE integration_settings 
ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT false;

-- Add a column to identify who created the integration (for attribution)
ALTER TABLE integration_settings 
ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Update existing integrations to set the created_by_user_id
UPDATE integration_settings 
SET created_by_user_id = user_id 
WHERE created_by_user_id IS NULL;

-- Create index for better performance on global integrations
CREATE INDEX IF NOT EXISTS idx_integration_settings_global ON integration_settings(is_global);
CREATE INDEX IF NOT EXISTS idx_integration_settings_created_by ON integration_settings(created_by_user_id);

-- Drop existing RLS policy and create new ones that support global integrations
DROP POLICY IF EXISTS "Users can manage their own integration settings" ON integration_settings;

-- Policy: Users can view their own integrations OR global integrations
CREATE POLICY "Users can view their own or global integration settings" ON integration_settings
  FOR SELECT USING (
    auth.uid() = user_id OR is_global = true
  );

-- Policy: Users can only insert their own integrations
CREATE POLICY "Users can insert their own integration settings" ON integration_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only update their own integrations
CREATE POLICY "Users can update their own integration settings" ON integration_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can only delete their own integrations
CREATE POLICY "Users can delete their own integration settings" ON integration_settings
  FOR DELETE USING (auth.uid() = user_id);

-- Update the API usage and rate limits policies to work with global integrations
-- Users can log usage for any integration they have access to (own or global)
DROP POLICY IF EXISTS "Users can access their own API usage" ON integration_api_usage;
CREATE POLICY "Users can access API usage for available integrations" ON integration_api_usage
  FOR ALL USING (
    auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM integration_settings i 
      WHERE i.id = integration_api_usage.integration_id 
      AND (i.user_id = auth.uid() OR i.is_global = true)
    )
  );

DROP POLICY IF EXISTS "Users can access their own rate limits" ON integration_rate_limits;
CREATE POLICY "Users can access rate limits for available integrations" ON integration_rate_limits
  FOR ALL USING (
    auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM integration_settings i 
      WHERE i.id = integration_rate_limits.integration_id 
      AND (i.user_id = auth.uid() OR i.is_global = true)
    )
  );

-- Create a function to get all available integrations for a user (own + global)
CREATE OR REPLACE FUNCTION get_available_integrations(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  integration_name VARCHAR(100),
  display_name TEXT,
  is_enabled BOOLEAN,
  is_configured BOOLEAN,
  is_global BOOLEAN,
  is_owner BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  masked_settings JSONB
) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.integration_name,
    CASE 
      WHEN i.integration_name = 'aquarius_software' THEN 'Aquarius Software'
      WHEN i.integration_name = 'stripe' THEN 'Stripe'
      WHEN i.integration_name = 'quickbooks' THEN 'QuickBooks'
      WHEN i.integration_name = 'paypal' THEN 'PayPal'
      ELSE initcap(replace(i.integration_name, '_', ' '))
    END as display_name,
    i.is_enabled,
    CASE 
      WHEN i.settings->>'api_url' IS NOT NULL AND i.settings->>'api_url' != '' THEN true
      WHEN i.settings->>'api_key' IS NOT NULL AND i.settings->>'api_key' != '' THEN true
      ELSE false
    END as is_configured,
    i.is_global,
    (i.user_id = p_user_id) as is_owner,
    i.created_at,
    i.updated_at,
    -- Mask sensitive fields for non-owners
    CASE 
      WHEN i.user_id = p_user_id THEN
        -- Owner can see masked versions of their own settings
        jsonb_build_object(
          'api_url', CASE WHEN i.settings->>'api_url' IS NOT NULL AND i.settings->>'api_url' != '' THEN '••••••••••••' ELSE '' END,
          'api_user', CASE WHEN i.settings->>'api_user' IS NOT NULL AND i.settings->>'api_user' != '' THEN '••••••••••••' ELSE '' END,
          'api_password', CASE WHEN i.settings->>'api_password' IS NOT NULL AND i.settings->>'api_password' != '' THEN '••••••••••••' ELSE '' END,
          'api_key', CASE WHEN i.settings->>'api_key' IS NOT NULL AND i.settings->>'api_key' != '' THEN '••••••••••••' ELSE '' END,
          'secret_key', CASE WHEN i.settings->>'secret_key' IS NOT NULL AND i.settings->>'secret_key' != '' THEN '••••••••••••' ELSE '' END
        )
      ELSE
        -- Non-owners see basic info only
        jsonb_build_object(
          'display_name', i.settings->>'display_name',
          'description', i.settings->>'description'
        )
    END as masked_settings
  FROM integration_settings i
  WHERE i.user_id = p_user_id OR i.is_global = true
  ORDER BY i.is_global DESC, i.integration_name;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_available_integrations(UUID) TO authenticated;

-- Create a function to mark an integration as global (admin function)
CREATE OR REPLACE FUNCTION make_integration_global(p_integration_id UUID, p_admin_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
AS $$
DECLARE
  integration_owner UUID;
BEGIN
  -- Get the owner of the integration
  SELECT user_id INTO integration_owner
  FROM integration_settings
  WHERE id = p_integration_id;
  
  -- Only the owner can make their integration global
  IF integration_owner != p_admin_user_id THEN
    RETURN FALSE;
  END IF;
  
  -- Mark as global
  UPDATE integration_settings
  SET is_global = true,
      updated_at = now()
  WHERE id = p_integration_id
    AND user_id = p_admin_user_id;
    
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION make_integration_global(UUID, UUID) TO authenticated;

-- Create a function to remove global status from an integration
CREATE OR REPLACE FUNCTION make_integration_private(p_integration_id UUID, p_admin_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
AS $$
DECLARE
  integration_owner UUID;
BEGIN
  -- Get the owner of the integration
  SELECT user_id INTO integration_owner
  FROM integration_settings
  WHERE id = p_integration_id;
  
  -- Only the owner can make their integration private
  IF integration_owner != p_admin_user_id THEN
    RETURN FALSE;
  END IF;
  
  -- Mark as private
  UPDATE integration_settings
  SET is_global = false,
      updated_at = now()
  WHERE id = p_integration_id
    AND user_id = p_admin_user_id;
    
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION make_integration_private(UUID, UUID) TO authenticated;

-- Update the integration_settings_view to include global status
DROP VIEW IF EXISTS integration_settings_view;
CREATE OR REPLACE VIEW integration_settings_view AS
SELECT 
  i.*,
  CASE 
    WHEN i.integration_name = 'aquarius_software' THEN 'Aquarius Software'
    WHEN i.integration_name = 'stripe' THEN 'Stripe'
    WHEN i.integration_name = 'quickbooks' THEN 'QuickBooks'
    WHEN i.integration_name = 'paypal' THEN 'PayPal'
    ELSE initcap(replace(i.integration_name, '_', ' '))
  END as display_name,
  CASE 
    WHEN i.settings->>'api_url' IS NOT NULL AND i.settings->>'api_url' != '' THEN true
    WHEN i.settings->>'api_key' IS NOT NULL AND i.settings->>'api_key' != '' THEN true
    ELSE false
  END as is_configured,
  (i.user_id = auth.uid()) as is_owner
FROM integration_settings i;

-- Grant permissions for the view
GRANT SELECT ON integration_settings_view TO authenticated;

-- Add comments to document the new fields
COMMENT ON COLUMN integration_settings.is_global IS 'Whether this integration is available to all users in the system';
COMMENT ON COLUMN integration_settings.created_by_user_id IS 'The user who originally created this integration (for attribution)';

-- Example: Create a sample global Aquarius integration (commented out - run manually if needed)
/*
INSERT INTO integration_settings (
  user_id, 
  integration_name, 
  settings, 
  is_enabled, 
  is_global,
  created_by_user_id
) VALUES (
  (SELECT id FROM auth.users LIMIT 1), -- Use first user as owner
  'aquarius_software_global',
  '{
    "api_url": "https://demo.aquarius-software.com/api",
    "api_user": "demo_user",
    "api_password": "demo_password",
    "description": "Global Aquarius Software Integration - Demo",
    "display_name": "Aquarius Software (Global)",
    "fields": [
      {
        "key": "api_url",
        "label": "API Base URL",
        "type": "text",
        "required": true,
        "placeholder": "https://api.aquarius-software.com"
      },
      {
        "key": "api_user",
        "label": "API User",
        "type": "text",
        "required": true,
        "placeholder": "your-api-username"
      },
      {
        "key": "api_password",
        "label": "API Password",
        "type": "password",
        "required": true,
        "placeholder": "your-api-password"
      }
    ]
  }',
  true,
  true,
  (SELECT id FROM auth.users LIMIT 1)
) ON CONFLICT (user_id, integration_name) DO NOTHING;
*/
