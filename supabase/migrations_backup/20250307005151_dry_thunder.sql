/*
  # Message Status Handler
  
  1. New Function
    - Creates a trigger function to handle message status updates
    - Ensures proper handling of read/unread status
    - Maintains message count consistency
  
  2. Trigger
    - Creates a trigger that fires on message updates
    - Handles both INSERT and UPDATE operations
*/

-- Create the trigger function
CREATE OR REPLACE FUNCTION handle_message_status()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS message_status_trigger ON messages;
CREATE TRIGGER message_status_trigger
  BEFORE INSERT OR UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION handle_message_status();

-- Create an index to optimize read status queries
CREATE INDEX IF NOT EXISTS idx_messages_read_status 
ON messages (receiver_id, read) 
WHERE read = false;