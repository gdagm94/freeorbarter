/*
  # Message Reactions and Enhanced Read Receipts

  1. New Tables
    - message_reactions
      - id (uuid, primary key)
      - message_id (uuid, foreign key)
      - user_id (uuid, foreign key)
      - emoji (text, the emoji reaction)
      - created_at (timestamp)
      - UNIQUE constraint on (message_id, user_id, emoji)

  2. Changes
    - Add read_at column to messages table for exact read time
    - Add indexes for efficient querying
    - Add RLS policies for message reactions

  3. Security
    - Enable RLS on message_reactions table
    - Add policies for users to manage their own reactions
*/

-- Add read_at column to messages table for exact read time
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at timestamptz;

-- Create message_reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Enable RLS
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS message_reactions_message_id_idx ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS message_reactions_user_id_idx ON message_reactions(user_id);
CREATE INDEX IF NOT EXISTS message_reactions_emoji_idx ON message_reactions(emoji);
CREATE INDEX IF NOT EXISTS messages_read_at_idx ON messages(read_at);

-- Create policies for message_reactions
CREATE POLICY "Users can view reactions on their messages"
  ON message_reactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM messages 
      WHERE messages.id = message_reactions.message_id 
      AND (messages.sender_id = auth.uid() OR messages.receiver_id = auth.uid())
    )
  );

CREATE POLICY "Users can add reactions to messages they can see"
  ON message_reactions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM messages 
      WHERE messages.id = message_reactions.message_id 
      AND (messages.sender_id = auth.uid() OR messages.receiver_id = auth.uid())
    )
  );

CREATE POLICY "Users can remove their own reactions"
  ON message_reactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create function to update read_at when message is marked as read
CREATE OR REPLACE FUNCTION update_message_read_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update read_at if read is being set to true and read_at is null
  IF NEW.read = true AND OLD.read = false AND NEW.read_at IS NULL THEN
    NEW.read_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update read_at
DROP TRIGGER IF EXISTS trigger_update_message_read_at ON messages;
CREATE TRIGGER trigger_update_message_read_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_message_read_at();
