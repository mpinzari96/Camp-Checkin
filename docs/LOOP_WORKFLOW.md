# Loop Workflow — how to build without babysitting

The goal: give the agent a target once, and have it build → self-check → get reviewed
→ fix, so you approve rather than re-prompt. This uses two "hats": a **Builder** and an
independent **Reviewer**.

## Primary setup: two Cursor chats, different models

Run two Cursor Agent chats side by side and assign each a **different model**:

- **Builder chat** — one model. Plans, writes code, runs the build, self-checks.
- **Reviewer chat** — a *different-family* model. Reviews the diff cold, returns PASS/FAIL.

Why different models (not just two chats): a second chat on the *same* model tends to
think the same way and rubber-stamp. The value is two different training backgrounds =
two different blind spots. Pair across families (e.g. a Claude model as Builder and a
different family as Reviewer, or swap them) so the review actually catches things.

The rules in `.cursor/rules/*.mdc` and the skills in `.claude/skills/` apply to both
chats automatically, so standards are enforced without restating them.

## The loop (per task)

```
   You: one-time task + acceptance criteria
        │
        ▼
   ┌─────────────┐   plan → build → npm run build → Self-check
   │  BUILDER     │   (Cursor chat A · model 1)
   └─────┬───────┘   uses realtime-feature / supabase-migration skills
         │ leaves an uncommitted diff + Self-check
         ▼
   ┌─────────────┐   fresh eyes → runs pre-ship-review skill
   │  REVIEWER    │   (Cursor chat B · model 2)
   └─────┬───────┘   → VERDICT: PASS | FAIL + specific fixes
         │
     PASS│FAIL
         │   └──► Builder applies ONLY the listed fixes, re-review (max 3 rounds)
         ▼
   You approve & commit
```

## One-time task prompt (Builder chat)
```
Goal: <what you want, in one or two sentences>
Acceptance criteria:
  - <observable outcome 1>
  - <observable outcome 2>
Constraints: follow docs/DESIRED_OUTCOME.md. Don't touch anything outside this task.
Process:
  1. Give me a short plan first, then implement.
  2. Use the relevant skill(s) (supabase-migration / realtime-feature).
  3. Run npm run build and fix errors.
  4. End with a Self-check against the Definition of Done.
Then STOP. Do not commit. Tell me to run the reviewer.
```

## Reviewer prompt (Reviewer chat — different model)
```
You did NOT write this code. Do not assume the author's approach is correct.
Start from `git diff` (the uncommitted changes) and the pre-ship-review skill's
invariant checklist — not from any explanation already on screen.
Use the pre-ship-review skill and return the VERDICT block. If FAIL, list exact
fixes with file:line. Do not modify code.
```

The first two lines matter: both Cursor chats can see the same open files and repo
state, so the Reviewer is *mostly* independent, not perfectly. That instruction forces
it to re-derive the verdict from the diff instead of agreeing with what it sees.

## Fix prompt (back to Builder chat)
```
Reviewer verdict:
<paste VERDICT block>
Apply ONLY the blocking fixes, re-run npm run build, update the Self-check, then stop.
Tell me to re-review.
```

## Your total involvement per task
Paste the goal once → skim the plan (~30s) → paste the verdict across 1–3 times →
approve the commit. That's the "not babysitting" state.

## When to reach for maximum independence (the exception)
Two Cursor chats share files, rules, and repo state, so independence is high but not
total. For a few high-stakes changes you may want a reviewer with *zero* shared context:

- changes to the check-in RPC contract,
- security-sensitive migrations or RLS/policy changes,
- anything touching secrets or the service-role path.

For those, run the **Reviewer in a different tool** (e.g. Claude Code in the terminal)
against the same `git diff`. Slower handoff (you paste the diff/verdict between tools),
maximum independence. Use it deliberately, not as the default — the two-chat setup above
is the efficient everyday path.

## Guardrails on the loop itself
- Builder never commits before review; the uncommitted diff is always the review target.
- Cap at ~3 review rounds. If it can't converge, the **spec** is underspecified — stop
  looping and tighten `DESIRED_OUTCOME.md` or the task prompt.
- Correct the same thing twice? Don't just fix it in chat — add it to
  `DESIRED_OUTCOME.md` or a `.cursor/rule` so the system needs less of you next time.

## Plan-first for bigger features
For anything non-trivial, have the Builder write the plan to `docs/plans/<feature>.md`
first. You skim it before code is written. Catching a wrong plan is ~10x cheaper than
reviewing wrong code.
