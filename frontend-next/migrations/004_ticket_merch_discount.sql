CREATE TABLE IF NOT EXISTS merch_discount_entitlements (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_ticket_order_id uuid NOT NULL REFERENCES ticket_orders(id),
  campaign text NOT NULL DEFAULT 'ticket-merch-20' CHECK (campaign = 'ticket-merch-20'),
  percent_off integer NOT NULL DEFAULT 20 CHECK (percent_off = 20),
  status text NOT NULL DEFAULT 'available' CHECK (
    status IN ('available', 'reserved', 'redeemed', 'revoked')
  ),
  checkout_idempotency_key text,
  stripe_checkout_session_id text,
  reserved_at timestamptz,
  redeemed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id),
  UNIQUE (source_ticket_order_id)
);

CREATE INDEX IF NOT EXISTS merch_discount_entitlements_status_idx
  ON merch_discount_entitlements (user_id, status, created_at);

CREATE TABLE IF NOT EXISTS merch_discount_sync_jobs (
  id uuid PRIMARY KEY,
  entitlement_id uuid NOT NULL REFERENCES merch_discount_entitlements(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('reconcile', 'revoke')),
  event_key text NOT NULL UNIQUE,
  stripe_checkout_session_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'retry', 'delivered', 'dead')
  ),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS merch_discount_sync_jobs_worker_idx
  ON merch_discount_sync_jobs (status, available_at, created_at);

WITH scott_qualifying_order AS (
  SELECT u.id AS user_id, o.id AS order_id
  FROM users u
  JOIN LATERAL (
    SELECT paid.id
    FROM ticket_orders paid
    WHERE paid.user_id = u.id AND paid.status = 'paid'
    ORDER BY paid.paid_at ASC NULLS LAST, paid.created_at ASC
    LIMIT 1
  ) o ON true
  WHERE lower(u.email) = 'scottcharles.rework@gmail.com'
)
INSERT INTO merch_discount_entitlements (
  id, user_id, source_ticket_order_id, status, created_at, updated_at
)
SELECT order_id, user_id, order_id, 'available', now(), now()
FROM scott_qualifying_order
ON CONFLICT (user_id) DO NOTHING;
