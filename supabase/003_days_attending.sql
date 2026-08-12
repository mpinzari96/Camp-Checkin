-- 003_days_attending.sql
--
-- Adds days_attending to registrants so partial-stay campers (they did not pay for
-- the full stay) are flagged. Allowed values 1, 2, or 3; NULL = full/standard stay.
--
-- Additive & idempotent: safe to re-run. No RLS change (existing registrants policies
-- already cover new columns), no realtime change (registrants is already published),
-- and no RPC (this is a plain profile field, not a conflict-prone state transition).
-- Apply in the Supabase SQL editor or with `supabase db push`.

alter table public.registrants
  add column if not exists days_attending int
    check (days_attending in (1, 2, 3));

-- ---------- Verify ----------
-- Column present:
--   select column_name from information_schema.columns
--    where table_name = 'registrants' and column_name = 'days_attending';  -- 1 row
