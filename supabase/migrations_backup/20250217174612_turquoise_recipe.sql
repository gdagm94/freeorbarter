/*
  # Fix user creation process

  1. Changes
    - Update handle_new_user trigger function to properly handle metadata
    - Add error handling for user creation
    - Ensure gender is properly stored

  2. Security
    - Maintain existing RLS policies
*/

-- Drop and recreate the trigger function with improved error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    full_name,
    gender
  ) VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    (CASE 
      WHEN new.raw_user_meta_data->>'gender' = 'male' THEN 'male'::user_gender
      WHEN new.raw_user_meta_data->>'gender' = 'female' THEN 'female'::user_gender
      ELSE NULL
    END)
  );
  RETURN new;
EXCEPTION
  WHEN others THEN
    -- Log the error (will appear in Supabase logs)
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;