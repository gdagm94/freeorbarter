/*
  # Add Claimed Status Support

  1. Changes
    - Drop all policies that depend on status column
    - Update item_status enum to include 'claimed'
    - Add index for status field
    - Recreate policies with updated status values

  2. Security
    - Maintain existing security model
    - Allow users to update status to claimed/traded
*/

-- First drop all policies that depend on the status column
DROP POLICY IF EXISTS "Users can update own items" ON items;
DROP POLICY IF EXISTS "Anyone can view available items" ON items;

-- Drop and recreate item_status enum to include 'claimed'
ALTER TYPE item_status RENAME TO item_status_old;
CREATE TYPE item_status AS ENUM ('available', 'pending', 'traded', 'claimed');

-- Convert existing column to use new enum
ALTER TABLE items 
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE item_status USING status::text::item_status;

-- Set default back
ALTER TABLE items
  ALTER COLUMN status SET DEFAULT 'available';

-- Drop old enum
DROP TYPE item_status_old;

-- Create index for status field if it doesn't exist
CREATE INDEX IF NOT EXISTS items_status_idx ON items(status);

-- Recreate the policies with updated status values
CREATE POLICY "Anyone can view available items"
  ON items FOR SELECT
  USING (status = 'available');

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
    status = ANY (ARRAY['available'::item_status, 'traded'::item_status, 'claimed'::item_status])
  );