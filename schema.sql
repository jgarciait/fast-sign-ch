

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'All filing systems, case files, and documents are globally accessible to authenticated users';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."request_status" AS ENUM (
    'sent',
    'received',
    'signed',
    'returned'
);


ALTER TYPE "public"."request_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_categorize_document"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    contract_category_id UUID;
    signed_category_id UUID;
    form_category_id UUID;
BEGIN
    -- Only auto-categorize if document is linked to a case file and no category is set
    IF NEW.file_record_id IS NOT NULL AND NEW.category_id IS NULL THEN
        
        -- Check if filename indicates it's a signed document
        IF NEW.file_name ILIKE 'SIGNED_%' OR NEW.file_name ILIKE '%_signed%' THEN
            SELECT id INTO signed_category_id 
            FROM document_categories 
            WHERE file_record_id = NEW.file_record_id AND name = 'Firmados'
            LIMIT 1;
            
            IF signed_category_id IS NOT NULL THEN
                NEW.category_id := signed_category_id;
            END IF;
            
        -- Check if filename indicates it's a contract
        ELSIF NEW.file_name ILIKE '%contrato%' OR NEW.file_name ILIKE '%contract%' THEN
            SELECT id INTO contract_category_id 
            FROM document_categories 
            WHERE file_record_id = NEW.file_record_id AND name = 'Contratos'
            LIMIT 1;
            
            IF contract_category_id IS NOT NULL THEN
                NEW.category_id := contract_category_id;
            END IF;
            
        -- Check if filename indicates it's a form
        ELSIF NEW.file_name ILIKE '%form%' OR NEW.file_name ILIKE '%formulario%' THEN
            SELECT id INTO form_category_id 
            FROM document_categories 
            WHERE file_record_id = NEW.file_record_id AND name = 'Formularios'
            LIMIT 1;
            
            IF form_category_id IS NOT NULL THEN
                NEW.category_id := form_category_id;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_categorize_document"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_unlink_documents_from_case_file"("p_document_ids" "uuid"[]) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    unlinked_count INTEGER := 0;
BEGIN
    UPDATE documents 
    SET 
        file_record_id = NULL,
        category_id = NULL,
        case_file_metadata = '{}',
        updated_at = NOW()
    WHERE id = ANY(p_document_ids)
    AND file_record_id IS NOT NULL;
    
    GET DIAGNOSTICS unlinked_count = ROW_COUNT;
    RETURN unlinked_count;
END;
$$;


ALTER FUNCTION "public"."bulk_unlink_documents_from_case_file"("p_document_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_rate_limit"("p_integration_id" "uuid", "p_period" "text" DEFAULT 'daily'::"text") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."check_rate_limit"("p_integration_id" "uuid", "p_period" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_default_category_for_file_record"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Create the default "Sin Categorizar" category for the new file record
  INSERT INTO document_categories (
    id,
    file_record_id,
    name,
    description,
    color,
    icon,
    sort_order,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    NEW.id,
    'Sin Categorizar',
    'Documentos sin categoría específica',
    '#6B7280',
    'inbox',
    0,
    NEW.created_by, -- Use the same user who created the file record
    NOW(),
    NOW()
  );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_default_category_for_file_record"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_default_category_for_new_file_record"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Only create the default category for new file records
  INSERT INTO document_categories (
    id,
    file_record_id,
    name,
    description,
    color,
    icon,
    sort_order,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    NEW.id,
    'Sin Categorizar',
    'Documentos sin categoría específica',
    '#6B7280',
    'inbox',
    0,
    NEW.created_by,
    NOW(),
    NOW()
  );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_default_category_for_new_file_record"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_template_from_mapping"("mapping_id" "uuid", "template_name" "text", "template_description" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    template_id uuid;
    user_id uuid;
BEGIN
    -- Get the user who created the mapping
    SELECT created_by INTO user_id 
    FROM document_signature_mappings 
    WHERE id = mapping_id;
    
    -- Mark the mapping as a template
    UPDATE document_signature_mappings 
    SET is_template = true 
    WHERE id = mapping_id;
    
    -- Create the template entry
    INSERT INTO signature_mapping_templates (name, description, created_by, document_mapping_id)
    VALUES (template_name, template_description, user_id, mapping_id)
    RETURNING id INTO template_id;
    
    RETURN template_id;
END;
$$;


ALTER FUNCTION "public"."create_template_from_mapping"("mapping_id" "uuid", "template_name" "text", "template_description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_single_active_filing_system"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- If setting a filing system as active, deactivate all others globally
  IF NEW.is_active = TRUE THEN
    UPDATE filing_systems 
    SET is_active = FALSE, updated_at = NOW()
    WHERE id != NEW.id 
      AND is_active = TRUE;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_single_active_filing_system"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_single_default_customer_signature"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.is_default_for_customer = TRUE THEN
    UPDATE customer_signatures 
    SET is_default_for_customer = FALSE, updated_at = NOW()
    WHERE customer_id = NEW.customer_id AND id != NEW.id;
  END IF;
  
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ensure_single_default_customer_signature"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_single_default_template"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.is_default = TRUE THEN
    UPDATE signature_templates 
    SET is_default = FALSE, updated_at = NOW()
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ensure_single_default_template"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."force_delete_default_category"("p_file_record_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Temporarily disable the trigger
  PERFORM pg_sleep(0.01); -- Just to ensure this runs in a transaction
  
  -- Delete the "Sin Categorizar" category for this specific file record
  -- This bypasses the normal trigger protection because we're in a controlled context
  DELETE FROM document_categories 
  WHERE file_record_id = p_file_record_id 
  AND name = 'Sin Categorizar';
  
EXCEPTION WHEN OTHERS THEN
  -- If there's any error, we'll handle it gracefully
  RAISE NOTICE 'Could not delete default category for file record %: %', p_file_record_id, SQLERRM;
END;
$$;


ALTER FUNCTION "public"."force_delete_default_category"("p_file_record_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_available_integrations"("p_user_id" "uuid") RETURNS TABLE("id" "uuid", "integration_name" character varying, "display_name" "text", "is_enabled" boolean, "is_configured" boolean, "is_global" boolean, "is_owner" boolean, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "masked_settings" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
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
$$;


ALTER FUNCTION "public"."get_available_integrations"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_category_hierarchy"("p_file_record_id" "uuid") RETURNS TABLE("category_id" "uuid", "category_name" "text", "category_color" "text", "category_icon" "text", "parent_id" "uuid", "level" integer, "path" "text", "document_count" bigint)
    LANGUAGE "sql"
    AS $$
WITH RECURSIVE category_tree AS (
    -- Base case: root categories
    SELECT 
        dc.id,
        dc.name,
        dc.color,
        dc.icon,
        dc.parent_category_id,
        0 as level,
        dc.name as path,
        (SELECT COUNT(*) FROM documents WHERE category_id = dc.id) as doc_count
    FROM document_categories dc
    WHERE dc.file_record_id = p_file_record_id 
    AND dc.parent_category_id IS NULL
    
    UNION ALL
    
    -- Recursive case: child categories
    SELECT 
        dc.id,
        dc.name,
        dc.color,
        dc.icon,
        dc.parent_category_id,
        ct.level + 1,
        ct.path || ' > ' || dc.name,
        (SELECT COUNT(*) FROM documents WHERE category_id = dc.id) as doc_count
    FROM document_categories dc
    INNER JOIN category_tree ct ON dc.parent_category_id = ct.id
    WHERE dc.file_record_id = p_file_record_id
)
SELECT 
    id as category_id,
    name as category_name,
    color as category_color,
    icon as category_icon,
    parent_category_id as parent_id,
    level,
    path,
    doc_count as document_count
FROM category_tree
ORDER BY level, name;
$$;


ALTER FUNCTION "public"."get_category_hierarchy"("p_file_record_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_document_creator_info"("p_document_id" "uuid") RETURNS TABLE("creator_user_id" "uuid", "creator_name" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.created_by as creator_user_id,
    COALESCE(p.first_name || ' ' || p.last_name, 'Unknown User') as creator_name,
    d.created_at
  FROM documents d
  LEFT JOIN profiles p ON d.created_by = p.id
  WHERE d.id = p_document_id;
END;
$$;


ALTER FUNCTION "public"."get_document_creator_info"("p_document_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_document_creator_info"("p_document_id" "uuid") IS 'Helper function to get document creator information for display purposes';



CREATE OR REPLACE FUNCTION "public"."get_file_record_access_info"("p_file_record_id" "uuid", "p_user_id" "uuid") RETURNS TABLE("can_view" boolean, "can_edit" boolean, "is_creator" boolean, "is_assigned" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (fr.created_by = p_user_id OR fr.assigned_to_user_id = p_user_id) as can_view,
    (fr.created_by = p_user_id OR fr.assigned_to_user_id = p_user_id) as can_edit,
    (fr.created_by = p_user_id) as is_creator,
    (fr.assigned_to_user_id = p_user_id) as is_assigned
  FROM file_records fr
  WHERE fr.id = p_file_record_id;
END;
$$;


ALTER FUNCTION "public"."get_file_record_access_info"("p_file_record_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_file_record_access_info"("p_file_record_id" "uuid", "p_user_id" "uuid") IS 'Helper function to check user access permissions for case files';



CREATE OR REPLACE FUNCTION "public"."get_integration_statistics"("p_integration_id" "uuid", "p_user_id" "uuid") RETURNS TABLE("success_rate" numeric, "total_calls_this_month" integer, "total_calls_last_7_days" integer, "daily_rate_limit" integer, "current_daily_usage" integer, "avg_response_time_ms" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
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
$$;


ALTER FUNCTION "public"."get_integration_statistics"("p_integration_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_integration_statistics_with_limits"("p_integration_id" "uuid") RETURNS TABLE("success_rate" numeric, "total_calls_this_month" integer, "total_calls_last_7_days" integer, "daily_rate_limit" integer, "current_daily_usage" integer, "avg_response_time_ms" numeric, "rate_limiting_enabled" boolean, "monthly_rate_limit" integer, "current_monthly_usage" integer)
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_integration_statistics_with_limits"("p_integration_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_masked_integration_settings"("p_user_id" "uuid") RETURNS TABLE("id" "uuid", "integration_name" character varying, "display_name" "text", "is_enabled" boolean, "is_configured" boolean, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "masked_settings" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
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
$$;


ALTER FUNCTION "public"."get_masked_integration_settings"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_rate_limit_status"("p_integration_id" "uuid") RETURNS TABLE("rate_limiting_enabled" boolean, "daily_limit" integer, "daily_usage" integer, "daily_remaining" integer, "monthly_limit" integer, "monthly_usage" integer, "monthly_remaining" integer, "daily_percentage" numeric, "monthly_percentage" numeric)
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_rate_limit_status"("p_integration_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, email)
  VALUES (NEW.id, NULL, NULL, NEW.email);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_new_user"() IS 'Creates profile record with email when new user is created in auth.users';



CREATE OR REPLACE FUNCTION "public"."handle_user_email_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.profiles 
  SET email = NEW.email 
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_user_email_update"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_user_email_update"() IS 'Updates profile email when auth.users email is changed';



CREATE OR REPLACE FUNCTION "public"."log_api_usage"("p_integration_id" "uuid", "p_user_id" "uuid", "p_endpoint" character varying, "p_method" character varying, "p_status_code" integer, "p_response_time_ms" integer DEFAULT NULL::integer, "p_request_size_bytes" integer DEFAULT NULL::integer, "p_response_size_bytes" integer DEFAULT NULL::integer, "p_error_message" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
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
$$;


ALTER FUNCTION "public"."log_api_usage"("p_integration_id" "uuid", "p_user_id" "uuid", "p_endpoint" character varying, "p_method" character varying, "p_status_code" integer, "p_response_time_ms" integer, "p_request_size_bytes" integer, "p_response_size_bytes" integer, "p_error_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."make_integration_global"("p_integration_id" "uuid", "p_admin_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
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
$$;


ALTER FUNCTION "public"."make_integration_global"("p_integration_id" "uuid", "p_admin_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."make_integration_private"("p_integration_id" "uuid", "p_admin_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
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
$$;


ALTER FUNCTION "public"."make_integration_private"("p_integration_id" "uuid", "p_admin_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."migrate_integration_endpoints"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
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
        'required', true
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
$$;


ALTER FUNCTION "public"."migrate_integration_endpoints"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."move_document_to_category"("p_document_id" "uuid", "p_category_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE documents 
    SET 
        category_id = p_category_id,
        updated_at = NOW()
    WHERE id = p_document_id;
    
    RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."move_document_to_category"("p_document_id" "uuid", "p_category_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rename_template"("template_id" "uuid", "new_name" "text", "new_description" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE signature_mapping_templates 
    SET name = new_name,
        description = COALESCE(new_description, description),
        updated_at = now()
    WHERE id = template_id;
    
    RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."rename_template"("template_id" "uuid", "new_name" "text", "new_description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_filing_system_schema"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  schema_json JSONB;
BEGIN
  -- Rebuild the esquema_json from current indices
  SELECT jsonb_build_object(
    'version', 1,
    'indices', COALESCE(jsonb_agg(
      jsonb_build_object(
        'clave', clave,
        'etiqueta', etiqueta,
        'tipo', tipo_dato,
        'obligatorio', obligatorio,
        'opciones', CASE WHEN tipo_dato = 'enum' THEN opciones_enum ELSE NULL END,
        'orden', orden
      ) ORDER BY orden
    ), '[]'::jsonb)
  ) INTO schema_json
  FROM filing_indices 
  WHERE sistema_id = COALESCE(NEW.sistema_id, OLD.sistema_id);
  
  -- Update the filing system's esquema_json
  UPDATE filing_systems 
  SET esquema_json = schema_json, updated_at = NOW()
  WHERE id = COALESCE(NEW.sistema_id, OLD.sistema_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_filing_system_schema"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_integration_rate_limits_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_integration_rate_limits_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_integration_settings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_integration_settings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_signature_mapping_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_signature_mapping_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_integration_endpoints"("p_settings" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."validate_integration_endpoints"("p_settings" "jsonb") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."document_categories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "file_record_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "color" "text" DEFAULT '#3B82F6'::"text",
    "icon" "text" DEFAULT 'folder'::"text",
    "parent_category_id" "uuid",
    "sort_order" integer DEFAULT 0,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."document_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "file_name" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_size" bigint NOT NULL,
    "file_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" NOT NULL,
    "archived" boolean DEFAULT false NOT NULL,
    "document_type" "text" DEFAULT 'email'::"text",
    "updated_at" timestamp with time zone,
    "file_record_id" "uuid",
    "status" "text",
    "rotation" integer DEFAULT 0,
    "category_id" "uuid",
    "case_file_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "original_file_path" "text",
    "files_metadata" "jsonb"
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


COMMENT ON TABLE "public"."documents" IS 'Documents are globally visible to all authenticated users, but only creators can modify them';



COMMENT ON COLUMN "public"."documents"."archived" IS 'Whether the document is archived (hidden from active view)';



COMMENT ON COLUMN "public"."documents"."document_type" IS 'Type of document: email (traditional) or fast_sign (Fast Sign documents)';



COMMENT ON COLUMN "public"."documents"."file_record_id" IS 'Links documents to file records (expedientes) for classification';



COMMENT ON COLUMN "public"."documents"."rotation" IS 'Cumulative rotation in degrees (0, 90, 180, 270)';



CREATE OR REPLACE VIEW "public"."case_file_documents_with_categories" AS
 SELECT "d"."id",
    "d"."file_name",
    "d"."file_path",
    "d"."file_size",
    "d"."file_type",
    "d"."created_at",
    "d"."updated_at",
    "d"."file_record_id",
    "d"."category_id",
    "d"."case_file_metadata",
    "d"."document_type",
    "d"."status",
    "dc"."name" AS "category_name",
    "dc"."color" AS "category_color",
    "dc"."icon" AS "category_icon",
    "dc"."parent_category_id",
        CASE
            WHEN ("dc"."parent_category_id" IS NOT NULL) THEN ((( SELECT "string_agg"("parent"."name", ' > '::"text" ORDER BY "parent"."sort_order") AS "string_agg"
               FROM "public"."document_categories" "parent"
              WHERE ("parent"."id" = "dc"."parent_category_id")) || ' > '::"text") || "dc"."name")
            ELSE "dc"."name"
        END AS "category_path",
    ( SELECT "count"(*) AS "count"
           FROM "public"."documents" "d2"
          WHERE ("d2"."category_id" = "dc"."id")) AS "documents_in_category"
   FROM ("public"."documents" "d"
     LEFT JOIN "public"."document_categories" "dc" ON (("d"."category_id" = "dc"."id")))
  WHERE ("d"."file_record_id" IS NOT NULL);


ALTER VIEW "public"."case_file_documents_with_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_signatures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "signature_name" character varying(255) NOT NULL,
    "signature_data" "text" NOT NULL,
    "signature_type" character varying(50) DEFAULT 'canvas'::character varying NOT NULL,
    "is_default_for_customer" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."customer_signatures" OWNER TO "postgres";


COMMENT ON TABLE "public"."customer_signatures" IS 'Signatures specific to customers';



CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "email" "text" NOT NULL,
    "telephone" "text",
    "postal_address" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid"
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


COMMENT ON COLUMN "public"."customers"."user_id" IS 'Links customers to users for access control';



CREATE TABLE IF NOT EXISTS "public"."document_annotations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "document_id" "uuid",
    "recipient_email" "text" NOT NULL,
    "annotations" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."document_annotations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_signature_mappings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "template_id" "uuid",
    "signature_fields" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_template" boolean DEFAULT false
);


ALTER TABLE "public"."document_signature_mappings" OWNER TO "postgres";


COMMENT ON TABLE "public"."document_signature_mappings" IS 'Mapeos específicos de campos de firma para documentos individuales';



COMMENT ON COLUMN "public"."document_signature_mappings"."signature_fields" IS 'Array JSON con campos de firma específicos para este documento, mismo formato que las plantillas';



CREATE TABLE IF NOT EXISTS "public"."document_signatures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "recipient_email" "text",
    "status" "text" NOT NULL,
    "signed_at" timestamp with time zone NOT NULL,
    "signature_data" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "signature_source" "text",
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."document_signatures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."file_records" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_by" "uuid",
    "sistema_id" "uuid",
    "valores_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "customer_id" "uuid",
    "assigned_to_user_id" "uuid"
);


ALTER TABLE "public"."file_records" OWNER TO "postgres";


COMMENT ON TABLE "public"."file_records" IS 'Case files can be assigned to users. Creators and assigned users can view/edit, only creators can delete';



COMMENT ON COLUMN "public"."file_records"."customer_id" IS 'Links case files to customers';



COMMENT ON COLUMN "public"."file_records"."assigned_to_user_id" IS 'User assigned to handle this case file. NULL means unassigned.';



CREATE TABLE IF NOT EXISTS "public"."filing_indices" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "sistema_id" "uuid",
    "clave" "text" NOT NULL,
    "etiqueta" "text" NOT NULL,
    "tipo_dato" "text" NOT NULL,
    "obligatorio" boolean DEFAULT false NOT NULL,
    "opciones_enum" "jsonb",
    "orden" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "filing_indices_tipo_dato_check" CHECK (("tipo_dato" = ANY (ARRAY['string'::"text", 'int'::"text", 'fecha'::"text", 'bool'::"text", 'enum'::"text"])))
);


ALTER TABLE "public"."filing_indices" OWNER TO "postgres";


COMMENT ON TABLE "public"."filing_indices" IS 'Individual field definitions for each filing system template';



CREATE TABLE IF NOT EXISTS "public"."filing_systems" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_by" "uuid",
    "nombre" "text" NOT NULL,
    "descripcion" "text",
    "esquema_json" "jsonb" DEFAULT '{"indices": [], "version": 1}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."filing_systems" OWNER TO "postgres";


COMMENT ON TABLE "public"."filing_systems" IS 'Document classification templates that define how documents should be organized';



CREATE TABLE IF NOT EXISTS "public"."integration_api_usage" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "integration_id" "uuid",
    "user_id" "uuid",
    "endpoint" character varying(255),
    "method" character varying(10),
    "status_code" integer,
    "response_time_ms" integer,
    "request_size_bytes" integer,
    "response_size_bytes" integer,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."integration_api_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_settings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "integration_name" character varying(100) NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_enabled" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "rate_limiting_enabled" boolean DEFAULT false,
    "daily_rate_limit" integer DEFAULT 4000,
    "monthly_rate_limit" integer DEFAULT 100000,
    "is_global" boolean DEFAULT false,
    "created_by_user_id" "uuid"
);


ALTER TABLE "public"."integration_settings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."integration_settings"."rate_limiting_enabled" IS 'Whether rate limiting is enabled for this integration';



COMMENT ON COLUMN "public"."integration_settings"."daily_rate_limit" IS 'Maximum API calls allowed per day (if rate limiting enabled)';



COMMENT ON COLUMN "public"."integration_settings"."monthly_rate_limit" IS 'Maximum API calls allowed per month (if rate limiting enabled)';



COMMENT ON COLUMN "public"."integration_settings"."is_global" IS 'Whether this integration is available to all users in the system';



COMMENT ON COLUMN "public"."integration_settings"."created_by_user_id" IS 'The user who originally created this integration (for attribution)';



CREATE OR REPLACE VIEW "public"."integration_endpoints_view" AS
 SELECT "i"."id" AS "integration_id",
    "i"."user_id",
    "i"."integration_name",
    "i"."is_enabled",
    "endpoint"."value" AS "endpoint_config"
   FROM ("public"."integration_settings" "i"
     CROSS JOIN LATERAL "jsonb_array_elements"(("i"."settings" -> 'endpoints'::"text")) "endpoint"("value"))
  WHERE ("i"."settings" ? 'endpoints'::"text");


ALTER VIEW "public"."integration_endpoints_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_rate_limits" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "integration_id" "uuid",
    "user_id" "uuid",
    "limit_type" character varying(50) NOT NULL,
    "limit_value" integer NOT NULL,
    "current_usage" integer DEFAULT 0,
    "reset_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."integration_rate_limits" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."integration_settings_view" AS
 SELECT "i"."id",
    "i"."user_id",
    "i"."integration_name",
    "i"."settings",
    "i"."is_enabled",
    "i"."created_at",
    "i"."updated_at",
    "i"."rate_limiting_enabled",
    "i"."daily_rate_limit",
    "i"."monthly_rate_limit",
    "i"."is_global",
    "i"."created_by_user_id",
        CASE
            WHEN (("i"."integration_name")::"text" = 'aquarius_software'::"text") THEN 'Aquarius Software'::"text"
            WHEN (("i"."integration_name")::"text" = 'stripe'::"text") THEN 'Stripe'::"text"
            WHEN (("i"."integration_name")::"text" = 'quickbooks'::"text") THEN 'QuickBooks'::"text"
            WHEN (("i"."integration_name")::"text" = 'paypal'::"text") THEN 'PayPal'::"text"
            ELSE "initcap"("replace"(("i"."integration_name")::"text", '_'::"text", ' '::"text"))
        END AS "display_name",
        CASE
            WHEN ((("i"."settings" ->> 'api_url'::"text") IS NOT NULL) AND (("i"."settings" ->> 'api_url'::"text") <> ''::"text")) THEN true
            WHEN ((("i"."settings" ->> 'api_key'::"text") IS NOT NULL) AND (("i"."settings" ->> 'api_key'::"text") <> ''::"text")) THEN true
            ELSE false
        END AS "is_configured",
    ("i"."user_id" = "auth"."uid"()) AS "is_owner"
   FROM "public"."integration_settings" "i";


ALTER VIEW "public"."integration_settings_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invitation_codes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "email" "text" NOT NULL,
    "code" character varying(5) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "used_at" timestamp with time zone,
    "used_by_user_id" "uuid",
    "created_by_user_id" "uuid"
);


ALTER TABLE "public"."invitation_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "email" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."email" IS 'User email synced from auth.users for easier access in application queries';



CREATE TABLE IF NOT EXISTS "public"."requests" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" "text" NOT NULL,
    "message" "text",
    "status" "public"."request_status" DEFAULT 'sent'::"public"."request_status" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "received_at" timestamp with time zone,
    "signed_at" timestamp with time zone,
    "returned_at" timestamp with time zone,
    "customer_id" "uuid" NOT NULL,
    "document_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "resent_at" timestamp with time zone,
    "signed_document_path" "text"
);


ALTER TABLE "public"."requests" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."request_details" WITH ("security_invoker"='on') AS
 SELECT "r"."id",
    "r"."title",
    "r"."message",
    "r"."status",
    "r"."sent_at",
    "r"."received_at",
    "r"."signed_at",
    "r"."returned_at",
    "r"."created_at",
    "c"."id" AS "customer_id",
    "c"."first_name" AS "customer_first_name",
    "c"."last_name" AS "customer_last_name",
    "c"."email" AS "customer_email",
    "d"."id" AS "document_id",
    "d"."file_name" AS "document_name",
    "d"."file_path" AS "document_path",
    "d"."file_size" AS "document_size",
    "r"."created_by" AS "user_id"
   FROM (("public"."requests" "r"
     JOIN "public"."customers" "c" ON (("r"."customer_id" = "c"."id")))
     JOIN "public"."documents" "d" ON (("r"."document_id" = "d"."id")));


ALTER VIEW "public"."request_details" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."signature_mapping_templates" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_by" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "document_mapping_id" "uuid" NOT NULL
);


ALTER TABLE "public"."signature_mapping_templates" OWNER TO "postgres";


COMMENT ON TABLE "public"."signature_mapping_templates" IS 'Plantillas reutilizables para mapeo de campos de firma';



CREATE TABLE IF NOT EXISTS "public"."signature_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "template_name" character varying(255) NOT NULL,
    "signature_data" "text" NOT NULL,
    "signature_type" character varying(50) DEFAULT 'canvas'::character varying NOT NULL,
    "is_default" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."signature_templates" OWNER TO "postgres";


COMMENT ON TABLE "public"."signature_templates" IS 'Reusable signature templates for users';



CREATE OR REPLACE VIEW "public"."signature_templates_view" AS
 SELECT "smt"."id" AS "template_id",
    "smt"."name" AS "template_name",
    "smt"."description" AS "template_description",
    "smt"."created_by",
    "smt"."is_active",
    "smt"."created_at" AS "template_created_at",
    "smt"."updated_at" AS "template_updated_at",
    "dsm"."id" AS "mapping_id",
    "dsm"."document_id",
    "dsm"."signature_fields",
    "dsm"."created_at" AS "mapping_created_at",
    "d"."file_name" AS "document_file_name",
    "d"."file_path" AS "document_file_path"
   FROM (("public"."signature_mapping_templates" "smt"
     JOIN "public"."document_signature_mappings" "dsm" ON (("smt"."document_mapping_id" = "dsm"."id")))
     JOIN "public"."documents" "d" ON (("dsm"."document_id" = "d"."id")))
  WHERE ("smt"."is_active" = true);


ALTER VIEW "public"."signature_templates_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."signing_requests" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "document_id" "uuid",
    "recipient_email" "text" NOT NULL,
    "signing_id" "text" NOT NULL,
    "status" "text" NOT NULL,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "signature_data" "jsonb",
    "signed_at" timestamp with time zone,
    "signed_document_path" "text",
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."signing_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."signing_requests" IS 'Stores signing requests for document access. Multiple requests can exist for the same document and recipient to support template reuse.';



COMMENT ON COLUMN "public"."signing_requests"."signature_data" IS 'Stores signature image data when document_signatures table is unavailable';



ALTER TABLE ONLY "public"."customer_signatures"
    ADD CONSTRAINT "customer_signatures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_annotations"
    ADD CONSTRAINT "document_annotations_document_id_recipient_email_key" UNIQUE ("document_id", "recipient_email");



ALTER TABLE ONLY "public"."document_annotations"
    ADD CONSTRAINT "document_annotations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_categories"
    ADD CONSTRAINT "document_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_signature_mappings"
    ADD CONSTRAINT "document_signature_mappings_document_id_key" UNIQUE ("document_id");



ALTER TABLE ONLY "public"."document_signature_mappings"
    ADD CONSTRAINT "document_signature_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_signatures"
    ADD CONSTRAINT "document_signatures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."file_records"
    ADD CONSTRAINT "file_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."filing_indices"
    ADD CONSTRAINT "filing_indices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."filing_indices"
    ADD CONSTRAINT "filing_indices_sistema_id_clave_key" UNIQUE ("sistema_id", "clave");



ALTER TABLE ONLY "public"."filing_systems"
    ADD CONSTRAINT "filing_systems_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_api_usage"
    ADD CONSTRAINT "integration_api_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_rate_limits"
    ADD CONSTRAINT "integration_rate_limits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_settings"
    ADD CONSTRAINT "integration_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitation_codes"
    ADD CONSTRAINT "invitation_codes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."invitation_codes"
    ADD CONSTRAINT "invitation_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."requests"
    ADD CONSTRAINT "requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."signature_mapping_templates"
    ADD CONSTRAINT "signature_mapping_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."signature_templates"
    ADD CONSTRAINT "signature_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."signing_requests"
    ADD CONSTRAINT "signing_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."signing_requests"
    ADD CONSTRAINT "signing_requests_signing_id_key" UNIQUE ("signing_id");



ALTER TABLE ONLY "public"."filing_systems"
    ADD CONSTRAINT "unique_active_filing_system_global" UNIQUE ("is_active") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."document_categories"
    ADD CONSTRAINT "unique_category_name_per_level" UNIQUE ("file_record_id", "name", "parent_category_id");



ALTER TABLE ONLY "public"."document_signatures"
    ADD CONSTRAINT "unique_signature_per_document_recipient" UNIQUE ("document_id", "recipient_email");



CREATE INDEX "idx_customer_signatures_customer_id" ON "public"."customer_signatures" USING "btree" ("customer_id");



CREATE INDEX "idx_customer_signatures_user_id" ON "public"."customer_signatures" USING "btree" ("user_id");



CREATE INDEX "idx_customers_user_id" ON "public"."customers" USING "btree" ("user_id");



CREATE INDEX "idx_document_annotations_document_id" ON "public"."document_annotations" USING "btree" ("document_id") WHERE ("annotations" IS NOT NULL);



CREATE INDEX "idx_document_categories_file_record_id" ON "public"."document_categories" USING "btree" ("file_record_id");



CREATE INDEX "idx_document_categories_file_record_name" ON "public"."document_categories" USING "btree" ("file_record_id", "name");



CREATE INDEX "idx_document_categories_parent_id" ON "public"."document_categories" USING "btree" ("parent_category_id");



CREATE INDEX "idx_document_signature_mappings_created_by" ON "public"."document_signature_mappings" USING "btree" ("created_by");



CREATE INDEX "idx_document_signature_mappings_document_id" ON "public"."document_signature_mappings" USING "btree" ("document_id");



CREATE INDEX "idx_document_signature_mappings_is_template" ON "public"."document_signature_mappings" USING "btree" ("is_template");



CREATE INDEX "idx_document_signature_mappings_template_id" ON "public"."document_signature_mappings" USING "btree" ("template_id");



CREATE INDEX "idx_document_signatures_document_id" ON "public"."document_signatures" USING "btree" ("document_id");



CREATE INDEX "idx_documents_archived" ON "public"."documents" USING "btree" ("archived");



CREATE INDEX "idx_documents_case_file_metadata" ON "public"."documents" USING "gin" ("case_file_metadata");



CREATE INDEX "idx_documents_category_id" ON "public"."documents" USING "btree" ("category_id");



CREATE INDEX "idx_documents_created_by" ON "public"."documents" USING "btree" ("created_by");



CREATE INDEX "idx_documents_created_by_created_at" ON "public"."documents" USING "btree" ("created_by", "created_at");



CREATE INDEX "idx_documents_created_by_fast_sign" ON "public"."documents" USING "btree" ("created_by", "document_type", "archived", "created_at" DESC) WHERE ("document_type" = 'fast_sign'::"text");



CREATE INDEX "idx_documents_document_type" ON "public"."documents" USING "btree" ("document_type");



CREATE INDEX "idx_documents_email_fastsign_archived_created" ON "public"."documents" USING "btree" ("archived", "created_at" DESC) WHERE ("document_type" = ANY (ARRAY['email'::"text", 'fast_sign'::"text"]));



CREATE INDEX "idx_documents_fast_sign_main" ON "public"."documents" USING "btree" ("document_type", "archived", "created_at" DESC) WHERE ("document_type" = 'fast_sign'::"text");



CREATE INDEX "idx_documents_file_record" ON "public"."documents" USING "btree" ("file_record_id");



CREATE INDEX "idx_documents_file_record_id" ON "public"."documents" USING "btree" ("file_record_id");



CREATE INDEX "idx_documents_filename_search" ON "public"."documents" USING "btree" ("file_name") WHERE ("document_type" = 'fast_sign'::"text");



CREATE INDEX "idx_documents_original_file_path" ON "public"."documents" USING "btree" ("original_file_path");



CREATE INDEX "idx_documents_type_archived_created" ON "public"."documents" USING "btree" ("document_type", "archived", "created_at" DESC);



CREATE INDEX "idx_documents_type_archived_created_by" ON "public"."documents" USING "btree" ("document_type", "archived", "created_by", "created_at" DESC);



CREATE INDEX "idx_documents_user_created" ON "public"."documents" USING "btree" ("created_by", "created_at");



CREATE INDEX "idx_file_records_assigned_to" ON "public"."file_records" USING "btree" ("assigned_to_user_id");



CREATE INDEX "idx_file_records_created_by_assigned" ON "public"."file_records" USING "btree" ("created_by", "assigned_to_user_id");



CREATE INDEX "idx_file_records_created_by_sistema" ON "public"."file_records" USING "btree" ("created_by", "sistema_id");



CREATE INDEX "idx_file_records_customer_id" ON "public"."file_records" USING "btree" ("customer_id");



CREATE INDEX "idx_file_records_filing_systems" ON "public"."file_records" USING "btree" ("sistema_id");



CREATE INDEX "idx_file_records_user_assigned" ON "public"."file_records" USING "btree" ("created_by", "assigned_to_user_id");



CREATE INDEX "idx_file_records_user_sistema" ON "public"."file_records" USING "btree" ("created_by", "sistema_id");



CREATE INDEX "idx_file_records_valores_gin" ON "public"."file_records" USING "gin" ("valores_json");



CREATE INDEX "idx_filing_indices_sistema" ON "public"."filing_indices" USING "btree" ("sistema_id", "orden");



CREATE INDEX "idx_filing_systems_created_by_active" ON "public"."filing_systems" USING "btree" ("created_by", "is_active");



CREATE INDEX "idx_filing_systems_user_active" ON "public"."filing_systems" USING "btree" ("created_by", "is_active");



CREATE INDEX "idx_integration_api_usage_created_at" ON "public"."integration_api_usage" USING "btree" ("created_at");



CREATE INDEX "idx_integration_api_usage_integration_created" ON "public"."integration_api_usage" USING "btree" ("integration_id", "created_at");



CREATE INDEX "idx_integration_api_usage_integration_id" ON "public"."integration_api_usage" USING "btree" ("integration_id");



CREATE INDEX "idx_integration_api_usage_status_code" ON "public"."integration_api_usage" USING "btree" ("status_code");



CREATE INDEX "idx_integration_api_usage_user_id" ON "public"."integration_api_usage" USING "btree" ("user_id");



CREATE INDEX "idx_integration_rate_limits_integration_id" ON "public"."integration_rate_limits" USING "btree" ("integration_id");



CREATE INDEX "idx_integration_rate_limits_limit_type" ON "public"."integration_rate_limits" USING "btree" ("limit_type");



CREATE UNIQUE INDEX "idx_integration_rate_limits_unique" ON "public"."integration_rate_limits" USING "btree" ("integration_id", "user_id", "limit_type");



CREATE INDEX "idx_integration_rate_limits_user_id" ON "public"."integration_rate_limits" USING "btree" ("user_id");



CREATE INDEX "idx_integration_settings_created_by" ON "public"."integration_settings" USING "btree" ("created_by_user_id");



CREATE INDEX "idx_integration_settings_enabled" ON "public"."integration_settings" USING "btree" ("is_enabled");



CREATE INDEX "idx_integration_settings_global" ON "public"."integration_settings" USING "btree" ("is_global");



CREATE INDEX "idx_integration_settings_integration_name" ON "public"."integration_settings" USING "btree" ("integration_name");



CREATE INDEX "idx_integration_settings_user_id" ON "public"."integration_settings" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_integration_settings_user_integration" ON "public"."integration_settings" USING "btree" ("user_id", "integration_name");



CREATE INDEX "idx_profiles_email" ON "public"."profiles" USING "btree" ("email");



CREATE INDEX "idx_profiles_id" ON "public"."profiles" USING "btree" ("id");



CREATE INDEX "idx_requests_signed_document_path" ON "public"."requests" USING "btree" ("signed_document_path") WHERE ("signed_document_path" IS NOT NULL);



CREATE INDEX "idx_signature_mapping_templates_active" ON "public"."signature_mapping_templates" USING "btree" ("is_active");



CREATE INDEX "idx_signature_mapping_templates_created_by" ON "public"."signature_mapping_templates" USING "btree" ("created_by");



CREATE INDEX "idx_signature_mapping_templates_document_mapping_id" ON "public"."signature_mapping_templates" USING "btree" ("document_mapping_id");



CREATE INDEX "idx_signature_templates_is_default" ON "public"."signature_templates" USING "btree" ("user_id", "is_default");



CREATE INDEX "idx_signature_templates_user_id" ON "public"."signature_templates" USING "btree" ("user_id");



CREATE INDEX "idx_signing_requests_document_id" ON "public"."signing_requests" USING "btree" ("document_id");



CREATE INDEX "idx_signing_requests_document_id_signed_at" ON "public"."signing_requests" USING "btree" ("document_id", "signed_at");



CREATE INDEX "idx_signing_requests_document_signed" ON "public"."signing_requests" USING "btree" ("document_id", "signed_at") WHERE ("signed_at" IS NOT NULL);



CREATE INDEX "idx_signing_requests_signed_document_path" ON "public"."signing_requests" USING "btree" ("signed_document_path") WHERE ("signed_document_path" IS NOT NULL);



CREATE OR REPLACE TRIGGER "ensure_single_default_customer_signature_trigger" BEFORE INSERT OR UPDATE ON "public"."customer_signatures" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_single_default_customer_signature"();



CREATE OR REPLACE TRIGGER "ensure_single_default_template_trigger" BEFORE INSERT OR UPDATE ON "public"."signature_templates" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_single_default_template"();



CREATE OR REPLACE TRIGGER "trigger_enforce_single_active_filing_system" BEFORE INSERT OR UPDATE ON "public"."filing_systems" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_single_active_filing_system"();



CREATE OR REPLACE TRIGGER "trigger_update_filing_system_schema" AFTER INSERT OR DELETE OR UPDATE ON "public"."filing_indices" FOR EACH ROW EXECUTE FUNCTION "public"."update_filing_system_schema"();



CREATE OR REPLACE TRIGGER "trigger_update_integration_rate_limits_updated_at" BEFORE UPDATE ON "public"."integration_rate_limits" FOR EACH ROW EXECUTE FUNCTION "public"."update_integration_rate_limits_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_integration_settings_updated_at" BEFORE UPDATE ON "public"."integration_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_integration_settings_updated_at"();



CREATE OR REPLACE TRIGGER "update_document_signature_mappings_updated_at" BEFORE UPDATE ON "public"."document_signature_mappings" FOR EACH ROW EXECUTE FUNCTION "public"."update_signature_mapping_updated_at"();



CREATE OR REPLACE TRIGGER "update_signature_mapping_templates_updated_at" BEFORE UPDATE ON "public"."signature_mapping_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_signature_mapping_updated_at"();



ALTER TABLE ONLY "public"."customer_signatures"
    ADD CONSTRAINT "customer_signatures_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_signatures"
    ADD CONSTRAINT "customer_signatures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_annotations"
    ADD CONSTRAINT "document_annotations_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_categories"
    ADD CONSTRAINT "document_categories_file_record_id_fkey" FOREIGN KEY ("file_record_id") REFERENCES "public"."file_records"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_categories"
    ADD CONSTRAINT "document_categories_parent_category_id_fkey" FOREIGN KEY ("parent_category_id") REFERENCES "public"."document_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_signature_mappings"
    ADD CONSTRAINT "document_signature_mappings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."document_signature_mappings"
    ADD CONSTRAINT "document_signature_mappings_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_signature_mappings"
    ADD CONSTRAINT "document_signature_mappings_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."signature_mapping_templates"("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."document_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_file_record_id_fkey" FOREIGN KEY ("file_record_id") REFERENCES "public"."file_records"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."file_records"
    ADD CONSTRAINT "file_records_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."file_records"
    ADD CONSTRAINT "file_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."file_records"
    ADD CONSTRAINT "file_records_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."file_records"
    ADD CONSTRAINT "file_records_sistema_id_fkey" FOREIGN KEY ("sistema_id") REFERENCES "public"."filing_systems"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."filing_indices"
    ADD CONSTRAINT "filing_indices_sistema_id_fkey" FOREIGN KEY ("sistema_id") REFERENCES "public"."filing_systems"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."filing_systems"
    ADD CONSTRAINT "filing_systems_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_api_usage"
    ADD CONSTRAINT "integration_api_usage_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "public"."integration_settings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_api_usage"
    ADD CONSTRAINT "integration_api_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_rate_limits"
    ADD CONSTRAINT "integration_rate_limits_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "public"."integration_settings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_rate_limits"
    ADD CONSTRAINT "integration_rate_limits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_settings"
    ADD CONSTRAINT "integration_settings_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."integration_settings"
    ADD CONSTRAINT "integration_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitation_codes"
    ADD CONSTRAINT "invitation_codes_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invitation_codes"
    ADD CONSTRAINT "invitation_codes_used_by_user_id_fkey" FOREIGN KEY ("used_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."requests"
    ADD CONSTRAINT "requests_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."requests"
    ADD CONSTRAINT "requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."requests"
    ADD CONSTRAINT "requests_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."signature_mapping_templates"
    ADD CONSTRAINT "signature_mapping_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."signature_mapping_templates"
    ADD CONSTRAINT "signature_mapping_templates_document_mapping_id_fkey" FOREIGN KEY ("document_mapping_id") REFERENCES "public"."document_signature_mappings"("id");



ALTER TABLE ONLY "public"."signature_templates"
    ADD CONSTRAINT "signature_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "All authenticated users can view requests" ON "public"."requests" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "All users can delete all file records" ON "public"."file_records" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "All users can delete all filing systems" ON "public"."filing_systems" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "All users can insert file records" ON "public"."file_records" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "All users can insert filing systems" ON "public"."filing_systems" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "All users can manage all document annotations" ON "public"."document_annotations" TO "authenticated" USING (true);



CREATE POLICY "All users can manage all document signatures" ON "public"."document_signatures" TO "authenticated" USING (true);



CREATE POLICY "All users can manage all filing indices" ON "public"."filing_indices" TO "authenticated" USING (true);



CREATE POLICY "All users can manage all signing requests" ON "public"."signing_requests" TO "authenticated" USING (true);



CREATE POLICY "All users can update all file records" ON "public"."file_records" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "All users can update all filing systems" ON "public"."filing_systems" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "All users can view all document annotations" ON "public"."document_annotations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "All users can view all document signatures" ON "public"."document_signatures" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "All users can view all file records" ON "public"."file_records" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "All users can view all filing indices" ON "public"."filing_indices" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "All users can view all filing systems" ON "public"."filing_systems" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "All users can view filing indices" ON "public"."filing_indices" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "All users can view filing systems" ON "public"."filing_systems" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anon" ON "public"."invitation_codes" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Auth" ON "public"."document_signature_mappings" TO "authenticated", "anon" USING (true);



CREATE POLICY "Auth" ON "public"."invitation_codes" TO "authenticated" USING (true);



CREATE POLICY "Auth" ON "public"."signing_requests" TO "authenticated" USING (true);



CREATE POLICY "Auth Anon" ON "public"."signature_mapping_templates" TO "authenticated", "anon" USING (true);



CREATE POLICY "Original creators can delete filing systems" ON "public"."filing_systems" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Original creators can manage filing indices" ON "public"."filing_indices" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."filing_systems"
  WHERE (("filing_systems"."id" = "filing_indices"."sistema_id") AND ("filing_systems"."created_by" = "auth"."uid"())))));



CREATE POLICY "Original creators can update filing systems" ON "public"."filing_systems" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Public can view signing requests" ON "public"."signing_requests" FOR SELECT USING (true);



CREATE POLICY "Request creators can delete their requests" ON "public"."requests" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Request creators can update their requests" ON "public"."requests" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Select Anon" ON "public"."signing_requests" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Users can access API usage for available integrations" ON "public"."integration_api_usage" USING ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."integration_settings" "i"
  WHERE (("i"."id" = "integration_api_usage"."integration_id") AND (("i"."user_id" = "auth"."uid"()) OR ("i"."is_global" = true)))))));



CREATE POLICY "Users can access rate limits for available integrations" ON "public"."integration_rate_limits" USING ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."integration_settings" "i"
  WHERE (("i"."id" = "integration_rate_limits"."integration_id") AND (("i"."user_id" = "auth"."uid"()) OR ("i"."is_global" = true)))))));



CREATE POLICY "Users can delete their own customer signatures" ON "public"."customer_signatures" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own file records" ON "public"."file_records" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can delete their own filing systems" ON "public"."filing_systems" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can delete their own integration settings" ON "public"."integration_settings" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own signature templates" ON "public"."signature_templates" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert filing systems" ON "public"."filing_systems" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can insert their own customer signatures" ON "public"."customer_signatures" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own file records" ON "public"."file_records" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can insert their own filing systems" ON "public"."filing_systems" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can insert their own integration settings" ON "public"."integration_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own requests" ON "public"."requests" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can insert their own signature templates" ON "public"."signature_templates" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update file records they created or are assigned to" ON "public"."file_records" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "created_by") OR ("auth"."uid"() = "assigned_to_user_id")));



CREATE POLICY "Users can update their own customer signatures" ON "public"."customer_signatures" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own filing systems" ON "public"."filing_systems" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can update their own integration settings" ON "public"."integration_settings" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own signature templates" ON "public"."signature_templates" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view file records they created or are assigned to" ON "public"."file_records" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "created_by") OR ("auth"."uid"() = "assigned_to_user_id")));



CREATE POLICY "Users can view their own customer signatures" ON "public"."customer_signatures" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own filing systems" ON "public"."filing_systems" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can view their own or global integration settings" ON "public"."integration_settings" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("is_global" = true)));



CREATE POLICY "Users can view their own signature templates" ON "public"."signature_templates" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "anon" ON "public"."document_annotations" TO "anon" USING (true);



CREATE POLICY "anon" ON "public"."document_signatures" TO "authenticated", "anon" USING (true);



CREATE POLICY "anon" ON "public"."documents" TO "authenticated", "anon" USING (true);



CREATE POLICY "auth" ON "public"."customers" TO "authenticated", "anon" USING (true);



CREATE POLICY "auth" ON "public"."document_categories" TO "authenticated" USING (true);



CREATE POLICY "auth" ON "public"."profiles" TO "authenticated" USING (true);



CREATE POLICY "auth" ON "public"."requests" TO "authenticated" USING (true);



ALTER TABLE "public"."customer_signatures" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_annotations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_signature_mappings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_signatures" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."file_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."filing_indices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."filing_systems" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."integration_api_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."integration_rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."integration_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invitation_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."signature_mapping_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."signature_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."signing_requests" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."document_annotations";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."document_categories";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."document_signature_mappings";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."document_signatures";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."documents";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."profiles";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."signature_templates";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."signing_requests";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."auto_categorize_document"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_categorize_document"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_categorize_document"() TO "service_role";



GRANT ALL ON FUNCTION "public"."bulk_unlink_documents_from_case_file"("p_document_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_unlink_documents_from_case_file"("p_document_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_unlink_documents_from_case_file"("p_document_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_integration_id" "uuid", "p_period" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_integration_id" "uuid", "p_period" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_integration_id" "uuid", "p_period" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_default_category_for_file_record"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_default_category_for_file_record"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_default_category_for_file_record"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_default_category_for_new_file_record"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_default_category_for_new_file_record"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_default_category_for_new_file_record"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_template_from_mapping"("mapping_id" "uuid", "template_name" "text", "template_description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_template_from_mapping"("mapping_id" "uuid", "template_name" "text", "template_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_template_from_mapping"("mapping_id" "uuid", "template_name" "text", "template_description" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_single_active_filing_system"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_single_active_filing_system"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_single_active_filing_system"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_single_default_customer_signature"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_single_default_customer_signature"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_single_default_customer_signature"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_single_default_template"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_single_default_template"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_single_default_template"() TO "service_role";



GRANT ALL ON FUNCTION "public"."force_delete_default_category"("p_file_record_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."force_delete_default_category"("p_file_record_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."force_delete_default_category"("p_file_record_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_available_integrations"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_available_integrations"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_available_integrations"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_category_hierarchy"("p_file_record_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_category_hierarchy"("p_file_record_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_category_hierarchy"("p_file_record_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_document_creator_info"("p_document_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_document_creator_info"("p_document_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_document_creator_info"("p_document_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_file_record_access_info"("p_file_record_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_file_record_access_info"("p_file_record_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_file_record_access_info"("p_file_record_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_integration_statistics"("p_integration_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_integration_statistics"("p_integration_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_integration_statistics"("p_integration_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_integration_statistics_with_limits"("p_integration_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_integration_statistics_with_limits"("p_integration_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_integration_statistics_with_limits"("p_integration_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_masked_integration_settings"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_masked_integration_settings"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_masked_integration_settings"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_rate_limit_status"("p_integration_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_rate_limit_status"("p_integration_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_rate_limit_status"("p_integration_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_user_email_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_user_email_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_user_email_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_api_usage"("p_integration_id" "uuid", "p_user_id" "uuid", "p_endpoint" character varying, "p_method" character varying, "p_status_code" integer, "p_response_time_ms" integer, "p_request_size_bytes" integer, "p_response_size_bytes" integer, "p_error_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."log_api_usage"("p_integration_id" "uuid", "p_user_id" "uuid", "p_endpoint" character varying, "p_method" character varying, "p_status_code" integer, "p_response_time_ms" integer, "p_request_size_bytes" integer, "p_response_size_bytes" integer, "p_error_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_api_usage"("p_integration_id" "uuid", "p_user_id" "uuid", "p_endpoint" character varying, "p_method" character varying, "p_status_code" integer, "p_response_time_ms" integer, "p_request_size_bytes" integer, "p_response_size_bytes" integer, "p_error_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."make_integration_global"("p_integration_id" "uuid", "p_admin_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."make_integration_global"("p_integration_id" "uuid", "p_admin_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."make_integration_global"("p_integration_id" "uuid", "p_admin_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."make_integration_private"("p_integration_id" "uuid", "p_admin_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."make_integration_private"("p_integration_id" "uuid", "p_admin_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."make_integration_private"("p_integration_id" "uuid", "p_admin_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."migrate_integration_endpoints"() TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_integration_endpoints"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."migrate_integration_endpoints"() TO "service_role";



GRANT ALL ON FUNCTION "public"."move_document_to_category"("p_document_id" "uuid", "p_category_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."move_document_to_category"("p_document_id" "uuid", "p_category_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."move_document_to_category"("p_document_id" "uuid", "p_category_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rename_template"("template_id" "uuid", "new_name" "text", "new_description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rename_template"("template_id" "uuid", "new_name" "text", "new_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rename_template"("template_id" "uuid", "new_name" "text", "new_description" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_filing_system_schema"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_filing_system_schema"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_filing_system_schema"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_integration_rate_limits_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_integration_rate_limits_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_integration_rate_limits_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_integration_settings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_integration_settings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_integration_settings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_signature_mapping_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_signature_mapping_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_signature_mapping_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_integration_endpoints"("p_settings" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_integration_endpoints"("p_settings" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_integration_endpoints"("p_settings" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";


















GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."document_categories" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."document_categories" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."document_categories" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."documents" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."documents" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."documents" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."case_file_documents_with_categories" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."case_file_documents_with_categories" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."case_file_documents_with_categories" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."customer_signatures" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."customer_signatures" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."customer_signatures" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."customers" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."customers" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."customers" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."document_annotations" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."document_annotations" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."document_annotations" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."document_signature_mappings" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."document_signature_mappings" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."document_signature_mappings" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."document_signatures" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."document_signatures" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."document_signatures" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."file_records" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."file_records" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."file_records" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."filing_indices" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."filing_indices" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."filing_indices" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."filing_systems" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."filing_systems" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."filing_systems" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."integration_api_usage" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."integration_api_usage" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."integration_api_usage" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."integration_settings" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."integration_settings" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."integration_settings" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."integration_endpoints_view" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."integration_endpoints_view" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."integration_endpoints_view" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."integration_rate_limits" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."integration_rate_limits" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."integration_rate_limits" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."integration_settings_view" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."integration_settings_view" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."integration_settings_view" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."invitation_codes" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."invitation_codes" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."invitation_codes" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."requests" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."requests" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."requests" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."request_details" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."request_details" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."request_details" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."signature_mapping_templates" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."signature_mapping_templates" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."signature_mapping_templates" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."signature_templates" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."signature_templates" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."signature_templates" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."signature_templates_view" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."signature_templates_view" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."signature_templates_view" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."signing_requests" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."signing_requests" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."signing_requests" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "service_role";






























RESET ALL;
