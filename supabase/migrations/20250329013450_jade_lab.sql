/*
  # Fix Items Table Update Policy

  1. Changes
    - Drop existing update policy
    - Create new update policy with simplified checks
    - Fix subquery issue by using direct comparison
    - Ensure proper type casting for status values
  
  2. Security
    - Maintain all security checks
    - Prevent type changes
    - Allow status updates only to valid values
*/

-- Drop existing update policy
DROP POLICY IF EXISTS "Users can update own items" ON items;

-- Create new update policy with simplified checks
CREATE POLICY "Users can update own items"
  ON items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    title IS NOT NULL AND
    description IS NOT NULL AND
    images IS NOT NULL AND
    condition IS NOT NULL AND
    category IS NOT NULL AND
    location IS NOT NULL AND
    user_id = auth.uid() AND
    type = (SELECT i.type FROM items i WHERE i.id = items.id) AND
    status = ANY (ARRAY['available'::item_status, 'traded'::item_status])
  );