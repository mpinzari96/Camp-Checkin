import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * Receives Tally.so webhook events when a liability form is submitted.
 *
 * Point Tally at:  https://YOUR-APP.vercel.app/api/tally-webhook?secret=TALLY_WEBHOOK_SECRET
 *
 * Matching strategy (configurable order):
 *   1. email  — exact, case-insensitive (primary identifier)
 *   2. name   — normalized first + last name fallback
 * Unmatched submissions are stored in audit_log so an admin can resolve them.
 */

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

type TallyField = { key: string; label: string; type: string; value: unknown };

function extract(fields: TallyField[]) {
  const byLabel = (want: RegExp): string | null => {
    const f = fields.find((f) => want.test(f.label.toLowerCase()));
    if (!f || f.value == null) return null;
    return String(Array.isArray(f.value) ? f.value[0] : f.value).trim();
  };
  return {
    email: byLabel(/e-?mail/),
    firstName: byLabel(/first\s*name/),
    lastName: byLabel(/last\s*name|surname/),
    fullName: byLabel(/^(full\s*)?name$/),
  };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-zа-я]/gi, '');

export async function POST(req: NextRequest) {
  // Shared-secret verification — reject anything that isn't Tally.
  const secret = req.nextUrl.searchParams.get('secret');
  if (!process.env.TALLY_WEBHOOK_SECRET || secret !== process.env.TALLY_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const fields: TallyField[] = body?.data?.fields ?? [];
  const { email, firstName, lastName, fullName } = extract(fields);
  const db = admin();

  // 1) Email match (primary)
  let match: { id: string } | null = null;
  if (email) {
    const { data } = await db.from('registrants').select('id').ilike('email', email).limit(2);
    if (data?.length === 1) match = data[0];
  }

  // 2) Name fallback
  if (!match) {
    const first = firstName ?? fullName?.split(/\s+/)[0] ?? '';
    const last = lastName ?? fullName?.split(/\s+/).slice(1).join(' ') ?? '';
    if (first && last) {
      const { data } = await db.from('registrants').select('id, first_name, last_name');
      const hits = (data ?? []).filter(
        (r) => norm(r.first_name) === norm(first) && norm(r.last_name) === norm(last)
      );
      if (hits.length === 1) match = hits[0];
    }
  }

  if (!match) {
    // Keep the payload so admins can resolve it by hand — never silently drop a form.
    await db.from('audit_log').insert({
      action: 'liability_webhook',
      detail: { matched: false, email, firstName, lastName, payload: body?.data ?? null },
    });
    return NextResponse.json({ matched: false });
  }

  await db
    .from('registrants')
    .update({
      liability_complete: true,
      liability_submitted_at: new Date().toISOString(),
      liability_payload: body?.data ?? null,
    })
    .eq('id', match.id);

  await db.from('audit_log').insert({
    registrant_id: match.id,
    action: 'liability_webhook',
    detail: { matched: true, email },
  });

  return NextResponse.json({ matched: true });
}
