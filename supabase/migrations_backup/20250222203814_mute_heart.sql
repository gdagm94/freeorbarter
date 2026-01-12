/*
  # Fix User Profile Creation

  1. Changes
    - Update trigger function to properly handle user creation
    - Add ON CONFLICT clause to handle edge cases
    - Remove email field since it's not in the schema

  2. Security
    - Maintain existing RLS policies
*/

-- Update handle_new_user function with improved error handling and conflict resolution
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (
    id,
    full_name,
    gender,
    profile_completed,
    created_at
  ) VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    (CASE 
      WHEN new.raw_user_meta_data->>'gender' = 'male' THEN 'male'::user_gender
      WHEN new.raw_user_meta_data->>'gender' = 'female' THEN 'female'::user_gender
      ELSE NULL
    END),
    false,
    COALESCE(new.created_at, now())
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    gender = EXCLUDED.gender,
    profile_completed = EXCLUDED.profile_completed;

  RETURN new;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure RLS policies are properly set
DROP POLICY IF EXISTS "Users can view all profiles" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

CREATE POLICY "Users can view all profiles"
  ON users FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create missing user records for existing auth users
INSERT INTO public.users (id, created_at, profile_completed)
SELECT 
  id,
  created_at,
  false as profile_completed
FROM auth.users
ON CONFLICT (id) DO NOTHING;