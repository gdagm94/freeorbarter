-- Fix message_threads insert RLS to allow direct conversations and item threads for the creator.
DO $$
BEGIN
  IF to_regclass('public.message_threads') IS NULL THEN
    RAISE NOTICE 'message_threads table missing; skipping 20260113_fix_message_threads_rls.sql';
    RETURN;
  END IF;

  EXECUTE 'drop policy if exists "insert message threads" on public.message_threads';

  EXECUTE $ql$
    create policy "insert message threads"
    on public.message_threads
    for insert
    to authenticated
    with check (
      auth.uid() = created_by
      and (
        item_id is null
        or exists (
          select 1 from public.items i
          where i.id = message_threads.item_id
        )
      )
    )
  $ql$;
END;
$$;
