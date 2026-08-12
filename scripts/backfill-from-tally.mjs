/**
 * One-time backfill from the Tally "Release of Liability" CSV into registrant profiles.
 *
 * Fills, for each confidently-matched registrant:
 *   - emergency_name   <- "Emergency Contact Name"
 *   - emergency_phone  <- "Emergency Contact Phone Number"
 *   - medical_notes    <- "Medical Conditions, Allergies, or Medications"
 *   - liability_complete = true  (they submitted the form)
 *
 * DOB/age are intentionally NOT imported: the CSV birth dates include bad values
 * (mistyped / future years) that would produce wrong ages, so they're left alone.
 *
 * MATCHING (name-only; the roster has no DOB/email to key on):
 *   Tier 1  exact normalized first+last, unique          -> auto-apply
 *   Tier 2  first WORD of first name + last, unique       -> auto-apply (handles middle names)
 *   Tier 3  last name + first initial, unique             -> auto-apply
 *   Tier 4  Slavic feminine surname fold (…ova/…ova→…ov,  -> auto-apply if unique
 *           …skaya→…skiy), first-initial + last, unique
 *   anything ambiguous or unmatched                       -> REVIEW list, never written
 *
 * SAFETY: dry-run by default. Prints the plan + full review list and writes nothing.
 * Re-run with --commit to apply. Review-pile rows are always left for you to do by hand
 * in the app (manual liability toggle + profile edit).
 *
 * Usage:
 *   node scripts/backfill-from-tally.mjs <tally.csv>            # dry run
 *   node scripts/backfill-from-tally.mjs <tally.csv> --commit   # apply
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

function loadEnv() {
  try {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {}
}
loadEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing Supabase env vars in .env.local'); process.exit(1); }

const csvPath = process.argv[2];
const COMMIT = process.argv.includes('--commit');
if (!csvPath) { console.error('Usage: node scripts/backfill-from-tally.mjs <tally.csv> [--commit]'); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });

// ---- CSV parse ----
function parseCsv(text) {
  const rows = []; let row = [''], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"' && text[i+1] === '"') { row[row.length-1]+='"'; i++; } else if (c === '"') inQ=false; else row[row.length-1]+=c; }
    else if (c === '"') inQ = true;
    else if (c === ',') row.push('');
    else if (c === '\n' || c === '\r') { if (row.length>1||row[0]!=='') rows.push(row); if (c==='\r'&&text[i+1]==='\n') i++; row=['']; }
    else row[row.length-1]+=c;
  }
  if (row.length>1||row[0]!=='') rows.push(row);
  const header = rows.shift().map(h => h.replace(/^\ufeff/,'').replace(/"/g,'').trim());
  return rows.map(r => Object.fromEntries(header.map((h,i) => [h,(r[i]??'').trim()])));
}

const norm = s => (s||'').toLowerCase().replace(/[^a-zа-я]/gi,'');
const firstWord = s => ((s||'').trim().split(/\s+/)[0]||'');
function femFold(nl) { // Slavic feminine surname -> masculine root (for matching only)
  return nl.replace(/(ova|eva|ina)$/,'ov').replace(/(skaya|ska)$/,'skiy').replace(/a$/,'');
}
const T = parseCsv(readFileSync(csvPath,'utf8'));
const col = {
  fn:'Participant First Name', ln:'Participant Last Name', dob:'Participant Date of Birth',
  ecName:'Emergency Contact Name', ecPhone:'Emergency Contact Phone Number',
  med:'Medical Conditions, Allergies, or Medications',
};

const { data: regs, error } = await db.from('registrants')
  .select('id, first_name, last_name, emergency_name, emergency_phone, medical_notes, liability_complete');
if (error) { console.error('DB read failed:', error.message); process.exit(1); }

const exact=new Map(), lastInit=new Map(), femInit=new Map();
const push=(m,k,v)=>{ (m.get(k)??m.set(k,[]).get(k)).push(v); };
for (const r of regs) {
  const nf=norm(r.first_name), nl=norm(r.last_name);
  push(exact, nf+'|'+nl, r);
  if (nf) push(lastInit, nl+'|'+nf[0], r);
  if (nf) push(femInit, femFold(nl)+'|'+nf[0], r);
}
const uniq = arr => arr && arr.length===1 ? arr[0] : null;

// Same field set as the auto-apply path.
const buildU = row => {
  const u = { liability_complete:true };
  if (row[col.ecName]) u.emergency_name = row[col.ecName];
  if (row[col.ecPhone]) u.emergency_phone = row[col.ecPhone];
  if (row[col.med]) u.medical_notes = row[col.med];
  return u;
};

// Human-decided manual matches for the review pile (Tally submission -> existing registrant).
// Applied BEFORE the fuzzy tiers so we never loosen matching to force these. Keyed by the
// normalized raw Tally name (first + last fields, punctuation/space-insensitive).
const OVERRIDES = {
  annetta:                       'Annetta Polishchuk',      // single-name form row
  snezhana:                      'Snezhana Sergeyeva',      // single-name form row
  kristinevonadleryorkvelichko:  'Kristine Rose Von Adler-York',
  elizabethbelashov:             'Liza Belashov',
  evelinapetrushova:             'Evelina P',
  frantzprints:                  'Frantz Prince',
  elliebarnhard:                 'Ellie Barnard',           // form spells "Barnhard"; live row is "Barnard"
};
// Resolve each override target to a unique registrant up front; fail loudly on 0 or >1.
const fullNorm = r => norm(r.first_name) + norm(r.last_name);
const overrideReg = {};
for (const [k, target] of Object.entries(OVERRIDES)) {
  const hits = regs.filter(r => fullNorm(r) === norm(target));
  if (hits.length === 1) overrideReg[k] = hits[0];
  else console.error(`OVERRIDE UNRESOLVED: "${target}" matched ${hits.length} registrants — will fall to review`);
}

const plan=[], review=[];
for (const row of T) {
  // Explicit human-decided overrides win before any fuzzy matching.
  const okey = norm(row[col.fn]) + norm(row[col.ln]);
  if (okey in OVERRIDES) {
    const reg = overrideReg[okey];
    const disp = `${row[col.fn]} ${row[col.ln]}`.trim();
    if (!reg) { review.push({fn:row[col.fn], ln:row[col.ln], why:'override target not found', cands:[]}); continue; }
    plan.push({ reg, u: buildU(row), name: disp, override: OVERRIDES[okey] });
    continue;
  }
  let fn=row[col.fn], ln=row[col.ln];
  if (fn && !(ln||'').trim()) {
    // Older single-field form: whole name is in "Participant First Name", last name blank.
    // Take the LAST whitespace token as the last name, everything before it as the first.
    const parts = fn.trim().split(/\s+/);
    if (parts.length >= 2) { ln = parts.pop(); fn = parts.join(' '); }
  }
  if (!fn || !(ln||'').trim()) { review.push({fn,ln,why:'blank name in form',cands:[]}); continue; }
  const nf=norm(fn), nl=norm(ln), fw=norm(firstWord(fn));
  let reg = uniq(exact.get(nf+'|'+nl))
         || uniq(exact.get(fw+'|'+nl))
         || uniq(lastInit.get(nl+'|'+(fw[0]||'')))
         || uniq(femInit.get(femFold(nl)+'|'+(fw[0]||'')));
  if (!reg) {
    // gather candidates by last name (masc or fem) for the review note
    const cands = regs.filter(r => norm(r.last_name)===nl || femFold(norm(r.last_name))===femFold(nl))
                      .map(r => `${r.first_name} ${r.last_name}`);
    review.push({fn,ln,why: cands.length?'ambiguous / name differs':'no roster match',cands});
    continue;
  }
  plan.push({ reg, u: buildU(row), name:`${fn} ${ln}` });
}

const overrides = plan.filter(p => p.override);
console.log(`Tally rows: ${T.length}   Registrants: ${regs.length}`);
console.log(`  auto-apply (confident unique match): ${plan.length - overrides.length}`);
console.log(`  manual overrides (human-decided): ${overrides.length}`);
console.log(`  TOTAL to write: ${plan.length}`);
console.log(`  REVIEW (do by hand): ${review.length}\n`);
console.log('MANUAL OVERRIDES applied (Tally -> registrant):');
for (const p of overrides) console.log(`  ${p.name}  ->  ${p.reg.first_name} ${p.reg.last_name}`);
console.log('');
console.log('REVIEW LIST — not written; resolve in the app:');
for (const r of review) console.log(`  ${r.fn} ${r.ln}  [${r.why}]${r.cands.length?`  candidates: ${r.cands.join(', ')}`:''}`);
console.log('\nSample of auto-apply (first 8):');
for (const p of plan.slice(0,8)) console.log(`  ${p.reg.first_name} ${p.reg.last_name}: contact="${p.u.emergency_name||'—'}" phone=${p.u.emergency_phone||'—'} med=${p.u.medical_notes?'yes':'no'}`);

if (!COMMIT) { console.log('\nDRY RUN — nothing written. Re-run with --commit to apply the auto-apply set.'); process.exit(0); }

console.log('\nCommitting...');
let ok=0, fail=0;
for (const p of plan) {
  const { error } = await db.from('registrants').update(p.u).eq('id', p.reg.id);
  if (error) { fail++; console.error(`  FAILED ${p.name}: ${error.message}`); } else ok++;
}
console.log(`\nDone. Updated ${ok}, failed ${fail}. ${review.length} review rows left untouched — handle in the app.`);
