-- Nullable: existing orders have no retrospectively inferred attribution.
ALTER TABLE ticket_orders ADD COLUMN IF NOT EXISTS source_attribution jsonb;
