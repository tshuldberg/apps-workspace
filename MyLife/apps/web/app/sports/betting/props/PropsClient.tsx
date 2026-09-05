'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { Bet } from '@mylife/sports';
import { SPORTS_ACCENT } from '../../_ui';
import type { SportsPropsData } from '../../actions';

const DANGER = '#E57373';
const MUTED = '#9F8E81';

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatAmerican(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

function formatSignedMoney(cents: number): string {
  const sign = cents > 0 ? '+' : '';
  return `${sign}${formatMoney(cents)}`;
}

function resultColor(b: Bet): string {
  if (b.result === 'won') return SPORTS_ACCENT;
  if (b.result === 'lost') return DANGER;
  return MUTED;
}

function resultLetter(b: Bet): string {
  switch (b.result) {
    case 'won':
      return 'W';
    case 'lost':
      return 'L';
    case 'push':
      return 'P';
    case 'void':
      return 'V';
    default:
      return '…';
  }
}

function labelForGroup(gameId: string | null): string {
  if (gameId === null) return 'No game attached';
  return `Game ${gameId.replace(/^espn:[a-z]+:/, '')}`;
}

export function PropsClient({ initial }: { initial: SportsPropsData }) {
  const { groups } = initial;
  return (
    <div style={styles.wrap}>
      <div style={styles.headerRow}>
        <div>
          <p style={styles.eyebrow}>Props</p>
          <h2 style={styles.title}>Player & game props</h2>
        </div>
        <Link href="/sports/bet/log?type=prop" style={styles.primaryBtn}>
          + Log a prop
        </Link>
      </div>

      {groups.length === 0 ? (
        <p style={styles.empty}>
          No prop bets yet. Tap "Log a prop" to track player yardage,
          strikeouts, three-pointers, and other markets.
        </p>
      ) : null}

      {groups.map((g) => (
        <section key={g.gameId ?? '__ungrouped__'} style={styles.section}>
          <h3 style={styles.sectionTitle}>{labelForGroup(g.gameId)}</h3>
          {g.items.map((b) => (
            <Link
              key={b.id}
              href={`/sports/bet/${encodeURIComponent(b.id)}`}
              style={styles.row}
            >
              <div style={styles.rowHeader}>
                <span
                  style={{
                    ...styles.badge,
                    borderColor: resultColor(b),
                    color: resultColor(b),
                  }}
                >
                  {resultLetter(b)}
                </span>
                <span style={styles.rowLeague}>{b.league.toUpperCase()}</span>
                <span style={styles.rowDate}>
                  {new Date(b.placed_at).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <div style={styles.rowDescription}>{b.description}</div>
              <div style={styles.rowFoot}>
                <span style={styles.rowOdds}>
                  {formatAmerican(b.odds_american)} ·{' '}
                  {formatMoney(b.stake_cents)}
                </span>
                <span
                  style={{
                    ...styles.rowPnL,
                    color:
                      b.result === 'pending'
                        ? MUTED
                        : b.profit_loss_cents > 0
                          ? SPORTS_ACCENT
                          : b.profit_loss_cents < 0
                            ? DANGER
                            : MUTED,
                  }}
                >
                  {b.result === 'pending'
                    ? `→ ${formatMoney(b.potential_payout_cents)}`
                    : formatSignedMoney(b.profit_loss_cents)}
                </span>
              </div>
            </Link>
          ))}
        </section>
      ))}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: 14 },
  headerRow: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
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
    fontSize: 26,
    fontWeight: 800,
    color: 'var(--text)',
  },
  primaryBtn: {
    padding: '10px 16px',
    borderRadius: 999,
    background: SPORTS_ACCENT,
    color: '#0E0E13',
    fontWeight: 800,
    textDecoration: 'none',
    fontSize: 14,
  },
  section: { display: 'grid', gap: 8 },
  sectionTitle: {
    margin: '6px 0 2px',
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--text-secondary)',
  },
  empty: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 14,
    padding: 14,
    borderRadius: 14,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
  },
  row: {
    display: 'grid',
    gap: 6,
    padding: 14,
    borderRadius: 14,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    textDecoration: 'none',
  },
  rowHeader: { display: 'flex', alignItems: 'center', gap: 8 },
  badge: {
    padding: '2px 9px',
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: 'solid',
    fontSize: 11,
    fontWeight: 800,
  },
  rowLeague: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-secondary)',
  },
  rowDate: {
    marginLeft: 'auto',
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
  rowDescription: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--text)',
    lineHeight: 1.4,
  },
  rowFoot: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowOdds: { fontSize: 13, color: 'var(--text-secondary)' },
  rowPnL: { fontSize: 13, fontWeight: 800 },
};
