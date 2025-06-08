/*
  # Create notification trigger functions

  1. Functions
    - `create_notification_on_friend_request()` - Creates notification when friend request is sent
    - `create_notification_on_friend_request_accepted()` - Creates notification when friend request is accepted
    - `create_notification_on_new_listing_from_friend()` - Creates notification when friend posts new item
    - `create_notification_on_direct_message()` - Creates notification for direct messages
    - `create_notification_on_watchlist_add()` - Creates notification when item is added to watchlist

  2. Triggers
    - Friend request notifications
    - Friend request accepted notifications  
    - New listing notifications
    - Direct message notifications
    - Watchlist notifications

  3. Pusher Integration
    - Each function triggers a Pusher event for real-time updates
*/

-- Function to create notification for friend requests
CREATE OR REPLACE FUNCTION create_notification_on_friend_request()
RETURNS TRIGGER AS $$
DECLARE
  sender_username text;
BEGIN
  -- Get sender's username
  SELECT username INTO sender_username
  FROM users
  WHERE id = NEW.sender_id;

  -- Insert notification for receiver
  INSERT INTO notifications (user_id, sender_id, type, content, related_id)
  VALUES (
    NEW.receiver_id,
    NEW.sender_id,
    'friend_request',
    sender_username || ' has requested to follow you',
    NEW.id
  );

  -- Trigger Pusher event (we'll handle this via HTTP request in the app)
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
        'type', 'friend_request',
        'content', sender_username || ' has requested to follow you'
      )
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create notification for accepted friend requests
CREATE OR REPLACE FUNCTION create_notification_on_friend_request_accepted()
RETURNS TRIGGER AS $$
DECLARE
  receiver_username text;
BEGIN
  -- Only process if status changed to 'accepted'
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Get receiver's username
    SELECT username INTO receiver_username
    FROM users
    WHERE id = NEW.receiver_id;

    -- Insert notification for original sender
    INSERT INTO notifications (user_id, sender_id, type, content, related_id)
    VALUES (
      NEW.sender_id,
      NEW.receiver_id,
      'friend_request_approved',
      receiver_username || ' has approved your friend request',
      NEW.receiver_id
    );

    -- Trigger Pusher event
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/pusher-trigger',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key'),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'channel', 'private-user-' || NEW.sender_id,
        'event', 'new-notification',
        'data', jsonb_build_object(
          'type', 'friend_request_approved',
          'content', receiver_username || ' has approved your friend request'
        )
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create notification for new listings from friends
CREATE OR REPLACE FUNCTION create_notification_on_new_listing_from_friend()
RETURNS TRIGGER AS $$
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
      poster_username || ' just posted: ' || NEW.title,
      NEW.id
    );

    -- Trigger Pusher event for each friend
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/pusher-trigger',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key'),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'channel', 'private-user-' || friend_record.friend_id,
        'event', 'new-notification',
        'data', jsonb_build_object(
          'type', 'new_listing',
          'content', poster_username || ' just posted: ' || NEW.title
        )
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create notification for direct messages
CREATE OR REPLACE FUNCTION create_notification_on_direct_message()
RETURNS TRIGGER AS $$
DECLARE
  sender_username text;
  message_preview text;
BEGIN
  -- Only process direct messages (item_id is null)
  IF NEW.item_id IS NULL THEN
    -- Get sender's username
    SELECT username INTO sender_username
    FROM users
    WHERE id = NEW.sender_id;

    -- Create message preview (max 50 chars)
    message_preview := CASE 
      WHEN length(NEW.content) > 50 THEN substring(NEW.content from 1 for 47) || '...'
      ELSE NEW.content
    END;

    -- Insert notification for receiver
    INSERT INTO notifications (user_id, sender_id, type, content, related_id)
    VALUES (
      NEW.receiver_id,
      NEW.sender_id,
      'direct_message',
      sender_username || ': ' || message_preview,
      NEW.id
    );

    -- Trigger Pusher event
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
          'content', sender_username || ': ' || message_preview
        )
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create notification for watchlist updates
CREATE OR REPLACE FUNCTION create_notification_on_watchlist_add()
RETURNS TRIGGER AS $$
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
      watcher_username || ' added ' || item_title || ' to their watchlist',
      NEW.item_id
    );

    -- Trigger Pusher event
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/pusher-trigger',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key'),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'channel', 'private-user-' || item_owner_id,
        'event', 'new-notification',
        'data', jsonb_build_object(
          'type', 'watchlist_update',
          'content', watcher_username || ' added ' || item_title || ' to their watchlist'
        )
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DROP TRIGGER IF EXISTS friend_request_notification_trigger ON friend_requests;
CREATE TRIGGER friend_request_notification_trigger
  AFTER INSERT ON friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION create_notification_on_friend_request();

DROP TRIGGER IF EXISTS friend_request_accepted_notification_trigger ON friend_requests;
CREATE TRIGGER friend_request_accepted_notification_trigger
  AFTER UPDATE ON friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION create_notification_on_friend_request_accepted();

DROP TRIGGER IF EXISTS new_listing_notification_trigger ON items;
CREATE TRIGGER new_listing_notification_trigger
  AFTER INSERT ON items
  FOR EACH ROW
  EXECUTE FUNCTION create_notification_on_new_listing_from_friend();

DROP TRIGGER IF EXISTS direct_message_notification_trigger ON messages;
CREATE TRIGGER direct_message_notification_trigger
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION create_notification_on_direct_message();

DROP TRIGGER IF EXISTS watchlist_notification_trigger ON watched_items;
CREATE TRIGGER watchlist_notification_trigger
  AFTER INSERT ON watched_items
  FOR EACH ROW
  EXECUTE FUNCTION create_notification_on_watchlist_add();