-- Ensure message_threads insert policy allows direct conversations (item_id null)
-- and item-based threads when the item exists.

DO $$
BEGIN
  IF to_regclass('public.message_threads') IS NULL THEN
    RAISE NOTICE 'message_threads table not found; skipping 20260112_update_message_threads_insert_policy.sql';
    RETURN;
  END IF;

  EXECUTE 'drop policy if exists "insert message threads" on public.message_threads';

  EXECUTE '
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
    )';
END;
$$;
