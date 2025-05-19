/*
  # Add location coordinates to items table

  1. Changes
    - Add latitude and longitude columns to items table
    - Add btree indexes for coordinate columns
    - Add check constraints to ensure valid coordinates

  2. Notes
    - Latitude must be between -90 and 90 degrees
    - Longitude must be between -180 and 180 degrees
    - Using btree indexes for simple coordinate lookups
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'items' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE items 
    ADD COLUMN latitude double precision,
    ADD COLUMN longitude double precision;

    -- Add check constraints for valid coordinates
    ALTER TABLE items 
    ADD CONSTRAINT valid_latitude 
    CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));

    ALTER TABLE items 
    ADD CONSTRAINT valid_longitude 
    CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));

    -- Create btree indexes for coordinates
    CREATE INDEX items_latitude_idx ON items (latitude);
    CREATE INDEX items_longitude_idx ON items (longitude);
  END IF;
END $$;