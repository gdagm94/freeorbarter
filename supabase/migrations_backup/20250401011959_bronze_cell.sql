/*
  # Fix RLS Policy for Item Status Updates

  1. Changes
    - Drop existing policies
    - Create new policies that properly handle status updates
    - Maintain security while allowing status transitions
  
  2. Security
    - Only item owners can update their items
    - Status can only be set to valid values
    - Maintain data integrity checks
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can update own items" ON items;
DROP POLICY IF EXISTS "Anyone can view available items" ON items;

-- Create policy for viewing items
CREATE POLICY "Anyone can view items"
  ON items FOR SELECT
  USING (true);

-- Create policy for updating items
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
    (
      CASE
        WHEN type = 'free' THEN status = ANY (ARRAY['available'::item_status, 'claimed'::item_status])
        WHEN type = 'barter' THEN status = ANY (ARRAY['available'::item_status, 'traded'::item_status])
      END
    )
  );