set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_user_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.users
  SET 
    username = new.raw_user_meta_data->>'username',
    avatar_url = new.raw_user_meta_data->>'avatar_url'
  WHERE id = new.id;
  RETURN new;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.expire_offers()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  -- Update expired offers
  UPDATE barter_offers 
  SET status = 'expired'
  WHERE status = 'pending' 
  AND expiration_date IS NOT NULL 
  AND expiration_date < now();
  
  -- Update expired counter offers
  UPDATE counter_offers 
  SET status = 'expired'
  WHERE status = 'pending' 
  AND EXISTS (
    SELECT 1 FROM barter_offers 
    WHERE barter_offers.id = counter_offers.original_offer_id 
    AND barter_offers.status = 'expired'
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.users (id, username, avatar_url)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING; -- Safe insert in case of race conditions
  RETURN new;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.send_push_for_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  fn_endpoint text;
  service_role_key text;
  payload jsonb;
  request_id bigint;
begin
  -- Read from settings table instead of config
  select 
    functions_endpoint,
    push_settings.service_role_key
  into fn_endpoint, service_role_key
  from public.push_settings
  where id = 'singleton';

  if fn_endpoint is null or service_role_key is null then
    raise warning 'send_push_for_notification: missing settings in push_settings table';
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

  select net.http_post(
    url := fn_endpoint,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || service_role_key,
      'Content-Type', 'application/json'
    ),
    body := payload
  ) into request_id;

  raise log 'send_push_for_notification: HTTP request queued with ID % for user %', 
    request_id, new.user_id;

  return new;
exception
  when others then
    raise warning 'send_push_for_notification error: %', SQLERRM;
    return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.track_item_creation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  INSERT INTO user_history (
    user_id,
    action_type,
    item_id,
    item_title,
    item_description,
    item_images,
    item_category,
    item_condition,
    item_type
  ) VALUES (
    NEW.user_id,
    'created',
    NEW.id,
    NEW.title,
    NEW.description,
    NEW.images,
    NEW.category,
    NEW.condition,
    NEW.type
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.track_item_deletion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  INSERT INTO user_history (
    user_id,
    action_type,
    item_id, -- This will be NULL since item is deleted
    item_title,
    item_description,
    item_images,
    item_category,
    item_condition,
    item_type
  ) VALUES (
    OLD.user_id,
    'deleted',
    NULL,
    OLD.title,
    OLD.description,
    OLD.images,
    OLD.category,
    OLD.condition,
    OLD.type
  );
  RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.track_item_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  changes_json jsonb := '{}';
BEGIN
  -- Track changes in a JSON object
  IF OLD.title != NEW.title THEN
    changes_json := changes_json || jsonb_build_object('title', jsonb_build_object('old', OLD.title, 'new', NEW.title));
  END IF;
  
  IF OLD.description != NEW.description THEN
    changes_json := changes_json || jsonb_build_object('description', jsonb_build_object('old', OLD.description, 'new', NEW.description));
  END IF;
  
  IF OLD.images != NEW.images THEN
    changes_json := changes_json || jsonb_build_object('images', jsonb_build_object('old', OLD.images, 'new', NEW.images));
  END IF;
  
  IF OLD.category != NEW.category THEN
    changes_json := changes_json || jsonb_build_object('category', jsonb_build_object('old', OLD.category, 'new', NEW.category));
  END IF;
  
  IF OLD.condition != NEW.condition THEN
    changes_json := changes_json || jsonb_build_object('condition', jsonb_build_object('old', OLD.condition, 'new', NEW.condition));
  END IF;
  
  IF OLD.type != NEW.type THEN
    changes_json := changes_json || jsonb_build_object('type', jsonb_build_object('old', OLD.type, 'new', NEW.type));
  END IF;
  
  IF OLD.location != NEW.location THEN
    changes_json := changes_json || jsonb_build_object('location', jsonb_build_object('old', OLD.location, 'new', NEW.location));
  END IF;

  -- Only insert history record if there were actual changes
  IF changes_json != '{}' THEN
    INSERT INTO user_history (
      user_id,
      action_type,
      item_id,
      item_title,
      item_description,
      item_images,
      item_category,
      item_condition,
      item_type,
      changes
    ) VALUES (
      NEW.user_id,
      'edited',
      NEW.id,
      NEW.title,
      NEW.description,
      NEW.images,
      NEW.category,
      NEW.condition,
      NEW.type,
      changes_json
    );
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_message_read_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  -- Only update read_at if read is being set to true and read_at is null
  IF NEW.read = true AND OLD.read = false AND NEW.read_at IS NULL THEN
    NEW.read_at = now();
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_template_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_thread_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  IF NEW.thread_id IS NOT NULL THEN
    UPDATE message_threads 
    SET updated_at = now() 
    WHERE id = NEW.thread_id;
  END IF;
  RETURN NEW;
END;
$function$
;


  create policy "Users can update their own profile"
  on "public"."users"
  as permissive
  for update
  to public
using ((auth.uid() = id));



  create policy "Users can view public profiles"
  on "public"."users"
  as permissive
  for select
  to public
using (true);


CREATE TRIGGER on_auth_user_updated AFTER UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();


  create policy "thread_members_can_read_realtime_messages"
  on "realtime"."messages"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.thread_members tm
  WHERE (((tm.thread_id)::text = split_part(messages.topic, ':'::text, 2)) AND (tm.user_id = ( SELECT auth.uid() AS uid))))));



  create policy "thread_members_can_write_realtime_messages"
  on "realtime"."messages"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.thread_members tm
  WHERE (((tm.thread_id)::text = split_part(messages.topic, ':'::text, 2)) AND (tm.user_id = ( SELECT auth.uid() AS uid))))));


CREATE TRIGGER messages_set_default_topic_tr BEFORE INSERT OR UPDATE ON realtime.messages FOR EACH ROW EXECUTE FUNCTION realtime.set_default_topic_if_null();

CREATE TRIGGER messages_set_default_topic_tr BEFORE INSERT OR UPDATE ON realtime.messages_2026_01_09 FOR EACH ROW EXECUTE FUNCTION realtime.set_default_topic_if_null();

CREATE TRIGGER messages_set_default_topic_tr BEFORE INSERT OR UPDATE ON realtime.messages_2026_01_10 FOR EACH ROW EXECUTE FUNCTION realtime.set_default_topic_if_null();

CREATE TRIGGER messages_set_default_topic_tr BEFORE INSERT OR UPDATE ON realtime.messages_2026_01_11 FOR EACH ROW EXECUTE FUNCTION realtime.set_default_topic_if_null();

CREATE TRIGGER messages_set_default_topic_tr BEFORE INSERT OR UPDATE ON realtime.messages_2026_01_12 FOR EACH ROW EXECUTE FUNCTION realtime.set_default_topic_if_null();

CREATE TRIGGER messages_set_default_topic_tr BEFORE INSERT OR UPDATE ON realtime.messages_2026_01_13 FOR EACH ROW EXECUTE FUNCTION realtime.set_default_topic_if_null();

CREATE TRIGGER messages_set_default_topic_tr BEFORE INSERT OR UPDATE ON realtime.messages_2026_01_14 FOR EACH ROW EXECUTE FUNCTION realtime.set_default_topic_if_null();

CREATE TRIGGER messages_set_default_topic_tr BEFORE INSERT OR UPDATE ON realtime.messages_2026_01_15 FOR EACH ROW EXECUTE FUNCTION realtime.set_default_topic_if_null();


