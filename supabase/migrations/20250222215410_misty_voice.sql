-- Update RLS policies for items to allow public access to available items
DROP POLICY IF EXISTS "Anyone can view available items" ON items;

CREATE POLICY "Anyone can view available items"
  ON items FOR SELECT
  USING (status = 'available');

-- Keep the existing policies for authenticated users
DROP POLICY IF EXISTS "Users can create items" ON items;
DROP POLICY IF EXISTS "Users can update own items" ON items;

CREATE POLICY "Users can create items"
  ON items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own items"
  ON items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);