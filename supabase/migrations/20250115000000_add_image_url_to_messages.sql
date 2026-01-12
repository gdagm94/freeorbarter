
/*
  # Add image_url column to messages table

  1. Changes
    - Add image_url column to messages table to support photo attachments
    - Column is nullable to maintain backward compatibility
    - Add index for performance on image_url queries

  2. Security
    - No changes to RLS policies needed as this only adds a column
*/

-- Add image_url column to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_url text;

-- Create index for performance
CREATE INDEX IF NOT EXISTS messages_image_url_idx ON messages(image_url) WHERE image_url IS NOT NULL;

-- Add comment to document the column
COMMENT ON COLUMN messages.image_url IS 'URL of image attachment in message, stored in Supabase storage';
