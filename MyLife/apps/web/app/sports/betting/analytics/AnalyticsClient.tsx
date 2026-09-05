'use client';

import { useMemo, type CSSProperties } from 'react';
import {
  computeBetStats,
  computeStreak,
  computeUnitsPnL,
  groupStatsBy,
  type Bet,
  type BetStats,
} from '@mylife/sports';
import { SPORTS_ACCENT } from '../../_ui';

type Props = {
  bets: Bet[];
  unitSizeCents: number;
};

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatSignedMoney(cents: number): string {
  const sign = cents > 0 ? '+' : '';
  return `${sign}${formatMoney(cents)}`;
}

function formatPct(pct: number | null, digits = 1): string {
  if (pct === null) return '—';
  return `${pct.toFixed(digits)}%`;
}

function pnlColor(cents: number): string {
  if (cents > 0) return SPORTS_ACCENT;
  if (cents < 0) return '#E57373';
  return '#9F8E81';
}

function sortedGroups<K>(
  map: Map<K, BetStats>,
): Array<{ key: K; stats: BetStats }> {
  return Array.from(map.entries())
    .map(([key, stats]) => ({ key, stats }))
    .sort((a, b) => b.stats.totalBets - a.stats.totalBets);
}

export function AnalyticsClient({ bets, unitSizeCents }: Props) {
  const stats = useMemo(() => computeBetStats(bets), [bets]);
  const streak = useMemo(() => computeStreak(bets), [bets]);
  const units = useMemo(
    () => computeUnitsPnL(bets, unitSizeCents),
    [bets, unitSizeCents],
  );
  const bySport = useMemo(
    () => sortedGroups(groupStatsBy(bets, (b) => b.sport)),
    [bets],
  );
  const byLeague = useMemo(
    () => sortedGroups(groupStatsBy(bets, (b) => b.league)),
    [bets],
  );
  const byType = useMemo(
    () => sortedGroups(groupStatsBy(bets, (b) => b.bet_type)),
    [bets],
  );
  const byBook = useMemo(
    () => sortedGroups(groupStatsBy(bets, (b) => b.sportsbook)),
    [bets],
  );

  if (bets.length === 0) {
    return (
      <div style={styles.empty}>
        <p style={styles.eyebrow}>Analytics</p>
        <h2 style={styles.title}>Nothing to chart yet</h2>
        <p style={styles.emptyBody}>
          Log a bet or two and this screen fills in with P/L, win rate, and
          streak breakdowns.
        </p>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <p style={styles.eyebrow}>Analytics</p>
      <h2 style={styles.title}>Performance</h2>

      <div style={styles.grid2}>
        <div style={styles.metricCard}>
          <p style={styles.metricLabel}>Net P/L</p>
          <p style={{ ...styles.metricBig, color: pnlColor(stats.profitLossCents) }}>
            {formatSignedMoney(stats.profitLossCents)}
          </p>
        </div>
        <div style={styles.metricCard}>
          <p style={styles.metricLabel}>ROI</p>
          <p style={styles.metricBig}>{formatPct(stats.roiPct)}</p>
        </div>
      </div>

      <div style={styles.grid2}>
        <div style={styles.metricCard}>
          <p style={styles.metricLabel}>Win rate</p>
          <p style={styles.metricBig}>{formatPct(stats.winRatePct)}</p>
          <p style={styles.metricSub}>
            {stats.wins}W · {stats.losses}L · {stats.pushes}P · {stats.voids}V
          </p>
        </div>
        <div style={styles.metricCard}>
          <p style={styles.metricLabel}>Streak</p>
          <p style={styles.metricBig}>
            {streak.current.type
              ? `${streak.current.length}${streak.current.type}`
              : '—'}
          </p>
          <p style={styles.metricSub}>
            Longest {streak.longestWin}W / {streak.longestLoss}L
          </p>
        </div>
      </div>

      <div style={styles.metricCard}>
        <p style={styles.metricLabel}>Units</p>
        <p style={styles.unitsLine}>
          +{units.wonUnits.toFixed(1)}U · −{units.lostUnits.toFixed(1)}U
        </p>
        <p
          style={{
            ...styles.unitsNet,
            color:
              units.netUnits > 0
                ? SPORTS_ACCENT
                : units.netUnits < 0
                  ? '#E57373'
                  : '#9F8E81',
          }}
        >
          Net {units.netUnits >= 0 ? '+' : ''}
          {units.netUnits.toFixed(2)}U at {formatMoney(unitSizeCents)}/unit
        </p>
      </div>

      <StatsTable title="By sport" rows={bySport} />
      <StatsTable title="By league" rows={byLeague} />
      <StatsTable title="By bet type" rows={byType} />
      <StatsTable title="By sportsbook" rows={byBook} />
    </div>
  );
}

function StatsTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ key: unknown; stats: BetStats }>;
}) {
  return (
    <section style={styles.tableCard}>
      <h3 style={styles.tableTitle}>{title}</h3>
      <div style={{ ...styles.tableRow, ...styles.tableHeader }}>
        <span style={{ ...styles.tableCell, flex: 2, fontWeight: 800 }}>
          Group
        </span>
        <span style={{ ...styles.tableCell, fontWeight: 800 }}>Bets</span>
        <span style={{ ...styles.tableCell, fontWeight: 800 }}>Win%</span>
        <span style={{ ...styles.tableCell, fontWeight: 800 }}>ROI</span>
        <span style={{ ...styles.tableCell, fontWeight: 800 }}>P/L</span>
      </div>
      {rows.map(({ key, stats }) => (
        <div key={String(key)} style={styles.tableRow}>
          <span style={{ ...styles.tableCell, flex: 2 }}>
            {String(key).toUpperCase()}
          </span>
          <span style={styles.tableCell}>{stats.totalBets}</span>
          <span style={styles.tableCell}>
            {formatPct(stats.winRatePct, 0)}
          </span>
          <span style={styles.tableCell}>{formatPct(stats.roiPct, 0)}</span>
          <span
            style={{
              ...styles.tableCell,
              color: pnlColor(stats.profitLossCents),
              fontWeight: 800,
            }}
          >
            {formatSignedMoney(stats.profitLossCents)}
          </span>
        </div>
      ))}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: 12 },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: '#4ADE80',
  },
  title: { margin: 0, fontSize: 26, fontWeight: 800, color: 'var(--text)' },
  empty: {
    display: 'grid',
    gap: 10,
    padding: 24,
    borderRadius: 18,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
  },
  emptyBody: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.6,
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  metricCard: {
    padding: 14,
    borderRadius: 14,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    display: 'grid',
    gap: 4,
  },
  metricLabel: {
    margin: 0,
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--text-secondary)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  metricBig: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    color: 'var(--text)',
  },
  metricSub: {
    margin: 0,
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
  unitsLine: {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text)',
  },
  unitsNet: {
    margin: 0,
    fontSize: 14,
    fontWeight: 800,
  },
  tableCard: {
    padding: 14,
    borderRadius: 14,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    display: 'grid',
    gap: 4,
  },
  tableTitle: {
    margin: '0 0 4px',
    fontSize: 15,
    fontWeight: 800,
    color: 'var(--text)',
  },
  tableHeader: {
    borderBottom: '1px solid var(--border)',
    paddingBottom: 6,
  },
  tableRow: {
    display: 'flex',
    gap: 8,
    padding: '6px 0',
  },
  tableCell: {
    flex: 1,
    fontSize: 13,
    color: 'var(--text)',
  },
};
