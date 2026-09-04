ALTER TABLE ticket_types
ADD COLUMN IF NOT EXISTS archived_at timestamptz;

UPDATE ticket_types
SET name = CASE id
      WHEN '8756ca79-53f1-4dd1-9298-c07e85fd10e2'::uuid THEN 'Archived ticket type 2'
      WHEN '8756ca79-53f1-4dd1-9298-c07e85fd10e3'::uuid THEN 'Archived ticket type 3'
      ELSE name
    END,
    is_active = false,
    archived_at = COALESCE(archived_at, now()),
    updated_at = now()
WHERE id IN (
  '8756ca79-53f1-4dd1-9298-c07e85fd10e2'::uuid,
  '8756ca79-53f1-4dd1-9298-c07e85fd10e3'::uuid
);

UPDATE ticket_types
SET name = 'General Release',
    price_minor = 500,
    currency = 'gbp',
    capacity = NULL,
    max_per_order = 10,
    sales_start_at = NULL,
    sales_end_at = NULL,
    is_active = true,
    sort_order = 10,
    archived_at = NULL,
    updated_at = now()
WHERE id = '8756ca79-53f1-4dd1-9298-c07e85fd10e1'::uuid;

CREATE INDEX IF NOT EXISTS ticket_types_current_event_idx
ON ticket_types (event_id, sort_order)
WHERE archived_at IS NULL;
