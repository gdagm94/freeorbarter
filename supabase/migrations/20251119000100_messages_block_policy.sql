/*
  # Tighten messaging RLS to respect block list

  - Recreate the messages INSERT policy so neither party can send a message when a block exists.
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'messages'
      AND policyname = 'Users can send messages'
  ) THEN
    DROP POLICY "Users can send messages" ON messages;
  END IF;
END $$;

CREATE POLICY "Users can send messages"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND NOT EXISTS (
      SELECT 1
      FROM blocked_users
      WHERE (blocker_id = sender_id AND blocked_id = receiver_id)
         OR (blocker_id = receiver_id AND blocked_id = sender_id)
    )
  );


