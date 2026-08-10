---
name: supabase-migration
description: Create a safe, additive Supabase migration for the camp check-in app. Use when the user wants to add or change database tables, columns, policies, functions, or realtime — e.g. "add a cabins table", "add a field for meal count", "let volunteers see X". Produces a new numbered .sql migration with RLS policies and (if needed) atomic RPCs and realtime registration, without breaking existing invariants.
---

# Supabase Migration

Produce a new migration file; never edit `supabase/schema.sql` in place.

## Steps
1. Read `docs/DESIRED_OUTCOME.md` for the invariants.
2. Look at existing `supabase/*.sql` to find the next number (e.g. `002_`, `003_`).
3. Write `supabase/<NNN>_<short_name>.sql` that is:
   - **Additive & idempotent**: `add column if not exists`, `create table if not exists`,
     `create or replace function`.
   - **RLS-complete**: any new table gets `enable row level security` + explicit policies
     matching the role model (volunteers: check-in/out + walk-in insert; admins: full).
   - **Realtime-aware**: if the UI must see live changes, add the table to
     `alter publication supabase_realtime add table ...`.
   - **Conflict-safe**: if it introduces a state transition that two volunteers could
     race, implement it as a `security definer` function with a guarded `UPDATE ... WHERE`,
     mirroring `check_in`. Grant execute to `authenticated`.
   - **Audited**: critical mutations insert into `audit_log`.
4. If the app code must change to use it, list exactly which files and how — but keep the
   migration and code changes clearly separated.
5. Tell the user the one command to apply it (paste into Supabase SQL editor, or
   `supabase db push`), and how to verify (a `select` or a UI check).

## Guardrails
- Never weaken an existing policy to make something work; add a scoped one.
- Never require the service role in client code to satisfy a query.
- Keep everything event-scoped (`event_id`) so multi-camp still works later.
