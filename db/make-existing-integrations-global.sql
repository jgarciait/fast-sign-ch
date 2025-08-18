-- Simple update to make existing integrations global
-- Run this in Supabase SQL Editor

-- Update all existing integrations to be global
UPDATE integration_settings 
SET is_global = true,
    created_by_user_id = user_id
WHERE is_global IS NULL OR is_global = false;

-- Verify the update
SELECT id, integration_name, is_enabled, is_global, user_id, created_by_user_id 
FROM integration_settings;
