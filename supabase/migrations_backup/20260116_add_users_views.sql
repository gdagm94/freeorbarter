-- Ensure a relation named "users" exists in both public and realtime schemas.
DO $$
BEGIN
  -- If public.users is absent, create a view over auth.users with common fields.
  IF to_regclass('public.users') IS NULL THEN
    EXECUTE '
      CREATE VIEW public.users AS
      SELECT
        id,
        raw_user_meta_data->>''username'' AS username,
        raw_user_meta_data->>''avatar_url'' AS avatar_url,
        created_at
      FROM auth.users
    ';
  END IF;

  -- If realtime.users is absent, expose it as a view over public.users.
  IF to_regclass('realtime.users') IS NULL THEN
    EXECUTE '
      CREATE VIEW realtime.users AS
      SELECT * FROM public.users
    ';
  END IF;
END;
$$;
