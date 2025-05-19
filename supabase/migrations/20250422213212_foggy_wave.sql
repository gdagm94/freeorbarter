/*
  # Messaging System Enhancements

  1. New Tables
    - blocked_users
      - id (uuid, primary key)
      - blocker_id (uuid, foreign key)
      - blocked_id (uuid, foreign key)
      - created_at (timestamp)
    
    - reported_messages
      - id (uuid, primary key)
      - message_id (uuid, foreign key)
      - reporter_id (uuid, foreign key)
      - reason (text)
      - created_at (timestamp)

  2. Changes
    - Add archived column to messages table
    - Add indexes for efficient querying
    - Add RLS policies for new tables
*/

-- Add archived column to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;

-- Create blocked_users table
CREATE TABLE IF NOT EXISTS blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  blocked_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

-- Create reported_messages table
CREATE TABLE IF NOT EXISTS reported_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  reporter_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  reason text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reported_messages ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS messages_archived_idx ON messages(archived);
CREATE INDEX IF NOT EXISTS blocked_users_blocker_id_idx ON blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS blocked_users_blocked_id_idx ON blocked_users(blocked_id);
CREATE INDEX IF NOT EXISTS reported_messages_reporter_id_idx ON reported_messages(reporter_id);
CREATE INDEX IF NOT EXISTS reported_messages_message_id_idx ON reported_messages(message_id);

-- Create policies for blocked_users
CREATE POLICY "Users can view their blocks"
  ON blocked_users FOR SELECT
  TO authenticated
  USING (auth.uid() = blocker_id);

CREATE POLICY "Users can create blocks"
  ON blocked_users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can remove blocks"
  ON blocked_users FOR DELETE
  TO authenticated
  USING (auth.uid() = blocker_id);

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
DROP POLICY IF EXISTS "Users can view their messages" ON messages;
CREATE POLICY "Users can view their messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    (auth.uid() = sender_id OR auth.uid() = receiver_id) AND
    NOT EXISTS (
      SELECT 1 FROM blocked_users
      WHERE (blocker_id = auth.uid() AND blocked_id = sender_id)
      OR (blocker_id = auth.uid() AND blocked_id = receiver_id)
    )
  );