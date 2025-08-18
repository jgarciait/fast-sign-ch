CREATE OR REPLACE FUNCTION get_enum_values(enum_name text)
RETURNS TABLE (enum_value text)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY EXECUTE format(
    'SELECT unnest(enum_range(NULL::%I))::text', 
    enum_name
  );
END;
$$;
