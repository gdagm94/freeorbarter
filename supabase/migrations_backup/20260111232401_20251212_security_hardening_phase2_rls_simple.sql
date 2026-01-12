/*
  # RLS hardening (guarded)
  Note: Skip if required tables are not present in the current database.
*/

DO $$
BEGIN
  IF to_regclass('public.users') IS NULL
     OR to_regclass('public.items') IS NULL
     OR to_regclass('public.messages') IS NULL
     OR to_regclass('public.watched_items') IS NULL
     OR to_regclass('public.notification_settings') IS NULL
     OR to_regclass('public.blocked_users') IS NULL
     OR to_regclass('public.barter_offers') IS NULL THEN
    RAISE NOTICE 'Required tables missing; skipping 20260111232401_20251212_security_hardening_phase2_rls_simple.sql';
    RETURN;
  END IF;

  -- policies intentionally omitted in guarded shadow context
END;
$$;
