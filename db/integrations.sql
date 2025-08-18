-- Integration settings table
CREATE TABLE IF NOT EXISTS integration_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_name VARCHAR(100) NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}',
  is_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- API usage tracking table
CREATE TABLE IF NOT EXISTS integration_api_usage (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  integration_id UUID REFERENCES integration_settings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint VARCHAR(255),
  method VARCHAR(10),
  status_code INTEGER,
  response_time_ms INTEGER,
  request_size_bytes INTEGER,
  response_size_bytes INTEGER,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Integration rate limits table
CREATE TABLE IF NOT EXISTS integration_rate_limits (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  integration_id UUID REFERENCES integration_settings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  limit_type VARCHAR(50) NOT NULL, -- 'daily', 'monthly', 'hourly'
  limit_value INTEGER NOT NULL,
  current_usage INTEGER DEFAULT 0,
  reset_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create unique constraint to prevent duplicate integrations per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_settings_user_integration 
ON integration_settings(user_id, integration_name);

-- RLS policies
ALTER TABLE integration_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_rate_limits ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own integration settings
CREATE POLICY "Users can manage their own integration settings" ON integration_settings
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can access their own API usage" ON integration_api_usage
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can access their own rate limits" ON integration_rate_limits
  FOR ALL USING (auth.uid() = user_id);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_integration_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_integration_rate_limits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_update_integration_settings_updated_at
  BEFORE UPDATE ON integration_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_settings_updated_at();

CREATE TRIGGER trigger_update_integration_rate_limits_updated_at
  BEFORE UPDATE ON integration_rate_limits
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_rate_limits_updated_at();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_integration_settings_user_id ON integration_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_settings_integration_name ON integration_settings(integration_name);
CREATE INDEX IF NOT EXISTS idx_integration_settings_enabled ON integration_settings(is_enabled);

CREATE INDEX IF NOT EXISTS idx_integration_api_usage_integration_id ON integration_api_usage(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_api_usage_user_id ON integration_api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_api_usage_created_at ON integration_api_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_integration_api_usage_status_code ON integration_api_usage(status_code);

CREATE INDEX IF NOT EXISTS idx_integration_rate_limits_integration_id ON integration_rate_limits(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_rate_limits_user_id ON integration_rate_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_rate_limits_limit_type ON integration_rate_limits(limit_type);

-- Function to get integration statistics
CREATE OR REPLACE FUNCTION get_integration_statistics(p_integration_id UUID, p_user_id UUID)
RETURNS TABLE (
  success_rate DECIMAL,
  total_calls_this_month INTEGER,
  total_calls_last_7_days INTEGER,
  daily_rate_limit INTEGER,
  current_daily_usage INTEGER,
  avg_response_time_ms DECIMAL
) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT 
      -- Success rate (last 7 days)
      CASE 
        WHEN COUNT(*) > 0 THEN 
          ROUND((COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300)::DECIMAL / COUNT(*)) * 100, 1)
        ELSE 0
      END as success_rate_7d,
      
      -- Total calls this month
      COUNT(*) FILTER (WHERE created_at >= date_trunc('month', now())) as calls_this_month,
      
      -- Total calls last 7 days  
      COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days') as calls_7_days,
      
      -- Average response time
      ROUND(AVG(response_time_ms), 1) as avg_response_time
      
    FROM integration_api_usage 
    WHERE integration_id = p_integration_id 
      AND user_id = p_user_id
      AND created_at >= now() - interval '30 days'
  ),
  rate_limit_info AS (
    SELECT 
      COALESCE(MAX(limit_value) FILTER (WHERE limit_type = 'daily'), 4000) as daily_limit,
      COALESCE(MAX(current_usage) FILTER (WHERE limit_type = 'daily'), 0) as daily_usage
    FROM integration_rate_limits 
    WHERE integration_id = p_integration_id 
      AND user_id = p_user_id
      AND limit_type = 'daily'
      AND (reset_at IS NULL OR reset_at > now())
  )
  SELECT 
    COALESCE(s.success_rate_7d, 0) as success_rate,
    COALESCE(s.calls_this_month, 0)::INTEGER as total_calls_this_month,
    COALESCE(s.calls_7_days, 0)::INTEGER as total_calls_last_7_days,
    r.daily_limit::INTEGER as daily_rate_limit,
    r.daily_usage::INTEGER as current_daily_usage,
    COALESCE(s.avg_response_time, 0) as avg_response_time_ms
  FROM stats s
  CROSS JOIN rate_limit_info r;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_integration_statistics(UUID, UUID) TO authenticated;

-- Function to log API usage
CREATE OR REPLACE FUNCTION log_api_usage(
  p_integration_id UUID,
  p_user_id UUID,
  p_endpoint VARCHAR(255),
  p_method VARCHAR(10),
  p_status_code INTEGER,
  p_response_time_ms INTEGER DEFAULT NULL,
  p_request_size_bytes INTEGER DEFAULT NULL,
  p_response_size_bytes INTEGER DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
AS $$
DECLARE
  usage_id UUID;
BEGIN
  -- Insert the API usage record
  INSERT INTO integration_api_usage (
    integration_id,
    user_id,
    endpoint,
    method,
    status_code,
    response_time_ms,
    request_size_bytes,
    response_size_bytes,
    error_message
  ) VALUES (
    p_integration_id,
    p_user_id,
    p_endpoint,
    p_method,
    p_status_code,
    p_response_time_ms,
    p_request_size_bytes,
    p_response_size_bytes,
    p_error_message
  ) RETURNING id INTO usage_id;
  
  -- Update daily rate limit usage
  INSERT INTO integration_rate_limits (
    integration_id,
    user_id,
    limit_type,
    limit_value,
    current_usage,
    reset_at
  ) VALUES (
    p_integration_id,
    p_user_id,
    'daily',
    4000, -- Default daily limit
    1,
    date_trunc('day', now()) + interval '1 day'
  )
  ON CONFLICT (integration_id, user_id, limit_type) 
  DO UPDATE SET 
    current_usage = CASE 
      WHEN integration_rate_limits.reset_at <= now() THEN 1
      ELSE integration_rate_limits.current_usage + 1
    END,
    reset_at = CASE 
      WHEN integration_rate_limits.reset_at <= now() THEN date_trunc('day', now()) + interval '1 day'
      ELSE integration_rate_limits.reset_at
    END,
    updated_at = now();
    
  RETURN usage_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION log_api_usage(UUID, UUID, VARCHAR, VARCHAR, INTEGER, INTEGER, INTEGER, INTEGER, TEXT) TO authenticated;

-- Add unique constraint for rate limits
CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_rate_limits_unique 
ON integration_rate_limits(integration_id, user_id, limit_type);

-- Insert default Aquarius Software integration template for existing users
-- This will be available for all users to add if they want
INSERT INTO integration_settings (user_id, integration_name, settings, is_enabled)
SELECT 
  auth.uid(), 
  'aquarius_software_template',
  '{
    "api_url": "",
    "api_user": "",
    "api_password": "",
    "description": "Aquarius Software Integration Template",
    "display_name": "Aquarius Software",
    "fields": [
      {
        "key": "api_url",
        "label": "API Base URL",
        "type": "password",
        "required": true,
        "placeholder": "https://api.aquarius-software.com"
      },
      {
        "key": "api_user",
        "label": "API User",
        "type": "password",
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
  false
WHERE auth.uid() IS NOT NULL
ON CONFLICT (user_id, integration_name) DO NOTHING;

-- Create a view for easier querying of integration settings with metadata
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
  END as is_configured
FROM integration_settings i;

-- Grant permissions for the view
GRANT SELECT ON integration_settings_view TO authenticated;

-- Function to safely get integration settings (masks sensitive data)
CREATE OR REPLACE FUNCTION get_masked_integration_settings(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  integration_name VARCHAR(100),
  display_name TEXT,
  is_enabled BOOLEAN,
  is_configured BOOLEAN,
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
    i.created_at,
    i.updated_at,
    -- Mask sensitive fields
    jsonb_build_object(
      'api_url', CASE WHEN i.settings->>'api_url' IS NOT NULL AND i.settings->>'api_url' != '' THEN '••••••••••••' ELSE '' END,
      'api_user', CASE WHEN i.settings->>'api_user' IS NOT NULL AND i.settings->>'api_user' != '' THEN '••••••••••••' ELSE '' END,
      'api_password', CASE WHEN i.settings->>'api_password' IS NOT NULL AND i.settings->>'api_password' != '' THEN '••••••••••••' ELSE '' END,
      'api_key', CASE WHEN i.settings->>'api_key' IS NOT NULL AND i.settings->>'api_key' != '' THEN '••••••••••••' ELSE '' END,
      'secret_key', CASE WHEN i.settings->>'secret_key' IS NOT NULL AND i.settings->>'secret_key' != '' THEN '••••••••••••' ELSE '' END
    ) as masked_settings
  FROM integration_settings i
  WHERE i.user_id = p_user_id
  ORDER BY i.integration_name;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_masked_integration_settings(UUID) TO authenticated;

-- Add some sample integration templates that users can enable
-- These won't be active by default but available for setup
DO $$
DECLARE
  template_integrations JSONB := '[
    {
      "name": "stripe",
      "display_name": "Stripe",
      "description": "Payment processing integration",
      "fields": [
        {"key": "api_key", "label": "API Key", "type": "password", "required": true, "placeholder": "sk_test_..."},
        {"key": "webhook_secret", "label": "Webhook Secret", "type": "password", "required": false, "placeholder": "whsec_..."}
      ]
    },
    {
      "name": "quickbooks",
      "display_name": "QuickBooks",
      "description": "Accounting software integration",
      "fields": [
        {"key": "client_id", "label": "Client ID", "type": "password", "required": true, "placeholder": "Your QuickBooks Client ID"},
        {"key": "client_secret", "label": "Client Secret", "type": "password", "required": true, "placeholder": "Your QuickBooks Client Secret"}
      ]
    },
    {
      "name": "paypal",
      "display_name": "PayPal",
      "description": "PayPal payment integration",
      "fields": [
        {"key": "client_id", "label": "Client ID", "type": "password", "required": true, "placeholder": "Your PayPal Client ID"},
        {"key": "client_secret", "label": "Client Secret", "type": "password", "required": true, "placeholder": "Your PayPal Client Secret"}
      ]
    }
  ]'::JSONB;
  template JSONB;
BEGIN
  -- This is just for documentation - in practice, templates would be handled by the application
  -- The actual integration setup will be done through the UI
  NULL;
END $$;
