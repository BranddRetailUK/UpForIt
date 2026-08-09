ALTER TABLE ticket_orders
  ALTER COLUMN order_number DROP NOT NULL;

UPDATE ticket_orders
   SET order_number = NULL
 WHERE status IN ('pending', 'expired', 'failed');

ALTER TABLE ticket_orders
  ADD CONSTRAINT ticket_orders_completed_number_check
  CHECK (status IN ('pending', 'expired', 'failed') OR order_number IS NOT NULL);
