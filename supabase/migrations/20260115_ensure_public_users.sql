-- Ensure public.users table exists for FK references (messages, threads, etc.)
DO $$
BEGIN
  -- Create minimal users table if missing
  IF to_regclass('public.users') IS NULL THEN
    CREATE TABLE public.users (
      id uuid PRIMARY KEY,
      username text,
      avatar_url text,
      created_at timestamptz DEFAULT now()
    );
  END IF;

  -- Backfill from auth.users if rows are missing
  INSERT INTO public.users (id, username, avatar_url)
  SELECT au.id, au.raw_user_meta_data->>'username', au.raw_user_meta_data->>'avatar_url'
  FROM auth.users au
  WHERE NOT EXISTS (SELECT 1 FROM public.users pu WHERE pu.id = au.id);
END;
$$;
