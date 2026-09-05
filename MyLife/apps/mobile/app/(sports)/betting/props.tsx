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
import { listBets, type Bet } from '@mylife/sports';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SPORTS_ACCENT } from '../_ui';

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

function resultColor(b: Bet): string {
  if (b.result === 'won') return SPORTS_ACCENT;
  if (b.result === 'lost') return DANGER;
  return MUTED;
}

export default function SportsPropsScreen() {
  const router = useRouter();
  const db = useDatabase();
  const [bets, setBets] = useState<Bet[]>([]);

  const load = useCallback(() => {
    try {
      setBets(listBets(db, { bet_type: 'prop', limit: 200 }));
    } catch (err) {
      console.error('[MySports] props load failed', err);
    }
  }, [db]);

  useEffect(() => {
    load();
  }, [load]);

  // Group by game_id (null -> 'ungrouped'). Within a group, sort by placed_at desc.
  const groups = useMemo(() => {
    const buckets = new Map<string, Bet[]>();
    for (const b of bets) {
      const key = b.game_id ?? '__ungrouped__';
      const list = buckets.get(key) ?? [];
      list.push(b);
      buckets.set(key, list);
    }
    return Array.from(buckets.entries())
      .map(([gameId, items]) => ({
        gameId,
        label:
          gameId === '__ungrouped__'
            ? 'No game attached'
            : `Game ${gameId.replace(/^espn:[a-z]+:/, '')}`,
        items: items.sort((a, b) => b.placed_at - a.placed_at),
      }))
      .sort((a, b) => b.items[0].placed_at - a.items[0].placed_at);
  }, [bets]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.eyebrow}>Props</Text>
      <Text style={styles.title}>Player & game props</Text>

      <Pressable
        style={styles.fab}
        onPress={() =>
          router.push('/(sports)/bet/log?type=prop' as never)
        }
        accessibilityRole="button"
      >
        <Text style={styles.fabText}>+ Log a prop</Text>
      </Pressable>

      {groups.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No prop bets yet. Tap "Log a prop" to track player yardage,
            strikeouts, three-pointers, and other markets.
          </Text>
        </View>
      ) : null}

      {groups.map((g) => (
        <View key={g.gameId} style={styles.group}>
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
                  style={[styles.badge, { borderColor: resultColor(b) }]}
                >
                  <Text
                    style={[styles.badgeText, { color: resultColor(b) }]}
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
                <Text style={styles.rowLeague}>
                  {b.league.toUpperCase()}
                </Text>
                <Text style={styles.rowDate}>
                  {new Date(b.placed_at).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </View>
              <Text style={styles.rowDescription} numberOfLines={3}>
                {b.description}
              </Text>
              <View style={styles.rowFoot}>
                <Text style={styles.rowOdds}>
                  {formatAmerican(b.odds_american)} ·{' '}
                  {formatMoney(b.stake_cents)}
                </Text>
                <Text
                  style={[
                    styles.rowPnL,
                    {
                      color:
                        b.result === 'pending'
                          ? MUTED
                          : b.profit_loss_cents > 0
                            ? SPORTS_ACCENT
                            : b.profit_loss_cents < 0
                              ? DANGER
                              : MUTED,
                    },
                  ]}
                >
                  {b.result === 'pending'
                    ? `→ ${formatMoney(b.potential_payout_cents)}`
                    : `${b.profit_loss_cents > 0 ? '+' : ''}${formatMoney(b.profit_loss_cents)}`}
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
  content: { padding: 20, paddingBottom: 160, gap: 10 },
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
  fab: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: SPORTS_ACCENT,
    marginBottom: 6,
  },
  fabText: { color: '#0E0E13', fontWeight: '800', fontSize: 14 },
  emptyCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  group: { gap: 6 },
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
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontWeight: '800' },
  rowLeague: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  rowDate: {
    marginLeft: 'auto',
    color: colors.textSecondary,
    fontSize: 12,
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
  rowOdds: { color: colors.textSecondary, fontSize: 13 },
  rowPnL: { fontSize: 13, fontWeight: '800' },
});
