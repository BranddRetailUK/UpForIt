ALTER TABLE ticket_orders
  ADD COLUMN IF NOT EXISTS meta_consent_granted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS meta_checkout_event_id text,
  ADD COLUMN IF NOT EXISTS meta_purchase_event_id text,
  ADD COLUMN IF NOT EXISTS meta_context_encrypted text;

CREATE TABLE IF NOT EXISTS meta_conversion_jobs (
  id uuid PRIMARY KEY,
  order_id uuid REFERENCES ticket_orders(id) ON DELETE SET NULL,
  event_name text NOT NULL CHECK (event_name IN ('InitiateCheckout', 'Purchase')),
  event_id text NOT NULL UNIQUE,
  encrypted_payload text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'retry', 'delivered', 'dead')
  ),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  delivered_at timestamptz,
  response_status integer,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meta_conversion_jobs_worker_idx
  ON meta_conversion_jobs (status, available_at, created_at);

CREATE INDEX IF NOT EXISTS meta_conversion_jobs_order_idx
  ON meta_conversion_jobs (order_id, created_at);
