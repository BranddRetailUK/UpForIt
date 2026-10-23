ALTER TABLE ticket_orders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE tickets ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE ticket_orders ADD COLUMN guest_name text, ADD COLUMN guest_email text, ADD COLUMN guest_access_hash text;
ALTER TABLE ticket_orders ADD CONSTRAINT ticket_order_buyer_required CHECK (
 user_id IS NOT NULL OR (guest_name IS NOT NULL AND guest_email IS NOT NULL AND guest_access_hash IS NOT NULL)
);
CREATE UNIQUE INDEX ticket_orders_guest_checkout_unique ON ticket_orders(guest_access_hash,idempotency_key) WHERE user_id IS NULL;
