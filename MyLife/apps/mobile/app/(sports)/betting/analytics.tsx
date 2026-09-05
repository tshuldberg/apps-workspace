import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, surfaceTiers } from '@mylife/ui';
import {
  computeBetStats,
  computeStreak,
  computeUnitsPnL,
  getBetLimits,
  groupStatsBy,
  listBets,
  type Bet,
  type BetStats,
} from '@mylife/sports';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SPORTS_ACCENT } from '../_ui';

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

function sortedGroups<K>(
  map: Map<K, BetStats>,
): Array<{ key: K; stats: BetStats }> {
  return Array.from(map.entries())
    .map(([key, stats]) => ({ key, stats }))
    .sort((a, b) => b.stats.totalBets - a.stats.totalBets);
}

export default function SportsAnalyticsScreen() {
  const db = useDatabase();
  const [bets, setBets] = useState<Bet[]>([]);

  useEffect(() => {
    try {
      setBets(listBets(db, { limit: 500 }));
    } catch (err) {
      console.error('[MySports] analytics load failed', err);
    }
  }, [db]);

  const unitSizeCents = useMemo(() => getBetLimits(db).unit_size_cents, [db]);

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
      <View style={[styles.screen, styles.emptyState]}>
        <Text style={styles.eyebrow}>Analytics</Text>
        <Text style={styles.title}>Nothing to chart yet</Text>
        <Text style={styles.body}>
          Log a bet or two and this screen will fill in with P/L, win rate,
          and streak breakdowns by sport, league, bet type, and sportsbook.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.eyebrow}>Analytics</Text>
      <Text style={styles.title}>Performance</Text>

      <View style={styles.topRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Net P/L</Text>
          <Text
            style={[
              styles.metricValueBig,
              {
                color:
                  stats.profitLossCents > 0
                    ? SPORTS_ACCENT
                    : stats.profitLossCents < 0
                      ? '#E57373'
                      : colors.textSecondary,
              },
            ]}
          >
            {formatSignedMoney(stats.profitLossCents)}
          </Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>ROI</Text>
          <Text style={styles.metricValueBig}>
            {formatPct(stats.roiPct)}
          </Text>
        </View>
      </View>

      <View style={styles.topRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Win rate</Text>
          <Text style={styles.metricValueBig}>
            {formatPct(stats.winRatePct)}
          </Text>
          <Text style={styles.metricSub}>
            {stats.wins}W · {stats.losses}L · {stats.pushes}P · {stats.voids}V
          </Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Streak</Text>
          <Text style={styles.metricValueBig}>
            {streak.current.type
              ? `${streak.current.length}${streak.current.type}`
              : '—'}
          </Text>
          <Text style={styles.metricSub}>
            Longest {streak.longestWin}W / {streak.longestLoss}L
          </Text>
        </View>
      </View>

      <View style={styles.unitsCard}>
        <Text style={styles.metricLabel}>Units</Text>
        <Text style={styles.unitsLine}>
          +{units.wonUnits.toFixed(1)}U · −{units.lostUnits.toFixed(1)}U
        </Text>
        <Text style={[styles.unitsNet, {
          color: units.netUnits > 0 ? SPORTS_ACCENT : units.netUnits < 0 ? '#E57373' : colors.textSecondary,
        }]}>
          Net {units.netUnits >= 0 ? '+' : ''}
          {units.netUnits.toFixed(2)}U at {formatMoney(unitSizeCents)}/unit
        </Text>
      </View>

      <StatsTable title="By sport" rows={bySport} />
      <StatsTable title="By league" rows={byLeague} />
      <StatsTable title="By bet type" rows={byType} />
      <StatsTable title="By sportsbook" rows={byBook} />
    </ScrollView>
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
    <View style={styles.tableCard}>
      <Text style={styles.tableTitle}>{title}</Text>
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Group</Text>
        <Text style={styles.tableHeaderCell}>Bets</Text>
        <Text style={styles.tableHeaderCell}>Win%</Text>
        <Text style={styles.tableHeaderCell}>ROI</Text>
        <Text style={styles.tableHeaderCell}>P/L</Text>
      </View>
      {rows.map(({ key, stats }) => (
        <View key={String(key)} style={styles.tableRow}>
          <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>
            {String(key).toUpperCase()}
          </Text>
          <Text style={styles.tableCell}>{stats.totalBets}</Text>
          <Text style={styles.tableCell}>{formatPct(stats.winRatePct, 0)}</Text>
          <Text style={styles.tableCell}>{formatPct(stats.roiPct, 0)}</Text>
          <Text
            style={[
              styles.tableCell,
              {
                color:
                  stats.profitLossCents > 0
                    ? SPORTS_ACCENT
                    : stats.profitLossCents < 0
                      ? '#E57373'
                      : colors.textSecondary,
                fontWeight: '800',
              },
            ]}
          >
            {formatSignedMoney(stats.profitLossCents)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: {
    padding: 20,
    paddingBottom: 160,
    gap: 12,
  },
  emptyState: {
    padding: 24,
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
  body: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  topRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  metricValueBig: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  metricSub: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  unitsCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  unitsLine: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  unitsNet: {
    fontSize: 14,
    fontWeight: '800',
  },
  tableCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  tableTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableHeaderCell: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 6,
  },
  tableCell: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
  },
});
