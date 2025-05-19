/*
  # Add read and offer status to messages

  1. New Columns
    - Add `read` boolean column to messages table
    - Add `is_offer` boolean column to messages table
  2. Indexes
    - Create indexes for efficient querying
  3. Cascade Delete
    - Update foreign key constraint to cascade delete messages when items are deleted
  4. Delete Policy
    - Add delete policy for items
*/

-- Add read status column to messages table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'read'
  ) THEN
    ALTER TABLE messages ADD COLUMN read BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Add is_offer column to messages table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'is_offer'
  ) THEN
    ALTER TABLE messages ADD COLUMN is_offer BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Create indexes for efficient querying
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'messages' AND indexname = 'messages_read_idx'
  ) THEN
    CREATE INDEX messages_read_idx ON messages(read);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'messages' AND indexname = 'messages_is_offer_idx'
  ) THEN
    CREATE INDEX messages_is_offer_idx ON messages(is_offer);
  END IF;
END $$;

-- Add delete policy for items if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'items' AND policyname = 'Users can delete own items'
  ) THEN
    CREATE POLICY "Users can delete own items"
      ON items FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Add cascade delete for messages when items are deleted
DO $$
BEGIN
  -- Check if the constraint exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'messages_item_id_fkey'
  ) THEN
    -- Drop the existing constraint
    ALTER TABLE messages DROP CONSTRAINT messages_item_id_fkey;
  END IF;
  
  -- Add the constraint with CASCADE
  ALTER TABLE messages
    ADD CONSTRAINT messages_item_id_fkey
    FOREIGN KEY (item_id)
    REFERENCES items(id)
    ON DELETE CASCADE;
END $$;