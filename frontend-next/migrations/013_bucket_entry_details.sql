-- Existing entries retain null details; do not infer historical attendance consent.
ALTER TABLE bucket_entries
  ADD COLUMN full_name text CHECK (length(btrim(full_name)) BETWEEN 1 AND 120),
  ADD COLUMN email text,
  ADD COLUMN phone text CHECK (length(phone) BETWEEN 7 AND 30),
  ADD COLUMN attendance_confirmed_at timestamptz;
