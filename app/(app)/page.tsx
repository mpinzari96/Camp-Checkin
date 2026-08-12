'use client';

import { useMemo, useState, useDeferredValue } from 'react';
import { useRouter } from 'next/navigation';
import { useRegistrants } from '@/hooks/useRegistrants';
import { buildIndex, search, applyStatusFilter, type StatusFilter } from '@/lib/search';
import { AddRegistrantSheet, CheckStateChip, LiabilityChip, StatFilters, Toast } from '@/components/ui';

export default function Dashboard() {
  const router = useRouter();
  const { list, loading, error, online, addRegistrant } = useRegistrants();
  const [q, setQ] = useState('');
  const deferredQ = useDeferredValue(q); // keeps typing at 60fps on slow phones
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const index = useMemo(() => buildIndex(list), [list]);
  const results = useMemo(
    () => applyStatusFilter(search(index, list, deferredQ), filter),
    [index, list, deferredQ, filter]
  );

  const stats = useMemo(() => {
    const total = list.length;
    const checkedIn = list.filter((r) => r.checked_in_at).length;
    const missing = list.filter((r) => !r.liability_complete).length;
    return { total, checkedIn, missing };
  }, [list]);

  return (
    <main className="container">
      {!online && !loading && (
        <div className="offline-banner">Reconnecting… changes made now will sync when back online.</div>
      )}

      <StatFilters
        counts={{ total: stats.total, checkedIn: stats.checkedIn, missing: stats.missing }}
        active={filter}
        onChange={setFilter}
      />

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
                {r.days_attending != null && (
                  <span className="chip warn">📅 {r.days_attending} day{r.days_attending === 1 ? '' : 's'}</span>
                )}
              </div>
            </button>
          ))}
          {results.length === 0 && (
            q.trim() ? (
              filter === 'checked_in' ? (
                <p className="empty">No checked-in campers match <b>“{q}”</b>.</p>
              ) : filter === 'missing' ? (
                <p className="empty">No missing-form campers match <b>“{q}”</b>.</p>
              ) : (
                <p className="empty">
                  No one matches <b>“{q}”</b>. Check the spelling, or add them as a walk-in with the + button.
                </p>
              )
            ) : filter === 'checked_in' ? (
              <p className="empty">No campers are checked in yet.</p>
            ) : filter === 'missing' ? (
              <p className="empty">No missing forms — everyone is set.</p>
            ) : (
              <p className="empty">No campers yet. Add a walk-in with the + button.</p>
            )
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
