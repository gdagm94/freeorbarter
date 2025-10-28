/*
  # Fix Message Threads RLS Policy

  1. Changes
    - Update RLS policy to allow users to create threads for conversations they're involved in
    - Allow thread creation for items they don't own but are messaging about
    - Maintain security by ensuring users can only create threads in conversations they participate in

  2. Security
    - Users can create threads for items they own
    - Users can create threads for items they're messaging about (have messages with the item owner)
    - Users can create general threads (item_id is null)
    - Users can only create threads in conversations they're part of
*/

-- Drop existing create policy
DROP POLICY IF EXISTS "Users can create threads in their conversations" ON message_threads;

-- Create new, more permissive policy for thread creation
CREATE POLICY "Users can create threads in their conversations"
  ON message_threads FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by AND
    (
      -- Can create threads for items they own
      EXISTS (
        SELECT 1 FROM items 
        WHERE items.id = message_threads.item_id 
        AND items.user_id = auth.uid()
      ) OR
      -- Can create threads for items they're messaging about
      EXISTS (
        SELECT 1 FROM messages 
        WHERE messages.item_id = message_threads.item_id 
        AND (messages.sender_id = auth.uid() OR messages.receiver_id = auth.uid())
      ) OR
      -- Can create general threads (no item association)
      message_threads.item_id IS NULL
    )
  );
