ALTER TABLE ticket_orders ADD COLUMN checkout_attempted_at timestamptz DEFAULT now();
ALTER TABLE ticket_orders ADD COLUMN checkout_last_error text;
ALTER TABLE ticket_orders ADD COLUMN checkout_checked_at timestamptz;
-- The default also protects orders inserted by an older frontend during rollout.
-- New checkout code explicitly writes NULL until it is ready to submit.
-- Old missing-session orders may already have reached Stripe. Never assume otherwise.
UPDATE ticket_orders SET checkout_attempted_at=created_at WHERE status='pending';
ALTER TABLE ticket_worker_health ADD COLUMN last_error text;
ALTER TABLE ticket_worker_health ADD COLUMN last_error_at timestamptz;
