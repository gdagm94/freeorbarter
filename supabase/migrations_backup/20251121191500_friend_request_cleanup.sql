-- Cleanup friend requests so declined rows don't block re-sending

create or replace function public.decline_friend_request_secure(p_request_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  request_record friend_requests%ROWTYPE;
begin
  select *
    into request_record
    from friend_requests
    where id = p_request_id;

  if request_record.id is null then
    raise exception 'Friend request not found';
  end if;

  if request_record.receiver_id <> auth.uid() then
    raise exception 'Not authorized to decline this request';
  end if;

  delete from friend_requests where id = p_request_id;

  return 'ok';
end;
$$;

revoke all on function public.decline_friend_request_secure(uuid) from public;
grant execute on function public.decline_friend_request_secure(uuid) to authenticated;


create or replace function public.cleanup_friend_request_pair(p_sender uuid, p_receiver uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() <> p_sender then
    raise exception 'Not authorized to clean up this friend request';
  end if;

  delete from friend_requests
  where sender_id = p_sender
    and receiver_id = p_receiver
    and status <> 'pending';

  return 'ok';
end;
$$;

revoke all on function public.cleanup_friend_request_pair(uuid, uuid) from public;
grant execute on function public.cleanup_friend_request_pair(uuid, uuid) to authenticated;

