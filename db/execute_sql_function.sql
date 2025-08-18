-- Create a function to execute arbitrary SQL with parameters
CREATE OR REPLACE FUNCTION execute_sql(sql text, params text[] DEFAULT '{}')
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  EXECUTE sql USING params INTO result;
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
