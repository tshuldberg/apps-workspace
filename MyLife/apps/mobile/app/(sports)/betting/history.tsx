import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, surfaceTiers } from '@mylife/ui';
import { listBets, type Bet, type BetResult } from '@mylife/sports';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SPORTS_ACCENT } from '../_ui';

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

export default function SportsBetHistoryScreen() {
  const router = useRouter();
  const db = useDatabase();
  const [range, setRange] = useState<RangeKey>('30d');
  const [resultFilter, setResultFilter] = useState<'all' | BetResult>('all');
  const [bets, setBets] = useState<Bet[]>([]);

  const load = useCallback(() => {
    const now = Date.now();
    const placedSince =
      range === 'all' ? undefined : now - RANGE_DAYS[range] * DAY_MS;
    const filter = resultFilter === 'all' ? undefined : resultFilter;
    try {
      const rows = listBets(db, {
        placedSince,
        result: filter,
        limit: 200,
      });
      setBets(rows);
    } catch (err) {
      console.error('[MySports] bet history load failed', err);
    }
  }, [db, range, resultFilter]);

  useEffect(() => {
    load();
  }, [load]);

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
      .map(([key, items]) => {
        const d = new Date(items[0].placed_at);
        return {
          key,
          label: d.toLocaleDateString([], {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }),
          items,
        };
      });
  }, [bets]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.eyebrow}>History</Text>
      <Text style={styles.title}>Bet journal</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {(['7d', '30d', '90d', '365d', 'all'] as RangeKey[]).map((k) => {
          const active = range === k;
          return (
            <Pressable
              key={k}
              onPress={() => setRange(k)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text
                style={[styles.chipText, active && styles.chipTextActive]}
              >
                {k === 'all' ? 'All time' : `Last ${k.replace('d', 'd')}`}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {RESULT_FILTERS.map((rf) => {
          const active = resultFilter === rf.key;
          return (
            <Pressable
              key={rf.key}
              onPress={() => setResultFilter(rf.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text
                style={[styles.chipText, active && styles.chipTextActive]}
              >
                {rf.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {grouped.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No bets match these filters. Widen the range or clear a filter.
          </Text>
        </View>
      ) : null}

      {grouped.map((g) => (
        <View key={g.key} style={styles.group}>
          <Text style={styles.groupHeader}>{g.label}</Text>
          {g.items.map((b) => (
            <Pressable
              key={b.id}
              style={styles.row}
              onPress={() =>
                router.push(
                  `/(sports)/bet/${encodeURIComponent(b.id)}` as never,
                )
              }
            >
              <View style={styles.rowHeader}>
                <View
                  style={[
                    styles.badge,
                    { borderColor: RESULT_COLOR[b.result] },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      { color: RESULT_COLOR[b.result] },
                    ]}
                  >
                    {b.result === 'won'
                      ? 'W'
                      : b.result === 'lost'
                        ? 'L'
                        : b.result === 'push'
                          ? 'P'
                          : b.result === 'void'
                            ? 'V'
                            : '…'}
                  </Text>
                </View>
                <Text style={styles.rowType}>
                  {b.bet_type.toUpperCase()}
                </Text>
                <Text style={styles.rowLeague}>{b.league.toUpperCase()}</Text>
              </View>
              <Text style={styles.rowDescription} numberOfLines={2}>
                {b.description}
              </Text>
              <View style={styles.rowFoot}>
                <Text style={styles.rowStake}>
                  {formatMoney(b.stake_cents)} @{' '}
                  {b.odds_american > 0 ? '+' : ''}
                  {b.odds_american}
                </Text>
                <Text
                  style={[
                    styles.rowPnL,
                    {
                      color:
                        b.result === 'pending'
                          ? colors.textSecondary
                          : b.profit_loss_cents > 0
                            ? SPORTS_ACCENT
                            : b.profit_loss_cents < 0
                              ? '#E57373'
                              : colors.textSecondary,
                    },
                  ]}
                >
                  {b.result === 'pending'
                    ? `→ ${formatMoney(b.potential_payout_cents)}`
                    : formatSignedMoney(b.profit_loss_cents)}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: {
    padding: 20,
    paddingBottom: 160,
    gap: 10,
  },
  eyebrow: {
    color: SPORTS_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 4,
  },
  chipRow: {
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: SPORTS_ACCENT,
    borderColor: SPORTS_ACCENT,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#0E0E13',
  },
  emptyCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  group: {
    gap: 6,
    marginTop: 6,
  },
  groupHeader: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  row: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  rowType: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  rowLeague: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  rowDescription: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  rowFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowStake: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  rowPnL: {
    fontSize: 13,
    fontWeight: '800',
  },
});
