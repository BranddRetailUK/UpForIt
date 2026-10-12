-- Additive admin-only tables; existing storefront records and migrations are untouched.
CREATE TABLE IF NOT EXISTS admin_signup_preferences (
 signup_id integer PRIMARY KEY REFERENCES signups(id) ON DELETE CASCADE,
 status text NOT NULL CHECK (status IN ('Subscribed','Unsubscribed')),
 updated_by uuid NOT NULL REFERENCES users(id),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS admin_mix_reviews (
 entry_id uuid PRIMARY KEY REFERENCES mix_entries(id) ON DELETE CASCADE,
 reviewed boolean NOT NULL DEFAULT false,
 updated_by uuid NOT NULL REFERENCES users(id),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS admin_audit_log (
 id uuid PRIMARY KEY,
 actor_id uuid NOT NULL REFERENCES users(id),
 action text NOT NULL,
 subject_id text,
 details jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_created_idx ON admin_audit_log(created_at DESC);

CREATE TABLE IF NOT EXISTS admin_email_campaigns (
 id uuid PRIMARY KEY, name text NOT NULL, subject text NOT NULL, preheader text NOT NULL DEFAULT '',
 body_text text NOT NULL, banner_url text NOT NULL DEFAULT '', from_name text NOT NULL,
 from_email text NOT NULL, postal_address text NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','queued','sent','attention')),
 created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),queued_at timestamptz,completed_at timestamptz
);
CREATE TABLE IF NOT EXISTS admin_email_recipients (
 id uuid PRIMARY KEY,campaign_id uuid NOT NULL REFERENCES admin_email_campaigns(id),
 signup_id integer REFERENCES signups(id) ON DELETE SET NULL,email text NOT NULL,
 unsubscribe_token text NOT NULL UNIQUE,status text NOT NULL DEFAULT 'queued'
 CHECK(status IN ('queued','sending','accepted','failed','unknown','skipped')),
 attempted_at timestamptz,accepted_at timestamptz,provider_message_id text,error text,
 UNIQUE(campaign_id,email)
);
CREATE INDEX IF NOT EXISTS admin_email_recipient_queue_idx ON admin_email_recipients(status,campaign_id);
CREATE TABLE IF NOT EXISTS admin_email_events (
 id text PRIMARY KEY,recipient_id uuid NOT NULL REFERENCES admin_email_recipients(id),
 event text NOT NULL,occurred_at timestamptz NOT NULL,received_at timestamptz NOT NULL DEFAULT now(),
 url text,machine_open boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS admin_email_event_recipient_idx ON admin_email_events(recipient_id,event);
CREATE TABLE IF NOT EXISTS admin_email_suppressions (
 email text PRIMARY KEY,reason text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now()
);
