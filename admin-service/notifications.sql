CREATE TABLE IF NOT EXISTS admin_push_state (
 id integer PRIMARY KEY CHECK(id=1), started_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS admin_push_subscriptions (
 id bigserial PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 endpoint_hash text NOT NULL UNIQUE, subscription jsonb NOT NULL, preferences jsonb NOT NULL,
 session_hash text NOT NULL, active_since timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_push_user_idx ON admin_push_subscriptions(user_id);
CREATE TABLE IF NOT EXISTS admin_push_events (
 id bigserial PRIMARY KEY, event_key text NOT NULL UNIQUE,
 kind text NOT NULL CHECK(kind IN ('sales','bucket','signups')),
 occurred_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS admin_push_deliveries (
 id bigserial PRIMARY KEY, event_id bigint NOT NULL REFERENCES admin_push_events(id) ON DELETE CASCADE,
 subscription_id bigint NOT NULL REFERENCES admin_push_subscriptions(id) ON DELETE CASCADE,
 attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz, outcome text, UNIQUE(event_id,subscription_id)
);
CREATE INDEX IF NOT EXISTS admin_push_pending_idx ON admin_push_deliveries(next_attempt_at)
 WHERE completed_at IS NULL AND attempts<5;
