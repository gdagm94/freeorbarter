-- Ensure a concrete public.users table exists (not just a view) for FKs and policies.
DO $$
BEGIN
  -- If a view named public.users exists, drop it to allow table creation.
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'users') THEN
    EXECUTE 'DROP VIEW public.users';
  END IF;

  -- Create the users table if missing.
  EXECUTE '
    CREATE TABLE IF NOT EXISTS public.users (
      id uuid PRIMARY KEY,
      username text,
      avatar_url text,
      created_at timestamptz DEFAULT now()
    )
  ';

  -- Backfill from auth.users when rows are missing.
  INSERT INTO public.users (id, username, avatar_url)
  SELECT au.id, au.raw_user_meta_data->>'username', au.raw_user_meta_data->>'avatar_url'
  FROM auth.users au
  WHERE NOT EXISTS (SELECT 1 FROM public.users pu WHERE pu.id = au.id);

  -- Recreate realtime.users as a view over public.users to satisfy realtime triggers/lookups.
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'realtime' AND viewname = 'users') THEN
    EXECUTE 'DROP VIEW realtime.users';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'realtime' AND viewname = 'users') THEN
    EXECUTE 'CREATE VIEW realtime.users AS SELECT * FROM public.users';
  END IF;
END;
$$;
