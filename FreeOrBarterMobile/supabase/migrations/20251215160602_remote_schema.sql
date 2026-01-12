-- Ensure helper exists before triggers (mirrors cloud function)
create or replace function realtime.set_default_topic_if_null()
returns trigger
language plpgsql
as $$
begin
  if new.topic is null then
    new.topic := format('realtime:%I:%I', tg_table_schema, tg_table_name);
  end if;
  return new;
end;
$$;

do $$
declare
  rec record;
  trig_name text := 'messages_set_default_topic_tr';
begin
  -- Parent table trigger (if table exists)
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'realtime' and c.relname = 'messages'
  ) then
    begin
      if exists (
        select 1
        from pg_trigger t
        join pg_class c on t.tgrelid = c.oid
        join pg_namespace n on c.relnamespace = n.oid
        where n.nspname = 'realtime' and c.relname = 'messages' and t.tgname = trig_name
      ) then
        execute format('drop trigger %I on realtime.messages', trig_name);
      end if;
      execute format('create trigger %I before insert or update on realtime.messages for each row execute function realtime.set_default_topic_if_null()', trig_name);
    exception when insufficient_privilege then
      -- Skip if we do not own the table locally
      null;
    end;
  end if;

  -- Partition triggers (only for partitions that exist locally)
  for rec in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'realtime' and c.relname like 'messages_%' and c.relkind in ('r', 'p')
  loop
    begin
      if exists (
        select 1
        from pg_trigger t
        join pg_class c2 on t.tgrelid = c2.oid
        join pg_namespace n2 on c2.relnamespace = n2.oid
        where n2.nspname = 'realtime' and c2.relname = rec.relname and t.tgname = trig_name
      ) then
        execute format('drop trigger %I on realtime.%I', trig_name, rec.relname);
      end if;

      execute format('create trigger %I before insert or update on realtime.%I for each row execute function realtime.set_default_topic_if_null()', trig_name, rec.relname);
    exception when insufficient_privilege then
      -- Skip partitions we don't own
      null;
    end;
  end loop;
end$$;

drop policy "Users can upload avatar images" on "storage"."objects";

drop policy "Users can upload item images" on "storage"."objects";


create policy "Users can upload avatar images"
on "storage"."objects"
as permissive
for insert
to authenticated
with check (
  bucket_id = 'avatars'::text
  and lower(substring(name from '\.([^.]+)$')) = any (array['jpg'::text, 'jpeg'::text, 'png'::text, 'gif'::text])
);

create policy "Users can upload item images"
on "storage"."objects"
as permissive
for insert
to authenticated
with check (
  bucket_id = 'item-images'::text
  and lower(substring(name from '\.([^.]+)$')) = any (array['jpg'::text, 'jpeg'::text, 'png'::text, 'gif'::text])
);
