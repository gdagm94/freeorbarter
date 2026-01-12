/*
  # Add Message Archiving and Reporting

  1. Changes
    - Add archived column to messages table
    - Create reported_messages table for message reporting
    - Add necessary indexes for performance
    - Set up RLS policies for reported messages
  
  2. Security
    - Enable RLS on reported_messages table
    - Add policies for viewing and creating reports
    - Update message viewing policy
*/

-- Add archived column to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;

-- Create reported_messages table
CREATE TABLE IF NOT EXISTS reported_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  reporter_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  reason text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE reported_messages ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS messages_archived_idx ON messages(archived);
CREATE INDEX IF NOT EXISTS reported_messages_reporter_id_idx ON reported_messages(reporter_id);
CREATE INDEX IF NOT EXISTS reported_messages_message_id_idx ON reported_messages(message_id);

-- Drop existing policies if they exist
DO $$ 
BEGIN
  -- Drop reported_messages policies if they exist
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'reported_messages' AND policyname = 'Users can view their reports'
  ) THEN
    DROP POLICY "Users can view their reports" ON reported_messages;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'reported_messages' AND policyname = 'Users can create reports'
  ) THEN
    DROP POLICY "Users can create reports" ON reported_messages;
  END IF;

  -- Drop messages policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'messages' AND policyname = 'Users can view their messages'
  ) THEN
    DROP POLICY "Users can view their messages" ON messages;
  END IF;
END $$;

-- Create policies for reported_messages
CREATE POLICY "Users can view their reports"
  ON reported_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "Users can create reports"
  ON reported_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- Update messages policy to handle archived messages
CREATE POLICY "Users can view their messages"
  ON messages FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);