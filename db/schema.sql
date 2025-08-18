-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create RLS policies for documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Policy for users to see only their own documents
CREATE POLICY "Users can view their own documents" 
  ON documents FOR SELECT 
  USING (auth.uid() = user_id);

-- Policy for users to insert their own documents
CREATE POLICY "Users can insert their own documents" 
  ON documents FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Policy for users to update their own documents
CREATE POLICY "Users can update their own documents" 
  ON documents FOR UPDATE 
  USING (auth.uid() = user_id);

-- Create recipients table
CREATE TABLE IF NOT EXISTS recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, email)
);

-- Create RLS policies for recipients
ALTER TABLE recipients ENABLE ROW LEVEL SECURITY;

-- Policy for users to see only their own recipients
CREATE POLICY "Users can view their own recipients" 
  ON recipients FOR SELECT 
  USING (auth.uid() = user_id);

-- Policy for users to insert their own recipients
CREATE POLICY "Users can insert their own recipients" 
  ON recipients FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Policy for users to update their own recipients
CREATE POLICY "Users can update their own recipients" 
  ON recipients FOR UPDATE 
  USING (auth.uid() = user_id);

-- Create document_signatures table
CREATE TABLE IF NOT EXISTS document_signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  signed_at TIMESTAMP WITH TIME ZONE,
  signature_data JSONB,
  signature_source TEXT NOT NULL DEFAULT 'canvas', -- 'canvas' or 'wacom'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create RLS policies for document_signatures
ALTER TABLE document_signatures ENABLE ROW LEVEL SECURITY;

-- Policy for users to see signatures for their documents
CREATE POLICY "Users can view signatures for their documents" 
  ON document_signatures FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM documents 
      WHERE documents.id = document_signatures.document_id 
      AND documents.user_id = auth.uid()
    )
  );

-- Policy for users to insert signatures for their documents
CREATE POLICY "Users can insert signatures for their documents" 
  ON document_signatures FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents 
      WHERE documents.id = document_signatures.document_id 
      AND documents.user_id = auth.uid()
    )
  );

-- Policy for users to update signatures for their documents
CREATE POLICY "Users can update signatures for their documents" 
  ON document_signatures FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM documents 
      WHERE documents.id = document_signatures.document_id 
      AND documents.user_id = auth.uid()
    )
  );

-- Create signing_requests table
CREATE TABLE IF NOT EXISTS signing_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create RLS policies for signing_requests
ALTER TABLE signing_requests ENABLE ROW LEVEL SECURITY;

-- Policy for public access to signing requests (needed for unauthenticated signing)
CREATE POLICY "Public can view signing requests" 
  ON signing_requests FOR SELECT 
  TO public
  USING (true);

-- Policy for users to manage signing requests for their documents
CREATE POLICY "Users can manage signing requests for their documents" 
  ON signing_requests FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM documents 
      WHERE documents.id = signing_requests.document_id 
      AND documents.user_id = auth.uid()
    )
  );
