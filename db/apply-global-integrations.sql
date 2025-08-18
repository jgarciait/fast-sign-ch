-- Apply global integrations migration to Supabase
-- Run this in Supabase SQL Editor

-- Add new columns to integration_settings table
ALTER TABLE integration_settings 
ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Update existing integrations to set the created_by_user_id and make them global
UPDATE integration_settings 
SET created_by_user_id = user_id,
    is_global = true
WHERE created_by_user_id IS NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_integration_settings_global ON integration_settings(is_global);
CREATE INDEX IF NOT EXISTS idx_integration_settings_created_by ON integration_settings(created_by_user_id);

-- Drop existing RLS policy and create new ones that support global integrations
DROP POLICY IF EXISTS "Users can manage their own integration settings" ON integration_settings;
DROP POLICY IF EXISTS "Users can view their own or global integration settings" ON integration_settings;
DROP POLICY IF EXISTS "Users can insert their own integration settings" ON integration_settings;
DROP POLICY IF EXISTS "Users can update their own integration settings" ON integration_settings;
DROP POLICY IF EXISTS "Users can delete their own integration settings" ON integration_settings;

-- Policy: All authenticated users can view all integrations (since they're all global now)
CREATE POLICY "All users can view integrations" ON integration_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Policy: Only original creators can insert integrations
CREATE POLICY "Users can insert integration settings" ON integration_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Only original creators can update integrations
CREATE POLICY "Original creators can update integration settings" ON integration_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Only original creators can delete integrations
CREATE POLICY "Original creators can delete integration settings" ON integration_settings
  FOR DELETE USING (auth.uid() = user_id);

-- Update the API usage and rate limits policies to work with global integrations
DROP POLICY IF EXISTS "Users can access their own API usage" ON integration_api_usage;
DROP POLICY IF EXISTS "Users can access API usage for available integrations" ON integration_api_usage;
CREATE POLICY "Users can log API usage for any integration" ON integration_api_usage
  FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can access their own rate limits" ON integration_rate_limits;
DROP POLICY IF EXISTS "Users can access rate limits for available integrations" ON integration_rate_limits;
CREATE POLICY "Users can access rate limits for any integration" ON integration_rate_limits
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Create function to get all available integrations (now global for everyone)
CREATE OR REPLACE FUNCTION get_available_integrations(p_user_id UUID DEFAULT NULL)
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
  masked_settings JSONB,
  settings JSONB
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
      WHEN i.settings->>'api_user' IS NOT NULL AND i.settings->>'api_user' != '' THEN true
      ELSE false
    END as is_configured,
    true as is_global, -- All integrations are now global
    (i.user_id = p_user_id) as is_owner,
    i.created_at,
    i.updated_at,
    -- Return masked settings for UI display (always masked for security)
    jsonb_build_object(
      'api_url', CASE WHEN i.settings->>'api_url' IS NOT NULL AND i.settings->>'api_url' != '' THEN '••••••••••••' ELSE '' END,
      'api_user', CASE WHEN i.settings->>'api_user' IS NOT NULL AND i.settings->>'api_user' != '' THEN '••••••••••••' ELSE '' END,
      'api_password', CASE WHEN i.settings->>'api_password' IS NOT NULL AND i.settings->>'api_password' != '' THEN '••••••••••••' ELSE '' END,
      'api_key', CASE WHEN i.settings->>'api_key' IS NOT NULL AND i.settings->>'api_key' != '' THEN '••••••••••••' ELSE '' END,
      'secret_key', CASE WHEN i.settings->>'secret_key' IS NOT NULL AND i.settings->>'secret_key' != '' THEN '••••••••••••' ELSE '' END,
      'display_name', i.settings->>'display_name',
      'description', i.settings->>'description',
      'endpoints', i.settings->'endpoints'
    ) as masked_settings,
    -- Return full settings for API usage (only for owners, but all can use the integrations)
    CASE 
      WHEN i.user_id = p_user_id THEN i.settings
      ELSE i.settings -- Return full settings for API usage by all users
    END as settings
  FROM integration_settings i
  WHERE i.is_enabled = true  -- Only return enabled integrations
  ORDER BY i.integration_name;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_available_integrations(UUID) TO authenticated;

-- Create a simpler function that returns all integrations for any authenticated user
CREATE OR REPLACE FUNCTION get_all_integrations()
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
  masked_settings JSONB,
  settings JSONB
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
      WHEN i.settings->>'api_user' IS NOT NULL AND i.settings->>'api_user' != '' THEN true
      ELSE false
    END as is_configured,
    true as is_global, -- All integrations are now global
    false as is_owner, -- For simplicity, no ownership concept for global use
    i.created_at,
    i.updated_at,
    -- Return masked settings for UI display
    jsonb_build_object(
      'api_url', CASE WHEN i.settings->>'api_url' IS NOT NULL AND i.settings->>'api_url' != '' THEN '••••••••••••' ELSE '' END,
      'api_user', CASE WHEN i.settings->>'api_user' IS NOT NULL AND i.settings->>'api_user' != '' THEN '••••••••••••' ELSE '' END,
      'api_password', CASE WHEN i.settings->>'api_password' IS NOT NULL AND i.settings->>'api_password' != '' THEN '••••••••••••' ELSE '' END,
      'api_key', CASE WHEN i.settings->>'api_key' IS NOT NULL AND i.settings->>'api_key' != '' THEN '••••••••••••' ELSE '' END,
      'secret_key', CASE WHEN i.settings->>'secret_key' IS NOT NULL AND i.settings->>'secret_key' != '' THEN '••••••••••••' ELSE '' END,
      'display_name', i.settings->>'display_name',
      'description', i.settings->>'description',
      'endpoints', i.settings->'endpoints'
    ) as masked_settings,
    -- Return full settings for API usage by all users
    i.settings
  FROM integration_settings i
  WHERE i.is_enabled = true  -- Only return enabled integrations
  ORDER BY i.integration_name;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_all_integrations() TO authenticated;

-- Create function to get integration by name for any user (global access)
CREATE OR REPLACE FUNCTION get_integration_by_name(p_integration_name VARCHAR(100))
RETURNS TABLE (
  id UUID,
  integration_name VARCHAR(100),
  settings JSONB,
  is_enabled BOOLEAN,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.integration_name,
    i.settings,
    i.is_enabled,
    i.user_id,
    i.created_at,
    i.updated_at
  FROM integration_settings i
  WHERE i.integration_name = p_integration_name
    AND i.is_enabled = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_integration_by_name(VARCHAR) TO authenticated;

-- Create function to mark an integration as global (admin function)
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

-- Create function to remove global status from an integration
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
    WHEN i.settings->>'api_user' IS NOT NULL AND i.settings->>'api_user' != '' THEN true
    ELSE false
  END as is_configured
FROM integration_settings i;

-- Grant access to the view
GRANT SELECT ON integration_settings_view TO authenticated;

-- Add comments to document the new fields
COMMENT ON COLUMN integration_settings.is_global IS 'Whether this integration is available to all users in the system';
COMMENT ON COLUMN integration_settings.created_by_user_id IS 'The user who originally created this integration (for attribution)';
