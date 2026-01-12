/*
  # Add unread message tracking

  1. New Columns
    - `messages` table:
      - `read` (boolean): Tracks whether a message has been read by the recipient
      - `is_offer` (boolean): Indicates if the message is a barter offer
    
  2. Changes
    - Add columns to track message read status
    - Add column to identify offer messages
    - Add indexes for efficient querying
  
  3. Security
    - Maintains existing RLS policies
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