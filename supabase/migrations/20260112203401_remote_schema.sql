

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgsodium";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."content_type" AS ENUM (
    'item_title',
    'item_description',
    'message'
);


ALTER TYPE "public"."content_type" OWNER TO "postgres";


CREATE TYPE "public"."filter_action" AS ENUM (
    'blocked',
    'warned',
    'allowed'
);


ALTER TYPE "public"."filter_action" OWNER TO "postgres";


CREATE TYPE "public"."filter_severity" AS ENUM (
    'warning',
    'block'
);


ALTER TYPE "public"."filter_severity" OWNER TO "postgres";


CREATE TYPE "public"."history_action_type" AS ENUM (
    'created',
    'edited',
    'deleted'
);


ALTER TYPE "public"."history_action_type" OWNER TO "postgres";


CREATE TYPE "public"."item_condition" AS ENUM (
    'new',
    'like-new',
    'good',
    'fair',
    'poor'
);


ALTER TYPE "public"."item_condition" OWNER TO "postgres";


CREATE TYPE "public"."item_status" AS ENUM (
    'available',
    'pending',
    'traded',
    'claimed'
);


ALTER TYPE "public"."item_status" OWNER TO "postgres";


CREATE TYPE "public"."listing_type" AS ENUM (
    'free',
    'barter'
);


ALTER TYPE "public"."listing_type" OWNER TO "postgres";


CREATE TYPE "public"."moderation_action_type" AS ENUM (
    'remove_content',
    'ban_user',
    'dismiss_report',
    'warn_user'
);


ALTER TYPE "public"."moderation_action_type" OWNER TO "postgres";


CREATE TYPE "public"."notification_type" AS ENUM (
    'friend_request',
    'friend_request_approved',
    'new_listing',
    'direct_message',
    'watchlist_update',
    'system_alerts'
);


ALTER TYPE "public"."notification_type" OWNER TO "postgres";


CREATE TYPE "public"."pattern_type" AS ENUM (
    'exact',
    'contains',
    'regex'
);


ALTER TYPE "public"."pattern_type" OWNER TO "postgres";


CREATE TYPE "public"."report_status" AS ENUM (
    'pending',
    'in_review',
    'resolved',
    'dismissed'
);


ALTER TYPE "public"."report_status" OWNER TO "postgres";


CREATE TYPE "public"."report_target_type" AS ENUM (
    'user',
    'item',
    'message',
    'comment',
    'other'
);


ALTER TYPE "public"."report_target_type" OWNER TO "postgres";


CREATE TYPE "public"."user_gender" AS ENUM (
    'male',
    'female'
);


ALTER TYPE "public"."user_gender" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_thread_member"("p_thread_id" "uuid", "p_user_id" "uuid", "p_role" "text" DEFAULT 'member'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."add_thread_member"("p_thread_id" "uuid", "p_user_id" "uuid", "p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ban_user"("user_id_to_ban" "uuid", "ban_reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
BEGIN
  -- Update users table
  UPDATE users
  SET banned = true
  WHERE id = user_id_to_ban;

  -- Log the action (if called from edge function, moderation_actions will be inserted separately)
END;
$$;


ALTER FUNCTION "public"."ban_user"("user_id_to_ban" "uuid", "ban_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_friend_request_pair"("p_sender" "uuid", "p_receiver" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."cleanup_friend_request_pair"("p_sender" "uuid", "p_receiver" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_notification_on_direct_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  sender_username text;
  message_preview text;
BEGIN
  -- Only process direct messages (item_id is null)
  IF NEW.item_id IS NULL THEN
    -- Get sender's username from PUBLIC.users
    SELECT username INTO sender_username
    FROM public.users
    WHERE id = NEW.sender_id;

    -- Create message preview (max 50 chars)
    message_preview := CASE 
      WHEN length(NEW.content) > 50 THEN substring(NEW.content from 1 for 47) || '...'
      ELSE NEW.content
    END;

    -- Insert notification
    INSERT INTO public.notifications (user_id, sender_id, type, content, related_id)
    VALUES (
      NEW.receiver_id,
      NEW.sender_id,
      'direct_message',
      coalesce(sender_username, 'Someone') || ': ' || message_preview,
      NEW.id
    );

    -- Trigger Pusher (keep existing logic)
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/pusher-trigger',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key'),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'channel', 'private-user-' || NEW.receiver_id,
        'event', 'new-notification',
        'data', jsonb_build_object(
          'type', 'direct_message',
          'content', coalesce(sender_username, 'Someone') || ': ' || message_preview
        )
      )
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_notification_on_direct_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_notification_on_friend_request"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  sender_username text;
BEGIN
  SELECT username INTO sender_username
  FROM public.users
  WHERE id = NEW.sender_id;

  INSERT INTO public.notifications (user_id, sender_id, type, content, related_id)
  VALUES (
    NEW.receiver_id,
    NEW.sender_id,
    'friend_request',
    coalesce(sender_username, 'Someone') || ' has requested to follow you',
    NEW.id
  );
  
  -- (Trigger Pusher logic omitted for brevity, assuming standard implementation)
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_notification_on_friend_request"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_notification_on_friend_request_accepted"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  receiver_username text;
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    SELECT username INTO receiver_username
    FROM public.users
    WHERE id = NEW.receiver_id;

    INSERT INTO public.notifications (user_id, sender_id, type, content, related_id)
    VALUES (
      NEW.sender_id,
      NEW.receiver_id,
      'friend_request_approved',
      coalesce(receiver_username, 'Someone') || ' has approved your friend request',
      NEW.receiver_id
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_notification_on_friend_request_accepted"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_notification_on_new_listing_from_friend"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
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
$$;


ALTER FUNCTION "public"."create_notification_on_new_listing_from_friend"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_notification_on_watchlist_add"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
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
$$;


ALTER FUNCTION "public"."create_notification_on_watchlist_add"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decline_friend_request_secure"("p_request_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."decline_friend_request_secure"("p_request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_user_account_data"("target_user_id" "uuid", "target_email" "text" DEFAULT NULL::"text", "metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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

DELETE FROM users WHERE id = target_user_id;
END;
$_$;


ALTER FUNCTION "public"."delete_user_account_data"("target_user_id" "uuid", "target_email" "text", "metadata" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."delete_user_account_data"("target_user_id" "uuid", "target_email" "text", "metadata" "jsonb") IS 'Purges relational data for the specified user and logs the deletion prior to removing the auth user.';



CREATE OR REPLACE FUNCTION "public"."expire_offers"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
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
$$;


ALTER FUNCTION "public"."expire_offers"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forward_messages_to_realtime"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."forward_messages_to_realtime"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_item_owner"("item_uuid" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $_$
  SELECT user_id FROM public.items WHERE id = $1;
$_$;


ALTER FUNCTION "public"."get_item_owner"("item_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_thread"("participant_uuids" "uuid"[], "item_id" "uuid" DEFAULT NULL::"uuid", "title" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
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
$_$;


ALTER FUNCTION "public"."get_or_create_thread"("participant_uuids" "uuid"[], "item_id" "uuid", "title" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_thread_members"("p_thread_id" "uuid") RETURNS TABLE("id" "uuid", "thread_id" "uuid", "user_id" "uuid", "role" "text", "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE
    AS $$
  SELECT id, thread_id, user_id, role, created_at FROM public.thread_members WHERE thread_id = p_thread_id ORDER BY created_at;
$$;


ALTER FUNCTION "public"."get_thread_members"("p_thread_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_accepted_friend_request"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
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
$$;


ALTER FUNCTION "public"."handle_accepted_friend_request"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_message_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
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
$$;


ALTER FUNCTION "public"."handle_message_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_user_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.users
  SET 
    username = new.raw_user_meta_data->>'username',
    avatar_url = new.raw_user_meta_data->>'avatar_url'
  WHERE id = new.id;
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_user_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_thread_member"("_user" "uuid", "_thread" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.thread_members tm
    WHERE tm.user_id = _user AND tm.thread_id = _thread
  );
$$;


ALTER FUNCTION "public"."is_thread_member"("_user" "uuid", "_thread" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."messages_broadcast_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."messages_broadcast_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_thread_member"("p_thread_id" "uuid", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."remove_thread_member"("p_thread_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reports_set_deadline"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
BEGIN
  IF NEW.needs_action_by IS NULL THEN
    NEW.needs_action_by := now() + interval '24 hours';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."reports_set_deadline"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reports_set_first_response"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
BEGIN
  IF NEW.first_response_at IS NULL
     AND OLD.status = 'pending'
     AND NEW.status <> 'pending' THEN
    NEW.first_response_at := now();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."reports_set_first_response"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_push_for_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."send_push_for_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_message_thread_created_by"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- If created_by is not provided, set it to the current authenticated user's uid
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_message_thread_created_by"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_item_creation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
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
$$;


ALTER FUNCTION "public"."track_item_creation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_item_deletion"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
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
$$;


ALTER FUNCTION "public"."track_item_deletion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_item_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
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
$$;


ALTER FUNCTION "public"."track_item_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unban_user"("user_id_to_unban" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
BEGIN
  UPDATE users
  SET banned = false
  WHERE id = user_id_to_unban;
END;
$$;


ALTER FUNCTION "public"."unban_user"("user_id_to_unban" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_blocked_keywords_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_blocked_keywords_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_message_read_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
BEGIN
  -- Only update read_at if read is being set to true and read_at is null
  IF NEW.read = true AND OLD.read = false AND NEW.read_at IS NULL THEN
    NEW.read_at = now();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_message_read_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_notification_settings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_notification_settings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_template_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_template_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_thread_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
BEGIN
  IF NEW.thread_id IS NOT NULL THEN
    UPDATE message_threads 
    SET updated_at = now() 
    WHERE id = NEW.thread_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_thread_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."account_deletion_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email" "text",
    "deleted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."account_deletion_audit" OWNER TO "postgres";


COMMENT ON TABLE "public"."account_deletion_audit" IS 'Stores a record for each user account deletion, including optional metadata for compliance.';



CREATE TABLE IF NOT EXISTS "public"."barter_offers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "receiver_id" "uuid" NOT NULL,
    "offered_item_id" "uuid" NOT NULL,
    "requested_item_id" "uuid" NOT NULL,
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "expiration_date" timestamp with time zone,
    "template_id" "uuid",
    "parent_offer_id" "uuid",
    CONSTRAINT "barter_offers_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."barter_offers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blocked_keywords" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "keyword" "text" NOT NULL,
    "pattern_type" "public"."pattern_type" DEFAULT 'contains'::"public"."pattern_type" NOT NULL,
    "severity" "public"."filter_severity" DEFAULT 'block'::"public"."filter_severity" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."blocked_keywords" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blocked_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "blocker_id" "uuid" NOT NULL,
    "blocked_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."blocked_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."changelog_dismissals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "changelog_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."changelog_dismissals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."changelogs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_upcoming" boolean DEFAULT false
);


ALTER TABLE "public"."changelogs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_filter_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "content_type" "public"."content_type" NOT NULL,
    "content_id" "uuid",
    "matched_keyword_id" "uuid",
    "action_taken" "public"."filter_action" NOT NULL,
    "content_preview" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."content_filter_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."counter_offers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "original_offer_id" "uuid" NOT NULL,
    "counter_offer_id" "uuid" NOT NULL,
    "message" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "counter_offers_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."counter_offers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."friend_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "receiver_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "friend_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text"])))
);


ALTER TABLE "public"."friend_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."friendships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user1_id" "uuid" NOT NULL,
    "user2_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "check_user_order" CHECK (("user1_id" < "user2_id"))
);


ALTER TABLE "public"."friendships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "images" "text"[] NOT NULL,
    "condition" "public"."item_condition" NOT NULL,
    "category" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "location" "text" NOT NULL,
    "status" "public"."item_status" DEFAULT 'available'::"public"."item_status",
    "latitude" double precision,
    "longitude" double precision,
    "type" "public"."listing_type" DEFAULT 'free'::"public"."listing_type" NOT NULL,
    CONSTRAINT "valid_latitude" CHECK ((("latitude" IS NULL) OR (("latitude" >= ('-90'::integer)::double precision) AND ("latitude" <= (90)::double precision)))),
    CONSTRAINT "valid_longitude" CHECK ((("longitude" IS NULL) OR (("longitude" >= ('-180'::integer)::double precision) AND ("longitude" <= (180)::double precision))))
);


ALTER TABLE "public"."items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_type" "text" NOT NULL,
    "file_size" bigint,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."message_files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "emoji" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."message_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "item_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."message_threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "receiver_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "item_id" "uuid",
    "offer_item_id" "uuid",
    "read" boolean DEFAULT false,
    "is_offer" boolean DEFAULT false,
    "archived" boolean DEFAULT false,
    "image_url" "text",
    "read_at" timestamp with time zone,
    "file_url" "text",
    "thread_id" "uuid",
    "topic" "text" DEFAULT 'direct'::"text" NOT NULL,
    CONSTRAINT "check_direct_message_structure" CHECK ((("item_id" IS NOT NULL) OR (("item_id" IS NULL) AND ("offer_item_id" IS NULL) AND ("is_offer" = false))))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


COMMENT ON COLUMN "public"."messages"."image_url" IS 'URL of image attachment in message, stored in Supabase storage';



CREATE TABLE IF NOT EXISTS "public"."moderation_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "moderator_id" "uuid" NOT NULL,
    "report_id" "uuid",
    "action_type" "public"."moderation_action_type" NOT NULL,
    "target_type" "public"."report_target_type" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."moderation_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."moderation_policies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "version" integer NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "published_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "require_reaccept_after" timestamp with time zone
);


ALTER TABLE "public"."moderation_policies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."newsletter_subscribers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "unsubscribe_token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unsubscribed_at" timestamp with time zone,
    "is_unsubscribed" boolean GENERATED ALWAYS AS (("unsubscribed_at" IS NOT NULL)) STORED
);


ALTER TABLE "public"."newsletter_subscribers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "enabled" boolean DEFAULT true,
    "delivery_methods" "jsonb" DEFAULT '{"push": true, "email": true, "in_app": true}'::"jsonb",
    "frequency" "text" DEFAULT 'real-time'::"text",
    "quiet_hours" "jsonb" DEFAULT '{"enabled": false, "end_time": "08:00", "timezone": "UTC", "start_time": "22:00"}'::"jsonb",
    "categories" "jsonb" DEFAULT '{"activity": {"sound": false, "banner": true, "enabled": true, "priority": "normal"}, "messages": {"sound": true, "banner": true, "enabled": true, "priority": "normal"}, "security": {"sound": true, "banner": true, "enabled": true, "priority": "urgent"}, "marketing": {"sound": false, "banner": false, "enabled": false, "priority": "low"}, "system_alerts": {"sound": true, "banner": true, "enabled": true, "priority": "urgent"}}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "notification_settings_frequency_check" CHECK (("frequency" = ANY (ARRAY['real-time'::"text", 'daily'::"text", 'weekly'::"text"])))
);


ALTER TABLE "public"."notification_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "sender_id" "uuid",
    "type" "public"."notification_type" NOT NULL,
    "content" "text" NOT NULL,
    "related_id" "uuid",
    "read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."offer_expirations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "offer_id" "uuid" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."offer_expirations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."offer_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."offer_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_settings" (
    "id" "text" DEFAULT 'singleton'::"text" NOT NULL,
    "functions_endpoint" "text" NOT NULL,
    "service_role_key" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."push_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reported_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."reported_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "target_type" "public"."report_target_type" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text",
    "status" "public"."report_status" DEFAULT 'pending'::"public"."report_status" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    "resolution_notes" "text",
    "needs_action_by" timestamp with time zone,
    "first_response_at" timestamp with time zone,
    "auto_escalated" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."thread_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."thread_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "action_type" "public"."history_action_type" NOT NULL,
    "item_id" "uuid",
    "item_title" "text" NOT NULL,
    "item_description" "text",
    "item_images" "text"[],
    "item_category" "text",
    "item_condition" "public"."item_condition",
    "item_type" "public"."listing_type",
    "changes" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_policy_acceptances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "policy_id" "uuid" NOT NULL,
    "platform" "text" DEFAULT 'web'::"text",
    "accepted_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_policy_acceptances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_push_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "push_token" "text" NOT NULL,
    "platform" "text" DEFAULT 'unknown'::"text",
    "app_version" "text",
    "last_seen_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "disabled" boolean DEFAULT false,
    CONSTRAINT "user_push_tokens_platform_check" CHECK (("platform" = ANY (ARRAY['ios'::"text", 'android'::"text", 'web'::"text", 'unknown'::"text"])))
);


ALTER TABLE "public"."user_push_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "location" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "gender" "public"."user_gender",
    "username" "text",
    "zipcode" "text",
    "profile_completed" boolean DEFAULT false,
    "rating" numeric(3,2),
    "banned" boolean DEFAULT false NOT NULL,
    CONSTRAINT "valid_rating" CHECK ((("rating" IS NULL) OR (("rating" >= (0)::numeric) AND ("rating" <= (5)::numeric)))),
    CONSTRAINT "valid_zipcode" CHECK (("zipcode" ~ '^\d{5}$'::"text"))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."watched_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."watched_items" OWNER TO "postgres";


ALTER TABLE ONLY "public"."account_deletion_audit"
    ADD CONSTRAINT "account_deletion_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."barter_offers"
    ADD CONSTRAINT "barter_offers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blocked_keywords"
    ADD CONSTRAINT "blocked_keywords_keyword_key" UNIQUE ("keyword");



ALTER TABLE ONLY "public"."blocked_keywords"
    ADD CONSTRAINT "blocked_keywords_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blocked_users"
    ADD CONSTRAINT "blocked_users_blocker_id_blocked_id_key" UNIQUE ("blocker_id", "blocked_id");



ALTER TABLE ONLY "public"."blocked_users"
    ADD CONSTRAINT "blocked_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."changelog_dismissals"
    ADD CONSTRAINT "changelog_dismissals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."changelog_dismissals"
    ADD CONSTRAINT "changelog_dismissals_user_id_changelog_id_key" UNIQUE ("user_id", "changelog_id");



ALTER TABLE ONLY "public"."changelogs"
    ADD CONSTRAINT "changelogs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_filter_logs"
    ADD CONSTRAINT "content_filter_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."counter_offers"
    ADD CONSTRAINT "counter_offers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."friend_requests"
    ADD CONSTRAINT "friend_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_files"
    ADD CONSTRAINT "message_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_reactions"
    ADD CONSTRAINT "message_reactions_message_id_user_id_emoji_key" UNIQUE ("message_id", "user_id", "emoji");



ALTER TABLE ONLY "public"."message_reactions"
    ADD CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_threads"
    ADD CONSTRAINT "message_threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."moderation_actions"
    ADD CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."moderation_policies"
    ADD CONSTRAINT "moderation_policies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."moderation_policies"
    ADD CONSTRAINT "moderation_policies_version_key" UNIQUE ("version");



ALTER TABLE ONLY "public"."newsletter_subscribers"
    ADD CONSTRAINT "newsletter_subscribers_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."newsletter_subscribers"
    ADD CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_settings"
    ADD CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."offer_expirations"
    ADD CONSTRAINT "offer_expirations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."offer_templates"
    ADD CONSTRAINT "offer_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_settings"
    ADD CONSTRAINT "push_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reported_messages"
    ADD CONSTRAINT "reported_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."thread_members"
    ADD CONSTRAINT "thread_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."thread_members"
    ADD CONSTRAINT "thread_members_thread_id_user_id_key" UNIQUE ("thread_id", "user_id");



ALTER TABLE ONLY "public"."friend_requests"
    ADD CONSTRAINT "unique_friend_request" UNIQUE ("sender_id", "receiver_id");



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "unique_friendship" UNIQUE ("user1_id", "user2_id");



ALTER TABLE ONLY "public"."user_history"
    ADD CONSTRAINT "user_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_policy_acceptances"
    ADD CONSTRAINT "user_policy_acceptances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_push_tokens"
    ADD CONSTRAINT "user_push_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."watched_items"
    ADD CONSTRAINT "watched_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."watched_items"
    ADD CONSTRAINT "watched_items_user_id_item_id_key" UNIQUE ("user_id", "item_id");



CREATE UNIQUE INDEX "account_deletion_audit_user_id_key" ON "public"."account_deletion_audit" USING "btree" ("user_id");



CREATE INDEX "blocked_keywords_enabled_idx" ON "public"."blocked_keywords" USING "btree" ("enabled", "severity");



CREATE INDEX "blocked_users_blocked_id_idx" ON "public"."blocked_users" USING "btree" ("blocked_id");



CREATE INDEX "blocked_users_blocker_id_idx" ON "public"."blocked_users" USING "btree" ("blocker_id");



CREATE INDEX "changelog_dismissals_user_id_idx" ON "public"."changelog_dismissals" USING "btree" ("user_id");



CREATE INDEX "friend_requests_receiver_id_idx" ON "public"."friend_requests" USING "btree" ("receiver_id");



CREATE INDEX "friend_requests_sender_id_idx" ON "public"."friend_requests" USING "btree" ("sender_id");



CREATE INDEX "friendships_user1_id_idx" ON "public"."friendships" USING "btree" ("user1_id");



CREATE INDEX "friendships_user2_id_idx" ON "public"."friendships" USING "btree" ("user2_id");



CREATE INDEX "idx_barter_offers_offered_item_id" ON "public"."barter_offers" USING "btree" ("offered_item_id");



CREATE INDEX "idx_barter_offers_requested_item_id" ON "public"."barter_offers" USING "btree" ("requested_item_id");



CREATE INDEX "idx_barter_offers_status" ON "public"."barter_offers" USING "btree" ("status");



CREATE INDEX "idx_content_filter_logs_matched_keyword_id" ON "public"."content_filter_logs" USING "btree" ("matched_keyword_id");



CREATE INDEX "idx_message_threads_created_by" ON "public"."message_threads" USING "btree" ("created_by");



CREATE INDEX "idx_messages_read_status" ON "public"."messages" USING "btree" ("receiver_id", "read") WHERE ("read" = false);



CREATE INDEX "idx_thread_members_thread_user" ON "public"."thread_members" USING "btree" ("thread_id", "user_id");



CREATE INDEX "idx_user_history_item_id" ON "public"."user_history" USING "btree" ("item_id");



CREATE INDEX "idx_user_policy_acceptances_policy_id" ON "public"."user_policy_acceptances" USING "btree" ("policy_id");



CREATE INDEX "items_latitude_idx" ON "public"."items" USING "btree" ("latitude");



CREATE INDEX "items_longitude_idx" ON "public"."items" USING "btree" ("longitude");



CREATE INDEX "items_user_id_idx" ON "public"."items" USING "btree" ("user_id");



CREATE INDEX "message_reactions_message_id_idx" ON "public"."message_reactions" USING "btree" ("message_id");



CREATE INDEX "message_reactions_user_id_idx" ON "public"."message_reactions" USING "btree" ("user_id");



CREATE INDEX "message_threads_created_by_idx" ON "public"."message_threads" USING "btree" ("created_by");



CREATE INDEX "message_threads_is_active_idx" ON "public"."message_threads" USING "btree" ("is_active");



CREATE INDEX "message_threads_item_id_idx" ON "public"."message_threads" USING "btree" ("item_id");



CREATE INDEX "messages_item_id_idx" ON "public"."messages" USING "btree" ("item_id");



CREATE INDEX "messages_offer_item_id_idx" ON "public"."messages" USING "btree" ("offer_item_id");



CREATE INDEX "messages_read_idx" ON "public"."messages" USING "btree" ("read");



CREATE INDEX "messages_receiver_id_idx" ON "public"."messages" USING "btree" ("receiver_id");



CREATE INDEX "messages_sender_id_idx" ON "public"."messages" USING "btree" ("sender_id");



CREATE INDEX "messages_thread_id_idx" ON "public"."messages" USING "btree" ("thread_id");



CREATE UNIQUE INDEX "newsletter_subscribers_unsubscribe_token_idx" ON "public"."newsletter_subscribers" USING "btree" ("unsubscribe_token");



CREATE UNIQUE INDEX "notification_settings_user_id_key" ON "public"."notification_settings" USING "btree" ("user_id");



CREATE INDEX "notifications_user_id_idx" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "notifications_user_unread_idx" ON "public"."notifications" USING "btree" ("user_id", "read") WHERE ("read" = false);



CREATE INDEX "offer_templates_user_id_idx" ON "public"."offer_templates" USING "btree" ("user_id");



CREATE INDEX "reported_messages_reporter_id_idx" ON "public"."reported_messages" USING "btree" ("reporter_id");



CREATE INDEX "user_history_user_action_idx" ON "public"."user_history" USING "btree" ("user_id", "action_type");



CREATE UNIQUE INDEX "user_policy_unique" ON "public"."user_policy_acceptances" USING "btree" ("user_id", "policy_id");



CREATE UNIQUE INDEX "user_push_tokens_token_key" ON "public"."user_push_tokens" USING "btree" ("push_token");



CREATE INDEX "user_push_tokens_user_id_idx" ON "public"."user_push_tokens" USING "btree" ("user_id");



CREATE UNIQUE INDEX "user_push_tokens_user_token_key" ON "public"."user_push_tokens" USING "btree" ("user_id", "push_token");



CREATE INDEX "watched_items_item_id_idx" ON "public"."watched_items" USING "btree" ("item_id");



CREATE INDEX "watched_items_user_id_idx" ON "public"."watched_items" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "direct_message_notification_trigger" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."create_notification_on_direct_message"();



CREATE OR REPLACE TRIGGER "forward_messages_to_realtime_trigger" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."forward_messages_to_realtime"();



CREATE OR REPLACE TRIGGER "friend_request_accepted_notification_trigger" AFTER UPDATE ON "public"."friend_requests" FOR EACH ROW EXECUTE FUNCTION "public"."create_notification_on_friend_request_accepted"();



CREATE OR REPLACE TRIGGER "friend_request_accepted_trigger" AFTER UPDATE ON "public"."friend_requests" FOR EACH ROW EXECUTE FUNCTION "public"."handle_accepted_friend_request"();



CREATE OR REPLACE TRIGGER "friend_request_notification_trigger" AFTER INSERT ON "public"."friend_requests" FOR EACH ROW EXECUTE FUNCTION "public"."create_notification_on_friend_request"();



CREATE OR REPLACE TRIGGER "message_status_trigger" BEFORE INSERT OR UPDATE ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."handle_message_status"();



CREATE OR REPLACE TRIGGER "messages_broadcast_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."messages_broadcast_trigger"();



CREATE OR REPLACE TRIGGER "new_listing_notification_trigger" AFTER INSERT ON "public"."items" FOR EACH ROW EXECUTE FUNCTION "public"."create_notification_on_new_listing_from_friend"();



CREATE OR REPLACE TRIGGER "set_message_thread_created_by_trg" BEFORE INSERT ON "public"."message_threads" FOR EACH ROW EXECUTE FUNCTION "public"."set_message_thread_created_by"();



CREATE OR REPLACE TRIGGER "track_item_creation_trigger" AFTER INSERT ON "public"."items" FOR EACH ROW EXECUTE FUNCTION "public"."track_item_creation"();



CREATE OR REPLACE TRIGGER "track_item_deletion_trigger" BEFORE DELETE ON "public"."items" FOR EACH ROW EXECUTE FUNCTION "public"."track_item_deletion"();



CREATE OR REPLACE TRIGGER "track_item_update_trigger" AFTER UPDATE ON "public"."items" FOR EACH ROW EXECUTE FUNCTION "public"."track_item_update"();



CREATE OR REPLACE TRIGGER "trg_reports_first_response" BEFORE UPDATE ON "public"."reports" FOR EACH ROW EXECUTE FUNCTION "public"."reports_set_first_response"();



CREATE OR REPLACE TRIGGER "trg_reports_set_deadline" BEFORE INSERT ON "public"."reports" FOR EACH ROW EXECUTE FUNCTION "public"."reports_set_deadline"();



CREATE OR REPLACE TRIGGER "trg_send_push_on_notifications" AFTER INSERT ON "public"."notifications" FOR EACH ROW EXECUTE FUNCTION "public"."send_push_for_notification"();



CREATE OR REPLACE TRIGGER "trigger_update_message_read_at" BEFORE UPDATE ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_message_read_at"();



CREATE OR REPLACE TRIGGER "trigger_update_template_updated_at" BEFORE UPDATE ON "public"."offer_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_template_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_thread_updated_at" AFTER INSERT OR UPDATE ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_thread_updated_at"();



CREATE OR REPLACE TRIGGER "update_blocked_keywords_updated_at_trigger" BEFORE UPDATE ON "public"."blocked_keywords" FOR EACH ROW EXECUTE FUNCTION "public"."update_blocked_keywords_updated_at"();



CREATE OR REPLACE TRIGGER "update_notification_settings_updated_at" BEFORE UPDATE ON "public"."notification_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_notification_settings_updated_at"();



CREATE OR REPLACE TRIGGER "watchlist_notification_trigger" AFTER INSERT ON "public"."watched_items" FOR EACH ROW EXECUTE FUNCTION "public"."create_notification_on_watchlist_add"();



ALTER TABLE ONLY "public"."barter_offers"
    ADD CONSTRAINT "barter_offers_offered_item_id_fkey" FOREIGN KEY ("offered_item_id") REFERENCES "public"."items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."barter_offers"
    ADD CONSTRAINT "barter_offers_parent_offer_id_fkey" FOREIGN KEY ("parent_offer_id") REFERENCES "public"."barter_offers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."barter_offers"
    ADD CONSTRAINT "barter_offers_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."barter_offers"
    ADD CONSTRAINT "barter_offers_requested_item_id_fkey" FOREIGN KEY ("requested_item_id") REFERENCES "public"."items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."barter_offers"
    ADD CONSTRAINT "barter_offers_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blocked_users"
    ADD CONSTRAINT "blocked_users_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blocked_users"
    ADD CONSTRAINT "blocked_users_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."changelog_dismissals"
    ADD CONSTRAINT "changelog_dismissals_changelog_id_fkey" FOREIGN KEY ("changelog_id") REFERENCES "public"."changelogs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."changelog_dismissals"
    ADD CONSTRAINT "changelog_dismissals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_filter_logs"
    ADD CONSTRAINT "content_filter_logs_matched_keyword_id_fkey" FOREIGN KEY ("matched_keyword_id") REFERENCES "public"."blocked_keywords"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_filter_logs"
    ADD CONSTRAINT "content_filter_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."counter_offers"
    ADD CONSTRAINT "counter_offers_counter_offer_id_fkey" FOREIGN KEY ("counter_offer_id") REFERENCES "public"."barter_offers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."counter_offers"
    ADD CONSTRAINT "counter_offers_original_offer_id_fkey" FOREIGN KEY ("original_offer_id") REFERENCES "public"."barter_offers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "fk_messages_thread_id" FOREIGN KEY ("thread_id") REFERENCES "public"."message_threads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."friend_requests"
    ADD CONSTRAINT "friend_requests_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friend_requests"
    ADD CONSTRAINT "friend_requests_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_user1_id_fkey" FOREIGN KEY ("user1_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_user2_id_fkey" FOREIGN KEY ("user2_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_files"
    ADD CONSTRAINT "message_files_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_reactions"
    ADD CONSTRAINT "message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_reactions"
    ADD CONSTRAINT "message_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_threads"
    ADD CONSTRAINT "message_threads_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_threads"
    ADD CONSTRAINT "message_threads_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_offer_item_id_fkey" FOREIGN KEY ("offer_item_id") REFERENCES "public"."items"("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



COMMENT ON CONSTRAINT "messages_sender_id_fkey" ON "public"."messages" IS 'Links message sender to public profile';



ALTER TABLE ONLY "public"."moderation_actions"
    ADD CONSTRAINT "moderation_actions_moderator_id_fkey" FOREIGN KEY ("moderator_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."moderation_actions"
    ADD CONSTRAINT "moderation_actions_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notification_settings"
    ADD CONSTRAINT "notification_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offer_expirations"
    ADD CONSTRAINT "offer_expirations_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "public"."barter_offers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offer_templates"
    ADD CONSTRAINT "offer_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reported_messages"
    ADD CONSTRAINT "reported_messages_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reported_messages"
    ADD CONSTRAINT "reported_messages_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."user_history"
    ADD CONSTRAINT "user_history_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_history"
    ADD CONSTRAINT "user_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_policy_acceptances"
    ADD CONSTRAINT "user_policy_acceptances_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "public"."moderation_policies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_policy_acceptances"
    ADD CONSTRAINT "user_policy_acceptances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_push_tokens"
    ADD CONSTRAINT "user_push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."watched_items"
    ADD CONSTRAINT "watched_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."watched_items"
    ADD CONSTRAINT "watched_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Anyone can subscribe to newsletter" ON "public"."newsletter_subscribers" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can view changelogs" ON "public"."changelogs" FOR SELECT USING (true);



CREATE POLICY "Anyone can view items" ON "public"."items" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can view enabled keywords" ON "public"."blocked_keywords" FOR SELECT TO "authenticated" USING (("enabled" = true));



CREATE POLICY "Moderators can update reports" ON "public"."reports" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."moderation_actions"
  WHERE ("moderation_actions"."moderator_id" = ( SELECT "auth"."uid"() AS "uid"))
 LIMIT 1))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."moderation_actions"
  WHERE ("moderation_actions"."moderator_id" = ( SELECT "auth"."uid"() AS "uid"))
 LIMIT 1)));



CREATE POLICY "Moderators can view all filter logs" ON "public"."content_filter_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."moderation_actions"
  WHERE ("moderation_actions"."moderator_id" = ( SELECT "auth"."uid"() AS "uid"))
 LIMIT 1)));



CREATE POLICY "Moderators can view all moderation actions" ON "public"."moderation_actions" FOR SELECT TO "authenticated" USING (("moderator_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Moderators can view reports" ON "public"."reports" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."moderation_actions"
  WHERE ("moderation_actions"."moderator_id" = ( SELECT "auth"."uid"() AS "uid"))
 LIMIT 1)));



CREATE POLICY "Policies viewable by anyone" ON "public"."moderation_policies" FOR SELECT USING (true);



CREATE POLICY "Reporters can view their reports" ON "public"."reports" FOR SELECT TO "authenticated" USING (("reporter_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Service role can read push settings" ON "public"."push_settings" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "System can insert friendships" ON "public"."friendships" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "System can insert history records" ON "public"."user_history" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "System can insert notifications" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can add files to their messages" ON "public"."message_files" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."messages"
  WHERE (("messages"."id" = "message_files"."message_id") AND ("messages"."sender_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can add reactions to messages they can see" ON "public"."message_reactions" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."messages"
  WHERE (("messages"."id" = "message_reactions"."message_id") AND (("messages"."sender_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("messages"."receiver_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "Users can add watched items" ON "public"."watched_items" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can create blocks" ON "public"."blocked_users" FOR INSERT TO "authenticated" WITH CHECK (("blocker_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can create counter offers" ON "public"."counter_offers" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."barter_offers"
  WHERE (("barter_offers"."id" = "counter_offers"."counter_offer_id") AND ("barter_offers"."sender_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can create dismissals" ON "public"."changelog_dismissals" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can create expirations for their offers" ON "public"."offer_expirations" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."barter_offers"
  WHERE (("barter_offers"."id" = "offer_expirations"."offer_id") AND ("barter_offers"."sender_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can create items" ON "public"."items" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can create message reports" ON "public"."reported_messages" FOR INSERT TO "authenticated" WITH CHECK (("reporter_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can create offers" ON "public"."barter_offers" FOR INSERT TO "authenticated" WITH CHECK (("sender_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can create reports" ON "public"."reports" FOR INSERT TO "authenticated" WITH CHECK (("reporter_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can create their own templates" ON "public"."offer_templates" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can delete files from their messages" ON "public"."message_files" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."messages"
  WHERE (("messages"."id" = "message_files"."message_id") AND ("messages"."sender_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can delete own items" ON "public"."items" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can delete their friendships" ON "public"."friendships" FOR DELETE TO "authenticated" USING ((("user1_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("user2_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Users can delete their own notification settings" ON "public"."notification_settings" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can delete their own pending requests" ON "public"."friend_requests" FOR DELETE TO "authenticated" USING (("sender_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can delete their own push tokens" ON "public"."user_push_tokens" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own templates" ON "public"."offer_templates" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can insert their own notification settings" ON "public"."notification_settings" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can insert their own push tokens" ON "public"."user_push_tokens" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read their own push tokens" ON "public"."user_push_tokens" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can remove blocks" ON "public"."blocked_users" FOR DELETE TO "authenticated" USING (("blocker_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can remove their own reactions" ON "public"."message_reactions" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can remove watched items" ON "public"."watched_items" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can send friend requests" ON "public"."friend_requests" FOR INSERT TO "authenticated" WITH CHECK (("sender_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can send messages" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK (("sender_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update counter offers they created" ON "public"."counter_offers" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."barter_offers"
  WHERE (("barter_offers"."id" = "counter_offers"."counter_offer_id") AND ("barter_offers"."sender_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."barter_offers"
  WHERE (("barter_offers"."id" = "counter_offers"."counter_offer_id") AND ("barter_offers"."sender_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can update expirations for their offers" ON "public"."offer_expirations" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."barter_offers"
  WHERE (("barter_offers"."id" = "offer_expirations"."offer_id") AND ("barter_offers"."sender_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."barter_offers"
  WHERE (("barter_offers"."id" = "offer_expirations"."offer_id") AND ("barter_offers"."sender_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can update own items" ON "public"."items" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update own profile" ON "public"."users" FOR UPDATE TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update read status of received messages" ON "public"."messages" FOR UPDATE TO "authenticated" USING (("receiver_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("receiver_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update received requests" ON "public"."friend_requests" FOR UPDATE TO "authenticated" USING (("receiver_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("receiver_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update their offers" ON "public"."barter_offers" FOR UPDATE TO "authenticated" USING (("sender_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("sender_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update their own notification settings" ON "public"."notification_settings" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update their own notifications" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own push tokens" ON "public"."user_push_tokens" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own templates" ON "public"."offer_templates" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view all profiles" ON "public"."users" FOR SELECT USING (true);



CREATE POLICY "Users can view counter offers they're involved in" ON "public"."counter_offers" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."barter_offers"
  WHERE ((("barter_offers"."id" = "counter_offers"."original_offer_id") OR ("barter_offers"."id" = "counter_offers"."counter_offer_id")) AND (("barter_offers"."sender_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("barter_offers"."receiver_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Users can view expirations for their offers" ON "public"."offer_expirations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."barter_offers"
  WHERE (("barter_offers"."id" = "offer_expirations"."offer_id") AND ("barter_offers"."sender_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can view files in their messages" ON "public"."message_files" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."messages"
  WHERE (("messages"."id" = "message_files"."message_id") AND (("messages"."sender_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("messages"."receiver_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Users can view public profiles" ON "public"."users" FOR SELECT USING (true);



CREATE POLICY "Users can view reactions on their messages" ON "public"."message_reactions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."messages"
  WHERE (("messages"."id" = "message_reactions"."message_id") AND (("messages"."sender_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("messages"."receiver_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Users can view their blocks" ON "public"."blocked_users" FOR SELECT TO "authenticated" USING (("blocker_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view their friendships" ON "public"."friendships" FOR SELECT TO "authenticated" USING ((("user1_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("user2_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Users can view their message reports" ON "public"."reported_messages" FOR SELECT TO "authenticated" USING (("reporter_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view their messages" ON "public"."messages" FOR SELECT TO "authenticated" USING ((("sender_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("receiver_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Users can view their offers" ON "public"."barter_offers" FOR SELECT TO "authenticated" USING ((("sender_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("receiver_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Users can view their own dismissals" ON "public"."changelog_dismissals" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view their own filter logs" ON "public"."content_filter_logs" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view their own friend requests" ON "public"."friend_requests" FOR SELECT TO "authenticated" USING ((("sender_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("receiver_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Users can view their own history" ON "public"."user_history" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view their own notification settings" ON "public"."notification_settings" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view their own notifications" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own templates" ON "public"."offer_templates" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view their watched items" ON "public"."watched_items" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users insert their policy acceptance" ON "public"."user_policy_acceptances" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users select own policy acceptance" ON "public"."user_policy_acceptances" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."account_deletion_audit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."barter_offers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."blocked_keywords" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."blocked_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."changelog_dismissals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."changelogs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_filter_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."counter_offers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "deny_all_clients" ON "public"."account_deletion_audit" USING (false);



ALTER TABLE "public"."friend_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."friendships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."message_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."message_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."message_threads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."moderation_actions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."moderation_policies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mt_insert_allow_creator" ON "public"."message_threads" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "mt_select_allow_all_auth" ON "public"."message_threads" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."newsletter_subscribers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."offer_expirations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."offer_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reported_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."thread_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "thread_members_select_member_only" ON "public"."thread_members" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_thread_member"(( SELECT "auth"."uid"() AS "uid"), "thread_id")));



ALTER TABLE "public"."user_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_policy_acceptances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_push_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."watched_items" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";




















































































































































































GRANT ALL ON FUNCTION "public"."add_thread_member"("p_thread_id" "uuid", "p_user_id" "uuid", "p_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_thread_member"("p_thread_id" "uuid", "p_user_id" "uuid", "p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_thread_member"("p_thread_id" "uuid", "p_user_id" "uuid", "p_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."ban_user"("user_id_to_ban" "uuid", "ban_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."ban_user"("user_id_to_ban" "uuid", "ban_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ban_user"("user_id_to_ban" "uuid", "ban_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cleanup_friend_request_pair"("p_sender" "uuid", "p_receiver" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_friend_request_pair"("p_sender" "uuid", "p_receiver" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_friend_request_pair"("p_sender" "uuid", "p_receiver" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_friend_request_pair"("p_sender" "uuid", "p_receiver" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_notification_on_direct_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_notification_on_direct_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_notification_on_direct_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_notification_on_friend_request"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_notification_on_friend_request"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_notification_on_friend_request"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_notification_on_friend_request_accepted"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_notification_on_friend_request_accepted"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_notification_on_friend_request_accepted"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_notification_on_new_listing_from_friend"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_notification_on_new_listing_from_friend"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_notification_on_new_listing_from_friend"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_notification_on_watchlist_add"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_notification_on_watchlist_add"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_notification_on_watchlist_add"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."decline_friend_request_secure"("p_request_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."decline_friend_request_secure"("p_request_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."decline_friend_request_secure"("p_request_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decline_friend_request_secure"("p_request_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_user_account_data"("target_user_id" "uuid", "target_email" "text", "metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_user_account_data"("target_user_id" "uuid", "target_email" "text", "metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_user_account_data"("target_user_id" "uuid", "target_email" "text", "metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."expire_offers"() TO "anon";
GRANT ALL ON FUNCTION "public"."expire_offers"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."expire_offers"() TO "service_role";



GRANT ALL ON FUNCTION "public"."forward_messages_to_realtime"() TO "anon";
GRANT ALL ON FUNCTION "public"."forward_messages_to_realtime"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."forward_messages_to_realtime"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_item_owner"("item_uuid" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_item_owner"("item_uuid" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_or_create_thread"("participant_uuids" "uuid"[], "item_id" "uuid", "title" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_thread"("participant_uuids" "uuid"[], "item_id" "uuid", "title" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_thread"("participant_uuids" "uuid"[], "item_id" "uuid", "title" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_thread_members"("p_thread_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_thread_members"("p_thread_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_thread_members"("p_thread_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_accepted_friend_request"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_accepted_friend_request"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_accepted_friend_request"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_message_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_message_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_message_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_user_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_user_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_user_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_thread_member"("_user" "uuid", "_thread" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."is_thread_member"("_user" "uuid", "_thread" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."messages_broadcast_trigger"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."messages_broadcast_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."messages_broadcast_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."messages_broadcast_trigger"() TO "service_role";
GRANT ALL ON FUNCTION "public"."messages_broadcast_trigger"() TO "supabase_admin";



GRANT ALL ON FUNCTION "public"."remove_thread_member"("p_thread_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_thread_member"("p_thread_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_thread_member"("p_thread_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."reports_set_deadline"() TO "anon";
GRANT ALL ON FUNCTION "public"."reports_set_deadline"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reports_set_deadline"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reports_set_first_response"() TO "anon";
GRANT ALL ON FUNCTION "public"."reports_set_first_response"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reports_set_first_response"() TO "service_role";



GRANT ALL ON FUNCTION "public"."send_push_for_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."send_push_for_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_push_for_notification"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_message_thread_created_by"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_message_thread_created_by"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_message_thread_created_by"() TO "service_role";



GRANT ALL ON FUNCTION "public"."track_item_creation"() TO "anon";
GRANT ALL ON FUNCTION "public"."track_item_creation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."track_item_creation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."track_item_deletion"() TO "anon";
GRANT ALL ON FUNCTION "public"."track_item_deletion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."track_item_deletion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."track_item_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."track_item_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."track_item_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."unban_user"("user_id_to_unban" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."unban_user"("user_id_to_unban" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unban_user"("user_id_to_unban" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_blocked_keywords_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_blocked_keywords_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_blocked_keywords_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_message_read_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_message_read_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_message_read_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_notification_settings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_notification_settings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_notification_settings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_template_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_template_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_template_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_thread_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_thread_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_thread_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."account_deletion_audit" TO "anon";
GRANT ALL ON TABLE "public"."account_deletion_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."account_deletion_audit" TO "service_role";



GRANT ALL ON TABLE "public"."barter_offers" TO "anon";
GRANT ALL ON TABLE "public"."barter_offers" TO "authenticated";
GRANT ALL ON TABLE "public"."barter_offers" TO "service_role";



GRANT ALL ON TABLE "public"."blocked_keywords" TO "anon";
GRANT ALL ON TABLE "public"."blocked_keywords" TO "authenticated";
GRANT ALL ON TABLE "public"."blocked_keywords" TO "service_role";



GRANT ALL ON TABLE "public"."blocked_users" TO "anon";
GRANT ALL ON TABLE "public"."blocked_users" TO "authenticated";
GRANT ALL ON TABLE "public"."blocked_users" TO "service_role";



GRANT ALL ON TABLE "public"."changelog_dismissals" TO "anon";
GRANT ALL ON TABLE "public"."changelog_dismissals" TO "authenticated";
GRANT ALL ON TABLE "public"."changelog_dismissals" TO "service_role";



GRANT ALL ON TABLE "public"."changelogs" TO "anon";
GRANT ALL ON TABLE "public"."changelogs" TO "authenticated";
GRANT ALL ON TABLE "public"."changelogs" TO "service_role";



GRANT ALL ON TABLE "public"."content_filter_logs" TO "anon";
GRANT ALL ON TABLE "public"."content_filter_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."content_filter_logs" TO "service_role";



GRANT ALL ON TABLE "public"."counter_offers" TO "anon";
GRANT ALL ON TABLE "public"."counter_offers" TO "authenticated";
GRANT ALL ON TABLE "public"."counter_offers" TO "service_role";



GRANT ALL ON TABLE "public"."friend_requests" TO "anon";
GRANT ALL ON TABLE "public"."friend_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."friend_requests" TO "service_role";



GRANT ALL ON TABLE "public"."friendships" TO "anon";
GRANT ALL ON TABLE "public"."friendships" TO "authenticated";
GRANT ALL ON TABLE "public"."friendships" TO "service_role";



GRANT ALL ON TABLE "public"."items" TO "anon";
GRANT ALL ON TABLE "public"."items" TO "authenticated";
GRANT ALL ON TABLE "public"."items" TO "service_role";



GRANT ALL ON TABLE "public"."message_files" TO "anon";
GRANT ALL ON TABLE "public"."message_files" TO "authenticated";
GRANT ALL ON TABLE "public"."message_files" TO "service_role";



GRANT ALL ON TABLE "public"."message_reactions" TO "anon";
GRANT ALL ON TABLE "public"."message_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."message_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."message_threads" TO "anon";
GRANT ALL ON TABLE "public"."message_threads" TO "authenticated";
GRANT ALL ON TABLE "public"."message_threads" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."message_threads" TO "authenticated";



GRANT SELECT("created_by") ON TABLE "public"."message_threads" TO "authenticated";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."moderation_actions" TO "anon";
GRANT ALL ON TABLE "public"."moderation_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."moderation_actions" TO "service_role";



GRANT ALL ON TABLE "public"."moderation_policies" TO "anon";
GRANT ALL ON TABLE "public"."moderation_policies" TO "authenticated";
GRANT ALL ON TABLE "public"."moderation_policies" TO "service_role";



GRANT ALL ON TABLE "public"."newsletter_subscribers" TO "anon";
GRANT ALL ON TABLE "public"."newsletter_subscribers" TO "authenticated";
GRANT ALL ON TABLE "public"."newsletter_subscribers" TO "service_role";



GRANT ALL ON TABLE "public"."notification_settings" TO "anon";
GRANT ALL ON TABLE "public"."notification_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_settings" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."offer_expirations" TO "anon";
GRANT ALL ON TABLE "public"."offer_expirations" TO "authenticated";
GRANT ALL ON TABLE "public"."offer_expirations" TO "service_role";



GRANT ALL ON TABLE "public"."offer_templates" TO "anon";
GRANT ALL ON TABLE "public"."offer_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."offer_templates" TO "service_role";



GRANT ALL ON TABLE "public"."push_settings" TO "anon";
GRANT ALL ON TABLE "public"."push_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."push_settings" TO "service_role";



GRANT ALL ON TABLE "public"."reported_messages" TO "anon";
GRANT ALL ON TABLE "public"."reported_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."reported_messages" TO "service_role";



GRANT ALL ON TABLE "public"."reports" TO "anon";
GRANT ALL ON TABLE "public"."reports" TO "authenticated";
GRANT ALL ON TABLE "public"."reports" TO "service_role";



GRANT ALL ON TABLE "public"."thread_members" TO "anon";
GRANT ALL ON TABLE "public"."thread_members" TO "authenticated";
GRANT ALL ON TABLE "public"."thread_members" TO "service_role";



GRANT ALL ON TABLE "public"."user_history" TO "anon";
GRANT ALL ON TABLE "public"."user_history" TO "authenticated";
GRANT ALL ON TABLE "public"."user_history" TO "service_role";



GRANT ALL ON TABLE "public"."user_policy_acceptances" TO "anon";
GRANT ALL ON TABLE "public"."user_policy_acceptances" TO "authenticated";
GRANT ALL ON TABLE "public"."user_policy_acceptances" TO "service_role";



GRANT ALL ON TABLE "public"."user_push_tokens" TO "anon";
GRANT ALL ON TABLE "public"."user_push_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."user_push_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."watched_items" TO "anon";
GRANT ALL ON TABLE "public"."watched_items" TO "authenticated";
GRANT ALL ON TABLE "public"."watched_items" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























set check_function_bodies = off;

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

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_auth_user_updated AFTER UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();








  create policy "Anyone can view images"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'item-images'::text));



  create policy "Authenticated users can upload images"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'item-images'::text));



  create policy "Avatar images are publicly accessible"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'avatars'::text));



  create policy "Give users authenticated access to folder 1oj01fe_0"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = 'private'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Give users authenticated access to folder 1oj01fe_1"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = 'private'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Give users authenticated access to folder 1oj01fe_2"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = 'private'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Item images are publicly accessible"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'item-images'::text));



  create policy "Users can delete own images"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using ((auth.uid() = owner));



  create policy "Users can delete own uploads"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using ((owner = auth.uid()));



  create policy "Users can delete their own files from message-files bucket"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'message-files'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "Users can update own images"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using ((auth.uid() = owner));



  create policy "Users can upload avatar images"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'avatars'::text) AND (lower("substring"(name, '\.([^\.]+);
::text)) = ANY (ARRAY['jpg'::text, 'jpeg'::text, 'png'::text, 'gif'::text]))));



  create policy "Users can upload files to message-files bucket"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'message-files'::text));



  create policy "Users can upload item images"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'item-images'::text) AND (lower("substring"(name, '\.([^\.]+);
::text)) = ANY (ARRAY['jpg'::text, 'jpeg'::text, 'png'::text, 'gif'::text]))));



  create policy "Users can upload message images"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'message-images'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Users can view files in message-files bucket"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using ((bucket_id = 'message-files'::text));



  create policy "Users can view message images"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'message-images'::text));



