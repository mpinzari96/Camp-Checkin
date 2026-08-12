-- add-dob.sql
-- Adds date_of_birth to registrants, needed by the one-time Tally liability backfill
-- (scripts/backfill-from-tally.mjs). Idempotent and safe to re-run.
-- Apply in the Supabase SQL editor, or with `supabase db push`.
alter table public.registrants add column if not exists date_of_birth date;
