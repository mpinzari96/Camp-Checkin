-- 002_two_state_checkin_and_liability_toggle.sql
--
-- Two changes to the registrant experience:
--   1. Collapse check-in to two states only (Checked in / Not checked in) by
--      removing the checked-out state entirely: drop the check_out / undo_check_out
--      RPCs and the checked_out_at / checked_out_by columns, and rebuild check_in
--      so it no longer references the removed columns.
--   2. Let any authenticated volunteer (not just admins) toggle a registrant's
--      liability form via a new atomic, audited set_liability RPC.
--
-- Destructive but idempotent where possible: this migration DROPS the check-out
-- columns (checked_out_at / checked_out_by) and the check_out / undo_check_out RPCs,
-- so it is not purely additive. Apply with the Supabase SQL editor or
-- `supabase db push`. Verify: see the notes at the bottom of this file.

-- ---------- 1. Rebuild check_in without the check-out columns ----------
-- Same conflict-safe guard (only transitions a not-yet-checked-in registrant);
-- just no longer clears checked_out_* (those columns are being dropped below).
create or replace function public.check_in(reg_id uuid)
returns public.registrants language plpgsql security definer set search_path = public as $$
declare r public.registrants;
begin
  update public.registrants
     set checked_in_at = now(), checked_in_by = auth.uid()
   where id = reg_id and checked_in_at is null
   returning * into r;
  if r.id is null then
    raise exception 'ALREADY_CHECKED_IN' using errcode = 'P0001';
  end if;
  insert into audit_log (registrant_id, actor_id, action) values (reg_id, auth.uid(), 'check_in');
  return r;
end $$;

-- SECURITY DEFINER functions get PUBLIC execute by default; revoke it so anon
-- can't call them, then grant only authenticated.
revoke all on function public.check_in(uuid) from public;
grant execute on function public.check_in(uuid) to authenticated;

-- ---------- 2. Remove the check-out RPCs entirely ----------
drop function if exists public.check_out(uuid);
drop function if exists public.undo_check_out(uuid);

-- ---------- 3. Drop the check-out columns ----------
alter table public.registrants
  drop column if exists checked_out_at,
  drop column if exists checked_out_by;

-- ---------- 4. Audited, conflict-safe liability toggle ----------
-- security definer so any authenticated volunteer can flip the flag without a
-- relaxed RLS policy; every toggle records the actor + new value in audit_log.
create or replace function public.set_liability(reg_id uuid, complete boolean)
returns public.registrants language plpgsql security definer set search_path = public as $$
declare r public.registrants;
begin
  update public.registrants
     set liability_complete = complete
   where id = reg_id
   returning * into r;
  if r.id is null then
    raise exception 'REGISTRANT_NOT_FOUND' using errcode = 'P0001';
  end if;
  insert into audit_log (registrant_id, actor_id, action, detail)
    values (reg_id, auth.uid(), 'set_liability', jsonb_build_object('complete', complete));
  return r;
end $$;

revoke all on function public.set_liability(uuid, boolean) from public;
grant execute on function public.set_liability(uuid, boolean) to authenticated;

-- ---------- Verify ----------
-- 1. Columns gone:
--      select column_name from information_schema.columns
--       where table_name = 'registrants' and column_name like 'checked_out%';  -- 0 rows
-- 2. RPCs gone / added:
--      select proname from pg_proc where proname in
--        ('check_out','undo_check_out','set_liability');  -- only set_liability
-- 3. Toggle audits: call set_liability on a test row, then
--      select * from audit_log where action = 'set_liability' order by created_at desc limit 1;
