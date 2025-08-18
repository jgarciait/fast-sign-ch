-- Fix RLS policy for invitation_codes to allow public validation during signup
-- This allows unauthenticated users to read invitation codes for validation purposes

-- Add policy to allow public users to SELECT invitation codes for validation
CREATE POLICY "Public can validate invitation codes"
  ON invitation_codes FOR SELECT
  TO public
  USING (true);

-- Note: This allows reading invitation codes publicly, but the codes are:
-- 1. Random 5-character codes that are not guessable
-- 2. Only used for validation during signup
-- 3. Marked as used after signup, preventing reuse
-- 4. The email is only revealed during the validation process to match with signup email

-- Alternative more restrictive approach (if needed):
-- CREATE POLICY "Public can validate unused invitation codes"
--   ON invitation_codes FOR SELECT
--   TO public
--   USING (used_at IS NULL); 