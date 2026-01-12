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