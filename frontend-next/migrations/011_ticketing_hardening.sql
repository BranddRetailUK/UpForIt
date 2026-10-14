ALTER TABLE events ADD COLUMN sales_open boolean NOT NULL DEFAULT false;
ALTER TABLE events ADD COLUMN merch_discount_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE ticket_orders ADD COLUMN fulfilled_at timestamptz;
ALTER TABLE ticket_orders ADD COLUMN refunded_minor integer NOT NULL DEFAULT 0 CHECK (refunded_minor >= 0);
ALTER TABLE ticket_orders ADD COLUMN admissions_hold boolean NOT NULL DEFAULT false;
ALTER TABLE ticket_orders ADD COLUMN checkout_payload jsonb;
ALTER TABLE ticket_orders ADD COLUMN checkout_state text NOT NULL DEFAULT 'created' CHECK (checkout_state IN ('created','ready','review'));
UPDATE ticket_orders SET fulfilled_at = COALESCE(paid_at, updated_at) WHERE EXISTS (SELECT 1 FROM tickets t WHERE t.order_id = ticket_orders.id);
UPDATE ticket_orders SET refunded_minor = total_minor, admissions_hold = true WHERE status = 'refunded';
UPDATE ticket_orders SET admissions_hold = true WHERE status = 'refund_review';
ALTER TABLE tickets ADD COLUMN admission_index integer;
WITH numbered AS (SELECT id, row_number() OVER (PARTITION BY order_item_id ORDER BY created_at, ticket_number)::integer AS n FROM tickets)
UPDATE tickets SET admission_index = numbered.n FROM numbered WHERE tickets.id = numbered.id;
ALTER TABLE tickets ALTER COLUMN admission_index SET NOT NULL;
ALTER TABLE tickets ADD CONSTRAINT ticket_item_admission_unique UNIQUE (order_item_id, admission_index);
CREATE TABLE ticket_payment_adjustments (
  payment_intent_id text PRIMARY KEY,
  charge_id text NOT NULL,
  amount_minor integer NOT NULL,
  refunded_minor integer NOT NULL DEFAULT 0,
  currency text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ticket_payment_disputes (
  id text PRIMARY KEY, payment_intent_id text NOT NULL, status text NOT NULL, event_created bigint NOT NULL
);
ALTER TABLE email_jobs DROP CONSTRAINT email_jobs_status_check;
ALTER TABLE email_jobs ADD CONSTRAINT email_jobs_status_check CHECK (status IN ('pending','processing','sent','failed','unknown','cancelled','delivered','bounced'));
ALTER TABLE email_jobs ADD COLUMN provider_message_id text;
ALTER TABLE email_jobs ADD COLUMN delivery_updated_at timestamptz;
ALTER TABLE email_jobs ADD COLUMN sending_at timestamptz;
CREATE TABLE ticket_email_events (id text PRIMARY KEY, job_id uuid NOT NULL REFERENCES email_jobs(id), event text NOT NULL, occurred_at timestamptz NOT NULL);
CREATE TABLE ticket_worker_health (worker text PRIMARY KEY, heartbeat_at timestamptz NOT NULL DEFAULT now());
