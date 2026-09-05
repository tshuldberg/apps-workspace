import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Polyline } from 'react-native-svg';
import {
  BG_CARD_RADIUS,
  BG_DANGER,
  BG_FONTS,
  BG_MONEY,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  GlassCard,
  getActiveTemplates,
  getAllocationsForMonth,
  getGoals,
  getSubscriptions,
  getUpcomingTransactions,
  listTransactions,
  suggestMonthlyContribution,
  type BudgetGoal,
} from '@mylife/budget';
import {
  BudgetButton,
  BudgetHeadline,
  BudgetMetric,
  BudgetScreen,
  BudgetSectionLabel,
  currentBudgetMonth,
  formatBudgetCurrency,
  formatBudgetMonth,
  monthKeyFromOffset,
} from '../../components/budget/BudgetPhase2Primitives';
import { useDatabase } from '../../components/DatabaseProvider';

type MonthProjection = {
  month: string;
  projectedReady: number;
  allocated: number;
  recurringOutflow: number;
  renewalTotal: number;
  goalContribution: number;
  bills: string[];
  fundedGoals: number;
};

function averageMonthlyIncome(transactions: ReturnType<typeof listTransactions>): number {
  const incomeByMonth = new Map<string, number>();

  transactions
    .filter((transaction) => transaction.direction === 'inflow')
    .forEach((transaction) => {
      const month = transaction.occurred_on.slice(0, 7);
      incomeByMonth.set(month, (incomeByMonth.get(month) ?? 0) + transaction.amount);
    });

  const recent = Array.from(incomeByMonth.values()).slice(0, 3);
  if (recent.length === 0) {
    return 0;
  }

  return Math.round(recent.reduce((sum, value) => sum + value, 0) / recent.length);
}

function goalContributionForMonth(goal: BudgetGoal): number {
  return suggestMonthlyContribution({
    id: goal.id,
    name: goal.name,
    targetAmount: goal.target_amount,
    currentAmount: goal.completed_amount,
    targetDate: goal.target_date,
    createdAt: goal.created_at.slice(0, 10),
  });
}

function monthSequence(): string[] {
  return Array.from({ length: 12 }, (_, index) => monthKeyFromOffset(index));
}

export default function FutureMonthsScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [months, setMonths] = useState<MonthProjection[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(currentBudgetMonth());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const monthKeys = monthSequence();
      const recentTransactions = listTransactions(db, { limit: 400 });
      const averageIncome = averageMonthlyIncome(recentTransactions);
      const activeTemplates = getActiveTemplates(db).map((template) => ({
        id: template.id,
        accountId: template.account_id,
        envelopeId: template.envelope_id,
        payee: template.payee,
        amount: template.amount,
        frequency: template.frequency,
        nextDate: template.next_date,
        endDate: template.end_date,
        isActive: template.is_active === 1,
      }));
      const upcoming = getUpcomingTransactions(activeTemplates, 365, `${currentBudgetMonth()}-01`);
      const goals = getGoals(db);
      const subscriptions = getSubscriptions(db, { status: 'active' });

      const projections = monthKeys.map((month) => {
        const allocations = getAllocationsForMonth(db, month);
        const allocated = allocations.reduce((sum, row) => sum + row.amount, 0);
        const recurringOutflow = upcoming
          .filter((transaction) => transaction.date.startsWith(month))
          .reduce((sum, transaction) => sum + transaction.amount, 0);
        const renewals = subscriptions.filter((subscription) => subscription.next_renewal.startsWith(month));
        const renewalTotal = renewals.reduce((sum, subscription) => sum + subscription.price, 0);
        const goalContribution = goals.reduce((sum, goal) => sum + goalContributionForMonth(goal), 0);
        const projectedReady = averageIncome - allocated - recurringOutflow - goalContribution;

        return {
          month,
          projectedReady,
          allocated,
          recurringOutflow,
          renewalTotal,
          goalContribution,
          bills: [
            ...renewals.slice(0, 2).map((subscription) => subscription.name),
            ...upcoming
              .filter((transaction) => transaction.date.startsWith(month))
              .slice(0, 2)
              .map((transaction) => transaction.payee),
          ].slice(0, 3),
          fundedGoals: goals.filter((goal) => goalContributionForMonth(goal) > 0).length,
        } satisfies MonthProjection;
      });

      setMonths(projections);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to build projections.');
    }
  }, [db]);

  const selectedProjection = useMemo(
    () => months.find((month) => month.month === selectedMonth) ?? months[0] ?? null,
    [months, selectedMonth],
  );

  return (
    <BudgetScreen>
      <GlassCard style={styles.heroCard}>
        <BudgetHeadline
          title="Future Months"
          subtitle="Projected ready-to-budget, scheduled bills, and goal funding over the next year."
        />
        <View style={styles.metricRow}>
          <BudgetMetric
            label="Months"
            value={String(months.length)}
            tone="neutral"
          />
          <BudgetMetric
            label="Current selection"
            value={selectedProjection ? formatBudgetMonth(selectedProjection.month) : 'None'}
            tone="warning"
          />
        </View>
      </GlassCard>

      <BudgetSectionLabel>Timeline</BudgetSectionLabel>
      <GlassCard style={styles.timelineCard}>
        <Svg width="100%" height={64} viewBox="0 0 320 64">
          <Polyline
            points={months
              .map((_, index) => `${20 + index * 25},32`)
              .join(' ')}
            fill="none"
            stroke="rgba(228,225,233,0.18)"
            strokeWidth={3}
          />
          {months.map((month, index) => (
            <Circle
              key={month.month}
              cx={20 + index * 25}
              cy={32}
              r={month.month === selectedMonth ? 8 : 5}
              fill={month.month === selectedMonth ? BG_MONEY : BG_TEXT_TERTIARY}
            />
          ))}
        </Svg>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.monthScroller}>
            {months.map((month) => (
              <BudgetButton
                key={month.month}
                label={month.month}
                tone={month.month === selectedMonth ? 'primary' : 'secondary'}
                onPress={() => setSelectedMonth(month.month)}
              />
            ))}
          </View>
        </ScrollView>
      </GlassCard>

      {selectedProjection ? (
        <GlassCard style={styles.detailCard}>
          <BudgetHeadline
            title={formatBudgetMonth(selectedProjection.month)}
            subtitle="Tap another month above to drill into that projection."
          />
          <View style={styles.metricRow}>
            <BudgetMetric
              label="Projected ready"
              value={formatBudgetCurrency(selectedProjection.projectedReady)}
              tone={selectedProjection.projectedReady >= 0 ? 'money' : 'danger'}
            />
            <BudgetMetric
              label="Allocated"
              value={formatBudgetCurrency(selectedProjection.allocated)}
              tone="warning"
            />
            <BudgetMetric
              label="Recurring"
              value={formatBudgetCurrency(selectedProjection.recurringOutflow)}
              tone="danger"
            />
            <BudgetMetric
              label="Goals"
              value={formatBudgetCurrency(selectedProjection.goalContribution)}
              tone="warning"
            />
          </View>

          <View style={styles.billCard}>
            <Text style={styles.billTitle}>Upcoming bills</Text>
            {selectedProjection.bills.length === 0 ? (
              <Text style={styles.billCopy}>No renewals or recurring items are scheduled yet.</Text>
            ) : (
              selectedProjection.bills.map((bill) => (
                <Text key={bill} style={styles.billCopy}>
                  • {bill}
                </Text>
              ))
            )}
          </View>

          <View style={styles.billCard}>
            <Text style={styles.billTitle}>Funding notes</Text>
            <Text style={styles.billCopy}>
              Renewal load: {formatBudgetCurrency(selectedProjection.renewalTotal)}
            </Text>
            <Text style={styles.billCopy}>
              Goals funded this month: {selectedProjection.fundedGoals}
            </Text>
          </View>

          <BudgetButton
            label="Apply Budget to This Month"
            onPress={() => router.push(`/(budget)/plan-tab?month=${selectedProjection.month}` as never)}
          />
        </GlassCard>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </BudgetScreen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: 14,
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  timelineCard: {
    gap: 14,
  },
  monthScroller: {
    flexDirection: 'row',
    gap: 10,
    paddingRight: 12,
  },
  detailCard: {
    gap: 14,
  },
  billCard: {
    borderRadius: BG_CARD_RADIUS,
    backgroundColor: BG_SURFACES.low,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  billTitle: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: BG_TEXT,
  },
  billCopy: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 17,
    color: BG_TEXT_SECONDARY,
  },
  errorText: {
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: BG_DANGER,
  },
});
