import Link from 'next/link';
import type { CSSProperties } from 'react';
import { getBucketList, type DestinationRecord } from '@mylife/travel';
import { ensureModuleMigrations, getAdapter } from '@/lib/db';
import {
  TRAVEL_ACCENT,
  WISHLIST_GOLD,
  countryFlag,
  isVisited,
} from '../destinations/_components/dest-helpers';
import { BucketVisitButton } from './_components/bucket-visit-button';

export const dynamic = 'force-dynamic';

function load(): { rows: DestinationRecord[]; error: string | null } {
  try {
    const adapter = getAdapter();
    ensureModuleMigrations('travel');
    return { rows: getBucketList(adapter), error: null };
  } catch (e) {
    return {
      rows: [],
      error: e instanceof Error ? e.message : 'Failed to load bucket list.',
    };
  }
}

export default async function TravelBucketListPage() {
  const { rows, error } = load();
  const visitedOnList = rows.filter(isVisited).length;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <p style={styles.eyebrow}>Bucket list</p>
        <h1 style={styles.title}>Places you want to see</h1>
        <p style={styles.summary}>
          {rows.length === 0
            ? 'Everything is local and private. Add wishlist destinations from the list view.'
            : `${visitedOnList} of ${rows.length} visited so far.`}
        </p>
        <div style={styles.navRow}>
          <Link href="/travel/destinations" style={styles.navLink}>
            All destinations
          </Link>
          <Link href="/travel/map" style={styles.navLink}>
            World map
          </Link>
        </div>
      </header>

      {error ? (
        <div style={styles.errorCard}>
          <p style={styles.errorTitle}>Could not load bucket list</p>
          <p style={styles.errorBody}>{error}</p>
        </div>
      ) : rows.length === 0 ? (
        <div style={styles.empty}>
          <h2 style={styles.emptyTitle}>No wishlist yet</h2>
          <p style={styles.emptyBody}>
            Start a list of dream destinations. Everything stays on this device.
          </p>
          <Link href="/travel/destinations" style={styles.emptyCta}>
            Add a destination
          </Link>
        </div>
      ) : (
        <div style={styles.grid}>
          {rows.map((d) => (
            <BucketCard key={d.id} record={d} />
          ))}
        </div>
      )}
    </div>
  );
}

function BucketCard({ record }: { record: DestinationRecord }) {
  const visited = isVisited(record);
  return (
    <article style={styles.card}>
      <Link href={`/travel/destination/${record.id}`} style={styles.cardLink}>
        <div style={styles.cardHeader}>
          <span style={styles.flag} aria-hidden>
            {countryFlag(record.country_code)}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={styles.cardName}>{record.name}</p>
            <p style={styles.cardMeta}>
              {record.country ?? 'Unknown location'}
              {record.priority != null ? `  \u00B7  Priority ${record.priority}` : ''}
            </p>
          </div>
          <span
            style={{
              ...styles.badge,
              color: visited ? TRAVEL_ACCENT : WISHLIST_GOLD,
              borderColor: visited ? TRAVEL_ACCENT : WISHLIST_GOLD,
            }}
          >
            {visited ? 'Visited' : 'Wishlist'}
          </span>
        </div>
      </Link>
      {!visited ? <BucketVisitButton id={record.id} /> : null}
    </article>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { display: 'grid', gap: 18 },
  header: {
    display: 'grid',
    gap: 6,
    padding: 20,
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,184,119,0.08)',
  },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: WISHLIST_GOLD,
  },
  title: {
    margin: 0,
    fontSize: 26,
    letterSpacing: '-0.03em',
    color: 'var(--text)',
  },
  summary: { margin: 0, color: 'var(--text-secondary)', fontSize: 14 },
  navRow: { display: 'flex', gap: 10, marginTop: 8 },
  navLink: {
    color: TRAVEL_ACCENT,
    fontSize: 13,
    fontWeight: 600,
    textDecoration: 'none',
  },
  grid: { display: 'grid', gap: 10 },
  card: {
    display: 'grid',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
  },
  cardLink: { textDecoration: 'none', color: 'inherit', display: 'block' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 12 },
  flag: { fontSize: 28 },
  cardName: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 16,
    fontWeight: 700,
  },
  cardMeta: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 13,
  },
  badge: {
    padding: '4px 10px',
    borderRadius: 999,
    border: '1px solid',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.04em',
  },
  empty: {
    display: 'grid',
    gap: 10,
    padding: 24,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    textAlign: 'center',
    justifyItems: 'center',
  },
  emptyTitle: { margin: 0, color: 'var(--text)', fontSize: 18 },
  emptyBody: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 13,
    lineHeight: 1.6,
  },
  emptyCta: {
    marginTop: 8,
    padding: '10px 18px',
    borderRadius: 999,
    background: TRAVEL_ACCENT,
    color: '#0E0E13',
    fontSize: 13,
    fontWeight: 800,
    textDecoration: 'none',
  },
  errorCard: {
    padding: 20,
    borderRadius: 16,
    border: '1px solid rgba(255,180,171,0.3)',
    background: 'rgba(147,0,10,0.2)',
  },
  errorTitle: { margin: 0, color: '#FFB4AB', fontSize: 15, fontWeight: 700 },
  errorBody: { margin: 0, color: 'var(--text-secondary)', fontSize: 13 },
};
