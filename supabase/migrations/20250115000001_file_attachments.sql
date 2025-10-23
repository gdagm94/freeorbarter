/*
  # File Attachments Support

  1. New Tables
    - message_files
      - id (uuid, primary key)
      - message_id (uuid, foreign key)
      - file_url (text, URL to the file)
      - file_name (text, original filename)
      - file_type (text, MIME type)
      - file_size (bigint, file size in bytes)
      - created_at (timestamp)

  2. Changes
    - Add file_url column to messages table for backward compatibility
    - Add indexes for efficient querying
    - Add RLS policies for message files

  3. Security
    - Enable RLS on message_files table
    - Add policies for users to manage files in their messages
*/

-- Add file_url column to messages table for backward compatibility
ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_url text;

-- Create message_files table
CREATE TABLE IF NOT EXISTS message_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size bigint,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE message_files ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS message_files_message_id_idx ON message_files(message_id);
CREATE INDEX IF NOT EXISTS message_files_file_type_idx ON message_files(file_type);
CREATE INDEX IF NOT EXISTS messages_file_url_idx ON messages(file_url);

-- Create policies for message_files
CREATE POLICY "Users can view files in their messages"
  ON message_files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM messages 
      WHERE messages.id = message_files.message_id 
      AND (messages.sender_id = auth.uid() OR messages.receiver_id = auth.uid())
    )
  );

CREATE POLICY "Users can add files to their messages"
  ON message_files FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM messages 
      WHERE messages.id = message_files.message_id 
      AND messages.sender_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete files from their messages"
  ON message_files FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM messages 
      WHERE messages.id = message_files.message_id 
      AND messages.sender_id = auth.uid()
    )
  );

-- Create storage bucket for message files
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-files', 'message-files', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for message files
CREATE POLICY "Users can upload files to message-files bucket"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'message-files');

CREATE POLICY "Users can view files in message-files bucket"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'message-files');

CREATE POLICY "Users can delete their own files from message-files bucket"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'message-files' AND auth.uid()::text = (storage.foldername(name))[1]);
