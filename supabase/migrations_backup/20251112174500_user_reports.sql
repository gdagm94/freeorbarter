/*
  # User Reports Table

  1. New Tables
    - reports
      - id (uuid primary key)
      - reporter_id (uuid references users)
      - target_type (text enum-like)
      - target_id (uuid)
      - category (text)
      - description (text)
      - created_at (timestamp)
      - status (text)
      - metadata (jsonb)

  2. Security
    - Enable RLS
    - Authenticated users can insert reports
    - Reporters can view their own reports
    - Moderators/Admins can view all reports (role claim)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'report_status'
  ) THEN
    CREATE TYPE report_status AS ENUM ('pending', 'in_review', 'resolved', 'dismissed');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'report_target_type'
  ) THEN
    CREATE TYPE report_target_type AS ENUM ('user', 'item', 'message', 'comment', 'other');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type report_target_type NOT NULL,
  target_id uuid NOT NULL,
  category text NOT NULL,
  description text,
  status report_status NOT NULL DEFAULT 'pending',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reports_reporter_idx ON reports(reporter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_target_idx ON reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports(status);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create reports"
  ON reports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Reporters can view their reports"
  ON reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "Moderators can view all reports"
  ON reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM auth.jwt()
      WHERE (auth.jwt()->>'role') IN ('moderator', 'admin')
    )
  );

