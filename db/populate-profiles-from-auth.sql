-- Populate profiles table with existing auth.users data
-- This ensures that all users who have created documents have profile records

-- First, let's see what we're working with
-- This will show us users who have created documents but don't have profiles
DO $$
BEGIN
  RAISE NOTICE 'Users who created documents but have no profile:';
END $$;

-- Insert missing profiles for users who have created documents
INSERT INTO profiles (id, first_name, last_name, email)
SELECT DISTINCT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'first_name', '') as first_name,
  COALESCE(au.raw_user_meta_data->>'last_name', '') as last_name,
  au.email
FROM auth.users au
WHERE au.id IN (
  -- Users who created documents
  SELECT DISTINCT created_by FROM documents WHERE created_by IS NOT NULL
  UNION
  -- Users who created file records  
  SELECT DISTINCT created_by FROM file_records WHERE created_by IS NOT NULL
  UNION
  -- Users who created filing systems
  SELECT DISTINCT created_by FROM filing_systems WHERE created_by IS NOT NULL
  UNION
  -- Users who created requests
  SELECT DISTINCT created_by FROM requests WHERE created_by IS NOT NULL
)
AND au.id NOT IN (
  -- Exclude users who already have profiles
  SELECT id FROM profiles
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  first_name = COALESCE(profiles.first_name, EXCLUDED.first_name),
  last_name = COALESCE(profiles.last_name, EXCLUDED.last_name);

-- Also update existing profiles with missing email addresses
UPDATE profiles 
SET email = au.email
FROM auth.users au
WHERE profiles.id = au.id 
AND (profiles.email IS NULL OR profiles.email = '');

-- Show summary of what we now have
DO $$
DECLARE
  total_profiles INTEGER;
  profiles_with_names INTEGER;
  profiles_with_emails INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_profiles FROM profiles;
  SELECT COUNT(*) INTO profiles_with_names FROM profiles WHERE first_name IS NOT NULL AND first_name != '' AND last_name IS NOT NULL AND last_name != '';
  SELECT COUNT(*) INTO profiles_with_emails FROM profiles WHERE email IS NOT NULL AND email != '';
  
  RAISE NOTICE 'Profile Summary:';
  RAISE NOTICE '  Total profiles: %', total_profiles;
  RAISE NOTICE '  Profiles with names: %', profiles_with_names;
  RAISE NOTICE '  Profiles with emails: %', profiles_with_emails;
END $$;
