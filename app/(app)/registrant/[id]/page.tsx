'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRegistrants } from '@/hooks/useRegistrants';
import { CheckStateChip, LiabilityChip, Toast } from '@/components/ui';

function fmt(ts: string | null) {
  if (!ts) return null;
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function RegistrantProfile() {
  const { id } = useParams<{ id: string }>();
  const { byId, loading, mutate, setLiability } = useRegistrants();
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const r = useMemo(() => byId.get(id), [byId, id]);

  async function act(action: 'check_in' | 'undo_check_in', label: string) {
    if (!r || busy) return;
    setBusy(true);
    const res = await mutate(r.id, action);
    setBusy(false);
    setToast(res.ok ? label : res.message ?? 'Something went wrong.');
  }

  async function toggleLiability() {
    if (!r || busy) return;
    const next = !r.liability_complete;
    setBusy(true);
    const res = await setLiability(r.id, next);
    setBusy(false);
    setToast(
      res.ok
        ? next
          ? 'Liability form marked complete.'
          : 'Liability form marked not complete.'
        : res.message ?? 'Something went wrong.'
    );
  }

  if (loading) return <main className="container"><p className="empty">Loading…</p></main>;
  if (!r) {
    return (
      <main className="container">
        <p className="empty">This registrant no longer exists. <Link href="/">Back to the roster</Link>.</p>
      </main>
    );
  }

  const checkedIn = !!r.checked_in_at;
  const hasMedical = !!(r.medical_notes || r.allergies || r.special_notes);

  return (
    <main className="container">
      <Link href="/" className="backlink">← Roster</Link>

      <div className="profile-head">
        <h1>
          {r.preferred_name ? `${r.preferred_name} (${r.first_name})` : r.first_name} {r.last_name}
        </h1>
        <div className="meta">
          {[r.church, [r.city, r.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
        </div>
        <div className="badges">
          <LiabilityChip r={r} large />
          <CheckStateChip r={r} large />
        </div>
        <div className="row-actions">
          <button
            className="btn-small"
            disabled={busy}
            aria-pressed={r.liability_complete}
            onClick={toggleLiability}
          >
            {r.liability_complete ? 'Mark liability form not complete' : 'Mark liability form complete'}
          </button>
        </div>
      </div>

      {hasMedical && (
        <section className="section medical" aria-label="Medical information">
          <h2>⚠ Medical</h2>
          {r.allergies && <div className="kv"><span className="k">Allergies</span><span className="v">{r.allergies}</span></div>}
          {r.medical_notes && <div className="note">{r.medical_notes}</div>}
          {r.special_notes && <div className="note">{r.special_notes}</div>}
        </section>
      )}

      <section className="section" aria-label="Emergency contact">
        <h2>Emergency contact</h2>
        <div className="kv"><span className="k">Name</span><span className="v">{r.emergency_name ?? '—'}</span></div>
        <div className="kv"><span className="k">Relationship</span><span className="v">{r.emergency_relationship ?? '—'}</span></div>
        <div className="kv">
          <span className="k">Phone</span>
          <span className="v">{r.emergency_phone ? <a href={`tel:${r.emergency_phone}`}>{r.emergency_phone}</a> : '—'}</span>
        </div>
      </section>

      <section className="section" aria-label="Registration details">
        <h2>Registration</h2>
        <div className="kv"><span className="k">Status</span><span className="v">{r.registration_status === 'walk_in' ? 'Walk-in' : 'Registered'}</span></div>
        <div className="kv"><span className="k">Age</span><span className="v">{r.age ?? '—'}</span></div>
        <div className="kv"><span className="k">Gender</span><span className="v">{r.gender ? r.gender[0].toUpperCase() + r.gender.slice(1) : '—'}</span></div>
        <div className="kv"><span className="k">Hoodie size</span><span className="v">{r.merch_size ?? '—'}</span></div>
        <div className="kv"><span className="k">Email</span><span className="v">{r.email ?? '—'}</span></div>
        <div className="kv"><span className="k">Phone</span><span className="v">{r.phone ? <a href={`tel:${r.phone}`}>{r.phone}</a> : '—'}</span></div>
        {r.cabin && <div className="kv"><span className="k">Cabin</span><span className="v">{r.cabin}</span></div>}
        {r.small_group && <div className="kv"><span className="k">Group</span><span className="v">{r.small_group}</span></div>}
      </section>

      <section className="section" aria-label="Check-in history">
        <h2>Check-in history</h2>
        <div className="kv"><span className="k">Checked in</span><span className="v">{fmt(r.checked_in_at) ?? 'Not yet'}</span></div>
      </section>

      {r.notes && (
        <section className="section" aria-label="Notes">
          <h2>Notes</h2>
          <div className="note">{r.notes}</div>
        </section>
      )}

      <div className="actionbar">
        <div className="actionbar-inner">
          {!checkedIn ? (
            <button className="btn-primary" disabled={busy} onClick={() => act('check_in', `${r.first_name} checked in.`)}>
              CHECK IN
            </button>
          ) : (
            <>
              <button className="btn-primary done" disabled>✓ CHECKED IN</button>
              <button className="btn-secondary" disabled={busy} onClick={() => act('undo_check_in', 'Check-in undone.')}>
                Undo check-in
              </button>
            </>
          )}
        </div>
      </div>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </main>
  );
}
