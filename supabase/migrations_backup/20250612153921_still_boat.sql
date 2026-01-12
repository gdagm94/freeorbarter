/*
  # Create notification settings table

  1. New Tables
    - `notification_settings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `enabled` (boolean, default true)
      - `delivery_methods` (jsonb for email, push, in_app settings)
      - `frequency` (text, enum: real-time, daily, weekly)
      - `quiet_hours` (jsonb for quiet hours configuration)
      - `categories` (jsonb for category-specific settings)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `notification_settings` table
    - Add policy for users to manage their own settings
*/

CREATE TABLE IF NOT EXISTS notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enabled boolean DEFAULT true,
  delivery_methods jsonb DEFAULT '{"email": true, "push": true, "in_app": true}'::jsonb,
  frequency text DEFAULT 'real-time' CHECK (frequency IN ('real-time', 'daily', 'weekly')),
  quiet_hours jsonb DEFAULT '{"enabled": false, "start_time": "22:00", "end_time": "08:00", "timezone": "UTC"}'::jsonb,
  categories jsonb DEFAULT '{
    "system_alerts": {"enabled": true, "sound": true, "banner": true, "priority": "urgent"},
    "security": {"enabled": true, "sound": true, "banner": true, "priority": "urgent"},
    "messages": {"enabled": true, "sound": true, "banner": true, "priority": "normal"},
    "activity": {"enabled": true, "sound": false, "banner": true, "priority": "normal"},
    "marketing": {"enabled": false, "sound": false, "banner": false, "priority": "low"}
  }'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create unique constraint to ensure one settings record per user
CREATE UNIQUE INDEX IF NOT EXISTS notification_settings_user_id_key ON notification_settings(user_id);

-- Enable RLS
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own notification settings"
  ON notification_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification settings"
  ON notification_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification settings"
  ON notification_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notification settings"
  ON notification_settings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notification_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_notification_settings_updated_at
  BEFORE UPDATE ON notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_settings_updated_at();