-- Add rate limiting configuration to integration settings
-- This allows users to enable/disable rate limiting per integration

-- Add rate limiting fields to integration_settings
ALTER TABLE integration_settings 
ADD COLUMN IF NOT EXISTS rate_limiting_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS daily_rate_limit INTEGER DEFAULT 4000,
ADD COLUMN IF NOT EXISTS monthly_rate_limit INTEGER DEFAULT 100000;

-- Update existing integrations to have rate limiting disabled by default
UPDATE integration_settings 
SET rate_limiting_enabled = false,
    daily_rate_limit = 4000,
    monthly_rate_limit = 100000
WHERE rate_limiting_enabled IS NULL;

-- Create function to check if rate limit is exceeded
CREATE OR REPLACE FUNCTION check_rate_limit(p_integration_id UUID, p_period TEXT DEFAULT 'daily')
RETURNS BOOLEAN AS $$
DECLARE
  current_usage INTEGER;
  rate_limit INTEGER;
  rate_limiting_enabled BOOLEAN;
  start_date TIMESTAMP;
BEGIN
  -- Get rate limiting settings
  SELECT 
    i.rate_limiting_enabled,
    CASE 
      WHEN p_period = 'daily' THEN i.daily_rate_limit
      WHEN p_period = 'monthly' THEN i.monthly_rate_limit
      ELSE i.daily_rate_limit
    END
  INTO rate_limiting_enabled, rate_limit
  FROM integration_settings i
  WHERE i.id = p_integration_id;
  
  -- If rate limiting is disabled, always allow
  IF NOT rate_limiting_enabled THEN
    RETURN TRUE;
  END IF;
  
  -- Calculate start date based on period
  IF p_period = 'daily' THEN
    start_date := CURRENT_DATE;
  ELSIF p_period = 'monthly' THEN
    start_date := DATE_TRUNC('month', CURRENT_DATE);
  ELSE
    start_date := CURRENT_DATE;
  END IF;
  
  -- Get current usage for the period
  SELECT COUNT(*)
  INTO current_usage
  FROM integration_api_usage
  WHERE integration_id = p_integration_id
    AND created_at >= start_date;
  
  -- Check if under limit
  RETURN current_usage < rate_limit;
END;
$$ LANGUAGE plpgsql;

-- Create function to get rate limit status
CREATE OR REPLACE FUNCTION get_rate_limit_status(p_integration_id UUID)
RETURNS TABLE(
  rate_limiting_enabled BOOLEAN,
  daily_limit INTEGER,
  daily_usage INTEGER,
  daily_remaining INTEGER,
  monthly_limit INTEGER,
  monthly_usage INTEGER,
  monthly_remaining INTEGER,
  daily_percentage NUMERIC,
  monthly_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.rate_limiting_enabled,
    i.daily_rate_limit,
    COALESCE(daily_stats.usage_count, 0)::INTEGER as daily_usage,
    GREATEST(i.daily_rate_limit - COALESCE(daily_stats.usage_count, 0), 0)::INTEGER as daily_remaining,
    i.monthly_rate_limit,
    COALESCE(monthly_stats.usage_count, 0)::INTEGER as monthly_usage,
    GREATEST(i.monthly_rate_limit - COALESCE(monthly_stats.usage_count, 0), 0)::INTEGER as monthly_remaining,
    CASE 
      WHEN i.daily_rate_limit > 0 THEN 
        ROUND((COALESCE(daily_stats.usage_count, 0)::NUMERIC / i.daily_rate_limit::NUMERIC) * 100, 1)
      ELSE 0 
    END as daily_percentage,
    CASE 
      WHEN i.monthly_rate_limit > 0 THEN 
        ROUND((COALESCE(monthly_stats.usage_count, 0)::NUMERIC / i.monthly_rate_limit::NUMERIC) * 100, 1)
      ELSE 0 
    END as monthly_percentage
  FROM integration_settings i
  LEFT JOIN (
    SELECT integration_id, COUNT(*) as usage_count
    FROM integration_api_usage
    WHERE created_at >= CURRENT_DATE
    GROUP BY integration_id
  ) daily_stats ON i.id = daily_stats.integration_id
  LEFT JOIN (
    SELECT integration_id, COUNT(*) as usage_count
    FROM integration_api_usage
    WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
    GROUP BY integration_id
  ) monthly_stats ON i.id = monthly_stats.integration_id
  WHERE i.id = p_integration_id;
END;
$$ LANGUAGE plpgsql;

-- Update the integration statistics function to respect rate limiting settings
CREATE OR REPLACE FUNCTION get_integration_statistics_with_limits(p_integration_id UUID)
RETURNS TABLE(
  success_rate NUMERIC,
  total_calls_this_month INTEGER,
  total_calls_last_7_days INTEGER,
  daily_rate_limit INTEGER,
  current_daily_usage INTEGER,
  avg_response_time_ms NUMERIC,
  rate_limiting_enabled BOOLEAN,
  monthly_rate_limit INTEGER,
  current_monthly_usage INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(
      ROUND(
        (COUNT(CASE WHEN iau.status_code BETWEEN 200 AND 299 THEN 1 END)::NUMERIC / 
         NULLIF(COUNT(*)::NUMERIC, 0)) * 100, 1
      ), 0
    ) as success_rate,
    COUNT(CASE WHEN iau.created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END)::INTEGER as total_calls_this_month,
    COUNT(CASE WHEN iau.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END)::INTEGER as total_calls_last_7_days,
    i.daily_rate_limit,
    COUNT(CASE WHEN iau.created_at >= CURRENT_DATE THEN 1 END)::INTEGER as current_daily_usage,
    COALESCE(ROUND(AVG(iau.response_time_ms), 0), 0) as avg_response_time_ms,
    i.rate_limiting_enabled,
    i.monthly_rate_limit,
    COUNT(CASE WHEN iau.created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END)::INTEGER as current_monthly_usage
  FROM integration_settings i
  LEFT JOIN integration_api_usage iau ON i.id = iau.integration_id
  WHERE i.id = p_integration_id
  GROUP BY i.id, i.daily_rate_limit, i.rate_limiting_enabled, i.monthly_rate_limit;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_rate_limit(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_rate_limit_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_integration_statistics_with_limits(UUID) TO authenticated;

-- Create index for better performance on rate limit checks
CREATE INDEX IF NOT EXISTS idx_integration_api_usage_integration_created 
ON integration_api_usage(integration_id, created_at);

-- Add comment to document the new fields
COMMENT ON COLUMN integration_settings.rate_limiting_enabled IS 'Whether rate limiting is enabled for this integration';
COMMENT ON COLUMN integration_settings.daily_rate_limit IS 'Maximum API calls allowed per day (if rate limiting enabled)';
COMMENT ON COLUMN integration_settings.monthly_rate_limit IS 'Maximum API calls allowed per month (if rate limiting enabled)';
