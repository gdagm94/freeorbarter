/*
  # Update RLS policy to allow type changes

  1. Changes
    - Remove type restriction from update policy
    - Allow users to change item type between 'free' and 'barter'
    - Maintain other validation checks
  
  2. Security
    - Users can still only update their own items
    - Required fields must still be present
    - Status changes limited to valid values
*/

-- Drop existing update policy
DROP POLICY IF EXISTS "Users can update own items" ON items;

-- Create new update policy without type restriction
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