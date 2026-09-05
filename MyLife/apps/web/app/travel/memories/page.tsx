import type { CSSProperties } from 'react';
import Link from 'next/link';
import {
  listJournalEntries,
  listTrips,
  type JournalEntryRow,
  type JournalMemoryKind,
  type JournalMemoryRow,
  type TripRow,
} from '@mylife/travel';
import { ensureModuleMigrations, getAdapter } from '@/lib/db';
import { TravelPanel } from '../_ui';
import { NewMemoryForm } from './_components/new-memory-form';
import { MemoriesGrid } from './_components/memories-grid';

export const dynamic = 'force-dynamic';

const KINDS: JournalMemoryKind[] = [
  'photo',
  'quote',
  'souvenir',
  'video',
  'audio',
  'other',
];

const KIND_ICONS: Record<JournalMemoryKind, string> = {
  photo: '\u{1F4F7}',
  quote: '\u{1F4AC}',
  souvenir: '\u{1F381}',
  video: '\u{1F3A5}',
  audio: '\u{1F3A7}',
  other: '\u{2728}',
};

export interface MemoryWithEntry extends JournalMemoryRow {
  entry_date: string | null;
  entry_title: string | null;
  trip_id: string | null;
}

interface ViewData {
  memories: MemoryWithEntry[];
  trips: TripRow[];
  entries: JournalEntryRow[];
  tripFilter: string | null;
  kindFilter: JournalMemoryKind | null;
}

function loadData(
  tripFilter: string | null,
  kindFilter: JournalMemoryKind | null,
): ViewData | { error: string } {
  try {
    ensureModuleMigrations('travel');
    const db = getAdapter();

    const where: string[] = [];
    const params: unknown[] = [];
    if (tripFilter) {
      where.push('e.trip_id = ?');
      params.push(tripFilter);
    }
    if (kindFilter) {
      where.push('m.kind = ?');
      params.push(kindFilter);
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const memories = db.query<MemoryWithEntry>(
      `SELECT m.id, m.entry_id, m.kind, m.media_ref, m.caption, m.sort_order,
              m.created_at,
              e.entry_date as entry_date,
              e.title as entry_title,
              e.trip_id as trip_id
       FROM tv_journal_memories m
       LEFT JOIN tv_journal_entries e ON e.id = m.entry_id
       ${whereSql}
       ORDER BY m.created_at DESC, m.sort_order ASC`,
      params,
    );
    return {
      memories,
      trips: listTrips(db),
      entries: listJournalEntries(db, {}),
      tripFilter,
      kindFilter,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to load memories' };
  }
}

export default async function TravelMemoriesPage({
  searchParams,
}: {
  searchParams?: Promise<{ tripId?: string; kind?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const tripFilter =
    typeof params.tripId === 'string' && params.tripId.length > 0
      ? params.tripId
      : null;
  const kindRaw =
    typeof params.kind === 'string' && params.kind.length > 0
      ? (params.kind as JournalMemoryKind)
      : null;
  const kindFilter =
    kindRaw && KINDS.indexOf(kindRaw) >= 0 ? kindRaw : null;

  const result = loadData(tripFilter, kindFilter);

  if ('error' in result) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <TravelPanel
          eyebrow="Memories"
          title="Could not load memories"
          body={result.error}
        />
      </div>
    );
  }

  const kindCounts: Record<string, number> = {};
  for (let i = 0; i < result.memories.length; i += 1) {
    const m = result.memories[i]!;
    kindCounts[m.kind] = (kindCounts[m.kind] ?? 0) + 1;
  }

  const buildHref = (next: {
    tripId?: string | null;
    kind?: string | null;
  }): string => {
    const q: string[] = [];
    const tripId = next.tripId ?? (next.tripId === null ? null : tripFilter);
    const kind = next.kind ?? (next.kind === null ? null : kindFilter);
    if (tripId) q.push(`tripId=${encodeURIComponent(tripId)}`);
    if (kind) q.push(`kind=${encodeURIComponent(kind)}`);
    return q.length > 0 ? `/travel/memories?${q.join('&')}` : '/travel/memories';
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <TravelPanel
        eyebrow="Memories"
        title="Highlights"
        body="Photos, quotes, souvenirs, and other memories attached to your journal entries."
      >
        <div style={{ marginTop: 8 }}>
          <Link href="/travel/journal" style={styles.backLink}>
            {'\u2190'} Back to Journal
          </Link>
        </div>
      </TravelPanel>

      <NewMemoryForm
        entries={result.entries.map((e) => ({
          id: e.id,
          entry_date: e.entry_date,
          title: e.title,
        }))}
      />

      <section style={styles.filterSection}>
        <div style={styles.filterLabel}>Filter by kind</div>
        <div style={styles.chipRow}>
          <Link
            href={buildHref({ kind: null })}
            style={{
              ...styles.chip,
              ...(kindFilter === null ? styles.chipActive : {}),
            }}
          >
            All
          </Link>
          {KINDS.map((k) => (
            <Link
              key={k}
              href={buildHref({ kind: kindFilter === k ? null : k })}
              style={{
                ...styles.chip,
                ...(kindFilter === k ? styles.chipActive : {}),
              }}
            >
              {KIND_ICONS[k]} {k}
              {kindCounts[k] ? ` (${kindCounts[k]})` : ''}
            </Link>
          ))}
        </div>
      </section>

      {result.trips.length > 0 ? (
        <section style={styles.filterSection}>
          <div style={styles.filterLabel}>Filter by trip</div>
          <div style={styles.chipRow}>
            <Link
              href={buildHref({ tripId: null })}
              style={{
                ...styles.chip,
                ...(tripFilter === null ? styles.chipActive : {}),
              }}
            >
              All trips
            </Link>
            {result.trips.slice(0, 40).map((t) => (
              <Link
                key={t.id}
                href={buildHref({ tripId: tripFilter === t.id ? null : t.id })}
                style={{
                  ...styles.chip,
                  ...(tripFilter === t.id ? styles.chipActive : {}),
                }}
              >
                {t.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {result.memories.length === 0 ? (
        <section style={styles.panel}>
          <h3 style={styles.sectionTitle}>
            {kindFilter || tripFilter ? 'No matches' : 'No memories yet'}
          </h3>
          <p style={styles.muted}>
            {kindFilter || tripFilter
              ? 'Try a different filter.'
              : 'Attach memories to journal entries to see them here.'}
          </p>
        </section>
      ) : (
        <MemoriesGrid memories={result.memories} />
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  backLink: {
    color: '#0EA5E9',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 700,
  },
  filterSection: { display: 'grid', gap: 8 },
  filterLabel: {
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: {
    padding: '6px 12px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text)',
    fontSize: 12,
    fontWeight: 600,
    textDecoration: 'none',
    textTransform: 'capitalize',
  },
  chipActive: {
    background: 'rgba(14,165,233,0.22)',
    borderColor: '#0EA5E9',
  },
  panel: {
    display: 'grid',
    gap: 10,
    padding: 18,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
  },
  sectionTitle: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 16,
  },
  muted: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.6,
  },
};
