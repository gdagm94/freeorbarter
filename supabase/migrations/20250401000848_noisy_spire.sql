/*
  # Add Changelog and Newsletter Features

  1. New Tables
    - changelogs
      - id (uuid, primary key)
      - title (text)
      - description (text)
      - created_at (timestamp)
      - is_upcoming (boolean)
    
    - changelog_dismissals
      - id (uuid, primary key)
      - user_id (uuid, foreign key)
      - changelog_id (uuid, foreign key)
      - created_at (timestamp)
    
    - newsletter_subscribers
      - id (uuid, primary key)
      - email (text, unique)
      - created_at (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add appropriate policies for each table
*/

-- Create changelogs table
CREATE TABLE IF NOT EXISTS changelogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  created_at timestamptz DEFAULT now(),
  is_upcoming boolean DEFAULT false
);

-- Create changelog_dismissals table
CREATE TABLE IF NOT EXISTS changelog_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  changelog_id uuid REFERENCES changelogs(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, changelog_id)
);

-- Create newsletter_subscribers table
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE changelogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE changelog_dismissals ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Create policies for changelogs
CREATE POLICY "Anyone can view changelogs"
  ON changelogs FOR SELECT
  USING (true);

-- Create policies for changelog_dismissals
CREATE POLICY "Users can view their own dismissals"
  ON changelog_dismissals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create dismissals"
  ON changelog_dismissals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create policies for newsletter_subscribers
CREATE POLICY "Anyone can subscribe to newsletter"
  ON newsletter_subscribers FOR INSERT
  WITH CHECK (true);

-- Create indexes
CREATE INDEX changelog_dismissals_user_id_idx ON changelog_dismissals(user_id);
CREATE INDEX changelog_dismissals_changelog_id_idx ON changelog_dismissals(changelog_id);
CREATE INDEX newsletter_subscribers_email_idx ON newsletter_subscribers(email);