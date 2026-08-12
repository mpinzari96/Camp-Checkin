'use client';

import { useEffect, useState } from 'react';
import type { Registrant } from '@/lib/types';
import type { StatusFilter } from '@/lib/search';

/* ---------- Status language (consistent everywhere) ---------- */

export function LiabilityChip({ r, large = false }: { r: Registrant; large?: boolean }) {
  const cls = large ? 'badge-lg' : 'chip';
  return r.liability_complete ? (
    <span className={`${cls} ok`}>✅ Liability complete</span>
  ) : (
    <span className={`${cls} bad`}>❌ Missing liability form</span>
  );
}

export function CheckStateChip({ r, large = false }: { r: Registrant; large?: boolean }) {
  const cls = large ? 'badge-lg' : 'chip';
  if (r.checked_in_at) return <span className={`${cls} ok`}>🟢 Checked in</span>;
  return <span className={`${cls} idle`}>⚪ Not checked in</span>;
}

/* ---------- Status filter tiles ---------- */

/**
 * The stat tiles double as the roster status filter. Counts always show the true
 * totals for the whole roster; tapping a tile filters the list to that group, and
 * tapping the active tile (or Registered) returns to showing everyone.
 */
export function StatFilters({
  counts,
  active,
  onChange,
  variant = 'stats',
}: {
  counts: { total: number; checkedIn: number; missing: number };
  active: StatusFilter;
  onChange: (f: StatusFilter) => void;
  variant?: 'stats' | 'admin-grid';
}) {
  const tile = (key: StatusFilter, n: number, label: string) => (
    <button
      type="button"
      className={`stat${active === key ? ' active' : ''}`}
      aria-pressed={active === key}
      onClick={() => onChange(active === key ? 'all' : key)}
    >
      <b>{n}</b>
      <span>{label}</span>
    </button>
  );

  return (
    <div className={variant} aria-label="Filter roster by status">
      {tile('all', counts.total, 'Registered')}
      {tile('checked_in', counts.checkedIn, 'Checked in')}
      {tile('missing', counts.missing, 'Missing forms')}
    </div>
  );
}

/* ---------- Toast ---------- */

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="toast" role="status">
      {message}
    </div>
  );
}

/* ---------- Add registrant (walk-in) sheet ---------- */

const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2-XL'];

export function AddRegistrantSheet({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (fields: Partial<Registrant>) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState<Record<string, string>>({
    first_name: '', last_name: '', church: '', city: '', state: '',
    emergency_name: '', emergency_phone: '', medical_notes: '', notes: '', merch_size: '',
  });
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [liability, setLiability] = useState(false);
  const [days, setDays] = useState<number | null>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  async function save() {
    if (!f.first_name.trim() || !f.last_name.trim()) {
      setErr('First and last name are required.');
      return;
    }
    setSaving(true);
    setErr(null);
    const res = await onSave({
      first_name: f.first_name.trim(),
      last_name: f.last_name.trim(),
      church: f.church.trim() || null,
      city: f.city.trim() || null,
      state: f.state.trim() || null,
      gender: gender || null,
      merch_size: f.merch_size || null,
      emergency_name: f.emergency_name.trim() || null,
      emergency_phone: f.emergency_phone.trim() || null,
      medical_notes: f.medical_notes.trim() || null,
      notes: f.notes.trim() || null,
      liability_complete: liability,
      days_attending: days,
    });
    setSaving(false);
    if (!res.ok) setErr(res.message ?? 'Could not save.');
    else onClose();
  }

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Add registrant">
        <h2>Add registrant</h2>

        <div className="field-row">
          <div className="field">
            <label htmlFor="fn">First name</label>
            <input id="fn" value={f.first_name} onChange={set('first_name')} autoFocus autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="ln">Last name</label>
            <input id="ln" value={f.last_name} onChange={set('last_name')} autoComplete="off" />
          </div>
        </div>

        <div className="field">
          <label>Gender</label>
          <div className="seg">
            <button type="button" aria-pressed={gender === 'male'} onClick={() => setGender('male')}>Male</button>
            <button type="button" aria-pressed={gender === 'female'} onClick={() => setGender('female')}>Female</button>
          </div>
        </div>

        <div className="field">
          <label htmlFor="ch">Church</label>
          <input id="ch" value={f.church} onChange={set('church')} />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="ci">City</label>
            <input id="ci" value={f.city} onChange={set('city')} />
          </div>
          <div className="field">
            <label htmlFor="st">State</label>
            <input id="st" value={f.state} onChange={set('state')} maxLength={20} />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="en">Emergency contact</label>
            <input id="en" value={f.emergency_name} onChange={set('emergency_name')} />
          </div>
          <div className="field">
            <label htmlFor="ep">Contact phone</label>
            <input id="ep" type="tel" value={f.emergency_phone} onChange={set('emergency_phone')} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="ms">Hoodie size</label>
          <select id="ms" value={f.merch_size} onChange={set('merch_size')}>
            <option value="">—</option>
            {SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="mn">Medical notes / allergies</label>
          <textarea id="mn" value={f.medical_notes} onChange={set('medical_notes')} />
        </div>
        <div className="field">
          <label htmlFor="no">Notes</label>
          <textarea id="no" value={f.notes} onChange={set('notes')} />
        </div>

        <div className="field">
          <label>Days attending</label>
          <div className="seg">
            <button type="button" aria-pressed={days === null} onClick={() => setDays(null)}>Full</button>
            <button type="button" aria-pressed={days === 1} onClick={() => setDays(1)}>1</button>
            <button type="button" aria-pressed={days === 2} onClick={() => setDays(2)}>2</button>
            <button type="button" aria-pressed={days === 3} onClick={() => setDays(3)}>3</button>
          </div>
        </div>

        <div className="field">
          <label>Liability form</label>
          <div className="seg">
            <button type="button" aria-pressed={liability} onClick={() => setLiability(true)}>✅ Submitted</button>
            <button type="button" aria-pressed={!liability} onClick={() => setLiability(false)}>❌ Missing</button>
          </div>
        </div>

        {err && <p className="login-error">{err}</p>}

        <button className="btn-block" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Add registrant'}
        </button>
      </div>
    </>
  );
}
