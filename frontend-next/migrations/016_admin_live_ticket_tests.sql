-- Only the authenticated dedicated admin may create these authorisations.
-- Never derive this privilege from Stripe metadata or a customer request flag.
CREATE TABLE ticket_admin_live_tests (
  order_id uuid PRIMARY KEY REFERENCES ticket_orders(id),
  actor_user_id uuid NOT NULL REFERENCES users(id),
  authorised_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CHECK (expires_at > authorised_at AND expires_at <= authorised_at + interval '1 hour')
);
CREATE INDEX ticket_admin_live_tests_actor_idx ON ticket_admin_live_tests(actor_user_id, authorised_at DESC);
