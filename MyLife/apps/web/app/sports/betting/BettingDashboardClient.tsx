'use client';

import Link from 'next/link';
import { useMemo, type CSSProperties } from 'react';
import { computeStreak, type Bet } from '@mylife/sports';
import { SPORTS_ACCENT } from '../_ui';
import type { SportsBettingDashboardData } from '../actions';

type Props = {
  initial: SportsBettingDashboardData;
};

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
  if (cents < 0) return DANGER;
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

function resultColor(b: Bet): string {
  if (b.result === 'won') return SPORTS_ACCENT;
  if (b.result === 'lost') return DANGER;
  return MUTED;
}

export function BettingDashboardClient({ initial }: Props) {
  const {
    bankroll,
    pending,
    recent,
    stats,
    limits,
    dailySpentCents,
    weeklySpentCents,
  } = initial;

  const now = Date.now();
  const cooldownActive =
    limits.cooldown_until !== null && limits.cooldown_until > now;

  const streak = useMemo(
    () => computeStreak([...pending, ...recent]),
    [pending, recent],
  );

  const dailyPct =
    limits.daily_cents && limits.daily_cents > 0
      ? (dailySpentCents / limits.daily_cents) * 100
      : null;
  const weeklyPct =
    limits.weekly_cents && limits.weekly_cents > 0
      ? (weeklySpentCents / limits.weekly_cents) * 100
      : null;
  const dailyWarn = dailyPct !== null && dailyPct >= 80;
  const weeklyWarn = weeklyPct !== null && weeklyPct >= 80;

  return (
    <div style={styles.wrap}>
      <div style={styles.headerRow}>
        <div>
          <p style={styles.eyebrow}>Betting</p>
          <h2 style={styles.title}>Bankroll journal</h2>
        </div>
        <Link href="/sports/betting/limits" style={styles.gearBtn}>
          Limits
        </Link>
      </div>

      {cooldownActive ? (
        <div style={{ ...styles.banner, ...styles.bannerDanger }}>
          <strong>Cooldown active.</strong> Bet logging is paused until{' '}
          {new Date(limits.cooldown_until!).toLocaleString()}.
        </div>
      ) : null}

      {pending.some((b) => b.bet_type === 'future') ? (
        <Link href="/sports/betting/futures" style={styles.futuresChip}>
          <span>
            <span style={styles.futuresChipEyebrow}>Open futures</span>
            <span style={styles.futuresChipTitle}>
              {pending.filter((b) => b.bet_type === 'future').length === 1
                ? pending.find((b) => b.bet_type === 'future')!.description
                : `${pending.filter((b) => b.bet_type === 'future').length} open long-shots`}
            </span>
          </span>
          <span style={styles.futuresChipArrow}>›</span>
        </Link>
      ) : null}

      {!cooldownActive && dailyWarn ? (
        <div style={{ ...styles.banner, ...styles.bannerWarn }}>
          Daily spend {formatMoney(dailySpentCents)} of{' '}
          {formatMoney(limits.daily_cents!)} ({dailyPct!.toFixed(0)}%).
        </div>
      ) : null}

      {!cooldownActive && weeklyWarn ? (
        <div style={{ ...styles.banner, ...styles.bannerWarn }}>
          Weekly spend {formatMoney(weeklySpentCents)} of{' '}
          {formatMoney(limits.weekly_cents!)} ({weeklyPct!.toFixed(0)}%).
        </div>
      ) : null}

      <section style={styles.card}>
        <div style={styles.cardRow}>
          <div>
            <p style={styles.metricLabel}>Bankroll</p>
            <p style={styles.metricBig}>
              {formatMoney(bankroll.current_cents)}
            </p>
            <p style={styles.metricSub}>
              Starting {formatMoney(bankroll.starting_cents)} · Unit{' '}
              {formatMoney(limits.unit_size_cents)}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={styles.metricLabel}>Net P/L</p>
            <p
              style={{
                ...styles.metricBig,
                color: pnlColor(stats.profitLossCents),
              }}
            >
              {formatSignedMoney(stats.profitLossCents)}
            </p>
            <p style={styles.metricSub}>
              ROI {formatPct(stats.roiPct)} · Win {formatPct(stats.winRatePct)}
            </p>
          </div>
        </div>
        <div style={styles.cardRow}>
          <p style={styles.metricSub}>
            {stats.wins}W · {stats.losses}L · {stats.pushes}P · {stats.voids}V
            {streak.current.type
              ? ` · streak ${streak.current.length}${streak.current.type}`
              : ''}
          </p>
        </div>
      </section>

      {!cooldownActive ? (
        <div style={styles.actionRow}>
          <Link href="/sports/betting/log" style={styles.primaryBtn}>
            Log bet
          </Link>
          <Link href="/sports/betting/parlay" style={styles.secondaryBtn}>
            Parlay
          </Link>
        </div>
      ) : null}

      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Pending</h3>
        {pending.length === 0 ? (
          <p style={styles.empty}>No open bets.</p>
        ) : (
          pending.map((b) => <BetRow key={b.id} bet={b} />)
        )}
      </section>

      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Recent</h3>
        {recent.length === 0 ? (
          <p style={styles.empty}>No settled bets yet.</p>
        ) : (
          recent.slice(0, 5).map((b) => <BetRow key={b.id} bet={b} />)
        )}
      </section>

      <div style={styles.footerRow}>
        <Link href="/sports/betting/history" style={styles.chip}>
          History
        </Link>
        <Link href="/sports/betting/analytics" style={styles.chip}>
          Analytics
        </Link>
      </div>
    </div>
  );
}

function BetRow({ bet }: { bet: Bet }) {
  return (
    <Link href={`/sports/bet/${encodeURIComponent(bet.id)}`} style={styles.row}>
      <div style={styles.rowHeader}>
        <span
          style={{
            ...styles.badge,
            borderColor: resultColor(bet),
            color: resultColor(bet),
          }}
        >
          {resultLetter(bet)}
        </span>
        <span style={styles.rowType}>{bet.bet_type.toUpperCase()}</span>
        <span style={styles.rowLeague}>{bet.league.toUpperCase()}</span>
      </div>
      <div style={styles.rowDescription}>{bet.description}</div>
      <div style={styles.rowFoot}>
        <span style={styles.rowStake}>
          {formatMoney(bet.stake_cents)} @{' '}
          {bet.odds_american > 0 ? '+' : ''}
          {bet.odds_american}
        </span>
        <span
          style={{
            ...styles.rowPnL,
            color:
              bet.result === 'pending'
                ? MUTED
                : pnlColor(bet.profit_loss_cents),
          }}
        >
          {bet.result === 'pending'
            ? `→ ${formatMoney(bet.potential_payout_cents)}`
            : formatSignedMoney(bet.profit_loss_cents)}
        </span>
      </div>
    </Link>
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
    color: '#4ADE80',
  },
  title: {
    margin: 0,
    fontSize: 26,
    fontWeight: 800,
    color: 'var(--text)',
  },
  gearBtn: {
    padding: '8px 14px',
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 600,
  },
  banner: {
    padding: '12px 14px',
    borderRadius: 14,
    fontSize: 14,
    lineHeight: 1.5,
  },
  bannerDanger: {
    background: 'rgba(229,115,115,0.12)',
    border: '1px solid rgba(229,115,115,0.35)',
    color: '#FCA5A5',
  },
  bannerWarn: {
    background: 'rgba(255,184,119,0.12)',
    border: '1px solid rgba(255,184,119,0.35)',
    color: '#FFB877',
  },
  card: {
    padding: 18,
    borderRadius: 18,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    display: 'grid',
    gap: 10,
  },
  cardRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 14,
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
    fontSize: 26,
    fontWeight: 800,
    color: 'var(--text)',
  },
  metricSub: {
    margin: 0,
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
  actionRow: { display: 'flex', gap: 10 },
  primaryBtn: {
    padding: '12px 18px',
    borderRadius: 12,
    background: SPORTS_ACCENT,
    color: '#0E0E13',
    fontWeight: 800,
    textDecoration: 'none',
    fontSize: 14,
  },
  secondaryBtn: {
    padding: '12px 18px',
    borderRadius: 12,
    border: `1px solid ${SPORTS_ACCENT}`,
    color: SPORTS_ACCENT,
    background: 'transparent',
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
  rowType: {
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--text-secondary)',
  },
  rowLeague: {
    fontSize: 11,
    fontWeight: 700,
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
  rowStake: { fontSize: 13, color: 'var(--text-secondary)' },
  rowPnL: { fontSize: 13, fontWeight: 800 },
  footerRow: { display: 'flex', gap: 10, marginTop: 8 },
  chip: {
    padding: '10px 16px',
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 700,
  },
  futuresChip: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    textDecoration: 'none',
  },
  futuresChipEyebrow: {
    display: 'block',
    color: SPORTS_ACCENT,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  futuresChipTitle: {
    display: 'block',
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 700,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  futuresChipArrow: {
    color: 'var(--text-secondary)',
    fontSize: 20,
    fontWeight: 700,
  },
};
