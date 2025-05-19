/*
  # Update Items Table Status Dependencies

  1. Changes
    - Drop the existing policy that depends on the status column
    - Drop the status column
    - Drop the status enum type
    - Create new policy without status dependency

  2. Notes
    - Handle dependencies in correct order to avoid cascade issues
    - Maintain data integrity during migration
*/

-- First drop the policy that depends on the status column
DROP POLICY IF EXISTS "Anyone can view available items" ON items;

-- Drop existing update policy
DROP POLICY IF EXISTS "Users can update own items" ON items;

-- Now we can safely remove the status column
ALTER TABLE items DROP COLUMN IF EXISTS status;

-- Drop the enum type since it's no longer needed
DROP TYPE IF EXISTS item_status;

-- Create new view policy without status dependency
CREATE POLICY "Anyone can view items"
  ON items FOR SELECT
  USING (true);

-- Create new update policy without status checks
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
    type = ANY (ARRAY['free'::listing_type, 'barter'::listing_type])
  );