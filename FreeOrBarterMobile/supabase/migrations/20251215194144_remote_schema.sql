-- Safely ensure the realtime partition triggers exist only when the partitions do
DO $$
DECLARE
  rec record;
  trig_name text := 'messages_set_default_topic_tr';
BEGIN
  FOR rec IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'realtime'
      AND c.relname IN ('messages_2025_12_12', 'messages_2025_12_13')
  LOOP
    -- Drop existing trigger on the partition if present
    IF EXISTS (
      SELECT 1
      FROM pg_trigger t
      JOIN pg_class c2 ON t.tgrelid = c2.oid
      JOIN pg_namespace n2 ON c2.relnamespace = n2.oid
      WHERE n2.nspname = 'realtime'
        AND c2.relname = rec.relname
        AND t.tgname = trig_name
    ) THEN
      EXECUTE format('drop trigger %I on realtime.%I', trig_name, rec.relname);
    END IF;

    -- Create trigger for partitions that exist locally
    EXECUTE format(
      'create trigger %I before insert or update on realtime.%I for each row execute function realtime.set_default_topic_if_null()',
      trig_name,
      rec.relname
    );
  END LOOP;
END
$$;

-- Recreate storage policies with explicit checks
drop policy if exists "Users can upload avatar images" on "storage"."objects";
drop policy if exists "Users can upload item images" on "storage"."objects";

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