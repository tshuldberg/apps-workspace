import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { Attendance } from '@mylife/sports';
import {
  sportsGetAttendanceStats,
  sportsListAttendance,
} from '../actions';
import { SPORTS_ACCENT } from '../_ui';

export const dynamic = 'force-dynamic';

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCost(cents: number): string {
  if (cents <= 0) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

function stars(rating: number | null): string {
  if (rating === null) return '';
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

function seatLabel(row: Attendance): string {
  const parts: string[] = [];
  if (row.section) parts.push(`sec ${row.section}`);
  if (row.row_label) parts.push(`row ${row.row_label}`);
  if (row.seat) parts.push(`seat ${row.seat}`);
  return parts.join(' · ');
}

export default async function SportsEventsPage() {
  const currentYear = new Date().getFullYear();
  const [listResult, statsResult] = await Promise.all([
    sportsListAttendance({ limit: 20 }),
    sportsGetAttendanceStats({ year: currentYear }),
  ]);

  const rows: Attendance[] = listResult.ok ? listResult.rows : [];
  const stats = statsResult.ok ? statsResult.stats : null;
  const error = !listResult.ok ? listResult.error : null;

  return (
    <div style={styles.wrap}>
      <p style={styles.eyebrow}>Attendance</p>
      <h2 style={styles.title}>Games attended</h2>
      <p style={styles.subtitle}>
        Track games you attend in person. Seats, cost, companions, ratings.
        Private to this device.
      </p>

      <div style={styles.ctaRow}>
        <Link href="/sports/events/log" style={styles.primaryLink}>
          Log attendance
        </Link>
        <Link href="/sports/events/venues" style={styles.secondaryLink}>
          Venues
        </Link>
      </div>

      <section style={styles.block}>
        <p style={styles.blockLabel}>Collections</p>
        <div style={styles.ctaRow}>
          <Link
            href="/sports/events/memorabilia"
            style={styles.secondaryLink}
          >
            Memorabilia
          </Link>
          <Link
            href="/sports/events/watch-party"
            style={styles.secondaryLink}
          >
            Watch parties
          </Link>
        </div>
      </section>

      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>{currentYear} games</span>
          <span style={styles.statValue}>{stats?.gamesAttended ?? 0}</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>{currentYear} spent</span>
          <span style={styles.statValue}>
            {formatCost(stats?.totalSpentCents ?? 0)}
          </span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Venues</span>
          <span style={styles.statValue}>{stats?.uniqueVenues ?? 0}</span>
        </div>
      </div>

      <section style={styles.block}>
        <p style={styles.blockLabel}>Recent</p>
        {error ? (
          <p style={styles.error}>Error: {error}</p>
        ) : rows.length === 0 ? (
          <div style={styles.emptyCard}>
            <p style={styles.emptyText}>
              No games attended yet. Tap Log Attendance to record your first.
            </p>
          </div>
        ) : (
          <div style={styles.list}>
            {rows.map((row) => {
              const seat = seatLabel(row);
              return (
                <Link
                  key={row.id}
                  href={`/sports/events/${encodeURIComponent(row.id)}`}
                  style={styles.row}
                >
                  <span style={styles.rowBody}>
                    <span style={styles.rowTitle}>{row.venue_name}</span>
                    {seat ? (
                      <span style={styles.rowMeta}>{seat}</span>
                    ) : null}
                    <span style={styles.rowMeta}>
                      {formatDate(row.attended_at)} ·{' '}
                      {formatCost(row.cost_cents)}
                    </span>
                  </span>
                  {row.rating !== null ? (
                    <span style={styles.stars}>{stars(row.rating)}</span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: 14 },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: SPORTS_ACCENT,
  },
  title: {
    margin: 0,
    fontSize: 28,
    lineHeight: 1.15,
    color: 'var(--text)',
    fontWeight: 800,
  },
  subtitle: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 15,
    lineHeight: 1.6,
    maxWidth: 720,
  },
  ctaRow: { display: 'flex', gap: 10 },
  primaryLink: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '10px 18px',
    borderRadius: 12,
    background: SPORTS_ACCENT,
    color: '#0E0E13',
    textDecoration: 'none',
    fontWeight: 800,
    fontSize: 14,
  },
  secondaryLink: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '10px 18px',
    borderRadius: 12,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    textDecoration: 'none',
    fontWeight: 800,
    fontSize: 14,
  },
  statsRow: { display: 'flex', gap: 8 },
  statCard: {
    flex: 1,
    display: 'grid',
    gap: 4,
    padding: 12,
    borderRadius: 12,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  statLabel: {
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  statValue: {
    color: 'var(--text)',
    fontSize: 18,
    fontWeight: 800,
  },
  block: { display: 'grid', gap: 10, marginTop: 6 },
  blockLabel: {
    margin: 0,
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--text-secondary)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
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
  rowMeta: { color: 'var(--text-secondary)', fontSize: 13 },
  stars: { color: SPORTS_ACCENT, fontSize: 14, fontWeight: 700 },
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
  error: { margin: 0, color: '#F87171', fontSize: 13 },
};
