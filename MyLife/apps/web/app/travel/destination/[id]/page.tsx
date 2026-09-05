import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDestination, type DestinationRecord } from '@mylife/travel';
import { ensureModuleMigrations, getAdapter } from '@/lib/db';
import {
  TRAVEL_ACCENT,
  WISHLIST_GOLD,
  BOTH_GREEN,
  countryFlag,
  isVisited,
} from '../../destinations/_components/dest-helpers';
import { DestEditForm } from '../../_components/dest-edit-form';
import type { CSSProperties } from 'react';

export const dynamic = 'force-dynamic';

function load(id: string): DestinationRecord | null {
  try {
    const adapter = getAdapter();
    ensureModuleMigrations('travel');
    return getDestination(adapter, id);
  } catch {
    return null;
  }
}

export default async function DestinationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dest = load(id);
  if (!dest) notFound();

  const visited = isVisited(dest);
  const accent =
    visited && dest.bucket_list
      ? BOTH_GREEN
      : visited
        ? TRAVEL_ACCENT
        : WISHLIST_GOLD;

  return (
    <div style={styles.page}>
      <div style={styles.headerRow}>
        <Link href="/travel/destinations" style={styles.backLink}>
          {'<-'} Destinations
        </Link>
      </div>

      <section style={styles.hero}>
        <div style={styles.heroTop}>
          <span style={styles.flag} aria-hidden>
            {countryFlag(dest.country_code)}
          </span>
          <div style={{ flex: 1 }}>
            <h1 style={styles.name}>{dest.name}</h1>
            <p style={styles.country}>
              {dest.country ?? 'Unknown location'}
              {dest.region ? ` \u00B7 ${dest.region}` : ''}
            </p>
          </div>
          <span style={{ ...styles.badge, borderColor: accent, color: accent }}>
            {visited && dest.bucket_list
              ? 'Visited + Wishlist'
              : visited
                ? `Visited${dest.visit_count > 1 ? ` \u00D7${dest.visit_count}` : ''}`
                : 'Wishlist'}
          </span>
        </div>

        <div style={styles.statsRow}>
          <Stat label="Visits" value={String(dest.visit_count)} />
          <Stat
            label="First"
            value={dest.first_visited ? dest.first_visited.slice(0, 10) : '\u2014'}
          />
          <Stat
            label="Last"
            value={dest.last_visited ? dest.last_visited.slice(0, 10) : '\u2014'}
          />
          <Stat
            label="Rating"
            value={dest.rating ? `${dest.rating}/5` : '\u2014'}
          />
        </div>

        {dest.lat != null && dest.lng != null ? (
          <p style={styles.coords}>
            Coordinates {dest.lat.toFixed(4)}, {dest.lng.toFixed(4)}
          </p>
        ) : null}

        {dest.best_season ? (
          <p style={styles.season}>Best season: {dest.best_season}</p>
        ) : null}

        {dest.notes_md ? (
          <div style={styles.notesBlock}>
            <p style={styles.sectionLabel}>Notes</p>
            <p style={styles.notesText}>{dest.notes_md}</p>
          </div>
        ) : null}
      </section>

      <DestEditForm record={dest} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.statCell}>
      <span style={styles.statValue}>{value}</span>
      <span style={styles.statLabel}>{label}</span>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { display: 'grid', gap: 18 },
  headerRow: { display: 'flex', alignItems: 'center' },
  backLink: {
    color: TRAVEL_ACCENT,
    fontSize: 13,
    fontWeight: 600,
    textDecoration: 'none',
  },
  hero: {
    display: 'grid',
    gap: 14,
    padding: 20,
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(18px)',
  },
  heroTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  flag: { fontSize: 42, lineHeight: 1 },
  name: {
    margin: 0,
    fontSize: 28,
    letterSpacing: '-0.03em',
    color: 'var(--text)',
  },
  country: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 14,
  },
  badge: {
    padding: '6px 12px',
    borderRadius: 999,
    border: '1px solid',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.04em',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    background: 'rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  statCell: {
    display: 'grid',
    gap: 4,
    justifyItems: 'center',
  },
  statValue: {
    color: TRAVEL_ACCENT,
    fontSize: 20,
    fontWeight: 800,
  },
  statLabel: {
    color: 'var(--text-secondary)',
    fontSize: 11,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  coords: { margin: 0, color: 'var(--text-secondary)', fontSize: 13 },
  season: { margin: 0, color: 'var(--text-secondary)', fontSize: 13 },
  notesBlock: { display: 'grid', gap: 6 },
  sectionLabel: {
    margin: 0,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--text-secondary)',
  },
  notesText: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 14,
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
  },
};
