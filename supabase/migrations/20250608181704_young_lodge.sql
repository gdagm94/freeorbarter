/*
  # Create friendship trigger function

  1. Functions
    - `handle_accepted_friend_request()` - Creates friendship when request is accepted
    - Ensures user1_id is always smaller than user2_id for consistency
    - Deletes the friend request after creating friendship

  2. Triggers
    - Trigger on friend_requests UPDATE to handle accepted requests
*/

-- Function to handle accepted friend requests
CREATE OR REPLACE FUNCTION handle_accepted_friend_request()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS friend_request_accepted_trigger ON friend_requests;
CREATE TRIGGER friend_request_accepted_trigger
  AFTER UPDATE ON friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION handle_accepted_friend_request();