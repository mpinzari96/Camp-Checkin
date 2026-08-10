/**
 * One-time roster import: seed/registrants.csv → Supabase.
 *
 * Usage:
 *   1. Fill in .env.local (needs SUPABASE_SERVICE_ROLE_KEY)
 *   2. npm run import
 *
 * Safe to re-run: existing (first_name, last_name, email) rows are skipped.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

function loadEnv() {
  try {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch { /* rely on shell env */ }
}
loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

function parseCsv(text) {
  const rows = [];
  let cur = [''], inQ = false, row = cur;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { row[row.length - 1] += '"'; i++; }
      else if (c === '"') inQ = false;
      else row[row.length - 1] += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') row.push('');
    else if (c === '\n' || c === '\r') {
      if (row.length > 1 || row[0] !== '') { rows.push(row); }
      if (c === '\r' && text[i + 1] === '\n') i++;
      row = [''];
    } else row[row.length - 1] += c;
  }
  if (row.length > 1 || row[0] !== '') rows.push(row);
  const header = rows.shift();
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

const seed = parseCsv(readFileSync('seed/registrants.csv', 'utf8'));

const { data: events, error: evErr } = await db.from('events').select('id').eq('is_active', true).limit(1);
if (evErr || !events?.length) {
  console.error('No active event found — run supabase/schema.sql first.');
  process.exit(1);
}
const event_id = events[0].id;

const { data: existing } = await db.from('registrants').select('first_name, last_name, email');
const seen = new Set((existing ?? []).map((r) => `${r.first_name}|${r.last_name}`.toLowerCase()));

const toInsert = seed
  .filter((r) => !seen.has(`${r.first_name}|${r.last_name}`.toLowerCase()))
  .map((r) => ({
    event_id,
    first_name: r.first_name,
    last_name: r.last_name,
    gender: r.gender || null,
    church: r.church || null,
    city: r.city || null,
    state: r.state || null,
    email: r.email || null,
    phone: r.phone || null,
    merch_size: r.merch_size || null,
  }));

if (!toInsert.length) {
  console.log('Nothing to import — all seed rows already exist.');
  process.exit(0);
}
const { error } = await db.from('registrants').insert(toInsert);
if (error) { console.error('Import failed:', error.message); process.exit(1); }
console.log(`Imported ${toInsert.length} registrants (skipped ${seed.length - toInsert.length} already present).`);
