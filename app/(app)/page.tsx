'use client';

import { useMemo, useState, useDeferredValue } from 'react';
import { useRouter } from 'next/navigation';
import { useRegistrants } from '@/hooks/useRegistrants';
import { buildIndex, search } from '@/lib/search';
import { AddRegistrantSheet, CheckStateChip, LiabilityChip, Toast } from '@/components/ui';

export default function Dashboard() {
  const router = useRouter();
  const { list, loading, error, online, addRegistrant } = useRegistrants();
  const [q, setQ] = useState('');
  const deferredQ = useDeferredValue(q); // keeps typing at 60fps on slow phones
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const index = useMemo(() => buildIndex(list), [list]);
  const results = useMemo(() => search(index, list, deferredQ), [index, list, deferredQ]);

  const stats = useMemo(() => {
    const total = list.length;
    const checkedIn = list.filter((r) => r.checked_in_at && !r.checked_out_at).length;
    const missing = list.filter((r) => !r.liability_complete).length;
    return { total, checkedIn, missing };
  }, [list]);

  return (
    <main className="container">
      {!online && !loading && (
        <div className="offline-banner">Reconnecting… changes made now will sync when back online.</div>
      )}

      <div className="stats" aria-label="Camp totals">
        <div className="stat"><b>{stats.total}</b><span>Registered</span></div>
        <div className="stat"><b>{stats.checkedIn}</b><span>Checked in</span></div>
        <div className="stat"><b>{stats.missing}</b><span>Missing forms</span></div>
      </div>

      <div className="searchwrap">
        <div className="search">
          <span aria-hidden>🔍</span>
          <input
            type="search"
            placeholder="Search name, church, or city"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            aria-label="Search registrants"
          />
          {q && (
            <button className="clear" onClick={() => setQ('')} aria-label="Clear search">✕</button>
          )}
        </div>
      </div>

      {loading && <p className="empty">Loading the roster…</p>}
      {error && <p className="empty">Couldn&apos;t load the roster. Pull down to retry or check your connection.</p>}

      {!loading && !error && (
        <div className="roster">
          {results.map((r) => (
            <button
              key={r.id}
              className="person"
              onClick={() => router.push(`/registrant/${r.id}`)}
            >
              <div className="who">
                <div className="name">
                  {r.preferred_name ? `${r.preferred_name} (${r.first_name})` : r.first_name} {r.last_name}
                </div>
                <div className="sub">{[r.church, r.city].filter(Boolean).join(' · ') || '—'}</div>
              </div>
              <div className="status">
                <LiabilityChip r={r} />
                <CheckStateChip r={r} />
              </div>
            </button>
          ))}
          {results.length === 0 && (
            <p className="empty">
              No one matches <b>“{q}”</b>. Check the spelling, or add them as a walk-in with the + button.
            </p>
          )}
        </div>
      )}

      <button className="fab" aria-label="Add registrant" onClick={() => setShowAdd(true)}>+</button>

      {showAdd && (
        <AddRegistrantSheet
          onClose={() => setShowAdd(false)}
          onSave={async (fields) => {
            const res = await addRegistrant(fields);
            if (res.ok) setToast(`${fields.first_name} ${fields.last_name} added.`);
            return res;
          }}
        />
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </main>
  );
}
