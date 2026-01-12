/*
  # Create friend requests table

  1. New Tables
    - `friend_requests`
      - `id` (uuid, primary key)
      - `sender_id` (uuid, foreign key to users)
      - `receiver_id` (uuid, foreign key to users)
      - `status` (text, enum-like: 'pending', 'accepted', 'declined')
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `friend_requests` table
    - Add policies for authenticated users to manage their own requests
    - Unique constraint to prevent duplicate requests
*/

CREATE TABLE IF NOT EXISTS friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz DEFAULT now()
);

-- Add unique constraint to prevent duplicate requests
ALTER TABLE friend_requests ADD CONSTRAINT unique_friend_request UNIQUE (sender_id, receiver_id);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS friend_requests_sender_id_idx ON friend_requests(sender_id);
CREATE INDEX IF NOT EXISTS friend_requests_receiver_id_idx ON friend_requests(receiver_id);
CREATE INDEX IF NOT EXISTS friend_requests_status_idx ON friend_requests(status);

-- Enable RLS
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own friend requests"
  ON friend_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send friend requests"
  ON friend_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id AND sender_id != receiver_id);

CREATE POLICY "Users can update received requests"
  ON friend_requests
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = receiver_id AND status = 'pending')
  WITH CHECK (auth.uid() = receiver_id AND status IN ('accepted', 'declined'));

CREATE POLICY "Users can delete their own pending requests"
  ON friend_requests
  FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id AND status = 'pending');