/*
  # Strengthen Cascades for Account Deletion

  1. Changes
    - Ensure `items.user_id` cascades when a profile is deleted
    - Ensure `messages.sender_id` and `messages.receiver_id` cascade on deletion
    - Ensure `watched_items.user_id` cascades to prevent orphaned records

  2. Notes
    - Existing foreign keys are dropped and recreated with `ON DELETE CASCADE`
    - Operations are idempotent for repeated execution
*/

DO $$
BEGIN
  -- Update items.user_id foreign key
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'items_user_id_fkey'
      AND table_name = 'items'
  ) THEN
    ALTER TABLE items
      DROP CONSTRAINT items_user_id_fkey;
  END IF;

  ALTER TABLE items
    ADD CONSTRAINT items_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

  -- Update messages sender and receiver foreign keys
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'messages_sender_id_fkey'
      AND table_name = 'messages'
  ) THEN
    ALTER TABLE messages
      DROP CONSTRAINT messages_sender_id_fkey;
  END IF;

  ALTER TABLE messages
    ADD CONSTRAINT messages_sender_id_fkey
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE;

  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'messages_receiver_id_fkey'
      AND table_name = 'messages'
  ) THEN
    ALTER TABLE messages
      DROP CONSTRAINT messages_receiver_id_fkey;
  END IF;

  ALTER TABLE messages
    ADD CONSTRAINT messages_receiver_id_fkey
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE;

  -- Update watched_items.user_id foreign key
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'watched_items_user_id_fkey'
      AND table_name = 'watched_items'
  ) THEN
    ALTER TABLE watched_items
      DROP CONSTRAINT watched_items_user_id_fkey;
  END IF;

  ALTER TABLE watched_items
    ADD CONSTRAINT watched_items_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
END $$;

