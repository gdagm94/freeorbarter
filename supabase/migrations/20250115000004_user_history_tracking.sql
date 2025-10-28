/*
  # Add User History Tracking

  1. New Tables
    - user_history
      - id (uuid, primary key)
      - user_id (uuid, foreign key)
      - action_type (enum: 'created', 'edited', 'deleted')
      - item_id (uuid, foreign key, nullable for deleted items)
      - item_title (text, to preserve title even if item is deleted)
      - item_description (text, to preserve description even if item is deleted)
      - item_images (text array, to preserve images even if item is deleted)
      - changes (jsonb, to track what was changed during edit)
      - created_at (timestamp)

  2. Security
    - Enable RLS on user_history table
    - Add policies for users to view their own history
    - Add policies for system to insert history records

  3. Indexes
    - Add indexes for efficient querying by user and action type
*/

-- Create action type enum
CREATE TYPE history_action_type AS ENUM ('created', 'edited', 'deleted');

-- Create user_history table
CREATE TABLE IF NOT EXISTS user_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type history_action_type NOT NULL,
  item_id uuid REFERENCES items(id) ON DELETE SET NULL, -- NULL for deleted items
  item_title text NOT NULL,
  item_description text,
  item_images text[],
  item_category text,
  item_condition item_condition,
  item_type listing_type,
  changes jsonb, -- Store what was changed during edit
  created_at timestamptz DEFAULT now()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS user_history_user_id_idx ON user_history(user_id);
CREATE INDEX IF NOT EXISTS user_history_action_type_idx ON user_history(action_type);
CREATE INDEX IF NOT EXISTS user_history_created_at_idx ON user_history(created_at DESC);
CREATE INDEX IF NOT EXISTS user_history_user_action_idx ON user_history(user_id, action_type);

-- Enable RLS
ALTER TABLE user_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own history"
  ON user_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert history records"
  ON user_history FOR INSERT
  TO authenticated
  WITH CHECK (true); -- Allow any authenticated user to insert (for system operations)

-- Create function to automatically track item creation
CREATE OR REPLACE FUNCTION track_item_creation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_history (
    user_id,
    action_type,
    item_id,
    item_title,
    item_description,
    item_images,
    item_category,
    item_condition,
    item_type
  ) VALUES (
    NEW.user_id,
    'created',
    NEW.id,
    NEW.title,
    NEW.description,
    NEW.images,
    NEW.category,
    NEW.condition,
    NEW.type
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to automatically track item updates
CREATE OR REPLACE FUNCTION track_item_update()
RETURNS TRIGGER AS $$
DECLARE
  changes_json jsonb := '{}';
BEGIN
  -- Track changes in a JSON object
  IF OLD.title != NEW.title THEN
    changes_json := changes_json || jsonb_build_object('title', jsonb_build_object('old', OLD.title, 'new', NEW.title));
  END IF;
  
  IF OLD.description != NEW.description THEN
    changes_json := changes_json || jsonb_build_object('description', jsonb_build_object('old', OLD.description, 'new', NEW.description));
  END IF;
  
  IF OLD.images != NEW.images THEN
    changes_json := changes_json || jsonb_build_object('images', jsonb_build_object('old', OLD.images, 'new', NEW.images));
  END IF;
  
  IF OLD.category != NEW.category THEN
    changes_json := changes_json || jsonb_build_object('category', jsonb_build_object('old', OLD.category, 'new', NEW.category));
  END IF;
  
  IF OLD.condition != NEW.condition THEN
    changes_json := changes_json || jsonb_build_object('condition', jsonb_build_object('old', OLD.condition, 'new', NEW.condition));
  END IF;
  
  IF OLD.type != NEW.type THEN
    changes_json := changes_json || jsonb_build_object('type', jsonb_build_object('old', OLD.type, 'new', NEW.type));
  END IF;
  
  IF OLD.location != NEW.location THEN
    changes_json := changes_json || jsonb_build_object('location', jsonb_build_object('old', OLD.location, 'new', NEW.location));
  END IF;

  -- Only insert history record if there were actual changes
  IF changes_json != '{}' THEN
    INSERT INTO user_history (
      user_id,
      action_type,
      item_id,
      item_title,
      item_description,
      item_images,
      item_category,
      item_condition,
      item_type,
      changes
    ) VALUES (
      NEW.user_id,
      'edited',
      NEW.id,
      NEW.title,
      NEW.description,
      NEW.images,
      NEW.category,
      NEW.condition,
      NEW.type,
      changes_json
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to track item deletion
CREATE OR REPLACE FUNCTION track_item_deletion()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_history (
    user_id,
    action_type,
    item_id, -- This will be NULL since item is deleted
    item_title,
    item_description,
    item_images,
    item_category,
    item_condition,
    item_type
  ) VALUES (
    OLD.user_id,
    'deleted',
    NULL,
    OLD.title,
    OLD.description,
    OLD.images,
    OLD.category,
    OLD.condition,
    OLD.type
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
CREATE TRIGGER track_item_creation_trigger
  AFTER INSERT ON items
  FOR EACH ROW
  EXECUTE FUNCTION track_item_creation();

CREATE TRIGGER track_item_update_trigger
  AFTER UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION track_item_update();

CREATE TRIGGER track_item_deletion_trigger
  BEFORE DELETE ON items
  FOR EACH ROW
  EXECUTE FUNCTION track_item_deletion();
