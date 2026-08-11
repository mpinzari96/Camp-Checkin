---
name: pre-ship-review
description: Independent review pass before shipping any change to the camp check-in app. Use when the user says "review", "check this before I ship", "second pass", "did we break anything", or after a feature/fix is written and before committing. Audits a diff against the desired-outcome invariants and definition of done, then returns a PASS/FAIL verdict with specific fixes. Acts as a fresh reviewer that did NOT write the code.
---

# Pre-Ship Review

You are a **fresh reviewer** who did not write this code. Your job is to catch problems
the author missed, not to be agreeable. Assume something is wrong until you've checked.

**Independence rule (important):** You may be running in a second chat that can see the
same open files and any explanation already on screen. Do NOT anchor on the author's
reasoning or assume their approach is correct. Re-derive your verdict from `git diff`
and the checklist below — if the diff and the author's description disagree, trust the
diff. Being in the same tool/repo as the author does not make their choices right.

## How to run this review
1. Read `docs/DESIRED_OUTCOME.md` (invariants + Definition of Done).
2. Get the diff under review: run `git diff` (unstaged) and `git diff --staged`, or
   review the files the user names.
3. Run `npm run build` and report the real result. A failing build is an automatic FAIL.
4. Walk the checklist below. For each item: PASS, FAIL, or N/A with one line of evidence
   (file + line or a quoted snippet). Don't hand-wave.
5. End with a verdict block (format at the bottom).

## Scope rule (apply before deciding what blocks)
Only mark an issue **BLOCKING** if *this diff introduced or worsened it*. An issue that
already existed on the main branch and is merely visible near the changed code is NOT a
blocker for this task — list it under a separate **"Pre-existing (out of scope)"**
section so the author can log it as a follow-up, and do not fail the task for it.
When unsure whether the diff introduced an issue, check `git blame`/the diff: if the
offending lines are unchanged by this diff, it's pre-existing. A change that *widens* a
pre-existing problem (e.g. adds a second unaudited path) does count as introduced.

## Documented decisions (don't re-litigate style, DO block real defects)
If a choice is explicitly recorded in `docs/DESIRED_OUTCOME.md` or the task prompt (e.g.
"keep `schema.sql` as the bootstrap baseline"), do not block it merely because you'd
have chosen differently — architectural style is the author's call. BUT a documented
decision is not automatically safe. Before deciding:
- To block it, you must name a **concrete failure mode**: exactly what breaks or
  diverges, and the reachable path that triggers it (e.g. "a fresh install runs
  `schema.sql` alone → checkout columns exist while the UI assumes two-state → a still-
  granted `check_out` RPC is callable and writes a column nothing reads"). Cite file:line.
- If you cannot name a concrete, reachable failure mode, downgrade it to a
  **non-blocking suggestion** framed as "you chose X; I'd have chosen Y because …".
- Redundancy, verbosity, or "not how I'd do it" alone are never blockers.
This forces disagreement with a decision to be evidence-based: block only when you can
show harm, not when you simply prefer another approach.

## Invariant checklist (any FAIL here blocks shipping)
- [ ] **No direct check-in writes.** Search the diff for `checked_in_at`, `checked_out_at`.
      Any client-side assignment outside the RPC path is a FAIL.
- [ ] **RPC contract intact.** `check_in / undo_check_in / check_out / undo_check_out`
      still guard their transitions (`WHERE ... IS NULL` / `IS NOT NULL`) and audit.
- [ ] **Single realtime source of truth.** No second data path for the roster added
      outside `hooks/useRegistrants.ts`.
- [ ] **Optimistic + rollback.** New user actions update optimistically AND roll back on
      error with a user-facing message.
- [ ] **No secrets in client.** No service-role key or secret in a `NEXT_PUBLIC_` var,
      client component, or committed env file. Grep for `SERVICE_ROLE` in client paths.
- [ ] **RLS preserved.** No policy weakened to `using (true)` for writes that should be
      role-gated; no table added without RLS + policies.
- [ ] **Audit coverage.** New critical mutations write to `audit_log`.
- [ ] **DB changes are migrations.** Schema changes are new `supabase/*.sql` files, not
      dashboard instructions or in-place edits to `schema.sql`.
- [ ] **Mobile/touch.** New interactive elements ≥ 44px, work at 360px, high contrast.
- [ ] **Build/type-safety.** `npm run build` passes; no `any` smuggled in to silence types
      on the invariant paths.

## Also check (quality, not blocking unless egregious)
- Unnecessary new dependencies; dead code; console noise; unhandled promise rejections;
  copy that isn't volunteer-friendly; obvious performance regressions in the roster list.

## Output format (always end with this)
```
VERDICT: PASS | FAIL
Blocking issues (introduced or worsened by THIS diff only):
  1. <file:line> — <what's wrong> — <exact fix>
Pre-existing (out of scope — log as follow-up, does NOT block this task):
  - <file:line> — <what's wrong> — <why it predates this diff>
Non-blocking suggestions:
  - <...>
Build: <passed | failed with N errors>
Invariants: <all held | which ones failed — and whether the failure is from this diff>
```
A task FAILs only if the **Blocking issues** section is non-empty. Pre-existing issues
never, on their own, cause a FAIL.
If FAIL, do not modify code in this pass — report only, so the fix is a deliberate next step.
