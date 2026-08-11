CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'staff', 'admin')),
  email_verified_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (lower(email));

CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON user_sessions (user_id);
CREATE INDEX IF NOT EXISTS user_sessions_expiry_idx ON user_sessions (expires_at);

CREATE TABLE IF NOT EXISTS auth_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('verify_email', 'reset_password', 'signup_session')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_tokens_user_purpose_idx ON auth_tokens (user_id, purpose);

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  bucket_key text PRIMARY KEY,
  attempt_count integer NOT NULL DEFAULT 1,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz
);

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  image_url text,
  venue_name text NOT NULL,
  venue_address text,
  timezone text NOT NULL DEFAULT 'Europe/London',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ticket_types (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name text NOT NULL,
  price_minor integer NOT NULL CHECK (price_minor >= 0),
  currency char(3) NOT NULL DEFAULT 'gbp',
  capacity integer CHECK (capacity IS NULL OR capacity >= 0),
  max_per_order integer NOT NULL DEFAULT 10 CHECK (max_per_order > 0),
  sales_start_at timestamptz,
  sales_end_at timestamptz,
  is_active boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, name)
);
CREATE INDEX IF NOT EXISTS ticket_types_event_idx ON ticket_types (event_id, sort_order);

CREATE SEQUENCE IF NOT EXISTS ticket_order_number_seq START 1001;
CREATE SEQUENCE IF NOT EXISTS admission_ticket_number_seq START 10001;

CREATE TABLE IF NOT EXISTS ticket_orders (
  id uuid PRIMARY KEY,
  order_number text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES users(id),
  event_id uuid NOT NULL REFERENCES events(id),
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'paid', 'expired', 'failed', 'refunded', 'refund_review')
  ),
  currency char(3) NOT NULL DEFAULT 'gbp',
  subtotal_minor integer NOT NULL CHECK (subtotal_minor >= 0),
  total_minor integer NOT NULL CHECK (total_minor >= 0),
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  stripe_checkout_session_id text UNIQUE,
  stripe_checkout_url text,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  reserved_until timestamptz NOT NULL,
  paid_at timestamptz,
  refunded_at timestamptz,
  confirmation_email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS ticket_orders_user_idx ON ticket_orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ticket_orders_event_idx ON ticket_orders (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ticket_orders_reservation_idx ON ticket_orders (status, reserved_until);

CREATE TABLE IF NOT EXISTS ticket_order_items (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES ticket_orders(id) ON DELETE CASCADE,
  ticket_type_id uuid NOT NULL REFERENCES ticket_types(id),
  ticket_type_name text NOT NULL,
  unit_price_minor integer NOT NULL CHECK (unit_price_minor >= 0),
  quantity integer NOT NULL CHECK (quantity > 0),
  line_total_minor integer NOT NULL CHECK (line_total_minor >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ticket_order_items_order_idx ON ticket_order_items (order_id);

CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY,
  public_id uuid NOT NULL UNIQUE,
  ticket_number text NOT NULL UNIQUE,
  order_id uuid NOT NULL REFERENCES ticket_orders(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES ticket_order_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  event_id uuid NOT NULL REFERENCES events(id),
  ticket_type_name text NOT NULL,
  status text NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'checked_in', 'void')),
  checked_in_at timestamptz,
  checked_in_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tickets_order_idx ON tickets (order_id);
CREATE INDEX IF NOT EXISTS tickets_event_status_idx ON tickets (event_id, status);

CREATE TABLE IF NOT EXISTS stripe_event_receipts (
  stripe_event_id text PRIMARY KEY,
  event_type text NOT NULL,
  livemode boolean NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_jobs (
  id uuid PRIMARY KEY,
  job_type text NOT NULL CHECK (job_type IN ('verify_email', 'reset_password', 'ticket_confirmation')),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  order_id uuid REFERENCES ticket_orders(id) ON DELETE SET NULL,
  encrypted_payload text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_jobs_worker_idx ON email_jobs (status, available_at, created_at);

CREATE TABLE IF NOT EXISTS ticket_audit_log (
  id uuid PRIMARY KEY,
  actor_user_id uuid REFERENCES users(id),
  ticket_id uuid REFERENCES tickets(id),
  order_id uuid REFERENCES ticket_orders(id),
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
