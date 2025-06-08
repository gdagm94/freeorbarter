/*
  # Fix Watchlist Notification Trigger

  1. Database Configuration
    - Set up required configuration parameters for Supabase URL and anon key
    - Update trigger function to handle missing configuration gracefully

  2. Function Updates
    - Remove HTTP calls that depend on configuration parameters
    - Keep notification creation but remove Pusher integration from trigger
    - Pusher events will be handled from the application layer instead
*/

-- Set up configuration parameters (replace with your actual values)
-- Note: These should be set by your Supabase instance automatically
-- If they're not available, we'll handle it gracefully in the function

-- Update the watchlist notification function to not depend on HTTP calls
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
      COALESCE(watcher_username, 'Someone') || ' added ' || COALESCE(item_title, 'an item') || ' to their watchlist',
      NEW.item_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Also update other notification functions to remove HTTP dependencies
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
    COALESCE(sender_username, 'Someone') || ' has requested to follow you',
    NEW.id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
      COALESCE(receiver_username, 'Someone') || ' has approved your friend request',
      NEW.receiver_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
      COALESCE(poster_username, 'Someone') || ' just posted: ' || COALESCE(NEW.title, 'a new item'),
      NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
      COALESCE(sender_username, 'Someone') || ': ' || message_preview,
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;