ALTER TABLE scanner_enrolments
  ADD COLUMN IF NOT EXISTS relink_session_id uuid REFERENCES scanner_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS scanner_enrolments_relink_session_idx
  ON scanner_enrolments (relink_session_id)
  WHERE relink_session_id IS NOT NULL;
