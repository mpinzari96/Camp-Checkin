import Fuse from 'fuse.js';
import type { Registrant } from '@/lib/types';

/**
 * Fuzzy roster search. Tolerates misspellings ("Jon" finds "John",
 * "Velichko" ≈ "Velichco") and matches on name, church, and city.
 * The index rebuilds only when the roster changes; each keystroke
 * is a sub-millisecond lookup on a camp-sized list.
 */
export function buildIndex(rows: Registrant[]) {
  return new Fuse(rows, {
    keys: [
      { name: 'full_name', weight: 3 },
      { name: 'preferred_name', weight: 2 },
      { name: 'first_name', weight: 2 },
      { name: 'last_name', weight: 2 },
      { name: 'church', weight: 1 },
      { name: 'city', weight: 1 },
    ],
    threshold: 0.34,        // forgiving enough for typos, strict enough to stay relevant
    ignoreLocation: true,
    minMatchCharLength: 2,
  });
}

export function search(index: Fuse<Registrant>, all: Registrant[], q: string): Registrant[] {
  const query = q.trim();
  if (!query) return all;
  return index.search(query).map((r) => r.item);
}
