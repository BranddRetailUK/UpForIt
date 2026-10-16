CREATE TABLE bucket_entries (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES events(id),
  user_id uuid NOT NULL REFERENCES users(id),
  ticket_id uuid NOT NULL REFERENCES tickets(id),
  dj_name text NOT NULL CHECK (length(btrim(dj_name)) BETWEEN 1 AND 80),
  consent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'entered' CHECK (status IN ('entered','called','played','skipped')),
  called_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id,user_id)
);
CREATE INDEX bucket_entries_draw_idx ON bucket_entries(event_id,status);
CREATE TABLE bucket_audit (
  id uuid PRIMARY KEY,
  entry_id uuid NOT NULL REFERENCES bucket_entries(id),
  actor_id uuid NOT NULL REFERENCES users(id),
  action text NOT NULL CHECK (action IN ('entered','called','played','skipped')),
  created_at timestamptz NOT NULL DEFAULT now()
);
