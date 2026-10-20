ALTER TABLE ticket_orders ADD COLUMN payment_review_reason text;
ALTER TABLE email_jobs DROP CONSTRAINT email_jobs_job_type_check;
ALTER TABLE email_jobs ADD CONSTRAINT email_jobs_job_type_check
  CHECK (job_type IN ('verify_email','reset_password','ticket_confirmation','ticket_payment_review'));
CREATE UNIQUE INDEX one_payment_review_email_per_order ON email_jobs(order_id)
  WHERE job_type='ticket_payment_review';

-- Preserve state at payment time across closure/reopening and delayed webhooks.
-- Existing state is a baseline, not invented historical evidence.
CREATE TABLE ticket_event_sales_history (
  id bigserial PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  effective_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  status text NOT NULL,
  sales_open boolean NOT NULL
);
CREATE INDEX ticket_event_sales_history_lookup ON ticket_event_sales_history(event_id,effective_at DESC,id DESC);
INSERT INTO ticket_event_sales_history(event_id,status,sales_open)
  SELECT id,status,sales_open FROM events;
CREATE FUNCTION record_ticket_event_sales_state() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status OR NEW.sales_open IS DISTINCT FROM OLD.sales_open THEN
    INSERT INTO ticket_event_sales_history(event_id,status,sales_open) VALUES(NEW.id,NEW.status,NEW.sales_open);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER ticket_event_sales_state AFTER INSERT OR UPDATE OF status,sales_open ON events
  FOR EACH ROW EXECUTE FUNCTION record_ticket_event_sales_state();
