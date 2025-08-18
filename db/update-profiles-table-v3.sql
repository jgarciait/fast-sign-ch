-- Add email column to profiles table and sync it from auth.users
-- This will allow us to display user information including email in the application

-- Add email column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Update existing profiles with email from auth.users
-- We'll use a function that can access auth.users
CREATE OR REPLACE FUNCTION sync_profile_emails()
RETURNS void AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Loop through all profiles that don't have email set
  FOR user_record IN 
    SELECT p.id, u.email 
    FROM profiles p 
    JOIN auth.users u ON p.id = u.id 
    WHERE p.email IS NULL OR p.email = ''
  LOOP
    UPDATE profiles 
    SET email = user_record.email 
    WHERE id = user_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the sync function
SELECT sync_profile_emails();

-- Drop the sync function as we don't need it anymore
DROP FUNCTION sync_profile_emails();

-- Update the trigger function to include email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, email)
  VALUES (NEW.id, NULL, NULL, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to update profile email when auth.users email changes
CREATE OR REPLACE FUNCTION public.handle_user_email_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles 
  SET email = NEW.email 
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create trigger for email updates
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW 
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.handle_user_email_update();

-- Update RLS policies to allow viewing email in profiles
-- The existing policies should already cover this, but let's make sure

-- Add index for better performance on email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Add comments for documentation
COMMENT ON COLUMN profiles.email IS 'User email synced from auth.users for easier access in application queries';
COMMENT ON FUNCTION public.handle_new_user IS 'Creates profile record with email when new user is created in auth.users';
COMMENT ON FUNCTION public.handle_user_email_update IS 'Updates profile email when auth.users email is changed';
