-- API usage tracking table (MISSING - needs to be added)
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

-- Integration rate limits table (MISSING - needs to be added)
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

-- Enable RLS on new tables
ALTER TABLE integration_api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS policies for API usage table
CREATE POLICY "Users can access their own API usage" ON integration_api_usage
  FOR ALL USING (auth.uid() = user_id);

-- RLS policies for rate limits table
CREATE POLICY "Users can access their own rate limits" ON integration_rate_limits
  FOR ALL USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_integration_api_usage_integration_id ON integration_api_usage(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_api_usage_user_id ON integration_api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_api_usage_created_at ON integration_api_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_integration_api_usage_status_code ON integration_api_usage(status_code);

CREATE INDEX IF NOT EXISTS idx_integration_rate_limits_integration_id ON integration_rate_limits(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_rate_limits_user_id ON integration_rate_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_rate_limits_limit_type ON integration_rate_limits(limit_type);

-- Unique constraint for rate limits (one record per integration/user/limit_type)
CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_rate_limits_unique 
ON integration_rate_limits(integration_id, user_id, limit_type);

-- Function to update rate limits updated_at timestamp
CREATE OR REPLACE FUNCTION update_integration_rate_limits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for rate limits updated_at
CREATE TRIGGER trigger_update_integration_rate_limits_updated_at
  BEFORE UPDATE ON integration_rate_limits
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_rate_limits_updated_at();

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

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_integration_statistics(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION log_api_usage(UUID, UUID, VARCHAR, VARCHAR, INTEGER, INTEGER, INTEGER, INTEGER, TEXT) TO authenticated;
