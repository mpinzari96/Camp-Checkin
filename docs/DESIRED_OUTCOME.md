# Camp Check-In — Desired Outcome (North Star)

> Every agent reads this file before planning or writing code. If a change conflicts
> with anything here, stop and flag it rather than "fixing" it silently.

## The one-sentence goal
A fast, reliable, mobile-first PWA that lets multiple volunteers check campers in and
out simultaneously with no conflicts, no page refreshes, and minimal taps — polished
enough to feel like a native commercial app.

## Who uses it
Non-technical volunteers, on phones, outdoors, under time pressure, one-handed, on
flaky Wi-Fi. Speed and obviousness beat features every time.

## Non-negotiable invariants (never regress these)
1. **No duplicate check-ins.** Check-in/out state changes go ONLY through the atomic
   Postgres RPCs (`check_in`, `undo_check_in`, `check_out`, `undo_check_out`). Never
   write `checked_in_at` directly from the client.
2. **Live everywhere.** Any change on one device appears on all others via Supabase
   Realtime with no refresh. Never introduce a flow that needs a manual reload.
3. **Optimistic UI with rollback.** Actions reflect instantly, then reconcile with the
   server; on failure they roll back and show a clear message.
4. **Security holds.** RLS stays on. Volunteers can check in/out and add walk-ins;
   only admins edit, delete, change liability, export, or view the audit log. The
   service-role key never ships to the browser (never in a `NEXT_PUBLIC_` var).
5. **Every critical action is audited** (check-in/out, edits, deletes, walk-ins,
   liability webhook) with who + when.
6. **Liability status is obvious** — a clear ✅ / ❌ on the row and the profile.
7. **Mobile-first.** Touch targets ≥ 44px, works at 360px wide, installable PWA,
   app shell cached for offline resilience.

## Definition of Done (a task isn't finished until all are true)
- [ ] `npm run build` passes with no type errors.
- [ ] No invariant above is violated (see the review checklist).
- [ ] New DB changes are a migration file in `supabase/`, not manual dashboard edits.
- [ ] New realtime-affecting code keeps a single source of truth (the `useRegistrants` store).
- [ ] UI changes keep large touch targets and high contrast; tested mentally at 360px.
- [ ] No secrets added to client code or committed env files.
- [ ] The change is described in plain language a volunteer coordinator could understand.

## Current architecture (don't drift from this without flagging)
- Next.js (App Router) + TypeScript, deployed on Vercel.
- Supabase: Postgres + Auth + Realtime; RLS on every table.
- State: one client-side realtime store (`hooks/useRegistrants.ts`) is the source of truth.
- Search: in-memory fuzzy (`lib/search.ts`) over the full roster (camp-sized list).
- Webhook: `app/api/tally-webhook/route.ts` matches liability forms by name (+ DOB tiebreak).

## Roadmap (future — build toward these without over-engineering now)
Cabins, small groups, QR/barcode check-in, day-by-day attendance, meal tracking,
parent-pickup verification, SMS, multiple camps/events. The schema is already
event-scoped and has cabin/group columns; extend, don't refactor.

## Explicit non-goals
- No feature that requires volunteers to type more than necessary.
- No dependency added just for polish if a few lines of CSS/React would do.
- No breaking change to the check-in RPC contract without updating this doc first.
