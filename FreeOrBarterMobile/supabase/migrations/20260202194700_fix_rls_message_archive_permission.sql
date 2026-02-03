-- Allow users to update messages they sent (needed for archiving)
create policy "Users can update their own sent messages"
on "public"."messages"
as permissive
for update
to authenticated
using (sender_id = auth.uid())
with check (sender_id = auth.uid());
