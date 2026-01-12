-- Reset message_threads policies to allow authenticated users to create threads.
DO $$
DECLARE
  pol record;
BEGIN
  IF to_regclass('public.message_threads') IS NULL THEN
    RAISE NOTICE 'message_threads table missing; skipping 20260113_reset_message_threads_policies.sql';
    RETURN;
  END IF;

  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'message_threads'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.message_threads', pol.policyname);
  END LOOP;

  CREATE POLICY "mt_insert_allow_creator"
    ON public.message_threads
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

  CREATE POLICY "mt_select_allow_all_auth"
    ON public.message_threads
    FOR SELECT
    TO authenticated
    USING (true);
END;
$$;
