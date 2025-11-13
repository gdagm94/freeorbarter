/*
  # Content Filtering System

  1. New Tables
    - blocked_keywords
      - id (uuid primary key)
      - keyword (text, unique)
      - pattern_type (enum: 'exact', 'contains', 'regex')
      - severity (enum: 'warning', 'block')
      - enabled (boolean)
      - created_at (timestamp)
      - updated_at (timestamp)
    
    - content_filter_logs
      - id (uuid primary key)
      - user_id (uuid references users)
      - content_type (enum: 'item_title', 'item_description', 'message')
      - content_id (uuid, nullable)
      - matched_keyword_id (uuid references blocked_keywords)
      - action_taken (enum: 'blocked', 'warned', 'allowed')
      - created_at (timestamp)

  2. Security
    - Enable RLS on both tables
    - Only service role can manage blocked_keywords
    - Authenticated users can view their own filter logs
    - Moderators can view all filter logs
*/

-- Create enums
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'pattern_type'
  ) THEN
    CREATE TYPE pattern_type AS ENUM ('exact', 'contains', 'regex');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'filter_severity'
  ) THEN
    CREATE TYPE filter_severity AS ENUM ('warning', 'block');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'content_type'
  ) THEN
    CREATE TYPE content_type AS ENUM ('item_title', 'item_description', 'message');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'filter_action'
  ) THEN
    CREATE TYPE filter_action AS ENUM ('blocked', 'warned', 'allowed');
  END IF;
END $$;

-- Create blocked_keywords table
CREATE TABLE IF NOT EXISTS blocked_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL UNIQUE,
  pattern_type pattern_type NOT NULL DEFAULT 'contains',
  severity filter_severity NOT NULL DEFAULT 'block',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create content_filter_logs table
CREATE TABLE IF NOT EXISTS content_filter_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  content_type content_type NOT NULL,
  content_id uuid,
  matched_keyword_id uuid REFERENCES blocked_keywords(id) ON DELETE SET NULL,
  action_taken filter_action NOT NULL,
  content_preview text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS blocked_keywords_enabled_idx ON blocked_keywords(enabled, severity);
CREATE INDEX IF NOT EXISTS blocked_keywords_keyword_idx ON blocked_keywords(keyword);
CREATE INDEX IF NOT EXISTS content_filter_logs_user_idx ON content_filter_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS content_filter_logs_content_idx ON content_filter_logs(content_type, content_id);
CREATE INDEX IF NOT EXISTS content_filter_logs_action_idx ON content_filter_logs(action_taken);

-- Enable RLS
ALTER TABLE blocked_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_filter_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for blocked_keywords (read-only for authenticated, full access for service role)
CREATE POLICY "Authenticated users can view enabled keywords"
  ON blocked_keywords
  FOR SELECT
  TO authenticated
  USING (enabled = true);

-- RLS Policies for content_filter_logs
CREATE POLICY "Users can view their own filter logs"
  ON content_filter_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Moderators can view all filter logs"
  ON content_filter_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM auth.jwt()
      WHERE (auth.jwt()->>'role') IN ('moderator', 'admin')
    )
  );

-- Insert some default blocked keywords (common profanity and inappropriate terms)
-- These are examples - you should customize based on your needs
INSERT INTO blocked_keywords (keyword, pattern_type, severity, enabled) VALUES
  ('spam', 'contains', 'block', true),
  ('scam', 'contains', 'block', true),
  ('fake', 'contains', 'warning', true)
ON CONFLICT (keyword) DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_blocked_keywords_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_blocked_keywords_updated_at_trigger ON blocked_keywords;
CREATE TRIGGER update_blocked_keywords_updated_at_trigger
  BEFORE UPDATE ON blocked_keywords
  FOR EACH ROW
  EXECUTE FUNCTION update_blocked_keywords_updated_at();

