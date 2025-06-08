/*
  # Create friendships table

  1. New Tables
    - `friendships`
      - `id` (uuid, primary key)
      - `user1_id` (uuid, foreign key to users - always the smaller UUID)
      - `user2_id` (uuid, foreign key to users - always the larger UUID)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `friendships` table
    - Add policies for authenticated users to view and manage friendships
    - Unique constraint and check constraint to ensure user1_id < user2_id
*/

CREATE TABLE IF NOT EXISTS friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user2_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT check_user_order CHECK (user1_id < user2_id),
  CONSTRAINT unique_friendship UNIQUE (user1_id, user2_id)
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS friendships_user1_id_idx ON friendships(user1_id);
CREATE INDEX IF NOT EXISTS friendships_user2_id_idx ON friendships(user2_id);

-- Enable RLS
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their friendships"
  ON friendships
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can delete their friendships"
  ON friendships
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Note: INSERT will be handled by the trigger function
CREATE POLICY "System can insert friendships"
  ON friendships
  FOR INSERT
  TO authenticated
  WITH CHECK (true);