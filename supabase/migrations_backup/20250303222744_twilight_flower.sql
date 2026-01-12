/*
  # Add delete policy for items table

  1. Changes
    - Add a new RLS policy to allow users to delete their own items
    - This policy is necessary because the existing update policy doesn't cover delete operations
  
  2. Security
    - Only authenticated users can delete their own items
    - The policy ensures users can only delete items they created
*/

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