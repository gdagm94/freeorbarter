/*
  # Fix trigger functions to remove database config parameter dependencies

  1. Updates
    - Remove dependency on app.supabase_url and app.supabase_anon_key configuration parameters
    - Simplify trigger functions to only handle database operations
    - Remove Pusher HTTP calls from database triggers (these will be handled in the application layer)

  2. Changes
    - Update create_notification_on_friend_request function
    - Update create_notification_on_friend_request_accepted function
    - Keep all other functionality intact
*/

-- Update the friend request notification trigger function
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

-- Update the friend request accepted notification trigger function
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