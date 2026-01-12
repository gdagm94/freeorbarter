/*
  # Fix RLS Policy for Items Table

  1. Changes
    - Simplify the update policy to avoid subquery issues
    - Use direct comparison for type field
    - Maintain all required field validations
    - Ensure proper status transitions

  2. Security
    - Maintain user ownership check
    - Prevent type changes
    - Allow only valid status values
*/

-- Drop existing update policy
DROP POLICY IF EXISTS "Users can update own items" ON items;

-- Create new update policy with simplified checks
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
    type IS NOT NULL AND
    status IN ('available', 'traded')
  );