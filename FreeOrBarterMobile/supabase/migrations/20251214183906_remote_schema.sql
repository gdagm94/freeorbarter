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



