/*
  # Add Watched Items Feature

  1. New Tables
    - watched_items
      - id (uuid, primary key)
      - user_id (uuid, foreign key)
      - item_id (uuid, foreign key)
      - created_at (timestamp)

  2. Security
    - Enable RLS on watched_items table
    - Add policies for authenticated users
    - Add unique constraint to prevent duplicate watches

  3. Indexes
    - Create indexes for efficient querying
*/

-- Create watched_items table
CREATE TABLE IF NOT EXISTS watched_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  item_id uuid REFERENCES items(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, item_id)
);

-- Enable RLS
ALTER TABLE watched_items ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their watched items"
  ON watched_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add watched items"
  ON watched_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove watched items"
  ON watched_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX watched_items_user_id_idx ON watched_items(user_id);
CREATE INDEX watched_items_item_id_idx ON watched_items(item_id);