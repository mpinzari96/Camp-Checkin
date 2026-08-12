'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRegistrants } from '@/hooks/useRegistrants';
import { buildIndex, search, applyStatusFilter, type StatusFilter } from '@/lib/search';
import { CheckStateChip, LiabilityChip, StatFilters, Toast } from '@/components/ui';
import type { AuditRow, Registrant } from '@/lib/types';

const EDITABLE: Array<{ key: keyof Registrant; label: string; type?: string }> = [
  { key: 'first_name', label: 'First name' },
  { key: 'last_name', label: 'Last name' },
  { key: 'preferred_name', label: 'Preferred name' },
  { key: 'age', label: 'Age', type: 'number' },
  { key: 'church', label: 'Church' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Phone', type: 'tel' },
  { key: 'merch_size', label: 'Hoodie size' },
  { key: 'emergency_name', label: 'Emergency contact' },
  { key: 'emergency_relationship', label: 'Relationship' },
  { key: 'emergency_phone', label: 'Emergency phone', type: 'tel' },
  { key: 'allergies', label: 'Allergies' },
  { key: 'medical_notes', label: 'Medical notes' },
  { key: 'special_notes', label: 'Special notes' },
  { key: 'notes', label: 'Notes' },
  { key: 'cabin', label: 'Cabin' },
  { key: 'small_group', label: 'Group' },
];

const CSV_COLS: Array<keyof Registrant> = [
  'first_name', 'last_name', 'preferred_name', 'age', 'gender', 'church', 'city', 'state',
  'email', 'phone', 'merch_size', 'registration_status', 'days_attending', 'liability_complete',
  'checked_in_at', 'emergency_name', 'emergency_relationship',
  'emergency_phone', 'allergies', 'medical_notes', 'special_notes', 'notes',
];

function toCsv(rows: Registrant[]) {
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [CSV_COLS.join(','), ...rows.map((r) => CSV_COLS.map((c) => esc(r[c])).join(','))].join('\n');
}

export default function AdminPage() {
  const supabase = useMemo(() => createClient(), []);
  const { list, loading, mutate, setLiability } = useRegistrants();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [editing, setEditing] = useState<Registrant | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setIsAdmin(false);
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      setIsAdmin(data?.role === 'admin');
    })();
  }, [supabase]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data } = await supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(40);
      setAudit((data as AuditRow[]) ?? []);
    })();
  }, [supabase, isAdmin, list]);

  const index = useMemo(() => buildIndex(list), [list]);
  const results = useMemo(
    () => applyStatusFilter(search(index, list, q), filter),
    [index, list, q, filter]
  );

  const stats = useMemo(() => ({
    total: list.length,
    in: list.filter((r) => r.checked_in_at).length,
    missing: list.filter((r) => !r.liability_complete).length,
  }), [list]);

  function exportCsv() {
    const blob = new Blob([toCsv(list)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `camp-registrants-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function saveEdit(fields: Partial<Registrant>) {
    if (!editing) return;
    const { error } = await supabase.from('registrants').update(fields).eq('id', editing.id);
    setToast(error ? 'Save failed — try again.' : 'Profile saved.');
    if (!error) setEditing(null);
  }

  async function remove(r: Registrant) {
    if (!confirm(`Delete ${r.full_name}? This cannot be undone.`)) return;
    const { error } = await supabase.from('registrants').delete().eq('id', r.id);
    setToast(error ? 'Delete failed — admins only.' : `${r.full_name} deleted.`);
  }

  async function toggleLiability(r: Registrant) {
    const res = await setLiability(r.id, !r.liability_complete);
    if (!res.ok) setToast(res.message ?? 'Update failed.');
  }

  if (isAdmin === false) {
    return (
      <main className="container">
        <p className="empty">The admin dashboard needs an admin account. <Link href="/">Back to check-in</Link>.</p>
      </main>
    );
  }

  return (
    <main className="container">
      <Link href="/" className="backlink">← Check-in</Link>

      <StatFilters
        counts={{ total: stats.total, checkedIn: stats.in, missing: stats.missing }}
        active={filter}
        onChange={setFilter}
        variant="admin-grid"
      />

      <div className="row-actions" style={{ padding: '4px 0 0' }}>
        <button className="btn-small" onClick={exportCsv}>Export CSV</button>
      </div>

      <div className="searchwrap" style={{ top: 0 }}>
        <div className="search">
          <span aria-hidden>🔍</span>
          <input type="search" placeholder="Search everyone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search registrants" />
          {q && <button className="clear" onClick={() => setQ('')} aria-label="Clear search">✕</button>}
        </div>
      </div>

      {loading && <p className="empty">Loading…</p>}

      <div className="roster">
        {results.map((r) => (
          <div key={r.id} className="person" style={{ flexWrap: 'wrap' }}>
            <div className="who">
              <div className="name">{r.first_name} {r.last_name}</div>
              <div className="sub">{[r.church, r.city, r.state].filter(Boolean).join(' · ')}</div>
            </div>
            <div className="status">
              <LiabilityChip r={r} />
              <CheckStateChip r={r} />
            </div>
            <div className="row-actions" style={{ padding: 0, width: '100%' }}>
              <button className="btn-small" onClick={() => setEditing(r)}>Edit</button>
              <button className="btn-small" onClick={() => toggleLiability(r)}>
                {r.liability_complete ? 'Mark form missing' : 'Mark form complete'}
              </button>
              {r.checked_in_at
                ? <button className="btn-small" onClick={() => mutate(r.id, 'undo_check_in')}>Undo check-in</button>
                : <button className="btn-small" onClick={() => mutate(r.id, 'check_in')}>Check in</button>}
              <button className="btn-small danger" onClick={() => remove(r)}>Delete</button>
            </div>
          </div>
        ))}
        {!loading && results.length === 0 && (
          q.trim() ? (
            filter === 'checked_in' ? (
              <p className="empty">No checked-in campers match <b>“{q}”</b>.</p>
            ) : filter === 'missing' ? (
              <p className="empty">No missing-form campers match <b>“{q}”</b>.</p>
            ) : (
              <p className="empty">No one matches <b>“{q}”</b>. Check the spelling.</p>
            )
          ) : filter === 'checked_in' ? (
            <p className="empty">No campers are checked in yet.</p>
          ) : filter === 'missing' ? (
            <p className="empty">No missing forms — everyone is set.</p>
          ) : (
            <p className="empty">No campers yet.</p>
          )
        )}
      </div>

      <section className="section" style={{ marginTop: 20 }}>
        <h2>Recent activity</h2>
        <div className="tablewrap">
          <table className="audit">
            <thead>
              <tr><th>When</th><th>Action</th><th>Registrant</th></tr>
            </thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id}>
                  <td>{new Date(a.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                  <td>{a.action.replaceAll('_', ' ')}</td>
                  <td>{a.registrant_id ? (listNameById(list, a.registrant_id) ?? '—') : '—'}</td>
                </tr>
              ))}
              {audit.length === 0 && <tr><td colSpan={3}>No activity yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <EditSheet r={editing} onClose={() => setEditing(null)} onSave={saveEdit} />
      )}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </main>
  );
}

function listNameById(list: Registrant[], id: string) {
  const r = list.find((x) => x.id === id);
  return r ? `${r.first_name} ${r.last_name}` : null;
}

function EditSheet({
  r, onClose, onSave,
}: {
  r: Registrant;
  onClose: () => void;
  onSave: (fields: Partial<Registrant>) => Promise<void>;
}) {
  const [f, setF] = useState<Record<string, string>>(() =>
    Object.fromEntries(EDITABLE.map(({ key }) => [key, r[key] == null ? '' : String(r[key])]))
  );
  const [days, setDays] = useState<number | null>(r.days_attending);
  const [saving, setSaving] = useState(false);

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={`Edit ${r.full_name}`}>
        <h2>Edit {r.first_name} {r.last_name}</h2>
        {EDITABLE.map(({ key, label, type }) => (
          <div className="field" key={key}>
            <label htmlFor={`e-${key}`}>{label}</label>
            <input
              id={`e-${key}`}
              type={type ?? 'text'}
              value={f[key]}
              onChange={(e) => setF((p) => ({ ...p, [key]: e.target.value }))}
            />
          </div>
        ))}
        <div className="field">
          <label>Days attending</label>
          <div className="seg">
            <button type="button" aria-pressed={days === null} onClick={() => setDays(null)}>Full</button>
            <button type="button" aria-pressed={days === 1} onClick={() => setDays(1)}>1</button>
            <button type="button" aria-pressed={days === 2} onClick={() => setDays(2)}>2</button>
            <button type="button" aria-pressed={days === 3} onClick={() => setDays(3)}>3</button>
          </div>
        </div>
        <button
          className="btn-block"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            const fields: Partial<Registrant> = {};
            for (const { key, type } of EDITABLE) {
              const raw = f[key].trim();
              (fields as any)[key] = raw === '' ? null : type === 'number' ? Number(raw) : raw;
            }
            fields.days_attending = days;
            await onSave(fields);
            setSaving(false);
          }}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </>
  );
}
