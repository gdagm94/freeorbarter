set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.ban_user(user_id_to_ban uuid, ban_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Update users table
  UPDATE users
  SET banned = true
  WHERE id = user_id_to_ban;

  -- Log the action (if called from edge function, moderation_actions will be inserted separately)
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_friend_request_pair(p_sender uuid, p_receiver uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.decline_friend_request_secure(p_request_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.expire_offers()
 RETURNS void
 LANGUAGE plpgsql
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

CREATE OR REPLACE FUNCTION public.reports_set_deadline()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.needs_action_by IS NULL THEN
    NEW.needs_action_by := now() + interval '24 hours';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reports_set_first_response()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.first_response_at IS NULL
     AND OLD.status = 'pending'
     AND NEW.status <> 'pending' THEN
    NEW.first_response_at := now();
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.track_item_creation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
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

CREATE OR REPLACE FUNCTION public.unban_user(user_id_to_unban uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE users
  SET banned = false
  WHERE id = user_id_to_unban;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_blocked_keywords_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_message_read_at()
 RETURNS trigger
 LANGUAGE plpgsql
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

drop policy if exists "Users can upload avatar images" on "storage"."objects";

drop policy if exists "Users can upload item images" on "storage"."objects";

-- Recreate with valid check using split_part on file extension
create policy "Users can upload avatar images"
on "storage"."objects"
as permissive
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and lower(split_part(name, '.', -1)) = any (array['jpg','jpeg','png','gif'])
);

create policy "Users can upload item images"
on "storage"."objects"
as permissive
for insert
to authenticated
with check (
  bucket_id = 'item-images'
  and lower(split_part(name, '.', -1)) = any (array['jpg','jpeg','png','gif'])
);



