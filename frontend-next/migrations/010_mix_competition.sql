CREATE TABLE mix_competitions (
 id text PRIMARY KEY,
 submissions_open boolean NOT NULL DEFAULT true,
 voting_open boolean NOT NULL DEFAULT true,
 submissions_close_at timestamptz NOT NULL,
 voting_close_at timestamptz NOT NULL,
 announce_at timestamptz NOT NULL,
 winner_entry_id uuid,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (submissions_close_at <= voting_close_at),
 CHECK (voting_close_at <= announce_at)
);
INSERT INTO mix_competitions (id, submissions_close_at, voting_close_at, announce_at)
VALUES ('nye-2026','2026-11-27T18:00:00Z','2026-11-27T18:00:00Z','2026-11-27T18:00:00Z');
CREATE TABLE mix_uploads (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES users(id),
 public_id text NOT NULL UNIQUE,
 original_filename text NOT NULL,
 expected_bytes bigint NOT NULL CHECK(expected_bytes > 0 AND expected_bytes <= 209715200),
 created_at timestamptz NOT NULL DEFAULT now(),
 consumed_at timestamptz
);
CREATE TABLE mix_entries (
 id uuid PRIMARY KEY,
 competition_id text NOT NULL REFERENCES mix_competitions(id),
 user_id uuid NOT NULL REFERENCES users(id),
 artist text NOT NULL,
 title text NOT NULL,
 genre text NOT NULL,
 email text NOT NULL,
 source text NOT NULL CHECK(source IN ('Upload','Link')),
 source_url text,
 upload_id uuid UNIQUE REFERENCES mix_uploads(id),
 audio_url text,
 original_filename text,
 allow_download boolean NOT NULL DEFAULT false,
 duration_seconds double precision,
 waveform_url text,
 status text NOT NULL DEFAULT 'published' CHECK(status IN ('published','hidden')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(competition_id,user_id),
 CHECK ((source='Upload' AND upload_id IS NOT NULL AND audio_url IS NOT NULL) OR (source='Link' AND source_url IS NOT NULL AND upload_id IS NULL AND NOT allow_download))
);
ALTER TABLE mix_competitions ADD FOREIGN KEY (winner_entry_id) REFERENCES mix_entries(id);
CREATE UNIQUE INDEX mix_unique_link ON mix_entries (competition_id,source_url) WHERE source_url IS NOT NULL;
CREATE TABLE mix_votes (
 competition_id text NOT NULL REFERENCES mix_competitions(id),
 user_id uuid NOT NULL REFERENCES users(id),
 entry_id uuid NOT NULL REFERENCES mix_entries(id),
 invalidated_at timestamptz,
 invalidation_reason text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(competition_id,user_id)
);
CREATE INDEX mix_votes_entry_idx ON mix_votes(entry_id);
CREATE TABLE mix_admin_audit (
 id uuid PRIMARY KEY,
 actor_id uuid NOT NULL REFERENCES users(id),
 action text NOT NULL,
 entry_id uuid REFERENCES mix_entries(id),
 details jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now()
);
