-- Create a bridge public.users table if missing and backfill from auth.users.
DO $$
BEGIN
  -- Create minimal users table if it does not exist
  IF to_regclass('public.users') IS NULL THEN
    CREATE TABLE public.users (
      id uuid PRIMARY KEY,
      username text,
      avatar_url text,
      created_at timestamptz DEFAULT now()
    );
  END IF;

  -- Backfill from auth.users to ensure existing auth users are present
  INSERT INTO public.users (id, username, avatar_url)
  SELECT au.id, au.raw_user_meta_data->>'username', au.raw_user_meta_data->>'avatar_url'
  FROM auth.users au
  WHERE NOT EXISTS (
    SELECT 1 FROM public.users pu WHERE pu.id = au.id
  );
END;
$$;
