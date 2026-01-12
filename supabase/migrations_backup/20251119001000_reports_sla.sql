/*
  # Report SLA metadata

  - Add needs_action_by/first_response_at/auto_escalated columns
  - Ensure deadlines are populated on insert
  - Capture the first moderator response timestamp
*/

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS needs_action_by timestamptz,
  ADD COLUMN IF NOT EXISTS first_response_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_escalated boolean NOT NULL DEFAULT false;

UPDATE reports
SET needs_action_by = COALESCE(needs_action_by, created_at + interval '24 hours')
WHERE needs_action_by IS NULL;

CREATE INDEX IF NOT EXISTS reports_needs_action_idx ON reports (status, needs_action_by);
CREATE INDEX IF NOT EXISTS reports_auto_escalated_idx ON reports (auto_escalated);

CREATE OR REPLACE FUNCTION reports_set_deadline()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.needs_action_by IS NULL THEN
    NEW.needs_action_by := now() + interval '24 hours';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reports_set_deadline ON reports;
CREATE TRIGGER trg_reports_set_deadline
BEFORE INSERT ON reports
FOR EACH ROW
EXECUTE FUNCTION reports_set_deadline();

CREATE OR REPLACE FUNCTION reports_set_first_response()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.first_response_at IS NULL
     AND OLD.status = 'pending'
     AND NEW.status <> 'pending' THEN
    NEW.first_response_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reports_first_response ON reports;
CREATE TRIGGER trg_reports_first_response
BEFORE UPDATE ON reports
FOR EACH ROW
EXECUTE FUNCTION reports_set_first_response();


