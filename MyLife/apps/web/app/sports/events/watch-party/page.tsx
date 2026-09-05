import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { Attendance } from '@mylife/sports';
import { sportsListWatchParties } from '../../actions';
import { SPORTS_ACCENT } from '../../_ui';

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

export default async function SportsWatchPartyPage() {
  const result = await sportsListWatchParties({ limit: 50 });
  const rows: Attendance[] = result.ok ? result.rows : [];
  const error = !result.ok ? result.error : null;
  const totalCost = rows.reduce((sum, r) => sum + r.cost_cents, 0);

  return (
    <div style={styles.wrap}>
      <p style={styles.eyebrow}>Watch parties</p>
      <h2 style={styles.title}>Games watched</h2>
      <p style={styles.subtitle}>
        Home, bar, or a friend&apos;s place. Food, drinks, who came. No seats
        needed.
      </p>

      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Parties</span>
          <span style={styles.statValue}>{rows.length}</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Total spent</span>
          <span style={styles.statValue}>{formatCost(totalCost)}</span>
        </div>
      </div>

      <Link
        href="/sports/events/log?mode=watch-party"
        style={styles.primaryLink}
      >
        Log watch party
      </Link>

      <section style={styles.block}>
        <p style={styles.blockLabel}>Recent</p>
        {error ? (
          <p style={styles.error}>Error: {error}</p>
        ) : rows.length === 0 ? (
          <div style={styles.emptyCard}>
            <p style={styles.emptyText}>
              No watch parties yet. Log one to track the game, the venue, and
              who you watched with.
            </p>
          </div>
        ) : (
          <div style={styles.list}>
            {rows.map((row) => (
              <Link
                key={row.id}
                href={`/sports/events/${encodeURIComponent(row.id)}`}
                style={styles.row}
              >
                <span style={styles.rowBody}>
                  <span style={styles.rowTitle}>{row.venue_name}</span>
                  <span style={styles.rowMeta}>
                    {formatDate(row.attended_at)} ·{' '}
                    {formatCost(row.cost_cents)}
                    {row.companions.length > 0
                      ? ` · ${row.companions.length} with you`
                      : ''}
                  </span>
                </span>
              </Link>
            ))}
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
  statValue: { color: 'var(--text)', fontSize: 18, fontWeight: 800 },
  primaryLink: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 18px',
    borderRadius: 12,
    background: SPORTS_ACCENT,
    color: '#0E0E13',
    textDecoration: 'none',
    fontWeight: 800,
    fontSize: 14,
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
