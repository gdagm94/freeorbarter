-- Fix existing rows that would violate the new constraint
-- Assign generated usernames to NULL/empty/invalid entries
UPDATE public.users
SET username = 'user_' || LEFT(REPLACE(id::text, '-', ''), 12)
WHERE username IS NULL OR username = '' OR username !~ '^[a-z0-9_.]{3,20}$';

-- Lowercase any remaining uppercase usernames
UPDATE public.users
SET username = lower(username)
WHERE username <> lower(username);

-- Add username format CHECK constraint (3–20 chars, lowercase a-z, 0-9, underscore, dot)
ALTER TABLE public.users
  ADD CONSTRAINT username_format CHECK (
    username ~ '^[a-z0-9_.]{3,20}$'
  );

-- RPC function: check whether a given username is available
CREATE OR REPLACE FUNCTION public.check_username_available(p_username text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.users WHERE lower(username) = lower(p_username)
  );
$$;

ALTER FUNCTION public.check_username_available(p_username text) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.check_username_available(text) TO anon;
GRANT EXECUTE ON FUNCTION public.check_username_available(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_username_available(text) TO service_role;

-- Update handle_new_user to also store full_name and lowercase the username
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.users (id, username, full_name, avatar_url)
  VALUES (
    new.id,
    lower(new.raw_user_meta_data->>'username'),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- Update handle_user_update to also keep full_name and lowercase username
CREATE OR REPLACE FUNCTION public.handle_user_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users
  SET
    username = COALESCE(lower(new.raw_user_meta_data->>'username'), username),
    full_name = COALESCE(new.raw_user_meta_data->>'full_name', full_name),
    avatar_url = COALESCE(new.raw_user_meta_data->>'avatar_url', avatar_url)
  WHERE id = new.id;
  RETURN new;
END;
$$;
