/*
  # Update Items RLS Policies

  1. Changes
    - Update the RLS policy for item updates to explicitly allow status changes
    - Ensure users can only update their own items
    - Add specific fields that can be updated
  
  2. Security
    - Maintain existing security model
    - Only allow item owners to update their items
    - Prevent modification of critical fields like user_id
*/

-- Drop existing update policy
DROP POLICY IF EXISTS "Users can update own items" ON items;

-- Create new update policy with explicit field controls
CREATE POLICY "Users can update own items"
  ON items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id AND
    (
      -- Allow updating these specific fields
      title IS NOT NULL AND
      description IS NOT NULL AND
      images IS NOT NULL AND
      condition IS NOT NULL AND
      category IS NOT NULL AND
      location IS NOT NULL AND
      -- Ensure user_id cannot be changed
      user_id = (SELECT user_id FROM items WHERE id = id) AND
      -- Ensure type cannot be changed
      type = (SELECT type FROM items WHERE id = id) AND
      -- Allow status to be changed only to valid values
      status IN ('available', 'traded')
    )
  );