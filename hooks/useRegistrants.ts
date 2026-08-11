'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Registrant } from '@/lib/types';

type Action = 'check_in' | 'undo_check_in';

/**
 * Single source of truth for the roster on every device.
 *
 * - Loads the full roster once (a camp roster is small; this makes search instant).
 * - Subscribes to Supabase Realtime so every insert/update/delete from any
 *   volunteer's phone lands here immediately — no refreshes, ever.
 * - Mutations are optimistic: the UI flips instantly, then reconciles with the
 *   server row. If the atomic RPC rejects (someone else won the race), we roll
 *   back and surface a gentle message instead of double-checking-in.
 */
export function useRegistrants() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Map<string, Registrant>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const pending = useRef<Set<string>>(new Set());

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('registrants')
        .select('*')
        .neq('registration_status', 'cancelled')
        .order('last_name');
      if (cancelled) return;
      if (error) setError(error.message);
      else setRows(new Map((data as Registrant[]).map((r) => [r.id, r])));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Live sync
  useEffect(() => {
    const channel = supabase
      .channel('registrants-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'registrants' },
        (payload) => {
          setRows((prev) => {
            const next = new Map(prev);
            if (payload.eventType === 'DELETE') {
              next.delete((payload.old as Registrant).id);
            } else {
              const row = payload.new as Registrant;
              // Server state always wins over any optimistic guess.
              next.set(row.id, row);
            }
            return next;
          });
        }
      )
      .subscribe((status) => setOnline(status === 'SUBSCRIBED'));
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  /** Optimistically apply a state change, call the atomic RPC, reconcile or roll back. */
  const mutate = useCallback(
    async (id: string, action: Action): Promise<{ ok: boolean; message?: string }> => {
      if (pending.current.has(id)) return { ok: false, message: 'Already saving…' };
      const before = rows.get(id);
      if (!before) return { ok: false, message: 'Registrant not found.' };
      pending.current.add(id);

      const nowIso = new Date().toISOString();
      const optimistic: Registrant = { ...before };
      if (action === 'check_in') optimistic.checked_in_at = nowIso;
      if (action === 'undo_check_in') optimistic.checked_in_at = null;
      setRows((prev) => new Map(prev).set(id, optimistic));

      const { data, error } = await supabase.rpc(action, { reg_id: id });
      pending.current.delete(id);

      if (error) {
        // Roll back to the pre-optimistic row; realtime will deliver the truth.
        setRows((prev) => new Map(prev).set(id, before));
        const friendly =
          error.message.includes('ALREADY_CHECKED_IN')
            ? 'Another volunteer just checked this camper in.'
            : error.message.includes('NOT_CHECKED_IN')
            ? 'This camper is not checked in.'
            : 'Could not save — check your connection and try again.';
        return { ok: false, message: friendly };
      }
      const serverRow = data as Registrant;
      setRows((prev) => new Map(prev).set(id, serverRow));
      return { ok: true };
    },
    [rows, supabase]
  );

  /**
   * Toggle a registrant's liability form. Optimistic like check-in, but routed
   * through the atomic `set_liability` RPC so every change is audited (actor +
   * new value) and usable by any authenticated volunteer.
   */
  const setLiability = useCallback(
    async (id: string, complete: boolean): Promise<{ ok: boolean; message?: string }> => {
      if (pending.current.has(id)) return { ok: false, message: 'Already saving…' };
      const before = rows.get(id);
      if (!before) return { ok: false, message: 'Registrant not found.' };
      pending.current.add(id);

      setRows((prev) => new Map(prev).set(id, { ...before, liability_complete: complete }));

      const { data, error } = await supabase.rpc('set_liability', { reg_id: id, complete });
      pending.current.delete(id);

      if (error) {
        // Roll back to the pre-optimistic row; realtime will deliver the truth.
        setRows((prev) => new Map(prev).set(id, before));
        return { ok: false, message: 'Could not save — check your connection and try again.' };
      }
      setRows((prev) => new Map(prev).set(id, data as Registrant));
      return { ok: true };
    },
    [rows, supabase]
  );

  const addRegistrant = useCallback(
    async (fields: Partial<Registrant>) => {
      const { data: events } = await supabase.from('events').select('id').eq('is_active', true).limit(1);
      const event_id = events?.[0]?.id;
      const { data, error } = await supabase
        .from('registrants')
        .insert({ ...fields, event_id, registration_status: 'walk_in' })
        .select()
        .single();
      if (error) return { ok: false as const, message: error.message };
      setRows((prev) => new Map(prev).set(data.id, data as Registrant));
      return { ok: true as const, row: data as Registrant };
    },
    [supabase]
  );

  const list = useMemo(
    () =>
      Array.from(rows.values()).sort((a, b) =>
        (a.last_name + a.first_name).localeCompare(b.last_name + b.first_name)
      ),
    [rows]
  );

  return { list, byId: rows, loading, error, online, mutate, setLiability, addRegistrant };
}
