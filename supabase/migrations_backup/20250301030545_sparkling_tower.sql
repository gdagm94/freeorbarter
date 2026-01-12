/*
  # Add offer item relation to messages

  1. Changes
    - Safely check for and create foreign key constraint for messages.offer_item_id
    - Create index for offer_item_id for better query performance
  
  2. Security
    - No changes to RLS policies
*/

-- Check if the constraint already exists before trying to add it
DO $$ 
BEGIN
  -- Only create the constraint if it doesn't already exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'messages_offer_item_id_fkey'
  ) THEN
    ALTER TABLE messages 
    ADD CONSTRAINT messages_offer_item_id_fkey 
    FOREIGN KEY (offer_item_id) 
    REFERENCES items(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for offer_item_id if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'messages' AND indexname = 'messages_offer_item_id_idx'
  ) THEN
    CREATE INDEX messages_offer_item_id_idx ON messages(offer_item_id);
  END IF;
END $$;