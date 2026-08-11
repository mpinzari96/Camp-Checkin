# Camp Check-In

A fast, mobile-first PWA for camp registration and on-site check-in. Built for many volunteers working the same line at once: every check-in syncs live to every phone, duplicate check-ins are blocked at the database level, and the whole roster searches instantly — typos included.

Your 2026 roster (161 registrants, with cleaned church names, gender, and hoodie sizes) ships in `seed/registrants.csv`, ready to import.

## What's inside

| Piece | Where |
|---|---|
| Database schema, roles, atomic check-in functions, audit log | `supabase/schema.sql` |
| Check-in dashboard (search + roster) | `app/(app)/page.tsx` |
| Registrant profile with CHECK IN + undo and a liability toggle | `app/(app)/registrant/[id]/page.tsx` |
| Admin dashboard (totals, edit, delete, CSV export, activity log) | `app/(app)/admin/page.tsx` |
| Live-sync + optimistic-update store | `hooks/useRegistrants.ts` |
| Fuzzy search | `lib/search.ts` |
| PWA (installable, offline shell) | `public/manifest.json`, `public/sw.js` |
| Roster import script + your seed data | `scripts/import-registrants.mjs`, `seed/registrants.csv` |

## Setup (about 20 minutes)

### 1. Create the Supabase project
1. [supabase.com](https://supabase.com) → New project.
2. SQL Editor → paste the entire contents of `supabase/schema.sql` → Run.
3. Project Settings → API: copy the **Project URL**, **anon key**, and **service_role key**.

### 2. Configure and run the app
```bash
cp .env.example .env.local   # fill in the three Supabase values
npm install
npm run import               # loads the 161-person roster
npm run dev                  # http://localhost:3000
```

### 3. Create volunteer accounts
Supabase Dashboard → Authentication → Users → **Add user** (email + password) for each volunteer. Everyone starts as a `volunteer`.

To promote yourself to admin, run in the SQL editor:
```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```

**Roles:** volunteers can search, view profiles, check campers in (with undo), toggle a registrant's liability status, and add walk-ins. Only admins can edit full profiles, delete records, export CSV, and see the audit log. Liability is set manually in-app — there's no auto-import.

### 4. Deploy (Vercel recommended)
1. Push this folder to a GitHub repo.
2. [vercel.com](https://vercel.com) → Import the repo.
3. Add the three environment variables from `.env.local` in Vercel's project settings.
4. Deploy. Your app is live at `https://your-app.vercel.app`.

### 5. Install on volunteers' phones
Open the site in Safari (iOS) or Chrome (Android) → Share → **Add to Home Screen**. It launches full-screen like a native app and keeps working through flaky camp Wi-Fi (the app shell is cached; live data reconnects automatically, and the header shows a banner while offline).

## How duplicate check-ins are prevented

Check-in state changes don't go through ordinary updates — they go through Postgres functions (`check_in`, `undo_check_in`) whose `UPDATE ... WHERE checked_in_at IS NULL` clause makes the transition atomic. If two volunteers tap CHECK IN at the same moment, exactly one succeeds; the other phone rolls back its optimistic update and shows "Another volunteer just checked this camper in." Every transition also writes an audit row with who did it and when.

## Future features the schema already supports

Cabins and small groups (columns exist, shown on profiles when set), multiple camps/events (`events` table — everything is event-scoped), QR/barcode check-in (registrant UUIDs are stable scan targets), day-by-day attendance and meal tracking (add event rows to `audit_log`-style tables), parent pickup verification, and SMS (emergency phone numbers are structured and clean).

## Troubleshooting

- **"Sign-in failed"** — the user doesn't exist yet in Supabase Auth, or the password is wrong.
- **Roster is empty** — run `npm run import`, and confirm the SQL schema ran without errors.
- **Realtime not updating** — make sure the last line of `schema.sql` ran (`alter publication supabase_realtime add table public.registrants;`), and that Realtime is enabled for the project.
