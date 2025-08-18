-- Update existing integration_settings to support JSON endpoint configuration
-- No schema changes needed as we're already using JSONB for settings

-- Function to migrate existing endpoint data to new JSON format
CREATE OR REPLACE FUNCTION migrate_integration_endpoints()
RETURNS void AS $$
BEGIN
  -- Update existing Aquarius integrations to use new JSON endpoint format
  UPDATE integration_settings 
  SET settings = settings || jsonb_build_object(
    'endpoints', jsonb_build_array(
      jsonb_build_object(
        'id', 'auth',
        'name', 'Authentication',
        'description', 'Authenticate and get access token',
        'method', 'POST',
        'endpoint', COALESCE(settings->>'auth_endpoint', '/token'),
        'required', true,
        'isAuth', true
      ),
      jsonb_build_object(
        'id', 'doctypes',
        'name', 'Document Types',
        'description', 'Get available document types and directories',
        'method', 'POST',
        'endpoint', COALESCE(settings->>'doctypes_endpoint', '/api/Doctypes'),
        'required', false
      )
    )
  )
  WHERE integration_name = 'aquarius_software'
    AND (settings ? 'auth_endpoint' OR settings ? 'doctypes_endpoint')
    AND NOT (settings ? 'endpoints');

  -- Remove old endpoint fields after migration
  UPDATE integration_settings 
  SET settings = settings - 'auth_endpoint' - 'doctypes_endpoint'
  WHERE integration_name = 'aquarius_software'
    AND (settings ? 'endpoints');
    
END;
$$ LANGUAGE plpgsql;

-- Run the migration
SELECT migrate_integration_endpoints();

-- Create a function to validate endpoint configuration
CREATE OR REPLACE FUNCTION validate_integration_endpoints(p_settings JSONB)
RETURNS boolean AS $$
DECLARE
  endpoint_item JSONB;
BEGIN
  -- Check if endpoints exist and is an array
  IF NOT (p_settings ? 'endpoints') OR jsonb_typeof(p_settings->'endpoints') != 'array' THEN
    RETURN false;
  END IF;
  
  -- Validate each endpoint
  FOR endpoint_item IN SELECT jsonb_array_elements(p_settings->'endpoints')
  LOOP
    -- Check required fields
    IF NOT (
      endpoint_item ? 'id' AND
      endpoint_item ? 'name' AND
      endpoint_item ? 'method' AND
      endpoint_item ? 'endpoint'
    ) THEN
      RETURN false;
    END IF;
    
    -- Validate method
    IF NOT (endpoint_item->>'method' IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH')) THEN
      RETURN false;
    END IF;
  END LOOP;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION validate_integration_endpoints(JSONB) TO authenticated;

-- Create a view to easily query endpoint configurations
CREATE OR REPLACE VIEW integration_endpoints_view AS
SELECT 
  i.id as integration_id,
  i.user_id,
  i.integration_name,
  i.is_enabled,
  endpoint.value as endpoint_config
FROM integration_settings i
CROSS JOIN LATERAL jsonb_array_elements(i.settings->'endpoints') AS endpoint
WHERE i.settings ? 'endpoints';

-- Grant permissions on the view
GRANT SELECT ON integration_endpoints_view TO authenticated;

-- Example of how the new JSON structure should look:
/*
{
  "api_url": "https://asp.aquariusimaging.com/AquariusWebAPI",
  "api_user": "admin@de",
  "api_password": "Admin456$",
  "endpoints": [
    {
      "id": "auth",
      "name": "Authentication",
      "description": "Authenticate and get access token",
      "method": "POST",
      "endpoint": "/token",
      "required": true,
      "isAuth": true
    },
    {
      "id": "doctypes",
      "name": "Document Types", 
      "description": "Get available document types and directories",
      "method": "POST",
      "endpoint": "/api/Doctypes",
      "required": false
    },
    {
      "id": "upload",
      "name": "Upload Document",
      "description": "Upload a new document to Aquarius",
      "method": "POST", 
      "endpoint": "/api/Documents/Upload",
      "required": false
    }
  ]
}
*/
