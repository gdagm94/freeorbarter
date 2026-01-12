/*
  # Add listing type to items table

  1. Changes
    - Add `type` column to items table with values 'free' or 'barter'
    - Add check constraint to ensure valid values
    - Set default value to 'free'

  2. Notes
    - Uses enum type for type safety
    - Includes check constraint for data integrity
*/

-- Create listing type enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_type') THEN
    CREATE TYPE listing_type AS ENUM ('free', 'barter');
  END IF;
END $$;

-- Add type column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'items' AND column_name = 'type'
  ) THEN
    ALTER TABLE items ADD COLUMN type listing_type DEFAULT 'free'::listing_type NOT NULL;
  END IF;
END $$;

-- Create index for type searches
CREATE INDEX IF NOT EXISTS items_type_idx ON items(type);