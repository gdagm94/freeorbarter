-- Add topic column to messages and all existing partitions, with default and NOT NULL
-- This mirrors the cloud change so local migrations stay in sync.

-- Ensure parent has the column
alter table public.messages
  add column if not exists topic text default 'direct';

-- Enforce default and NOT NULL on parent
alter table public.messages
  alter column topic set default 'direct',
  alter column topic set not null;

-- Apply to every existing partition
do $$
declare
  r record;
begin
  for r in
    select inhrelid::regclass as partition_name
    from pg_inherits
    join pg_class parent on pg_inherits.inhparent = parent.oid
    where parent.relname = 'messages' and parent.relnamespace = 'public'::regnamespace
  loop
    execute format('alter table %I add column if not exists topic text default ''direct'';', r.partition_name);
    execute format('alter table %I alter column topic set default ''direct'';', r.partition_name);
    execute format('alter table %I alter column topic set not null;', r.partition_name);
    execute format('update %I set topic = ''direct'' where topic is null;', r.partition_name);
  end loop;
end$$;

-- Backfill parent just in case
update public.messages set topic = 'direct' where topic is null;

-- Reload PostgREST schema cache so the API sees the column
select pg_notify('pgrst', 'reload schema');

