CREATE TABLE IF NOT EXISTS site_analytics_started (id boolean PRIMARY KEY DEFAULT true CHECK(id), started_at timestamptz NOT NULL DEFAULT now());
INSERT INTO site_analytics_started(id) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS site_page_hits (
 id uuid PRIMARY KEY, visitor_id uuid NOT NULL, session_id uuid NOT NULL,
 path varchar(250) NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS site_page_hits_created_idx ON site_page_hits(created_at);
CREATE INDEX IF NOT EXISTS site_page_hits_session_idx ON site_page_hits(session_id, created_at);
