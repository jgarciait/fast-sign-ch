-- FIX: Modify auto-categorization trigger to only run on INSERT, not UPDATE
-- This prevents the trigger from interfering with manual category assignments

-- Step 1: Drop the existing trigger
DROP TRIGGER IF EXISTS trigger_auto_categorize_document ON documents;

-- Step 2: The function stays the same, but we'll recreate the trigger with INSERT only
-- (The function is already defined in add-document-categories-system.sql)

-- Step 3: Recreate the trigger to ONLY fire on INSERT operations
CREATE TRIGGER trigger_auto_categorize_document
    BEFORE INSERT ON documents  -- ⚠️ ONLY INSERT, NOT UPDATE!
    FOR EACH ROW
    EXECUTE FUNCTION auto_categorize_document();

-- Step 4: Verify the fix
SELECT 
  trigger_name,
  event_manipulation,
  action_statement,
  action_timing
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_auto_categorize_document'
AND table_name = 'documents';

-- Expected result:
-- trigger_name: trigger_auto_categorize_document
-- event_manipulation: INSERT (should NOT show UPDATE anymore)
-- action_timing: BEFORE 