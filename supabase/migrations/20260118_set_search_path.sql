-- Ensure unqualified relations resolve to public by default.
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER ROLE anon SET search_path = public, extensions';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping anon search_path update (insufficient privilege)';
  END;

  BEGIN
    EXECUTE 'ALTER ROLE authenticated SET search_path = public, extensions';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping authenticated search_path update (insufficient privilege)';
  END;

  BEGIN
    EXECUTE 'ALTER ROLE service_role SET search_path = public, extensions';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping service_role search_path update (insufficient privilege)';
  END;

  -- Set database default as well.
  BEGIN
    EXECUTE 'ALTER DATABASE postgres SET search_path = public, extensions';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping database search_path update (insufficient privilege)';
  END;
END;
$$;
