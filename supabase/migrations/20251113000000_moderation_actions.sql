/*
  # Moderation Actions and User Banning

  1. New Tables
    - moderation_actions
      - id (uuid primary key)
      - moderator_id (uuid references users)
      - report_id (uuid references reports, nullable)
      - action_type (enum: remove_content, ban_user, dismiss_report)
      - target_type (enum: user, item, message)
      - target_id (uuid)
      - notes (text)
      - created_at (timestamp)

  2. Changes
    - Add `banned` boolean column to `users` table
    - Add `resolved_at` and `resolved_by` columns to `reports` table
    - Add `resolution_notes` column to `reports` table

  3. Security
    - Enable RLS on moderation_actions table
    - Moderators can view all moderation actions
    - Service role can insert moderation actions
*/

-- Create action type enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'moderation_action_type'
  ) THEN
    CREATE TYPE moderation_action_type AS ENUM ('remove_content', 'ban_user', 'dismiss_report', 'warn_user');
  END IF;
END $$;

-- Add banned column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS users_banned_idx ON users(banned);

-- Add resolution columns to reports table
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES users(id);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolution_notes text;

-- Create moderation_actions table
CREATE TABLE IF NOT EXISTS moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_id uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  report_id uuid REFERENCES reports(id) ON DELETE SET NULL,
  action_type moderation_action_type NOT NULL,
  target_type report_target_type NOT NULL,
  target_id uuid NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS moderation_actions_moderator_idx ON moderation_actions(moderator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS moderation_actions_report_idx ON moderation_actions(report_id);
CREATE INDEX IF NOT EXISTS moderation_actions_target_idx ON moderation_actions(target_type, target_id);
CREATE INDEX IF NOT EXISTS moderation_actions_type_idx ON moderation_actions(action_type);
CREATE INDEX IF NOT EXISTS reports_resolved_by_idx ON reports(resolved_by);
CREATE INDEX IF NOT EXISTS reports_resolved_at_idx ON reports(resolved_at);

-- Enable RLS
ALTER TABLE moderation_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for moderation_actions
CREATE POLICY "Moderators can view all moderation actions"
  ON moderation_actions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM auth.jwt()
      WHERE (auth.jwt()->>'role') IN ('moderator', 'admin')
    )
  );

-- Add UPDATE policy for reports (moderators can update status)
CREATE POLICY "Moderators can update reports"
  ON reports
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM auth.jwt()
      WHERE (auth.jwt()->>'role') IN ('moderator', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM auth.jwt()
      WHERE (auth.jwt()->>'role') IN ('moderator', 'admin')
    )
  );

-- Function to ban a user (sets banned flag and prevents login)
CREATE OR REPLACE FUNCTION ban_user(user_id_to_ban uuid, ban_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update users table
  UPDATE users
  SET banned = true
  WHERE id = user_id_to_ban;

  -- Log the action (if called from edge function, moderation_actions will be inserted separately)
END;
$$;

-- Function to unban a user
CREATE OR REPLACE FUNCTION unban_user(user_id_to_unban uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users
  SET banned = false
  WHERE id = user_id_to_unban;
END;
$$;

