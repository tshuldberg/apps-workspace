import type { CSSProperties } from 'react';
import Link from 'next/link';
import {
  getJournalStreak,
  listDestinations,
  listJournalEntriesByMonth,
  listTrips,
  type DestinationRecord,
  type JournalEntryRow,
  type TripRow,
} from '@mylife/travel';
import { ensureModuleMigrations, getAdapter } from '@/lib/db';
import { TravelPanel } from '../_ui';
import { NewJournalEntryForm } from './_components/new-entry-form';

export const dynamic = 'force-dynamic';

const MOOD_ICONS: Record<number, string> = {
  1: '\u{1F614}',
  2: '\u{1F615}',
  3: '\u{1F610}',
  4: '\u{1F642}',
  5: '\u{1F604}',
};

function formatMonth(key: string): string {
  const [yStr, mStr] = key.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  if (Number.isNaN(y) || Number.isNaN(m)) return key;
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function previewBody(body: string): string {
  if (!body) return '';
  const lines = body.split('\n').filter((l) => l.trim().length > 0);
  return lines.slice(0, 2).join(' ');
}

interface ViewData {
  year: number;
  grouped: Record<string, JournalEntryRow[]>;
  streak: { current: number; longest: number };
  trips: TripRow[];
  destinations: DestinationRecord[];
}

function loadData(year: number): ViewData | { error: string } {
  try {
    ensureModuleMigrations('travel');
    const db = getAdapter();
    return {
      year,
      grouped: listJournalEntriesByMonth(db, year),
      streak: getJournalStreak(db),
      trips: listTrips(db),
      destinations: listDestinations(db),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to load journal' };
  }
}

export default async function TravelJournalPage({
  searchParams,
}: {
  searchParams?: Promise<{ year?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const yearRaw = typeof params.year === 'string' ? Number(params.year) : NaN;
  const year = Number.isFinite(yearRaw) && yearRaw > 1900
    ? Math.floor(yearRaw)
    : new Date().getFullYear();

  const result = loadData(year);

  if ('error' in result) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <TravelPanel
          eyebrow="Journal"
          title="Could not load journal"
          body={result.error}
        />
      </div>
    );
  }

  const monthKeys = Object.keys(result.grouped).sort((a, b) =>
    a < b ? 1 : -1,
  );
  const hasEntries = monthKeys.length > 0;
  const prevYear = year - 1;
  const nextYear = year + 1;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <TravelPanel
        eyebrow="Journal"
        title="Travel stories"
        body="Daily notes from the road, tied to trips, destinations, and mood."
      >
        <div style={{ marginTop: 8 }}>
          <Link href="/travel/memories" style={styles.memoriesLink}>
            Memories {'\u2192'}
          </Link>
        </div>
      </TravelPanel>

      <section style={styles.streakCard}>
        <div style={styles.streakCol}>
          <span style={styles.streakLabel}>Current streak</span>
          <span style={styles.streakValue}>
            {result.streak.current}{' '}
            {result.streak.current === 1 ? 'day' : 'days'}
          </span>
        </div>
        <div style={styles.streakDivider} />
        <div style={styles.streakCol}>
          <span style={styles.streakLabel}>Longest</span>
          <span style={styles.streakValue}>
            {result.streak.longest}{' '}
            {result.streak.longest === 1 ? 'day' : 'days'}
          </span>
        </div>
      </section>

      <nav style={styles.yearRow}>
        <Link href={`/travel/journal?year=${prevYear}`} style={styles.yearBtn}>
          {'\u2039'} {prevYear}
        </Link>
        <span style={styles.yearText}>{year}</span>
        <Link href={`/travel/journal?year=${nextYear}`} style={styles.yearBtn}>
          {nextYear} {'\u203A'}
        </Link>
      </nav>

      <NewJournalEntryForm
        trips={result.trips.map((t) => ({ id: t.id, name: t.name }))}
        destinations={result.destinations.map((d) => ({
          id: d.id,
          name: d.name,
        }))}
      />

      {!hasEntries ? (
        <section style={styles.panel}>
          <h3 style={styles.sectionTitle}>No entries yet</h3>
          <p style={styles.muted}>
            Your travel stories start here. Add your first entry.
          </p>
        </section>
      ) : (
        monthKeys.map((key) => {
          const rows = result.grouped[key] ?? [];
          return (
            <section key={key} style={styles.monthGroup}>
              <h3 style={styles.monthLabel}>{formatMonth(key)}</h3>
              <ul style={styles.entryList}>
                {rows.map((row) => (
                  <li key={row.id} style={styles.entryRow}>
                    <Link
                      href={`/travel/journal/${row.id}`}
                      style={styles.entryLink}
                    >
                      <div style={styles.entryHeader}>
                        <span style={styles.entryDate}>{row.entry_date}</span>
                        {row.mood != null ? (
                          <span style={styles.entryMood}>
                            {MOOD_ICONS[row.mood] ?? ''}
                          </span>
                        ) : null}
                      </div>
                      {row.title ? (
                        <span style={styles.entryTitle}>{row.title}</span>
                      ) : null}
                      <span style={styles.entryBody}>
                        {previewBody(row.body_md)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  streakCard: {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
  },
  streakCol: {
    display: 'grid',
    gap: 4,
    justifyItems: 'center',
    textAlign: 'center',
  },
  streakDivider: {
    width: 1,
    height: 36,
    background: 'rgba(255,255,255,0.12)',
    margin: '0 12px',
  },
  streakLabel: {
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  streakValue: {
    color: 'var(--text)',
    fontSize: 20,
    fontWeight: 800,
  },
  yearRow: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearBtn: {
    padding: '8px 14px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text)',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 700,
  },
  yearText: {
    color: 'var(--text)',
    fontSize: 18,
    fontWeight: 800,
    minWidth: 64,
    textAlign: 'center',
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
  monthGroup: { display: 'grid', gap: 8 },
  monthLabel: {
    margin: 0,
    color: '#0EA5E9',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  entryList: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
    display: 'grid',
    gap: 8,
  },
  entryRow: {
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
  },
  entryLink: {
    display: 'grid',
    gap: 6,
    padding: 14,
    color: 'var(--text)',
    textDecoration: 'none',
  },
  entryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entryDate: {
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 700,
  },
  entryMood: { fontSize: 18 },
  entryTitle: {
    color: 'var(--text)',
    fontSize: 15,
    fontWeight: 700,
  },
  entryBody: {
    color: 'var(--text-secondary)',
    fontSize: 13,
    lineHeight: 1.5,
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    overflow: 'hidden',
  },
  memoriesLink: {
    color: '#0EA5E9',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 700,
  },
};
