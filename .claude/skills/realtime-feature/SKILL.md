---
name: realtime-feature
description: Add or modify a user-facing feature in the camp check-in app that must stay live across devices and optimistic on tap. Use when building things like check-in flows, status toggles, cabin assignment, or any roster mutation volunteers trigger. Ensures the change flows through the single realtime store with optimistic update + rollback, keeps mobile ergonomics, and passes the build.
---

# Realtime Feature

Use for any feature where a volunteer's action changes shared state that other phones
must see immediately.

## Steps
1. Read `docs/DESIRED_OUTCOME.md`.
2. Route all shared-state reads/writes through `hooks/useRegistrants.ts` — do not create
   a second data source for the roster. Extend the store if new actions are needed.
3. For mutations that must be conflict-free, call an atomic RPC (add one via the
   supabase-migration skill if it doesn't exist). For simple field edits, use a normal
   update but keep the optimistic+rollback pattern.
4. Implement the interaction as: optimistic local update → server call → on success
   reconcile with returned row → on error roll back + user-facing toast.
5. Keep it mobile-first: big bottom-anchored primary action, ≥44px targets, 360px-safe,
   high contrast, minimal typing.
6. Run `npm run build`; fix type errors.
7. Finish with a Self-check against the Definition of Done, then recommend running the
   `pre-ship-review` skill as an independent pass.

## Anti-patterns to avoid
- A refresh/refetch button to "make it update" (realtime should handle it).
- Writing check-in timestamps directly instead of via RPC.
- Blocking the whole screen on a spinner for a single-row action.
