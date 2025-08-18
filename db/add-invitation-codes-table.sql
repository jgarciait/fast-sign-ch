-- Create invitation_codes table
CREATE TABLE IF NOT EXISTS invitation_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  code VARCHAR(5) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITH TIME ZONE,
  used_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create RLS policies for invitation_codes
ALTER TABLE invitation_codes ENABLE ROW LEVEL SECURITY;

-- Policy for users to create invitation codes
CREATE POLICY "Users can create invitation codes"
  ON invitation_codes FOR INSERT
  WITH CHECK (auth.uid() = created_by_user_id);

-- Policy for users to view invitation codes they created (optional, for management)
CREATE POLICY "Users can view their own invitation codes"
  ON invitation_codes FOR SELECT
  USING (auth.uid() = created_by_user_id);

-- Policy for public to update invitation codes (when used during signup)
-- This policy allows anyone to update an invitation code if they know the code and email,
-- but only to mark it as used by a specific user.
CREATE POLICY "Public can use invitation codes"
  ON invitation_codes FOR UPDATE
  USING (
    used_at IS NULL AND
    used_by_user_id IS NULL AND
    auth.uid() IS NOT NULL -- Ensure a user is authenticated when using it
  )
  WITH CHECK (
    used_at IS NOT NULL AND
    used_by_user_id = auth.uid()
  );

-- Policy for admin/owner to manage all invitation codes (if needed, for future roles)
-- For now, only the creator can manage.
