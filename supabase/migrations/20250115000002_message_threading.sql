/*
  # Message Threading System

  1. New Tables
    - message_threads
      - id (uuid, primary key)
      - title (text, thread title)
      - item_id (uuid, foreign key, nullable for general conversations)
      - created_by (uuid, foreign key to users)
      - created_at (timestamp)
      - updated_at (timestamp)
      - is_active (boolean, default true)

  2. Changes
    - Add thread_id column to messages table
    - Add indexes for efficient querying
    - Add RLS policies for message threads

  3. Security
    - Enable RLS on message_threads table
    - Add policies for users to manage threads in their conversations
*/

-- Add thread_id column to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS thread_id uuid;

-- Create message_threads table
CREATE TABLE IF NOT EXISTS message_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  item_id uuid REFERENCES items(id) ON DELETE CASCADE,
  created_by uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

-- Enable RLS
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS message_threads_item_id_idx ON message_threads(item_id);
CREATE INDEX IF NOT EXISTS message_threads_created_by_idx ON message_threads(created_by);
CREATE INDEX IF NOT EXISTS message_threads_is_active_idx ON message_threads(is_active);
CREATE INDEX IF NOT EXISTS messages_thread_id_idx ON messages(thread_id);

-- Create policies for message_threads
CREATE POLICY "Users can view threads in their conversations"
  ON message_threads FOR SELECT
  TO authenticated
  USING (
    -- Users can see threads for items they own or are involved in
    EXISTS (
      SELECT 1 FROM items 
      WHERE items.id = message_threads.item_id 
      AND (items.user_id = auth.uid() OR 
           EXISTS (
             SELECT 1 FROM messages 
             WHERE messages.item_id = items.id 
             AND (messages.sender_id = auth.uid() OR messages.receiver_id = auth.uid())
           ))
    ) OR
    -- Users can see general threads they're involved in
    EXISTS (
      SELECT 1 FROM messages 
      WHERE messages.thread_id = message_threads.id 
      AND (messages.sender_id = auth.uid() OR messages.receiver_id = auth.uid())
    )
  );

CREATE POLICY "Users can create threads in their conversations"
  ON message_threads FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by AND
    (
      -- Can create threads for items they own
      EXISTS (
        SELECT 1 FROM items 
        WHERE items.id = message_threads.item_id 
        AND items.user_id = auth.uid()
      ) OR
      -- Can create general threads
      message_threads.item_id IS NULL
    )
  );

CREATE POLICY "Users can update threads they created"
  ON message_threads FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete threads they created"
  ON message_threads FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Add foreign key constraint for thread_id in messages
ALTER TABLE messages 
ADD CONSTRAINT fk_messages_thread_id 
FOREIGN KEY (thread_id) REFERENCES message_threads(id) ON DELETE SET NULL;

-- Create function to update thread updated_at timestamp
CREATE OR REPLACE FUNCTION update_thread_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.thread_id IS NOT NULL THEN
    UPDATE message_threads 
    SET updated_at = now() 
    WHERE id = NEW.thread_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update thread timestamp
DROP TRIGGER IF EXISTS trigger_update_thread_updated_at ON messages;
CREATE TRIGGER trigger_update_thread_updated_at
  AFTER INSERT OR UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_thread_updated_at();
