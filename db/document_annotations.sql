-- Create document_annotations table
CREATE TABLE IF NOT EXISTS document_annotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  annotations JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(document_id, recipient_email)
);

-- Create RLS policies for document_annotations
ALTER TABLE document_annotations ENABLE ROW LEVEL SECURITY;

-- Policy for users to see annotations for their documents
CREATE POLICY "Users can view annotations for their documents" 
  ON document_annotations FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM documents 
      WHERE documents.id = document_annotations.document_id 
      AND documents.user_id = auth.uid()
    )
  );

-- Policy for users to insert annotations for their documents
CREATE POLICY "Users can insert annotations for their documents" 
  ON document_annotations FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents 
      WHERE documents.id = document_annotations.document_id 
      AND documents.user_id = auth.uid()
    )
  );

-- Policy for users to update annotations for their documents
CREATE POLICY "Users can update annotations for their documents" 
  ON document_annotations FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM documents 
      WHERE documents.id = document_annotations.document_id 
      AND documents.user_id = auth.uid()
    )
  );

-- Policy for recipients to view their own annotations
CREATE POLICY "Recipients can view their own annotations" 
  ON document_annotations FOR SELECT 
  USING (recipient_email = current_setting('request.jwt.claims')::json->>'email');

-- Policy for recipients to update their own annotations
CREATE POLICY "Recipients can update their own annotations" 
  ON document_annotations FOR UPDATE 
  USING (recipient_email = current_setting('request.jwt.claims')::json->>'email');

-- Policy for recipients to insert their own annotations
CREATE POLICY "Recipients can insert their own annotations" 
  ON document_annotations FOR INSERT 
  WITH CHECK (recipient_email = current_setting('request.jwt.claims')::json->>'email');

-- Update the signature_data type to include page and relative positioning
CREATE TYPE signature_position AS (
  x float,
  y float,
  width float,
  height float,
  page integer,
  relativeX float,
  relativeY float
);

-- Update or create the document_signatures table
CREATE TABLE IF NOT EXISTS document_signatures (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  signature_data jsonb NOT NULL,
  signature_source text DEFAULT 'canvas',
  status text DEFAULT 'pending',
  signed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT signature_data_check CHECK (
    signature_data ? 'dataUrl' AND
    signature_data ? 'position' AND
    (signature_data->>'position')::jsonb ? 'x' AND
    (signature_data->>'position')::jsonb ? 'y' AND
    (signature_data->>'position')::jsonb ? 'width' AND
    (signature_data->>'position')::jsonb ? 'height' AND
    (signature_data->>'position')::jsonb ? 'page' AND
    (signature_data->>'position')::jsonb ? 'relativeX' AND
    (signature_data->>'position')::jsonb ? 'relativeY'
  )
);
