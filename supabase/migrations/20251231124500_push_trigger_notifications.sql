-- Send push notifications automatically when a notification row is created.
-- This uses pg_net to call the existing send-push Edge Function.
-- Prerequisites (set once in your DB, not committed to git):
--   SELECT set_config('app.settings.functions_endpoint', 'https://<project-ref>.functions.supabase.co/send-push', true);
--   SELECT set_config('app.settings.service_role_key', '<SERVICE_ROLE_KEY>', true);

create extension if not exists pg_net;

create or replace function public.send_push_for_notification()
returns trigger
language plpgsql
security definer
as $$
declare
  fn_endpoint text;
  service_role_key text;
  payload jsonb;
begin
  fn_endpoint := current_setting('app.settings.functions_endpoint', true);
  service_role_key := current_setting('app.settings.service_role_key', true);

  -- If config is missing, do nothing
  if fn_endpoint is null or service_role_key is null then
    return new;
  end if;

  payload := jsonb_build_object(
    'user_id', new.user_id,
    'title', coalesce(new.type::text, 'Notification'),
    'body', coalesce(new.content, 'You have a new notification'),
    'data', jsonb_build_object(
      'type', new.type,
      'notification_id', new.id,
      'related_id', new.related_id
    )
  );

  perform
    net.http_post(
      url := fn_endpoint,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || service_role_key,
        'Content-Type', 'application/json'
      ),
      body := payload
    );

  return new;
end;
$$;

drop trigger if exists trg_send_push_on_notifications on public.notifications;

create trigger trg_send_push_on_notifications
after insert on public.notifications
for each row
execute function public.send_push_for_notification();

