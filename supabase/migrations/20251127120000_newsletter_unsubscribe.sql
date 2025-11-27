/*
  # Newsletter unsubscribe fields

  Adds metadata columns that allow us to issue unique unsubscribe links
  and track when a subscriber opts out of mailings.
*/

ALTER TABLE newsletter_subscribers
ADD COLUMN IF NOT EXISTS unsubscribe_token uuid DEFAULT gen_random_uuid() NOT NULL,
ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz,
ADD COLUMN IF NOT EXISTS is_unsubscribed boolean GENERATED ALWAYS AS (unsubscribed_at IS NOT NULL) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_unsubscribe_token_idx
  ON newsletter_subscribers(unsubscribe_token);

-- Ensure every existing row gets a token (older Postgres versions may skip the DEFAULT)
UPDATE newsletter_subscribers
SET unsubscribe_token = gen_random_uuid()
WHERE unsubscribe_token IS NULL;

