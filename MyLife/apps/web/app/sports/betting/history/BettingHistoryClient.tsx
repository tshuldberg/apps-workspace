'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type CSSProperties,
} from 'react';
import type { Bet, BetResult } from '@mylife/sports';
import { SPORTS_ACCENT } from '../../_ui';
import { sportsListBets } from '../../actions';

type Props = {
  initial: Bet[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

type RangeKey = '7d' | '30d' | '90d' | '365d' | 'all';
const RANGE_DAYS: Record<Exclude<RangeKey, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '365d': 365,
};

const RESULT_FILTERS: Array<{ key: 'all' | BetResult; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
  { key: 'push', label: 'Push' },
  { key: 'void', label: 'Void' },
];

const RESULT_COLOR: Record<string, string> = {
  won: SPORTS_ACCENT,
  lost: '#E57373',
  push: '#9F8E81',
  void: '#9F8E81',
  pending: '#9F8E81',
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

function resultLetter(r: BetResult): string {
  switch (r) {
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

export function BettingHistoryClient({ initial }: Props) {
  const [range, setRange] = useState<RangeKey>('30d');
  const [resultFilter, setResultFilter] = useState<'all' | BetResult>('all');
  const [bets, setBets] = useState<Bet[]>(initial);
  const [isPending, startTransition] = useTransition();

  const reload = useCallback(() => {
    const now = Date.now();
    const placedSince =
      range === 'all' ? undefined : now - RANGE_DAYS[range] * DAY_MS;
    const filter = resultFilter === 'all' ? undefined : resultFilter;
    startTransition(async () => {
      try {
        const rows = await sportsListBets({
          placedSince,
          result: filter,
          limit: 200,
        });
        setBets(rows);
      } catch (err) {
        console.error('[MySports] history load failed', err);
      }
    });
  }, [range, resultFilter]);

  useEffect(() => {
    reload();
  }, [reload]);

  const grouped = useMemo(() => {
    const buckets = new Map<string, Bet[]>();
    for (const b of bets) {
      const d = new Date(b.placed_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const list = buckets.get(key) ?? [];
      list.push(b);
      buckets.set(key, list);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([key, items]) => ({
        key,
        label: new Date(items[0].placed_at).toLocaleDateString([], {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }),
        items,
      }));
  }, [bets]);

  return (
    <div style={styles.wrap}>
      <p style={styles.eyebrow}>History</p>
      <h2 style={styles.title}>Bet journal</h2>

      <div style={styles.chipRow}>
        {(['7d', '30d', '90d', '365d', 'all'] as RangeKey[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setRange(k)}
            style={{
              ...styles.chip,
              ...(range === k ? styles.chipActive : {}),
            }}
          >
            {k === 'all' ? 'All time' : `Last ${k}`}
          </button>
        ))}
      </div>

      <div style={styles.chipRow}>
        {RESULT_FILTERS.map((rf) => (
          <button
            key={rf.key}
            type="button"
            onClick={() => setResultFilter(rf.key)}
            style={{
              ...styles.chip,
              ...(resultFilter === rf.key ? styles.chipActive : {}),
            }}
          >
            {rf.label}
          </button>
        ))}
      </div>

      {grouped.length === 0 ? (
        <div style={styles.empty}>
          No bets match these filters.{' '}
          {isPending ? 'Loading…' : 'Widen the range or clear a filter.'}
        </div>
      ) : (
        grouped.map((g) => (
          <section key={g.key} style={styles.group}>
            <h3 style={styles.groupHeader}>{g.label}</h3>
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
                      borderColor: RESULT_COLOR[b.result],
                      color: RESULT_COLOR[b.result],
                    }}
                  >
                    {resultLetter(b.result)}
                  </span>
                  <span style={styles.rowType}>{b.bet_type.toUpperCase()}</span>
                  <span style={styles.rowLeague}>
                    {b.league.toUpperCase()}
                  </span>
                </div>
                <div style={styles.rowDescription}>{b.description}</div>
                <div style={styles.rowFoot}>
                  <span style={styles.rowStake}>
                    {formatMoney(b.stake_cents)} @{' '}
                    {b.odds_american > 0 ? '+' : ''}
                    {b.odds_american}
                  </span>
                  <span
                    style={{
                      ...styles.rowPnL,
                      color:
                        b.result === 'pending'
                          ? '#9F8E81'
                          : b.profit_loss_cents > 0
                            ? SPORTS_ACCENT
                            : b.profit_loss_cents < 0
                              ? '#E57373'
                              : '#9F8E81',
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
        ))
      )}
    </div>
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
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: {
    padding: '8px 14px',
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  chipActive: {
    borderColor: SPORTS_ACCENT,
    background: SPORTS_ACCENT,
    color: '#0E0E13',
  },
  empty: {
    padding: 16,
    borderRadius: 14,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-secondary)',
    fontSize: 14,
  },
  group: { display: 'grid', gap: 6 },
  groupHeader: {
    margin: '6px 0 2px',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--text-secondary)',
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
  rowType: { fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)' },
  rowLeague: { fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' },
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
};
