import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AddFAB,
  AmountDisplay,
  BG_ACCENT,
  BG_ACCENT_LIGHT,
  BG_FONTS,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  GoalProgressRing,
  GlassCard,
  MaterialSymbol,
  calculateGoalProgress,
  getGoals,
  listEnvelopes,
  suggestMonthlyContribution,
  type BudgetGoal,
  type Envelope,
} from '@mylife/budget';
import {
  BudgetStatusPill,
  formatBudgetCurrency,
  formatBudgetDate,
  getBudgetGoalLabel,
  getBudgetGoalTone,
  relativeBudgetDate,
} from '../../components/budget/BudgetPhase3Shared';
import { useDatabase } from '../../components/DatabaseProvider';

type GoalFilter = 'achieved' | 'active' | 'all' | 'behind';

type GoalInsight = {
  envelopeName: string;
  goal: BudgetGoal;
  monthlyContribution: number;
  progress: ReturnType<typeof calculateGoalProgress>;
};

function toEngineGoal(goal: BudgetGoal) {
  return {
    createdAt: goal.created_at,
    currentAmount: goal.completed_amount,
    id: goal.id,
    name: goal.name,
    targetAmount: goal.target_amount,
    targetDate: goal.target_date,
  };
}

function getGoalFilterMatch(filter: GoalFilter, insight: GoalInsight): boolean {
  if (filter === 'all') {
    return true;
  }
  if (filter === 'achieved') {
    return insight.progress.status === 'completed';
  }
  if (filter === 'behind') {
    return (
      insight.progress.status === 'behind' ||
      insight.progress.status === 'overdue'
    );
  }

  return insight.progress.status !== 'completed';
}

function sortGoalInsights(a: GoalInsight, b: GoalInsight): number {
  const statusRank = (insight: GoalInsight) =>
    insight.progress.status === 'completed'
      ? 2
      : insight.progress.status === 'behind' || insight.progress.status === 'overdue'
        ? 0
        : 1;

  if (statusRank(a) !== statusRank(b)) {
    return statusRank(a) - statusRank(b);
  }

  if (a.goal.target_date && b.goal.target_date) {
    return a.goal.target_date.localeCompare(b.goal.target_date);
  }

  if (a.goal.target_date) {
    return -1;
  }

  if (b.goal.target_date) {
    return 1;
  }

  return b.goal.created_at.localeCompare(a.goal.created_at);
}

export default function BudgetGoalsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { refresh } = useLocalSearchParams<{ refresh?: string }>();

  const [goals, setGoals] = useState<BudgetGoal[]>([]);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [filter, setFilter] = useState<GoalFilter>('all');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    try {
      setGoals(getGoals(db));
      setEnvelopes(listEnvelopes(db, true));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load goals.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db]);

  useEffect(() => {
    load();
  }, [load, refresh]);

  const insights = useMemo<GoalInsight[]>(() => {
    const envelopeById = new Map(envelopes.map((envelope) => [envelope.id, envelope.name]));

    return goals
      .map((goal) => {
        const engineGoal = toEngineGoal(goal);
        return {
          envelopeName: envelopeById.get(goal.envelope_id) ?? 'Unlinked envelope',
          goal,
          monthlyContribution: suggestMonthlyContribution(engineGoal),
          progress: calculateGoalProgress(engineGoal),
        };
      })
      .sort(sortGoalInsights);
  }, [envelopes, goals]);

  const filteredGoals = useMemo(
    () => insights.filter((insight) => getGoalFilterMatch(filter, insight)),
    [filter, insights],
  );

  const totalSaved = useMemo(
    () => goals.reduce((sum, goal) => sum + goal.completed_amount, 0),
    [goals],
  );
  const totalTarget = useMemo(
    () => goals.reduce((sum, goal) => sum + goal.target_amount, 0),
    [goals],
  );
  const activeCount = useMemo(
    () => insights.filter((insight) => insight.progress.status !== 'completed').length,
    [insights],
  );
  const behindCount = useMemo(
    () =>
      insights.filter(
        (insight) =>
          insight.progress.status === 'behind' ||
          insight.progress.status === 'overdue',
      ).length,
    [insights],
  );
  const monthlyNeed = useMemo(
    () => insights.reduce((sum, insight) => sum + insight.monthlyContribution, 0),
    [insights],
  );

  const renderHeader = () => (
    <View style={styles.headerBlock}>
      <GlassCard style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>Overview</Text>
            <Text style={styles.heroTitle}>Savings Goals</Text>
            <Text style={styles.heroSubtitle}>
              Track the funds you are actively building across your budget.
            </Text>
          </View>
          <View style={styles.heroIcon}>
            <MaterialSymbol color={BG_ACCENT_LIGHT} name="savings" size={28} />
          </View>
        </View>

        <AmountDisplay cents={totalSaved} size="xl" />

        <Text style={styles.heroCaption}>
          {formatBudgetCurrency(totalTarget)} target across {goals.length} goal
          {goals.length === 1 ? '' : 's'}
        </Text>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Active</Text>
            <Text style={styles.metricValue}>{activeCount}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Behind</Text>
            <Text style={styles.metricValue}>{behindCount}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Needed / mo</Text>
            <Text style={styles.metricValue}>{formatBudgetCurrency(monthlyNeed)}</Text>
          </View>
        </View>
      </GlassCard>

      <View style={styles.filtersRow}>
        {([
          { label: 'All', value: 'all' },
          { label: 'Active', value: 'active' },
          { label: 'Achieved', value: 'achieved' },
          { label: 'Behind', value: 'behind' },
        ] as const).map((option) => {
          const selected = filter === option.value;
          return (
            <GlassCard
              key={option.value}
              onPress={() => setFilter(option.value)}
              padding={0}
              style={[
                styles.filterChip,
                selected ? styles.filterChipSelected : null,
              ]}
            >
              <Text
                style={[
                  styles.filterLabel,
                  selected ? styles.filterLabelSelected : null,
                ]}
              >
                {option.label}
              </Text>
            </GlassCard>
          );
        })}
      </View>

      {error ? (
        <GlassCard style={styles.errorCard}>
          <Text style={styles.errorTitle}>Goals are unavailable right now</Text>
          <Text style={styles.errorBody}>{error}</Text>
        </GlassCard>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredGoals}
        keyExtractor={(item) => item.goal.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          loading ? (
            <GlassCard style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Loading goals…</Text>
            </GlassCard>
          ) : (
            <GlassCard style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No goals match this view</Text>
              <Text style={styles.emptyBody}>
                Try another filter or create a new goal to start tracking progress.
              </Text>
            </GlassCard>
          )
        }
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={BG_ACCENT}
          />
        }
        renderItem={({ item }) => (
          <GlassCard
            onPress={() => router.push(`/(budget)/goal/${item.goal.id}` as never)}
            style={styles.goalCard}
          >
            <View style={styles.goalCardTop}>
              <View style={styles.goalCardLead}>
                <GoalProgressRing
                  current={item.goal.completed_amount}
                  size={88}
                  target={item.goal.target_amount}
                />
                <View style={styles.goalCardCopy}>
                  <View style={styles.goalCardTitleRow}>
                    <Text style={styles.goalName}>{item.goal.name}</Text>
                    <BudgetStatusPill
                      label={getBudgetGoalLabel(item.progress.status)}
                      tone={getBudgetGoalTone(item.progress.status)}
                    />
                  </View>
                  <Text style={styles.goalEnvelope}>{item.envelopeName}</Text>
                  <Text style={styles.goalMeta}>
                    Due {formatBudgetDate(item.goal.target_date)} ·{' '}
                    {relativeBudgetDate(item.goal.target_date)}
                  </Text>
                </View>
              </View>
              <MaterialSymbol color={BG_TEXT_TERTIARY} name="arrow_forward" size={18} />
            </View>

            <View style={styles.goalStatsRow}>
              <View style={styles.goalStat}>
                <Text style={styles.goalStatLabel}>Saved</Text>
                <AmountDisplay cents={item.goal.completed_amount} size="md" />
              </View>
              <View style={styles.goalStat}>
                <Text style={styles.goalStatLabel}>Target</Text>
                <Text style={styles.goalStatValue}>
                  {formatBudgetCurrency(item.goal.target_amount)}
                </Text>
              </View>
              <View style={styles.goalStat}>
                <Text style={styles.goalStatLabel}>Monthly pace</Text>
                <Text style={styles.goalStatValue}>
                  {item.monthlyContribution > 0
                    ? formatBudgetCurrency(item.monthlyContribution)
                    : 'Met'}
                </Text>
              </View>
            </View>
          </GlassCard>
        )}
      />

      <AddFAB
        label="Add Goal"
        onPress={() => router.push('/(budget)/goal/create' as never)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: BG_SURFACES.base,
    flex: 1,
  },
  headerBlock: {
    gap: 18,
    marginBottom: 18,
  },
  heroCard: {
    gap: 16,
  },
  heroTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 184, 119, 0.12)',
    borderRadius: 18,
    height: 56,
    justifyContent: 'center',
    width: 56,
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
  },
  heroCaption: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    flex: 1,
    gap: 6,
    padding: 14,
  },
  metricLabel: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metricValue: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  filterChip: {
    borderRadius: 999,
  },
  filterChipSelected: {
    backgroundColor: 'rgba(255, 184, 119, 0.16)',
  },
  filterLabel: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterLabelSelected: {
    color: BG_ACCENT_LIGHT,
  },
  errorCard: {
    gap: 6,
  },
  errorTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  errorBody: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  listContent: {
    gap: 14,
    paddingBottom: 160,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    minHeight: 180,
  },
  emptyTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 20,
    lineHeight: 24,
    textAlign: 'center',
  },
  emptyBody: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  goalCard: {
    gap: 18,
  },
  goalCardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  goalCardLead: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 14,
  },
  goalCardCopy: {
    flex: 1,
    gap: 4,
  },
  goalCardTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  goalName: {
    color: BG_TEXT,
    flexShrink: 1,
    fontFamily: BG_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
  },
  goalEnvelope: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 18,
  },
  goalMeta: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  goalStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  goalStat: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 16,
    flex: 1,
    gap: 6,
    padding: 14,
  },
  goalStatLabel: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  goalStatValue: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
  },
});
