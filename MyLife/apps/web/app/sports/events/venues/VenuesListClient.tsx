'use client';

import {
  useMemo,
  useState,
  useTransition,
  type CSSProperties,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Venue } from '@mylife/sports';
import { sportsCreateVenue } from '../../actions';
import { SPORTS_ACCENT } from '../../_ui';

type Filter = 'all' | 'visited' | 'bucket';

type Props = {
  venues: Venue[];
};

export function VenuesListClient({ venues }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>('all');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCity, setNewCity] = useState('');
  const [error, setError] = useState<string | null>(null);

  const visited = useMemo(
    () => venues.filter((v) => v.visited === 1),
    [venues],
  );
  const bucket = useMemo(
    () => venues.filter((v) => v.bucket_list === 1),
    [venues],
  );

  const displayed = useMemo(() => {
    if (filter === 'visited') return visited;
    if (filter === 'bucket') return bucket;
    return venues;
  }, [filter, venues, visited, bucket]);

  const bucketVisited = bucket.filter((v) => v.visited === 1).length;
  const progressPct =
    bucket.length > 0 ? Math.round((bucketVisited / bucket.length) * 100) : 0;

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) {
      setError('Name is required.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await sportsCreateVenue({
        name,
        city: newCity.trim() === '' ? null : newCity.trim(),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNewName('');
      setNewCity('');
      setAdding(false);
      router.push(`/sports/events/venues/${encodeURIComponent(res.venue.id)}`);
      router.refresh();
    });
  };

  return (
    <div style={styles.wrap}>
      {bucket.length > 0 ? (
        <div style={styles.progressCard}>
          <p style={styles.progressLabel}>Bucket-list progress</p>
          <p style={styles.progressValue}>
            {bucketVisited} / {bucket.length} visited ({progressPct}%)
          </p>
          <div style={styles.progressBar}>
            <div
              style={{ ...styles.progressFill, width: `${progressPct}%` }}
            />
          </div>
        </div>
      ) : null}

      <div style={styles.filterRow}>
        {(
          [
            { key: 'all', label: `All (${venues.length})` },
            { key: 'visited', label: `Visited (${visited.length})` },
            { key: 'bucket', label: `Bucket (${bucket.length})` },
          ] as const
        ).map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              style={{
                ...styles.filterChip,
                ...(active ? styles.filterChipActive : {}),
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {adding ? (
        <div style={styles.addCard}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Venue name"
            style={styles.input}
          />
          <input
            type="text"
            value={newCity}
            onChange={(e) => setNewCity(e.target.value)}
            placeholder="City (optional)"
            style={styles.input}
          />
          {error ? <p style={styles.error}>{error}</p> : null}
          <div style={styles.addRow}>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setNewName('');
                setNewCity('');
                setError(null);
              }}
              style={styles.secondaryBtn}
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              style={styles.primaryBtn}
              disabled={isPending}
            >
              {isPending ? 'Saving…' : 'Save venue'}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          style={styles.fab}
        >
          + Add venue
        </button>
      )}

      {displayed.length === 0 ? (
        <div style={styles.emptyCard}>
          <p style={styles.emptyText}>
            {filter === 'bucket'
              ? 'No bucket-list venues yet. Add venues and flag them from the detail screen.'
              : filter === 'visited'
                ? 'No visited venues yet.'
                : 'No venues yet. Tap Add venue to get started.'}
          </p>
        </div>
      ) : (
        <div style={styles.list}>
          {displayed.map((v) => (
            <Link
              key={v.id}
              href={`/sports/events/venues/${encodeURIComponent(v.id)}`}
              style={styles.row}
            >
              <span style={styles.rowBody}>
                <span style={styles.rowTitle}>{v.name}</span>
                {v.city || v.sport || v.team ? (
                  <span style={styles.rowMeta}>
                    {[v.city, v.sport, v.team].filter(Boolean).join(' · ')}
                  </span>
                ) : null}
              </span>
              <span style={styles.badges}>
                {v.visited === 1 ? (
                  <span style={styles.visitedBadge}>✓</span>
                ) : null}
                {v.bucket_list === 1 ? (
                  <span style={styles.bucketBadge}>★</span>
                ) : null}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: 12 },
  progressCard: {
    display: 'grid',
    gap: 4,
    padding: 14,
    borderRadius: 14,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  progressLabel: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  progressValue: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 16,
    fontWeight: 800,
  },
  progressBar: {
    height: 6,
    borderRadius: 4,
    background: 'var(--background)',
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: {
    height: '100%',
    background: SPORTS_ACCENT,
  },
  filterRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  filterChip: {
    padding: '8px 12px',
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  filterChipActive: {
    background: SPORTS_ACCENT,
    borderColor: SPORTS_ACCENT,
    color: '#0E0E13',
  },
  addCard: {
    display: 'grid',
    gap: 8,
    padding: 14,
    borderRadius: 14,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  input: {
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--background)',
    color: 'var(--text)',
    fontSize: 14,
  },
  addRow: { display: 'flex', gap: 10 },
  fab: {
    alignSelf: 'flex-start',
    padding: '10px 14px',
    borderRadius: 12,
    border: 'none',
    background: SPORTS_ACCENT,
    color: '#0E0E13',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
  list: { display: 'grid', gap: 8 },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    textDecoration: 'none',
  },
  rowBody: { display: 'grid', gap: 2, flex: 1 },
  rowTitle: { color: 'var(--text)', fontSize: 15, fontWeight: 700 },
  rowMeta: {
    color: 'var(--text-secondary)',
    fontSize: 13,
    textTransform: 'capitalize',
  },
  badges: { display: 'flex', gap: 6 },
  visitedBadge: {
    color: SPORTS_ACCENT,
    fontSize: 16,
    fontWeight: 800,
  },
  bucketBadge: {
    color: '#FFB877',
    fontSize: 16,
    fontWeight: 800,
  },
  emptyCard: {
    padding: 20,
    borderRadius: 14,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  emptyText: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.5,
  },
  primaryBtn: {
    flex: 1,
    padding: '10px 18px',
    borderRadius: 12,
    border: 'none',
    background: SPORTS_ACCENT,
    color: '#0E0E13',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
  secondaryBtn: {
    flex: 1,
    padding: '10px 18px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
  error: { margin: 0, color: '#F87171', fontSize: 13 },
};
