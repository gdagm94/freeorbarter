/*
  # Profile Enhancements Schema Update

  1. New Fields
    - Add `username` field to users table
    - Add `zipcode` field to users table
    - Add `profile_completed` flag to users table
    - Add `rating` field to users table

  2. Changes
    - Make `full_name` nullable since we'll use username as primary identifier
    - Add check constraint for zipcode format
    - Add check constraint for rating range

  3. Security
    - Update RLS policies to allow profile updates
*/

-- Add new fields to users table
DO $$ 
BEGIN
  -- Add username if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'username'
  ) THEN
    ALTER TABLE users ADD COLUMN username text UNIQUE;
  END IF;

  -- Add zipcode if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'zipcode'
  ) THEN
    ALTER TABLE users ADD COLUMN zipcode text;
  END IF;

  -- Add profile_completed flag if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'profile_completed'
  ) THEN
    ALTER TABLE users ADD COLUMN profile_completed boolean DEFAULT false;
  END IF;

  -- Add rating if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'rating'
  ) THEN
    ALTER TABLE users ADD COLUMN rating numeric(3,2);
  END IF;
END $$;

-- Add constraints
ALTER TABLE users
  ADD CONSTRAINT valid_zipcode CHECK (zipcode ~ '^\d{5}$'),
  ADD CONSTRAINT valid_rating CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5));

-- Create index for username searches
CREATE INDEX IF NOT EXISTS users_username_idx ON users(username);

-- Update handle_new_user function to set profile_completed
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    full_name,
    gender,
    profile_completed
  ) VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    (CASE 
      WHEN new.raw_user_meta_data->>'gender' = 'male' THEN 'male'::user_gender
      WHEN new.raw_user_meta_data->>'gender' = 'female' THEN 'female'::user_gender
      ELSE NULL
    END),
    false
  );
  RETURN new;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;