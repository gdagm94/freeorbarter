/*
  # Fix Items Update Policy

  1. Changes
    - Drop existing update policy
    - Create new policy that allows users to:
      - Update their own items
      - Change item type between 'free' and 'barter'
      - Change status between 'available' and 'traded'
    - Ensure required fields are present
    - Maintain data integrity checks

  2. Security
    - Only item owners can update their items
    - Required fields must be present
    - Type and status must be valid enum values
*/

-- Drop existing update policy
DROP POLICY IF EXISTS "Users can update own items" ON items;

-- Create new update policy with proper field validation
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
    type = ANY (ARRAY['free'::listing_type, 'barter'::listing_type]) AND
    status = ANY (ARRAY['available'::item_status, 'traded'::item_status])
  );