-- Make item_id nullable to support direct messages between friends
ALTER TABLE messages ALTER COLUMN item_id DROP NOT NULL;

-- Update the constraint to allow null item_id for direct messages
-- (The existing foreign key constraint will still work for non-null values)

-- Add a check constraint to ensure direct messages have proper structure
ALTER TABLE messages ADD CONSTRAINT check_direct_message_structure 
CHECK (
  (item_id IS NOT NULL) OR 
  (item_id IS NULL AND offer_item_id IS NULL AND is_offer = false)
);