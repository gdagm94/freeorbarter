-- Fix update_thread_updated_at
CREATE OR REPLACE FUNCTION "public"."update_thread_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
BEGIN
  IF NEW.thread_id IS NOT NULL THEN
    UPDATE public.message_threads 
    SET updated_at = now() 
    WHERE id = NEW.thread_id;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."update_thread_updated_at"() OWNER TO "postgres";

-- Fix track_item_creation
CREATE OR REPLACE FUNCTION "public"."track_item_creation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
BEGIN
  INSERT INTO public.user_history (
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

-- Fix track_item_deletion
CREATE OR REPLACE FUNCTION "public"."track_item_deletion"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
BEGIN
  INSERT INTO public.user_history (
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

-- Fix track_item_update
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
    INSERT INTO public.user_history (
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

-- Fix create_notification_on_new_listing_from_friend
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
  FROM public.users
  WHERE id = NEW.user_id;

  -- Find all friends of the item poster and create notifications
  FOR friend_record IN
    SELECT CASE 
      WHEN user1_id = NEW.user_id THEN user2_id
      ELSE user1_id
    END as friend_id
    FROM public.friendships
    WHERE user1_id = NEW.user_id OR user2_id = NEW.user_id
  LOOP
    -- Insert notification for each friend
    INSERT INTO public.notifications (user_id, sender_id, type, content, related_id)
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

-- Fix create_notification_on_watchlist_add
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
  FROM public.users
  WHERE id = NEW.user_id;

  -- Get item details
  SELECT title, user_id INTO item_title, item_owner_id
  FROM public.items
  WHERE id = NEW.item_id;

  -- Only create notification if someone else is watching the item (not the owner)
  IF NEW.user_id != item_owner_id THEN
    -- Insert notification for item owner
    INSERT INTO public.notifications (user_id, sender_id, type, content, related_id)
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

-- Fix expire_offers
CREATE OR REPLACE FUNCTION "public"."expire_offers"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
BEGIN
  -- Update expired offers
  UPDATE public.barter_offers 
  SET status = 'expired'
  WHERE status = 'pending' 
  AND expiration_date IS NOT NULL 
  AND expiration_date < now();
  
  -- Update expired counter offers
  UPDATE public.counter_offers 
  SET status = 'expired'
  WHERE status = 'pending' 
  AND EXISTS (
    SELECT 1 FROM public.barter_offers 
    WHERE public.barter_offers.id = public.counter_offers.original_offer_id 
    AND public.barter_offers.status = 'expired'
  );
END;
$$;

ALTER FUNCTION "public"."expire_offers"() OWNER TO "postgres";

-- Fix ban_user
CREATE OR REPLACE FUNCTION "public"."ban_user"("user_id_to_ban" "uuid", "ban_reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
BEGIN
  -- Update users table
  UPDATE public.users
  SET banned = true
  WHERE id = user_id_to_ban;

  -- Log the action (if called from edge function, moderation_actions will be inserted separately)
END;
$$;

ALTER FUNCTION "public"."ban_user"("user_id_to_ban" "uuid", "ban_reason" "text") OWNER TO "postgres";

-- Fix unban_user
CREATE OR REPLACE FUNCTION "public"."unban_user"("user_id_to_unban" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
BEGIN
  UPDATE public.users
  SET banned = false
  WHERE id = user_id_to_unban;
END;
$$;

ALTER FUNCTION "public"."unban_user"("user_id_to_unban" "uuid") OWNER TO "postgres";
