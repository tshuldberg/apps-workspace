'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { Bet, OddsSnapshot } from '@mylife/sports';
import { SPORTS_ACCENT } from '../../_ui';
import type { SportsFuturesData } from '../../actions';

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

function matchCurrent(
  bet: Bet,
  currentOddsByLeague: Record<string, OddsSnapshot[] | null>,
): number | null {
  const lid = bet.league.toLowerCase();
  const snaps = currentOddsByLeague[lid];
  if (!snaps) return null;
  const desc = bet.description.toLowerCase();
  let best: OddsSnapshot | null = null;
  for (const s of snaps) {
    if (desc.includes(s.team.toLowerCase())) {
      if (!best || s.fetched_at > best.fetched_at) best = s;
    }
  }
  return best ? best.price_american : null;
}

export function FuturesClient({ initial }: { initial: SportsFuturesData }) {
  const { pending, settled, currentOddsByLeague, hasKey } = initial;
  const anyCurrent = Object.values(currentOddsByLeague).some(
    (v) => v !== null && v.length > 0,
  );
  const showUnavailable = pending.length > 0 && !anyCurrent;

  return (
    <div style={styles.wrap}>
      <div style={styles.headerRow}>
        <div>
          <p style={styles.eyebrow}>Futures</p>
          <h2 style={styles.title}>Long-shot journal</h2>
        </div>
        <Link href="/sports/bet/log?type=future" style={styles.primaryBtn}>
          + Log a future
        </Link>
      </div>

      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Open</h3>
        {pending.length === 0 ? (
          <p style={styles.empty}>
            No open futures. Tap "Log a future" to track championship or
            season-long wagers.
          </p>
        ) : (
          pending.map((b) => {
            const cur = matchCurrent(b, currentOddsByLeague);
            return (
              <Link
                key={b.id}
                href={`/sports/bet/${encodeURIComponent(b.id)}`}
                style={styles.row}
              >
                <div style={styles.rowHeader}>
                  <span style={styles.rowType}>FUTURE</span>
                  <span style={styles.rowLeague}>
                    {b.league.toUpperCase()}
                  </span>
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
                    Taken {formatAmerican(b.odds_american)} ·{' '}
                    {formatMoney(b.stake_cents)}
                  </span>
                  {cur !== null ? (
                    <DeltaChip taken={b.odds_american} current={cur} />
                  ) : null}
                </div>
              </Link>
            );
          })
        )}
        {showUnavailable ? (
          <Link href="/sports/settings" style={styles.unavailable}>
            Current odds unavailable —{' '}
            {hasKey
              ? 'try again later or change sportsbook.'
              : 'add an Odds API key in Settings.'}
          </Link>
        ) : null}
      </section>

      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Settled</h3>
        {settled.length === 0 ? (
          <p style={styles.empty}>
            Settled futures will appear here once they are resolved.
          </p>
        ) : (
          settled.map((b) => (
            <Link
              key={b.id}
              href={`/sports/bet/${encodeURIComponent(b.id)}`}
              style={styles.row}
            >
              <div style={styles.rowHeader}>
                <span style={styles.rowType}>FUTURE</span>
                <span style={styles.rowLeague}>{b.league.toUpperCase()}</span>
                <span style={styles.rowDate}>
                  {new Date(b.settled_at ?? b.placed_at).toLocaleDateString(
                    [],
                    { month: 'short', day: 'numeric' },
                  )}
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
                      b.profit_loss_cents > 0
                        ? SPORTS_ACCENT
                        : b.profit_loss_cents < 0
                          ? DANGER
                          : MUTED,
                  }}
                >
                  {b.result.toUpperCase()}
                </span>
              </div>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}

function DeltaChip({ taken, current }: { taken: number; current: number }) {
  const delta = current - taken;
  if (delta === 0) {
    return (
      <span style={{ ...styles.deltaChip, borderColor: MUTED, color: MUTED }}>
        flat
      </span>
    );
  }
  const favored = delta > 0;
  return (
    <span
      style={{
        ...styles.deltaChip,
        borderColor: favored ? SPORTS_ACCENT : DANGER,
        color: favored ? SPORTS_ACCENT : DANGER,
      }}
    >
      {favored ? '↑' : '↓'} {current > 0 ? `+${current}` : current}
    </span>
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
  rowType: {
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--text-secondary)',
    letterSpacing: '0.1em',
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
    gap: 8,
  },
  rowOdds: { fontSize: 13, color: 'var(--text-secondary)' },
  rowPnL: { fontSize: 13, fontWeight: 800 },
  deltaChip: {
    padding: '3px 10px',
    borderRadius: 999,
    border: '1px solid',
    fontSize: 12,
    fontWeight: 800,
  },
  unavailable: {
    padding: 12,
    borderRadius: 12,
    border: '1px dashed var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: 12,
    lineHeight: 1.4,
    textDecoration: 'none',
  },
};
