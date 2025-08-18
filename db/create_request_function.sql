CREATE OR REPLACE FUNCTION create_request(
  p_title TEXT,
  p_message TEXT,
  p_customer_id UUID,
  p_document_id UUID,
  p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_request_id UUID;
  v_result JSONB;
BEGIN
  -- Insert the request with default status value
  INSERT INTO requests (
    title,
    message,
    customer_id,
    document_id,
    user_id,
    sent_at
  ) VALUES (
    p_title,
    p_message,
    p_customer_id,
    p_document_id,
    p_user_id,
    NOW()
  ) RETURNING id INTO v_request_id;
  
  -- Return the created request ID
  SELECT jsonb_build_object(
    'id', v_request_id,
    'success', true
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
