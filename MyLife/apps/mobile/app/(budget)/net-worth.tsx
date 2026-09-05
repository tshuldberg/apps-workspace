import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  AmountDisplay,
  BG_ACCENT,
  BG_ACCENT_LIGHT,
  BG_DANGER,
  BG_FONTS,
  BG_MONEY,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  GlassCard,
  MaterialSymbol,
  buildNetWorthTimeline,
  calculateNetWorth,
  captureSnapshot,
  createMilestone,
  createNetWorthSnapshot,
  getMilestones,
  getNetWorthSnapshots,
  listAccounts,
  milestoneExists,
  type NetWorthMilestone,
  type NetWorthResult,
} from '@mylife/budget';
import {
  BudgetLineChart,
  BudgetStatusPill,
  formatBudgetCurrency,
  getBudgetMilestoneCopy,
  relativeBudgetDate,
} from '../../components/budget/BudgetPhase3Shared';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const PERIODS = ['1M', '3M', '6M', '1Y', 'All'] as const;
const ROUND_MILESTONES = [
  1_000_00,
  5_000_00,
  10_000_00,
  25_000_00,
  50_000_00,
  100_000_00,
  250_000_00,
  500_000_00,
  1_000_000_00,
];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildDeltaCopy(value: number, label: string): string {
  if (value === 0) {
    return `${label}: flat`;
  }
  return `${label}: ${formatBudgetCurrency(value, { signed: true })}`;
}

function getTargetDate(period: (typeof PERIODS)[number]) {
  const date = new Date();
  if (period === '1M') {
    date.setMonth(date.getMonth() - 1);
  } else if (period === '3M') {
    date.setMonth(date.getMonth() - 3);
  } else if (period === '6M') {
    date.setMonth(date.getMonth() - 6);
  } else if (period === '1Y') {
    date.setFullYear(date.getFullYear() - 1);
  }
  return date;
}

export default function NetWorthScreen() {
  const db = useDatabase();

  const [netWorthResult, setNetWorthResult] = useState<NetWorthResult | null>(null);
  const [timeline, setTimeline] = useState<
    Array<{ change: number; changePercent: number; date: string; netWorth: number }>
  >([]);
  const [milestones, setMilestones] = useState<NetWorthMilestone[]>([]);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('All');
  const [loading, setLoading] = useState(true);
  const [snapshotting, setSnapshotting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    try {
      const accounts = listAccounts(db, false);
      const nextResult = calculateNetWorth(
        accounts.map((account) => ({
          accountType: account.type,
          balance: account.current_balance,
          id: account.id,
          name: account.name,
        })),
      );
      setNetWorthResult(nextResult);

      const snapshots = getNetWorthSnapshots(db).map((snapshot) => ({
        date: snapshot.month,
        netWorth: snapshot.net_worth,
        totalAssets: snapshot.assets,
        totalLiabilities: snapshot.liabilities,
      }));
      const today = todayISO();
      const hasLivePoint = snapshots.some((snapshot) => snapshot.date === today);
      const nextTimeline = buildNetWorthTimeline(
        hasLivePoint
          ? snapshots
          : [
              ...snapshots,
              {
                date: today,
                netWorth: nextResult.netWorth,
                totalAssets: nextResult.totalAssets,
                totalLiabilities: nextResult.totalLiabilities,
              },
            ],
      );

      setTimeline(nextTimeline);
      setMilestones(getMilestones(db));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load net worth.');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredTimeline = useMemo(() => {
    if (period === 'All') {
      return timeline;
    }

    const cutoff = getTargetDate(period);
    return timeline.filter((point) => new Date(point.date) >= cutoff);
  }, [period, timeline]);

  const currentPoint = filteredTimeline[filteredTimeline.length - 1] ?? null;
  const previousPoint = timeline.length >= 2 ? timeline[timeline.length - 2] : null;
  const yearTarget = getTargetDate('1Y');
  const yearPoint =
    [...timeline]
      .reverse()
      .find((point) => new Date(point.date) <= yearTarget) ?? timeline[0] ?? null;
  const previousHigh = Math.max(
    0,
    ...timeline.slice(0, -1).map((point) => point.netWorth),
  );
  const deltaVsMonth = currentPoint && previousPoint ? currentPoint.netWorth - previousPoint.netWorth : 0;
  const deltaVsYear = currentPoint && yearPoint ? currentPoint.netWorth - yearPoint.netWorth : 0;
  const deltaVsHigh = currentPoint ? currentPoint.netWorth - previousHigh : 0;

  const chartPoints = filteredTimeline.map((point) => ({
    label: new Date(point.date).toLocaleDateString('en-US', { month: 'short' }),
    value: point.netWorth,
  }));

  const totalCapital =
    (netWorthResult?.totalAssets ?? 0) + (netWorthResult?.totalLiabilities ?? 0);
  const assetRatio =
    totalCapital > 0 ? (netWorthResult?.totalAssets ?? 0) / totalCapital : 0;
  const liabilityRatio =
    totalCapital > 0 ? (netWorthResult?.totalLiabilities ?? 0) / totalCapital : 0;

  const handleSnapshot = async () => {
    if (!netWorthResult || snapshotting) {
      return;
    }

    setSnapshotting(true);
    setError(null);
    try {
      const accounts = listAccounts(db, false);
      const today = todayISO();
      const snapshot = captureSnapshot({
        accounts: accounts.map((account) => ({
          accountType: account.type,
          balance: account.current_balance,
          id: account.id,
          name: account.name,
        })),
        date: today,
      });

      createNetWorthSnapshot(db, uuid(), {
        account_balances: null,
        assets: snapshot.totalAssets,
        liabilities: snapshot.totalLiabilities,
        month: snapshot.date,
        net_worth: snapshot.netWorth,
      });

      const existingMilestones = getMilestones(db);
      const hasFirstPositive = existingMilestones.some(
        (milestone) => milestone.milestone_type === 'first_positive',
      );
      const hasDebtFree = existingMilestones.some(
        (milestone) => milestone.milestone_type === 'debt_free',
      );
      const previousMax = Math.max(
        0,
        ...timeline.map((point) => point.netWorth),
      );

      if (snapshot.netWorth > 0 && !hasFirstPositive) {
        createMilestone(db, {
          achieved_at: today,
          milestone_type: 'first_positive',
          value: snapshot.netWorth,
        });
      }

      if (snapshot.totalLiabilities === 0 && !hasDebtFree) {
        createMilestone(db, {
          achieved_at: today,
          milestone_type: 'debt_free',
          value: 0,
        });
      }

      if (snapshot.netWorth > previousMax) {
        createMilestone(db, {
          achieved_at: today,
          milestone_type: 'all_time_high',
          value: snapshot.netWorth,
        });
      }

      ROUND_MILESTONES.forEach((threshold) => {
        if (
          snapshot.netWorth >= threshold &&
          !milestoneExists(db, 'round_number', threshold)
        ) {
          createMilestone(db, {
            achieved_at: today,
            milestone_type: 'round_number',
            value: threshold,
          });
        }
      });

      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to capture snapshot.');
    } finally {
      setSnapshotting(false);
    }
  };

  if (loading && !netWorthResult) {
    return (
      <View style={styles.centered}>
        <GlassCard style={styles.loadingCard}>
          <Text style={styles.loadingText}>Loading net worth…</Text>
        </GlassCard>
      </View>
    );
  }

  if (!netWorthResult) {
    return (
      <View style={styles.centered}>
        <GlassCard style={styles.loadingCard}>
          <Text style={styles.loadingText}>{error ?? 'No accounts available.'}</Text>
        </GlassCard>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={load} tintColor={BG_ACCENT} />
      }
    >
      <GlassCard style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View>
            <Text style={styles.eyebrow}>Balance Sheet</Text>
            <Text style={styles.heroTitle}>Net Worth</Text>
            <Text style={styles.heroSubtitle}>
              Every asset and liability in one running personal snapshot.
            </Text>
          </View>
          <View style={styles.heroBadge}>
            <MaterialSymbol color={BG_ACCENT_LIGHT} name="account_balance" size={24} />
          </View>
        </View>

        <AmountDisplay cents={netWorthResult.netWorth} size="xl" />

        <View style={styles.heroDelta}>
          <MaterialSymbol
            color={deltaVsMonth >= 0 ? BG_MONEY : BG_DANGER}
            name={deltaVsMonth >= 0 ? 'arrow_upward' : 'arrow_downward'}
            size={18}
          />
          <Text
            style={[
              styles.heroDeltaText,
              { color: deltaVsMonth >= 0 ? BG_MONEY : BG_DANGER },
            ]}
          >
            {buildDeltaCopy(deltaVsMonth, 'vs last month')}
          </Text>
        </View>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Trend</Text>
          <View style={styles.periodRow}>
            {PERIODS.map((option) => {
              const selected = option === period;
              return (
                <Pressable
                  key={option}
                  onPress={() => setPeriod(option)}
                  style={[
                    styles.periodChip,
                    selected ? styles.periodChipSelected : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.periodLabel,
                      selected ? styles.periodLabelSelected : null,
                    ]}
                  >
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {chartPoints.length >= 2 ? (
          <BudgetLineChart color={BG_ACCENT_LIGHT} data={chartPoints} />
        ) : (
          <Text style={styles.emptyText}>
            Capture a second snapshot to unlock your net worth trend.
          </Text>
        )}

        <View style={styles.deltaList}>
          <Text style={styles.deltaItem}>{buildDeltaCopy(deltaVsMonth, 'vs last month')}</Text>
          <Text style={styles.deltaItem}>{buildDeltaCopy(deltaVsYear, 'vs last year')}</Text>
          <Text style={styles.deltaItem}>{buildDeltaCopy(deltaVsHigh, 'vs all-time high')}</Text>
        </View>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Assets vs Liabilities</Text>

        <View style={styles.breakdownTrack}>
          <View
            style={[
              styles.breakdownAssets,
              { flex: Math.max(assetRatio, 0.08) },
            ]}
          />
          <View
            style={[
              styles.breakdownLiabilities,
              { flex: Math.max(liabilityRatio, 0.08) },
            ]}
          />
        </View>

        <View style={styles.breakdownRows}>
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownLead}>
              <View style={[styles.breakdownDot, { backgroundColor: BG_MONEY }]} />
              <Text style={styles.breakdownLabel}>Assets</Text>
            </View>
            <Text style={styles.breakdownValue}>
              {formatBudgetCurrency(netWorthResult.totalAssets)}
            </Text>
          </View>
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownLead}>
              <View style={[styles.breakdownDot, { backgroundColor: BG_DANGER }]} />
              <Text style={styles.breakdownLabel}>Liabilities</Text>
            </View>
            <Text style={styles.breakdownValue}>
              {formatBudgetCurrency(netWorthResult.totalLiabilities)}
            </Text>
          </View>
        </View>

        <View style={styles.accountColumns}>
          <View style={styles.accountColumn}>
            <Text style={styles.accountColumnTitle}>Assets</Text>
            {netWorthResult.assetAccounts.slice(0, 4).map((account) => (
              <View key={account.id} style={styles.accountRow}>
                <Text style={styles.accountName}>{account.name}</Text>
                <Text style={styles.accountValue}>
                  {formatBudgetCurrency(account.balance)}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.accountColumn}>
            <Text style={styles.accountColumnTitle}>Liabilities</Text>
            {netWorthResult.liabilityAccounts.slice(0, 4).map((account) => (
              <View key={account.id} style={styles.accountRow}>
                <Text style={styles.accountName}>{account.name}</Text>
                <Text style={styles.accountValue}>
                  {formatBudgetCurrency(account.balance)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Milestones</Text>
          <BudgetStatusPill
            label={milestones.length === 0 ? 'Tracking Ready' : `${milestones.length} logged`}
            tone={milestones.length === 0 ? 'neutral' : 'positive'}
          />
        </View>

        {milestones.length === 0 ? (
          <Text style={styles.emptyText}>
            Take a snapshot now to start milestone tracking.
          </Text>
        ) : (
          milestones.slice(0, 5).map((milestone) => (
            <View key={milestone.id} style={styles.milestoneRow}>
              <View style={styles.milestoneLead}>
                <View style={styles.milestoneIcon}>
                  <MaterialSymbol color={BG_ACCENT_LIGHT} name="flag" size={16} />
                </View>
                <View style={styles.milestoneCopy}>
                  <Text style={styles.milestoneTitle}>
                    {getBudgetMilestoneCopy(milestone.milestone_type, milestone.value)}
                  </Text>
                  <Text style={styles.milestoneMeta}>
                    {relativeBudgetDate(milestone.achieved_at)}
                  </Text>
                </View>
              </View>
              <Text style={styles.milestoneValue}>
                {milestone.value > 0 ? formatBudgetCurrency(milestone.value) : 'Complete'}
              </Text>
            </View>
          ))
        )}

        <Pressable onPress={handleSnapshot} style={styles.primaryButton}>
          <Text style={styles.primaryButtonLabel}>
            {snapshotting ? 'Saving Snapshot…' : 'Take Snapshot Now'}
          </Text>
        </Pressable>
      </GlassCard>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: BG_SURFACES.base,
    flex: 1,
  },
  content: {
    gap: 16,
    padding: 16,
    paddingBottom: 96,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.base,
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  loadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    width: '100%',
  },
  loadingText: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 16,
    lineHeight: 20,
  },
  heroCard: {
    gap: 16,
  },
  heroHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  eyebrow: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.extraBold,
    fontSize: 30,
    lineHeight: 34,
  },
  heroSubtitle: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  heroBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 184, 119, 0.12)',
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  heroDelta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  heroDeltaText: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionCard: {
    gap: 14,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 20,
    lineHeight: 24,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  periodChip: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  periodChipSelected: {
    backgroundColor: 'rgba(255, 184, 119, 0.16)',
  },
  periodLabel: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 14,
  },
  periodLabelSelected: {
    color: BG_ACCENT_LIGHT,
  },
  deltaList: {
    gap: 6,
  },
  deltaItem: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  breakdownTrack: {
    backgroundColor: BG_SURFACES.high,
    borderRadius: 999,
    flexDirection: 'row',
    height: 18,
    overflow: 'hidden',
  },
  breakdownAssets: {
    backgroundColor: BG_MONEY,
  },
  breakdownLiabilities: {
    backgroundColor: BG_DANGER,
  },
  breakdownRows: {
    gap: 10,
  },
  breakdownRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  breakdownLead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  breakdownDot: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  breakdownLabel: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  breakdownValue: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
  },
  accountColumns: {
    flexDirection: 'row',
    gap: 12,
  },
  accountColumn: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 18,
    flex: 1,
    gap: 8,
    padding: 14,
  },
  accountColumnTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  accountName: {
    color: BG_TEXT_SECONDARY,
    flex: 1,
    fontFamily: BG_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  accountValue: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 18,
  },
  milestoneRow: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.low,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  milestoneLead: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  milestoneIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 184, 119, 0.12)',
    borderRadius: 16,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  milestoneCopy: {
    flex: 1,
    gap: 4,
  },
  milestoneTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
  },
  milestoneMeta: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  milestoneValue: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: BG_ACCENT,
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
  },
  primaryButtonLabel: {
    color: BG_SURFACES.lowest,
    fontFamily: BG_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  emptyText: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    color: '#FFB4AB',
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});
