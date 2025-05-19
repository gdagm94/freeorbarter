/*
  # Fix RLS Policy for Item Updates

  1. Changes
    - Drop existing update policy
    - Create new update policy with proper type comparison
    - Fix status enum array syntax
    - Ensure all required fields are present
    - Maintain data integrity checks
  
  2. Security
    - Only allow users to update their own items
    - Prevent type changes after creation
    - Restrict status changes to valid values
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
    type = (
      SELECT type 
      FROM items AS current_item 
      WHERE current_item.id = items.id
    ) AND
    status IN ('available', 'traded')
  );