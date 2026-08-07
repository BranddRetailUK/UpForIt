CREATE TABLE IF NOT EXISTS scanner_enrolments (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES users(id),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  max_devices integer NOT NULL DEFAULT 20 CHECK (max_devices > 0 AND max_devices <= 100),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scanner_enrolments_event_idx
  ON scanner_enrolments (event_id, created_at DESC);

CREATE TABLE IF NOT EXISTS scanner_sessions (
  id uuid PRIMARY KEY,
  enrolment_id uuid NOT NULL REFERENCES scanner_enrolments(id),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  device_label text NOT NULL,
  user_agent text,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scanner_sessions_event_idx
  ON scanner_sessions (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS scanner_sessions_expiry_idx
  ON scanner_sessions (expires_at) WHERE revoked_at IS NULL;

ALTER TABLE ticket_audit_log
  ADD COLUMN IF NOT EXISTS scanner_session_id uuid REFERENCES scanner_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ticket_audit_log_scanner_session_idx
  ON ticket_audit_log (scanner_session_id, created_at DESC)
  WHERE scanner_session_id IS NOT NULL;
