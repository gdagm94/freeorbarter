CREATE OR REPLACE FUNCTION "public"."create_notification_on_direct_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  sender_username text;
  message_preview text;
  app_url text;
  anon_key text;
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

    -- Trigger Pusher (safely)
    -- Check if settings exist to avoid missing config parameter error
    -- Using true to ignore missing settings
    app_url := current_setting('app.supabase_url', true);
    anon_key := current_setting('app.supabase_anon_key', true);

    IF app_url IS NOT NULL AND anon_key IS NOT NULL THEN
      PERFORM net.http_post(
        url := app_url || '/functions/v1/pusher-trigger',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || anon_key,
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
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."create_notification_on_direct_message"() OWNER TO "postgres";
