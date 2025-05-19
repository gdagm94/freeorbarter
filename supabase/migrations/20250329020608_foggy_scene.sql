/*
  # Fix items table RLS policy

  1. Changes
    - Drop existing update policy
    - Create new policy with proper field validation
    - Allow type changes between 'free' and 'barter'
    - Maintain security checks for user ownership
  
  2. Security
    - Users can still only update their own items
    - Required fields must be present
    - Status changes limited to valid values
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