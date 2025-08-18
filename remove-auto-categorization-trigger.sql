-- SIMPLE FIX: Remove the auto-categorization trigger completely
-- This allows full manual control over document categories

-- Drop the trigger that automatically assigns categories based on filename
DROP TRIGGER IF EXISTS trigger_auto_categorize_document ON documents;

-- Optionally, we can also drop the function if it's no longer needed
-- (Uncomment the line below if you want to remove the function too)
-- DROP FUNCTION IF EXISTS auto_categorize_document();

-- Verify the trigger is gone
SELECT 
  trigger_name,
  table_name
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_auto_categorize_document'
AND table_name = 'documents';

-- Expected result: No rows (trigger should be completely removed) 