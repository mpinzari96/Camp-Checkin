# Follow-up task: tighten registrant write access + full audit coverage

> Surfaced as pre-existing issues (#4, #5) during the two-state-check-in review. They were
> correctly left out of that task's scope. Run this as its own Builder→Reviewer loop.

## Builder prompt (paste into the Builder chat)

```
Goal: Close two pre-existing gaps in the camp check-in app's write security and audit
trail, without changing any user-visible behavior. (1) Volunteers can currently UPDATE
every column on any registrant via a broad RLS policy; tighten this so volunteers can
only perform their intended actions (check-in/undo and liability toggle, which already
go through SECURITY DEFINER RPCs), while full row edits, deletes, and exports stay
admin-only. (2) Walk-in creation, profile edits, and deletes are not written to the
audit log; make every critical mutation audited.

Acceptance criteria:
  Write access:
  - The registrants UPDATE policy no longer lets an ordinary volunteer edit arbitrary
    columns directly. Volunteer-permitted changes continue to work ONLY through the
    existing audited RPCs (check_in, undo_check_in, set_liability).
  - Admin full-row edit, delete, and CSV export continue to work unchanged for admins.
  - Walk-in registrant creation by volunteers still works (that path is intended).
  - No user-facing behavior changes for either role beyond the tightened boundary;
    verify the volunteer liability toggle and check-in still work end to end.

  Audit coverage:
  - Walk-in create, admin profile edit, and delete each write an audit_log row
    (actor + registrant + action + relevant detail).
  - Prefer database-level enforcement (triggers or SECURITY DEFINER RPCs) over relying
    on client code to remember to audit, so a future code path can't silently skip it.

Constraints:
  - Follow docs/DESIRED_OUTCOME.md. This task MAY change invariant #4/#5 wording if the
    enforcement mechanism changes — update the doc to match what you actually implement.
  - All DB changes are a new numbered migration under supabase/ (e.g. 003_...). Additive
    where possible; if you replace a policy, drop-and-recreate it in the migration.
  - Do not weaken any admin capability. Do not break the volunteer flows that are
    supposed to work (check-in, undo, liability toggle, walk-in add).
  - Keep hooks/useRegistrants.ts the single realtime source of truth.

Process:
  1. Give me a short plan first (files + migration), then implement.
  2. Use the supabase-migration skill for the policy/trigger/RPC work.
  3. Run npm run build and fix errors.
  4. End with a Self-check against the Definition of Done.
Then STOP. Do not commit. Tell me to run the reviewer.
```

## Reviewer focus for this one
When you run the pre-ship-review pass, make the verdict explicitly confirm:
- A volunteer genuinely cannot UPDATE arbitrary registrant columns directly anymore
  (test the intent: would a raw `.update()` from a volunteer session be rejected?).
- Admin edit/delete/export still function.
- The three volunteer flows (check-in, undo, liability toggle) and walk-in add still work.
- create / edit / delete each produce an audit row, enforced at the DB level.
- This is a behavior-preserving hardening — no new capability was handed to volunteers.
