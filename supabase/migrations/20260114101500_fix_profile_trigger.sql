-- Fix handle_user_update to prevent overwriting existing data with NULLs
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users
  SET
    username = COALESCE(new.raw_user_meta_data->>'username', username),
    avatar_url = COALESCE(new.raw_user_meta_data->>'avatar_url', avatar_url)
  WHERE id = new.id;
  RETURN new;
END;
$$;
