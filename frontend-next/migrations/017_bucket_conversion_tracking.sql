ALTER TABLE meta_conversion_jobs
  DROP CONSTRAINT meta_conversion_jobs_event_name_check;
ALTER TABLE meta_conversion_jobs
  ADD CONSTRAINT meta_conversion_jobs_event_name_check
  CHECK (event_name IN ('InitiateCheckout', 'Purchase', 'CompleteRegistration'));
