/*
  # Fix Items Table Update Policy

  1. Changes
    - Drop existing update policy
    - Create new update policy with proper field validation
    - Fix SQL syntax for type comparison
    - Add proper status validation

  2. Security
    - Maintain user ownership check
    - Prevent type field modification
    - Allow status changes only to valid values
    - Ensure all required fields are present
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
    title IS NOT NULL AND
    description IS NOT NULL AND
    images IS NOT NULL AND
    condition IS NOT NULL AND
    category IS NOT NULL AND
    location IS NOT NULL AND
    user_id = auth.uid() AND
    type = (SELECT type FROM items WHERE id = items.id) AND
    status = ANY (ARRAY['available', 'traded']::item_status[])
  );