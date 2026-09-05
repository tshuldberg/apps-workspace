import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors, surfaceTiers } from '@mylife/ui';
import {
  computeBetStats,
  computeStreak,
  ensureDefaultBankroll,
  getBankroll,
  getBetLimits,
  listBets,
  sumStakesSince,
  type Bankroll,
  type Bet,
  type BetLimits,
  type BetStats,
  type StreakSummary,
} from '@mylife/sports';
import { useDatabase } from '../../components/DatabaseProvider';
import { SPORTS_ACCENT } from './_ui';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const RESULT_COLOR: Record<string, string> = {
  won: SPORTS_ACCENT,
  lost: '#E57373',
  push: '#9F8E81',
  void: '#9F8E81',
  pending: '#9F8E81',
};

function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatMoney(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString(undefined, {
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

function formatPct(pct: number | null): string {
  if (pct === null) return '—';
  return `${pct >= 0 ? '' : ''}${pct.toFixed(1)}%`;
}

interface DashboardData {
  bankroll: Bankroll;
  pending: Bet[];
  recent: Bet[];
  openFutures: Bet[];
  stats: BetStats;
  streak: StreakSummary;
  limits: BetLimits;
  dailySpent: number;
  weeklySpent: number;
}

function loadDashboard(db: ReturnType<typeof useDatabase>): DashboardData {
  const bankroll = ensureDefaultBankroll(db);
  const limits = getBetLimits(db);
  const pending = listBets(db, { result: 'pending', limit: 20 });
  const recent30 = listBets(db, { limit: 30 });
  const recent = recent30.filter((b) => b.result !== 'pending').slice(0, 5);
  const openFutures = listBets(db, {
    bet_type: 'future',
    result: 'pending',
    limit: 3,
  });
  const all = listBets(db, { limit: 500 });
  const stats = computeBetStats(all);
  const streak = computeStreak(all);
  const dailySpent = sumStakesSince(db, startOfTodayMs());
  const weeklySpent = sumStakesSince(db, Date.now() - WEEK_MS);
  return {
    bankroll: bankroll ?? (getBankroll(db) as Bankroll),
    pending,
    recent,
    openFutures,
    stats,
    streak,
    limits,
    dailySpent,
    weeklySpent,
  };
}

export default function SportsBettingScreen() {
  const router = useRouter();
  const db = useDatabase();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const reload = useCallback(() => {
    try {
      setData(loadDashboard(db));
    } catch (err) {
      console.error('[MySports] betting dashboard load failed', err);
    }
  }, [db]);

  useEffect(() => {
    reload();
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const now = Date.now();
  const cooldownActive = useMemo(
    () => data?.limits.cooldown_until != null && data.limits.cooldown_until > now,
    [data, now],
  );

  const dailyPct = useMemo(() => {
    if (!data) return null;
    if (data.limits.daily_cents === null || data.limits.daily_cents === 0)
      return null;
    return data.dailySpent / data.limits.daily_cents;
  }, [data]);

  const weeklyPct = useMemo(() => {
    if (!data) return null;
    if (data.limits.weekly_cents === null || data.limits.weekly_cents === 0)
      return null;
    return data.weeklySpent / data.limits.weekly_cents;
  }, [data]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => {
            setIsRefreshing(true);
            try {
              reload();
            } finally {
              setIsRefreshing(false);
            }
          }}
          tintColor={SPORTS_ACCENT}
        />
      }
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Betting</Text>
          <Text style={styles.title}>Your journal</Text>
        </View>
        <Pressable
          style={styles.gearBtn}
          onPress={() => router.push('/(sports)/betting/limits' as never)}
          accessibilityRole="button"
          accessibilityLabel="Betting limits"
        >
          <Text style={styles.gearIcon}>⚙︎</Text>
        </Pressable>
      </View>

      {cooldownActive && data?.limits.cooldown_until ? (
        <View style={styles.cooldownBanner}>
          <Text style={styles.cooldownTitle}>Logging paused</Text>
          <Text style={styles.cooldownBody}>
            You set a break until{' '}
            {new Date(data.limits.cooldown_until).toLocaleDateString([], {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
            . You can adjust this any time from the settings.
          </Text>
        </View>
      ) : null}

      {!cooldownActive && dailyPct !== null && dailyPct >= 0.8 ? (
        <View style={styles.softBanner}>
          <Text style={styles.softBannerText}>
            You've wagered {formatMoney(data!.dailySpent)} of your{' '}
            {formatMoney(data!.limits.daily_cents ?? 0)} daily target.
          </Text>
        </View>
      ) : null}

      {!cooldownActive &&
      weeklyPct !== null &&
      weeklyPct >= 0.8 &&
      (dailyPct === null || dailyPct < 0.8) ? (
        <View style={styles.softBanner}>
          <Text style={styles.softBannerText}>
            You've wagered {formatMoney(data!.weeklySpent)} of your{' '}
            {formatMoney(data!.limits.weekly_cents ?? 0)} weekly target.
          </Text>
        </View>
      ) : null}

      {/* Futures chip -- visible when there are any open future bets */}
      {data && data.openFutures.length > 0 ? (
        <Pressable
          style={styles.futuresChip}
          onPress={() => router.push('/(sports)/betting/futures' as never)}
          accessibilityRole="button"
          accessibilityLabel="View futures"
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.futuresChipEyebrow}>Open futures</Text>
            <Text style={styles.futuresChipTitle} numberOfLines={1}>
              {data.openFutures.length === 1
                ? data.openFutures[0].description
                : `${data.openFutures.length} open long-shots`}
            </Text>
          </View>
          <Text style={styles.futuresChipArrow}>›</Text>
        </Pressable>
      ) : null}

      {/* Bankroll card */}
      {data ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Bankroll</Text>
          <Text style={styles.bankrollValue}>
            {formatMoney(data.bankroll.current_cents)}
          </Text>
          <View style={styles.metricsRow}>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>Net</Text>
              <Text
                style={[
                  styles.metricValue,
                  {
                    color:
                      data.stats.profitLossCents > 0
                        ? SPORTS_ACCENT
                        : data.stats.profitLossCents < 0
                          ? '#E57373'
                          : colors.textSecondary,
                  },
                ]}
              >
                {formatSignedMoney(data.stats.profitLossCents)}
              </Text>
            </View>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>ROI</Text>
              <Text style={styles.metricValue}>
                {formatPct(data.stats.roiPct)}
              </Text>
            </View>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>Streak</Text>
              <Text style={styles.metricValue}>
                {data.streak.current.type
                  ? `${data.streak.current.length}${data.streak.current.type}`
                  : '—'}
              </Text>
            </View>
          </View>
          <Text style={styles.unitFootnote}>
            Unit size {formatMoney(data.limits.unit_size_cents)}
          </Text>
        </View>
      ) : null}

      {/* Action row */}
      {!cooldownActive ? (
        <View style={styles.actionRow}>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => router.push('/(sports)/bet/log' as never)}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>Log bet</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => router.push('/(sports)/bet/parlay' as never)}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryBtnText}>Build parlay</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Pending bets */}
      <Text style={styles.sectionHeader}>Pending</Text>
      {data && data.pending.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No open bets. Log one above.</Text>
        </View>
      ) : null}
      {data?.pending.map((bet) => (
        <Pressable
          key={bet.id}
          style={styles.betRow}
          onPress={() =>
            router.push(`/(sports)/bet/${encodeURIComponent(bet.id)}` as never)
          }
          accessibilityRole="button"
        >
          <View style={styles.betRowHeader}>
            <Text style={styles.betTypeTag}>{bet.bet_type.toUpperCase()}</Text>
            <Text style={styles.betPlacedAt}>
              {new Date(bet.placed_at).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </View>
          <Text style={styles.betDescription} numberOfLines={2}>
            {bet.description}
          </Text>
          <View style={styles.betRowFoot}>
            <Text style={styles.betStake}>
              {formatMoney(bet.stake_cents)} @{' '}
              {bet.odds_american > 0 ? '+' : ''}
              {bet.odds_american}
            </Text>
            <Text style={styles.betPayout}>
              to win {formatMoney(bet.potential_payout_cents - bet.stake_cents)}
            </Text>
          </View>
        </Pressable>
      ))}

      {/* Recent results */}
      <Text style={styles.sectionHeader}>Recent results</Text>
      {data && data.recent.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            Settled bets will show here so you can review how you did.
          </Text>
        </View>
      ) : null}
      {data?.recent.map((bet) => (
        <Pressable
          key={bet.id}
          style={styles.betRow}
          onPress={() =>
            router.push(`/(sports)/bet/${encodeURIComponent(bet.id)}` as never)
          }
          accessibilityRole="button"
        >
          <View style={styles.betRowHeader}>
            <View
              style={[
                styles.resultBadge,
                { borderColor: RESULT_COLOR[bet.result] ?? '#9F8E81' },
              ]}
            >
              <Text
                style={[
                  styles.resultBadgeText,
                  { color: RESULT_COLOR[bet.result] ?? '#9F8E81' },
                ]}
              >
                {bet.result === 'won'
                  ? 'W'
                  : bet.result === 'lost'
                    ? 'L'
                    : bet.result === 'push'
                      ? 'P'
                      : 'V'}
              </Text>
            </View>
            <Text style={styles.betPlacedAt}>
              {new Date(bet.settled_at ?? bet.placed_at).toLocaleDateString(
                [],
                { month: 'short', day: 'numeric' },
              )}
            </Text>
          </View>
          <Text style={styles.betDescription} numberOfLines={2}>
            {bet.description}
          </Text>
          <View style={styles.betRowFoot}>
            <Text style={styles.betStake}>
              {formatMoney(bet.stake_cents)} @{' '}
              {bet.odds_american > 0 ? '+' : ''}
              {bet.odds_american}
            </Text>
            <Text
              style={[
                styles.betPayout,
                {
                  color:
                    bet.profit_loss_cents > 0
                      ? SPORTS_ACCENT
                      : bet.profit_loss_cents < 0
                        ? '#E57373'
                        : colors.textSecondary,
                },
              ]}
            >
              {formatSignedMoney(bet.profit_loss_cents)}
            </Text>
          </View>
        </Pressable>
      ))}

      {/* Footer chips */}
      <View style={styles.footerChipRow}>
        <Pressable
          style={styles.chip}
          onPress={() => router.push('/(sports)/betting/history' as never)}
          accessibilityRole="button"
        >
          <Text style={styles.chipText}>View history</Text>
        </Pressable>
        <Pressable
          style={styles.chip}
          onPress={() => router.push('/(sports)/betting/analytics' as never)}
          accessibilityRole="button"
        >
          <Text style={styles.chipText}>View analytics</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: surfaceTiers.lowest,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    lineHeight: 32,
    fontWeight: '800',
  },
  gearBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearIcon: {
    fontSize: 18,
    color: colors.textSecondary,
  },
  cooldownBanner: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  cooldownTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  cooldownBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  softBanner: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(212, 195, 181, 0.08)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  softBannerText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  cardLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  bankrollValue: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCell: {
    flex: 1,
    gap: 2,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  metricValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  unitFootnote: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: SPORTS_ACCENT,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#0E0E13',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  sectionHeader: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 8,
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
    fontSize: 13,
    lineHeight: 18,
  },
  betRow: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  betRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  betTypeTag: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.0,
  },
  betPlacedAt: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  betDescription: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  betRowFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  betStake: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  betPayout: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  resultBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  resultBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  footerChipRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  chip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  chipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  futuresChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  futuresChipEyebrow: {
    color: SPORTS_ACCENT,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  futuresChipTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  futuresChipArrow: {
    color: colors.textSecondary,
    fontSize: 20,
    fontWeight: '700',
  },
});
