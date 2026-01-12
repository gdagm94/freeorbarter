/*
  # Policy & EULA Acceptance Tracking

  1. New Tables
    - moderation_policies
    - user_policy_acceptances

  2. Changes
    - Seed initial policy (version 1)

  3. Security
    - Enable RLS with policies for safe access
*/

CREATE TABLE IF NOT EXISTS moderation_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL UNIQUE,
  title text NOT NULL,
  content text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  require_reaccept_after timestamptz
);

INSERT INTO moderation_policies (version, title, content)
VALUES (
  1,
  'FreeorBarter Community Guidelines & Zero Tolerance Policy',
  '## FreeorBarter Community Guidelines

Welcome to FreeorBarter. To keep the community safe, all members **must** follow these rules:

- No harassment, hate speech, or bullying.
- No nudity, pornography, or sexually explicit content.
- No violence, illegal activity, weapons, or drugs.
- No spam, scams, or misleading offers.
- Only list items you legally own and accurately describe.
- Respect other members; trades and meetups must be safe and consensual.

### Zero Tolerance
We operate a strict zero-tolerance policy. Content or behavior that violates these rules will be removed immediately and may result in account suspension or permanent removal.

### Reporting & Enforcement
Members can report content or users that break these rules. Our moderation team reviews reports and takes action within 24 hours, including removing content or ejecting offending users.

By using FreeorBarter you confirm you understand and agree to follow this policy.'
)
ON CONFLICT (version) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_policy_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  policy_id uuid NOT NULL REFERENCES moderation_policies(id) ON DELETE CASCADE,
  platform text DEFAULT 'web',
  accepted_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_policy_unique ON user_policy_acceptances(user_id, policy_id);
CREATE INDEX IF NOT EXISTS user_policy_latest_idx ON user_policy_acceptances(user_id, accepted_at DESC);

ALTER TABLE moderation_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_policy_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Policies viewable by anyone"
  ON moderation_policies
  FOR SELECT
  USING (true);

CREATE POLICY "Users select own policy acceptance"
  ON user_policy_acceptances
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert their policy acceptance"
  ON user_policy_acceptances
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

