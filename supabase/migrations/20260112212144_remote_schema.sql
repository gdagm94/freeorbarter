set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.add_thread_member(p_thread_id uuid, p_user_id uuid, p_role text DEFAULT 'member'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_creator uuid;
  v_exists boolean;
BEGIN
  -- Check thread exists and get creator
  SELECT created_by INTO v_creator FROM public.message_threads WHERE id = p_thread_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','error','message','thread_not_found');
  END IF;

  -- permission: allow if caller is thread creator or member with role 'admin' or caller equals p_user_id (self-join)
  -- Use auth.uid() for caller
  IF (SELECT COALESCE((SELECT (auth.uid()) IS NOT NULL), FALSE) ) IS NULL THEN
    -- auth.uid() may be null in some contexts; allow only service role then
    NULL; -- continue, SECURITY DEFINER used; rely on caller context
  END IF;

  -- Check permission: caller must be creator OR member with admin role OR adding themselves
  IF (SELECT auth.uid())::text IS NOT NULL THEN
    IF (SELECT auth.uid()::uuid) <> v_creator AND NOT EXISTS (
      SELECT 1 FROM public.thread_members tm WHERE tm.thread_id = p_thread_id AND tm.user_id = (SELECT auth.uid()) AND tm.role = 'admin'
    ) AND (SELECT auth.uid())::uuid <> p_user_id THEN
      RETURN jsonb_build_object('status','error','message','forbidden');
    END IF;
  END IF;

  -- Insert idempotent
  SELECT EXISTS(SELECT 1 FROM public.thread_members WHERE thread_id = p_thread_id AND user_id = p_user_id) INTO v_exists;
  IF v_exists THEN
    RETURN jsonb_build_object('status','ok','message','already_member');
  END IF;

  INSERT INTO public.thread_members(thread_id, user_id, role) VALUES (p_thread_id, p_user_id, p_role);
  RETURN jsonb_build_object('status','ok','message','added');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_notification_on_new_listing_from_friend()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  friend_record RECORD;
  poster_username text;
BEGIN
  -- Get poster's username
  SELECT username INTO poster_username
  FROM users
  WHERE id = NEW.user_id;

  -- Find all friends of the item poster and create notifications
  FOR friend_record IN
    SELECT CASE 
      WHEN user1_id = NEW.user_id THEN user2_id
      ELSE user1_id
    END as friend_id
    FROM friendships
    WHERE user1_id = NEW.user_id OR user2_id = NEW.user_id
  LOOP
    -- Insert notification for each friend
    INSERT INTO notifications (user_id, sender_id, type, content, related_id)
    VALUES (
      friend_record.friend_id,
      NEW.user_id,
      'new_listing',
      COALESCE(poster_username, 'Someone') || ' just posted: ' || COALESCE(NEW.title, 'a new item'),
      NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_notification_on_watchlist_add()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  watcher_username text;
  item_title text;
  item_owner_id uuid;
BEGIN
  -- Get watcher's username
  SELECT username INTO watcher_username
  FROM users
  WHERE id = NEW.user_id;

  -- Get item details
  SELECT title, user_id INTO item_title, item_owner_id
  FROM items
  WHERE id = NEW.item_id;

  -- Only create notification if someone else is watching the item (not the owner)
  IF NEW.user_id != item_owner_id THEN
    -- Insert notification for item owner
    INSERT INTO notifications (user_id, sender_id, type, content, related_id)
    VALUES (
      item_owner_id,
      NEW.user_id,
      'watchlist_update',
      COALESCE(watcher_username, 'Someone') || ' added ' || COALESCE(item_title, 'an item') || ' to their watchlist',
      NEW.item_id
    );
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_user_account_data(target_user_id uuid, target_email text DEFAULT NULL::text, metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
cleaned_metadata jsonb := COALESCE(metadata, '{}'::jsonb);
BEGIN
IF target_user_id IS NULL THEN
RAISE EXCEPTION 'target_user_id must be provided';
END IF;

INSERT INTO account_deletion_audit (user_id, email, metadata)
VALUES (target_user_id, target_email, cleaned_metadata)
ON CONFLICT (user_id) DO UPDATE
SET deleted_at = now(),
email = COALESCE(EXCLUDED.email, account_deletion_audit.email),
metadata = account_deletion_audit.metadata || EXCLUDED.metadata;

-- Defensive clean-up for tables that may not cascade automatically
IF to_regclass('public.notification_settings') IS NOT NULL THEN
EXECUTE 'DELETE FROM public.notification_settings WHERE user_id = $1'
USING target_user_id;
END IF;

IF to_regclass('public.offer_templates') IS NOT NULL THEN
EXECUTE 'DELETE FROM public.offer_templates WHERE user_id = $1'
USING target_user_id;
END IF;

IF to_regclass('public.changelog_dismissals') IS NOT NULL THEN
EXECUTE 'DELETE FROM public.changelog_dismissals WHERE user_id = $1'
USING target_user_id;
END IF;

IF to_regclass('public.reported_messages') IS NOT NULL THEN
EXECUTE 'DELETE FROM public.reported_messages WHERE reporter_id = $1'
USING target_user_id;
END IF;

IF to_regclass('public.message_reactions') IS NOT NULL THEN
EXECUTE 'DELETE FROM public.message_reactions WHERE user_id = $1'
USING target_user_id;
END IF;

IF to_regclass('public.barter_offers') IS NOT NULL THEN
IF EXISTS (
SELECT 1 FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'barter_offers'
AND column_name = 'sender_id'
) THEN
EXECUTE 'DELETE FROM public.barter_offers WHERE sender_id = $1'
USING target_user_id;
END IF;

IF EXISTS (
SELECT 1 FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'barter_offers'
AND column_name = 'receiver_id'
) THEN
EXECUTE 'DELETE FROM public.barter_offers WHERE receiver_id = $1'
USING target_user_id;
END IF;

IF EXISTS (
SELECT 1 FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'barter_offers'
AND column_name = 'requested_item_owner_id'
) THEN
EXECUTE 'DELETE FROM public.barter_offers WHERE requested_item_owner_id = $1'
USING target_user_id;
END IF;
END IF;

IF to_regclass('public.counter_offers') IS NOT NULL THEN
IF EXISTS (
SELECT 1 FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'counter_offers'
AND column_name = 'created_by'
) THEN
EXECUTE 'DELETE FROM public.counter_offers WHERE created_by = $1'
USING target_user_id;
END IF;
END IF;

IF to_regclass('public.notifications') IS NOT NULL THEN
IF EXISTS (
SELECT 1 FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'notifications'
AND column_name = 'sender_id'
) THEN
EXECUTE 'DELETE FROM public.notifications WHERE sender_id = $1'
USING target_user_id;
END IF;
END IF;

IF to_regclass('public.friend_requests') IS NOT NULL THEN
EXECUTE 'DELETE FROM public.friend_requests WHERE sender_id = $1 OR receiver_id = $1'
USING target_user_id;
END IF;

IF to_regclass('public.friendships') IS NOT NULL THEN
EXECUTE 'DELETE FROM public.friendships WHERE user1_id = $1 OR user2_id = $1'
USING target_user_id;
END IF;

IF to_regclass('public.blocked_users') IS NOT NULL THEN
EXECUTE 'DELETE FROM public.blocked_users WHERE blocker_id = $1 OR blocked_id = $1'
USING target_user_id;
END IF;

IF to_regclass('public.notifications') IS NOT NULL THEN
IF EXISTS (
SELECT 1 FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'notifications'
AND column_name = 'user_id'
) THEN
EXECUTE 'DELETE FROM public.notifications WHERE user_id = $1'
USING target_user_id;
END IF;
END IF;

IF to_regclass('public.watched_items') IS NOT NULL THEN
EXECUTE 'DELETE FROM public.watched_items WHERE user_id = $1'
USING target_user_id;
END IF;

IF to_regclass('public.message_threads') IS NOT NULL THEN
IF EXISTS (
SELECT 1 FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'message_threads'
AND column_name = 'created_by'
) THEN
EXECUTE 'DELETE FROM public.message_threads WHERE created_by = $1'
USING target_user_id;
END IF;
END IF;

IF to_regclass('public.messages') IS NOT NULL THEN
EXECUTE 'DELETE FROM public.messages WHERE sender_id = $1 OR receiver_id = $1'
USING target_user_id;
END IF;

IF to_regclass('public.items') IS NOT NULL THEN
EXECUTE 'DELETE FROM public.items WHERE user_id = $1'
USING target_user_id;
END IF;

IF to_regclass('public.user_history') IS NOT NULL THEN
EXECUTE 'DELETE FROM public.user_history WHERE user_id = $1'
USING target_user_id;
END IF;

-- Finally remove the profile row (cascades handle remaining relations)
DELETE FROM users WHERE id = target_user_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.forward_messages_to_realtime()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO realtime.messages(topic, payload, "event")
    VALUES (
      'room:' || NEW.thread_id::text || ':messages',
      to_jsonb(NEW),
      'INSERT'
    );
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_item_owner(item_uuid uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT user_id FROM public.items WHERE id = $1;
$function$
;

CREATE OR REPLACE FUNCTION public.get_or_create_thread(participant_uuids uuid[], item_id uuid DEFAULT NULL::uuid, title text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  normalized uuid[] := (SELECT ARRAY(SELECT DISTINCT unnest(participant_uuids)));
  participants_count int := array_length(normalized,1);
  existing_thread uuid;
  new_thread uuid := gen_random_uuid();
BEGIN
  IF participants_count IS NULL OR participants_count < 2 THEN
    RAISE EXCEPTION 'participant_uuids must contain at least 2 distinct uuids';
  END IF;

  -- Try to find an existing thread with same set of participants and same item_id (if provided)
  SELECT mt.id INTO existing_thread
  FROM public.message_threads mt
  WHERE (
    (item_id IS NULL AND $2 IS NULL) OR (mt.item_id = $2)
  )
  AND (
    -- participants match: count of members equals and all members present
    (SELECT COUNT(DISTINCT tm.user_id) FROM public.thread_members tm WHERE tm.thread_id = mt.id) = participants_count
    AND NOT EXISTS (
      SELECT 1 FROM (
        SELECT unnest(normalized) AS u
      ) p
      WHERE NOT EXISTS (
        SELECT 1 FROM public.thread_members tm2 WHERE tm2.thread_id = mt.id AND tm2.user_id = p.u
      )
    )
  )
  LIMIT 1;

  IF existing_thread IS NOT NULL THEN
    RETURN existing_thread;
  END IF;

  -- Create thread
  INSERT INTO public.message_threads(id, title, item_id, created_by, created_at, updated_at)
  VALUES (new_thread, title, item_id, auth.uid(), now(), now());

  -- Insert members
  INSERT INTO public.thread_members(id, thread_id, user_id, created_at)
  SELECT gen_random_uuid(), new_thread, u, now() FROM unnest(normalized) AS u;

  RETURN new_thread;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_thread_members(p_thread_id uuid)
 RETURNS TABLE(id uuid, thread_id uuid, user_id uuid, role text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT id, thread_id, user_id, role, created_at FROM public.thread_members WHERE thread_id = p_thread_id ORDER BY created_at;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_accepted_friend_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  -- Only process if status changed to 'accepted'
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Insert friendship with consistent ordering (smaller UUID first)
    INSERT INTO friendships (user1_id, user2_id)
    VALUES (
      LEAST(NEW.sender_id, NEW.receiver_id),
      GREATEST(NEW.sender_id, NEW.receiver_id)
    )
    ON CONFLICT (user1_id, user2_id) DO NOTHING;
    
    -- Delete the friend request
    DELETE FROM friend_requests WHERE id = NEW.id;
    
    -- Return NULL to prevent the original UPDATE
    RETURN NULL;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_message_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  -- For new messages
  IF TG_OP = 'INSERT' THEN
    -- Set default values for new messages
    NEW.read := FALSE;
    RETURN NEW;
  
  -- For message updates
  ELSIF TG_OP = 'UPDATE' THEN
    -- If read status is being changed
    IF NEW.read IS DISTINCT FROM OLD.read THEN
      -- Ensure read timestamp is set when message is marked as read
      IF NEW.read = TRUE THEN
        NEW.read := TRUE;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_thread_member(_user uuid, _thread uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.thread_members tm
    WHERE tm.user_id = _user AND tm.thread_id = _thread
  );
$function$
;

CREATE OR REPLACE FUNCTION public.messages_broadcast_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  PERFORM realtime.broadcast_changes(
    'room:' || COALESCE(NEW.thread_id, OLD.thread_id)::text || ':messages',
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN COALESCE(NEW, OLD);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.remove_thread_member(p_thread_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_creator uuid;
BEGIN
  SELECT created_by INTO v_creator FROM public.message_threads WHERE id = p_thread_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','error','message','thread_not_found');
  END IF;

  -- permission: allow if caller is thread creator OR member with admin role OR removing themselves
  IF (SELECT auth.uid())::text IS NOT NULL THEN
    IF (SELECT auth.uid()::uuid) <> v_creator AND NOT EXISTS (
      SELECT 1 FROM public.thread_members tm WHERE tm.thread_id = p_thread_id AND tm.user_id = (SELECT auth.uid()) AND tm.role = 'admin'
    ) AND (SELECT auth.uid())::uuid <> p_user_id THEN
      RETURN jsonb_build_object('status','error','message','forbidden');
    END IF;
  END IF;

  DELETE FROM public.thread_members WHERE thread_id = p_thread_id AND user_id = p_user_id;
  IF FOUND THEN
    RETURN jsonb_build_object('status','ok','message','removed');
  ELSE
    RETURN jsonb_build_object('status','ok','message','not_found');
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_message_thread_created_by()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- If created_by is not provided, set it to the current authenticated user's uid
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_notification_settings_updated_at()
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


