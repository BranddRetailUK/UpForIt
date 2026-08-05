UPDATE ticket_types
SET capacity = CASE id
  WHEN '8756ca79-53f1-4dd1-9298-c07e85fd10e1'::uuid THEN 50
  WHEN '8756ca79-53f1-4dd1-9298-c07e85fd10e2'::uuid THEN 100
  WHEN '8756ca79-53f1-4dd1-9298-c07e85fd10e3'::uuid THEN NULL
  ELSE capacity
END,
max_per_order = CASE
  WHEN id IN (
    '8756ca79-53f1-4dd1-9298-c07e85fd10e1'::uuid,
    '8756ca79-53f1-4dd1-9298-c07e85fd10e2'::uuid,
    '8756ca79-53f1-4dd1-9298-c07e85fd10e3'::uuid
  ) THEN 10
  ELSE max_per_order
END,
updated_at = now()
WHERE event_id = '4e37f654-31f8-4c86-a59e-bf4e72c7f0a1'::uuid;

WITH paid AS (
  SELECT
    COALESCE(sum(i.quantity) FILTER (
      WHERE i.ticket_type_id = '8756ca79-53f1-4dd1-9298-c07e85fd10e1'::uuid
    ), 0) AS early_bird,
    COALESCE(sum(i.quantity) FILTER (
      WHERE i.ticket_type_id = '8756ca79-53f1-4dd1-9298-c07e85fd10e2'::uuid
    ), 0) AS tier_one
  FROM ticket_order_items i
  JOIN ticket_orders o ON o.id = i.order_id
  WHERE o.status = 'paid'
    AND o.event_id = '4e37f654-31f8-4c86-a59e-bf4e72c7f0a1'::uuid
)
UPDATE ticket_types tt
SET is_active = CASE
  WHEN paid.early_bird < 50 THEN tt.id = '8756ca79-53f1-4dd1-9298-c07e85fd10e1'::uuid
  WHEN paid.tier_one < 100 THEN tt.id = '8756ca79-53f1-4dd1-9298-c07e85fd10e2'::uuid
  ELSE tt.id = '8756ca79-53f1-4dd1-9298-c07e85fd10e3'::uuid
END,
updated_at = now()
FROM paid
WHERE tt.event_id = '4e37f654-31f8-4c86-a59e-bf4e72c7f0a1'::uuid;

