CREATE TRIGGER messages_set_default_topic_tr BEFORE INSERT OR UPDATE ON realtime.messages FOR EACH ROW EXECUTE FUNCTION realtime.set_default_topic_if_null();

CREATE TRIGGER messages_set_default_topic_tr BEFORE INSERT OR UPDATE ON realtime.messages_2025_12_12 FOR EACH ROW EXECUTE FUNCTION realtime.set_default_topic_if_null();

CREATE TRIGGER messages_set_default_topic_tr BEFORE INSERT OR UPDATE ON realtime.messages_2025_12_13 FOR EACH ROW EXECUTE FUNCTION realtime.set_default_topic_if_null();

CREATE TRIGGER messages_set_default_topic_tr BEFORE INSERT OR UPDATE ON realtime.messages_2025_12_14 FOR EACH ROW EXECUTE FUNCTION realtime.set_default_topic_if_null();

CREATE TRIGGER messages_set_default_topic_tr BEFORE INSERT OR UPDATE ON realtime.messages_2025_12_15 FOR EACH ROW EXECUTE FUNCTION realtime.set_default_topic_if_null();

CREATE TRIGGER messages_set_default_topic_tr BEFORE INSERT OR UPDATE ON realtime.messages_2025_12_16 FOR EACH ROW EXECUTE FUNCTION realtime.set_default_topic_if_null();

CREATE TRIGGER messages_set_default_topic_tr BEFORE INSERT OR UPDATE ON realtime.messages_2025_12_17 FOR EACH ROW EXECUTE FUNCTION realtime.set_default_topic_if_null();

CREATE TRIGGER messages_set_default_topic_tr BEFORE INSERT OR UPDATE ON realtime.messages_2025_12_18 FOR EACH ROW EXECUTE FUNCTION realtime.set_default_topic_if_null();

drop policy "Users can upload avatar images" on "storage"."objects";

drop policy "Users can upload item images" on "storage"."objects";


  create policy "Users can upload avatar images"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'avatars'::text) AND (lower("substring"(name, '\.([^\.]+);
::text)) = ANY (ARRAY['jpg'::text, 'jpeg'::text, 'png'::text, 'gif'::text]))));



  create policy "Users can upload item images"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'item-images'::text) AND (lower("substring"(name, '\.([^\.]+);
::text)) = ANY (ARRAY['jpg'::text, 'jpeg'::text, 'png'::text, 'gif'::text]))));



