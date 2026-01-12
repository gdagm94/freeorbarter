/*
  # Add gender field to users table

  1. Changes
    - Add gender field to users table
    - Make it an enum type for data consistency
    - Allow null values for users who prefer not to specify

  2. Security
    - Maintain existing RLS policies
*/

-- Create gender enum type
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_gender') THEN
    CREATE TYPE user_gender AS ENUM ('male', 'female');
  END IF;
END $$;

-- Add gender column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'gender'
  ) THEN
    ALTER TABLE users ADD COLUMN gender user_gender;
  END IF;
END $$;