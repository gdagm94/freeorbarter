-- Create a new migration file to update the function
-- Timestamp: 20260204194800

CREATE OR REPLACE FUNCTION "public"."create_notification_on_direct_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  sender_username text;
  message_preview text;
  app_url text;
  anon_key text;
  notification_type text;
  item_title text;
BEGIN
  -- Get sender's username from PUBLIC.users
  SELECT username INTO sender_username
  FROM public.users
  WHERE id = NEW.sender_id;

  -- Create message preview (max 50 chars)
  message_preview := CASE 
    WHEN length(NEW.content) > 50 THEN substring(NEW.content from 1 for 47) || '...'
    ELSE NEW.content
  END;

  -- Determine notification type and context
  IF NEW.item_id IS NOT NULL THEN
     notification_type := 'direct_message'; -- or we could add 'item_message' if the enum allows. type enum has 'direct_message', keeping it simple.
     
     -- Get item title for context
     SELECT title INTO item_title FROM public.items WHERE id = NEW.item_id;
     
     -- Optionally prepend item title to content? 
     -- For now, let's just show the message content as standard behavior.
     -- The UI will handle the navigation based on related_id (which is the message ID).
  ELSE
     notification_type := 'direct_message';
  END IF;

  -- Insert notification
  INSERT INTO public.notifications (user_id, sender_id, type, content, related_id)
  VALUES (
    NEW.receiver_id,
    NEW.sender_id,
    'direct_message', -- Use direct_message type for all chat messages
    coalesce(sender_username, 'Someone') || ': ' || message_preview,
    NEW.id
  );

  -- Trigger Pusher (safely)
  -- Check if settings exist to avoid missing config parameter error
  BEGIN
    app_url := current_setting('app.supabase_url', true);
    anon_key := current_setting('app.supabase_anon_key', true);
  EXCEPTION WHEN OTHERS THEN
    app_url := NULL;
    anon_key := NULL;
  END;

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

  RETURN NEW;
END;
$$;
