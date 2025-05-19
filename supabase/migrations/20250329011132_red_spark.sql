/*
  # Fix Items Table RLS Policy

  1. Changes
    - Update RLS policy to properly handle status changes
    - Fix subquery issues by using proper table references
    - Ensure proper validation of required fields
    - Allow status updates while maintaining data integrity

  2. Security
    - Only item owners can update their items
    - Status can only be set to 'available' or 'traded'
    - Type and user_id cannot be changed
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
    type = (SELECT i.type FROM items i WHERE i.id = items.id LIMIT 1) AND
    status = ANY (ARRAY['available'::item_status, 'traded'::item_status])
  );