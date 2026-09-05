import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  BG_FONTS,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  GlassCard,
  getGoals,
  getSetting,
  getSubscriptions,
  listAccounts,
  listTransactions,
  listEnvelopes,
  setSetting,
} from '@mylife/budget';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  BudgetActionButton,
  BudgetChip,
  BudgetHeroCard,
  BudgetPhaseHeader,
  BudgetPhaseScreen,
  BudgetProgressBar,
  BudgetSection,
} from '../../components/budget/BudgetPhase5Kit';

type ChecklistTask = {
  description: string;
  detail: string;
  id: string;
  isAutoComplete: boolean;
  route: string;
  title: string;
};

const CHECKLIST_SETTING_PREFIX = 'budget_phase5_checklist:';

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function shiftMonth(month: string, delta: number): string {
  const [year, monthValue] = month.split('-').map(Number);
  const next = new Date(year, monthValue - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month: string): string {
  const [year, monthValue] = month.split('-').map(Number);
  return new Date(year, monthValue - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function monthRange(month: string): { from: string; to: string } {
  const [year, monthValue] = month.split('-').map(Number);
  const lastDay = new Date(year, monthValue, 0).getDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, '0')}`,
  };
}

function parseCompleted(raw: string | null): string[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function ChecklistScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [tasks, setTasks] = useState<ChecklistTask[]>([]);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    const accounts = listAccounts(db, false).filter((account) => account.archived === 0);
    const envelopes = listEnvelopes(db, false).filter((envelope) => envelope.archived === 0);
    const goals = getGoals(db);
    const subscriptions = getSubscriptions(db).filter(
      (subscription) => subscription.status === 'active' || subscription.status === 'trial',
    );
    const previousMonth = shiftMonth(selectedMonth, -1);
    const previousMonthTxCount = listTransactions(db, {
      from_date: monthRange(previousMonth).from,
      limit: 600,
      to_date: monthRange(previousMonth).to,
    }).length;
    const creditAccounts = accounts.filter((account) => account.type === 'credit');
    const goalFundingCount = goals.filter((goal) => goal.completed_amount > 0).length;
    const budgetedEnvelopes = envelopes.filter((envelope) => envelope.monthly_budget > 0).length;

    setTasks([
      {
        description: previousMonthTxCount > 0 ? `${previousMonthTxCount} transactions logged last month` : 'Open reports and scan last month’s patterns',
        detail: 'Spot overspends, category drift, and any missed reimbursements before the new month gets busy.',
        id: 'review-last-month',
        isAutoComplete: false,
        route: '/(budget)/reports',
        title: "Review last month's spending",
      },
      {
        description: budgetedEnvelopes > 0 ? `${budgetedEnvelopes} envelopes already have targets` : 'Allocate money across your active envelopes',
        detail: 'This stays auto-complete once at least one active envelope has a monthly target in place.',
        id: 'allocate-budget',
        isAutoComplete: budgetedEnvelopes > 0,
        route: '/(budget)/plan-tab',
        title: `Allocate ${monthLabel(selectedMonth)}`,
      },
      {
        description: creditAccounts.length > 0 ? `${creditAccounts.length} credit account${creditAccounts.length === 1 ? '' : 's'} need attention` : 'No credit accounts linked right now',
        detail: 'Review balances, due dates, and whether any recent outflows should be moved to payoff envelopes.',
        id: 'pay-credit-balances',
        isAutoComplete: creditAccounts.length === 0,
        route: '/(budget)/accounts',
        title: 'Pay credit card balances',
      },
      {
        description: subscriptions.length > 0 ? `${subscriptions.length} active subscription${subscriptions.length === 1 ? '' : 's'} tracked` : 'No active subscriptions tracked yet',
        detail: 'Open the renewal calendar and confirm every recurring bill still deserves a slot in your plan.',
        id: 'review-subscriptions',
        isAutoComplete: false,
        route: '/(budget)/renewal-calendar',
        title: 'Review subscriptions',
      },
      {
        description: goals.length > 0 ? `${goals.length} savings goal${goals.length === 1 ? '' : 's'} in progress` : 'Create a target worth funding this month',
        detail: 'Goals auto-complete once at least one target already has funded progress.',
        id: 'contribute-goals',
        isAutoComplete: goalFundingCount > 0,
        route: '/(budget)/goals',
        title: 'Contribute to savings goals',
      },
      {
        description: accounts.length > 0 ? `${accounts.length} active account${accounts.length === 1 ? '' : 's'} linked` : 'Add or connect an account before reconciling',
        detail: 'Use the accounts surface to confirm balances match reality and clear any lingering imports.',
        id: 'reconcile-accounts',
        isAutoComplete: false,
        route: '/(budget)/accounts',
        title: 'Reconcile accounts',
      },
    ]);

    setCompletedIds(parseCompleted(getSetting(db, `${CHECKLIST_SETTING_PREFIX}${selectedMonth}`)));
    setRefreshing(false);
  }, [db, selectedMonth]);

  useEffect(() => {
    load();
  }, [load]);

  const progress = useMemo(() => {
    const completedCount = tasks.filter(
      (task) => task.isAutoComplete || completedIds.includes(task.id),
    ).length;
    return {
      completedCount,
      totalCount: tasks.length,
    };
  }, [completedIds, tasks]);

  const toggleTask = useCallback(
    (taskId: string) => {
      const task = tasks.find((item) => item.id === taskId);
      if (!task || task.isAutoComplete) {
        return;
      }

      const nextCompletedIds = completedIds.includes(taskId)
        ? completedIds.filter((id) => id !== taskId)
        : [...completedIds, taskId];

      setCompletedIds(nextCompletedIds);
      setSetting(db, `${CHECKLIST_SETTING_PREFIX}${selectedMonth}`, JSON.stringify(nextCompletedIds));
    },
    [completedIds, db, selectedMonth, tasks],
  );

  const refreshControl = (
    <RefreshControl
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
      refreshing={refreshing}
      tintColor={BG_TEXT}
    />
  );

  const nextOpenTask = tasks.find(
    (task) => !task.isAutoComplete && !completedIds.includes(task.id),
  );

  return (
    <BudgetPhaseScreen refreshControl={refreshControl}>
      <BudgetPhaseHeader
        action={
          <View style={styles.headerActions}>
            <BudgetActionButton
              icon="chevron_left"
              label="Prev"
              onPress={() => setSelectedMonth((current) => shiftMonth(current, -1))}
              quiet
              tone="gold"
            />
            <BudgetActionButton
              icon="today"
              label="Current"
              onPress={() => setSelectedMonth(currentMonth())}
              quiet
              tone="money"
            />
            <BudgetActionButton
              icon="chevron_right"
              label="Next"
              onPress={() => setSelectedMonth((current) => shiftMonth(current, 1))}
              quiet
              tone="info"
            />
          </View>
        }
        eyebrow="Checklist"
        eyebrowIcon="checklist"
        subtitle={monthLabel(selectedMonth)}
        title="Monthly checklist"
      />

      <BudgetHeroCard
        detail={`${progress.completedCount} of ${progress.totalCount} tasks complete`}
        subtitle={progress.completedCount === progress.totalCount ? 'This month is fully staged' : 'Use the task buttons to jump into the right budget screens'}
        title="Planning progress"
        value={`${Math.round(progress.totalCount > 0 ? (progress.completedCount / progress.totalCount) * 100 : 0)}%`}
      />

      <GlassCard padding={20}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Checklist completion</Text>
          <BudgetChip active label={`${progress.completedCount}/${progress.totalCount}`} tone="money" />
        </View>
        <BudgetProgressBar progress={progress.totalCount > 0 ? progress.completedCount / progress.totalCount : 0} tone="money" />
      </GlassCard>

      <BudgetSection
        subtitle="Mixes live signals from accounts, goals, subscriptions, and transaction history with the manual checkboxes you control."
        title="Tasks"
      >
        <View style={styles.listColumn}>
          {tasks.map((task) => {
            const completed = task.isAutoComplete || completedIds.includes(task.id);
            return (
              <GlassCard key={task.id} padding={18}>
                <View style={styles.taskRow}>
                  <Pressable
                    onPress={() => toggleTask(task.id)}
                    style={[
                      styles.checkbox,
                      completed ? styles.checkboxDone : null,
                    ]}
                  >
                    {completed ? <Text style={styles.checkboxMark}>✓</Text> : null}
                  </Pressable>

                  <View style={styles.taskCopy}>
                    <View style={styles.taskTitleRow}>
                      <Text style={[styles.taskTitle, completed ? styles.taskTitleDone : null]}>
                        {task.title}
                      </Text>
                      {task.isAutoComplete ? (
                        <BudgetChip active label="Auto" tone="money" />
                      ) : null}
                    </View>
                    <Text style={styles.taskDescription}>{task.description}</Text>
                    <Text style={styles.taskDetail}>{task.detail}</Text>
                  </View>
                </View>
                <View style={styles.taskActions}>
                  <BudgetActionButton
                    icon="open_in_new"
                    label="Do This"
                    onPress={() => router.push(task.route as never)}
                    quiet
                    tone="gold"
                  />
                </View>
              </GlassCard>
            );
          })}
        </View>
      </BudgetSection>

      {nextOpenTask ? (
        <GlassCard padding={20} style={styles.focusCard}>
          <Text style={styles.focusEyebrow}>Next recommended move</Text>
          <Text style={styles.focusTitle}>{nextOpenTask.title}</Text>
          <Text style={styles.focusDescription}>{nextOpenTask.description}</Text>
          <View style={styles.focusAction}>
            <BudgetActionButton
              icon="bolt"
              label="Open task"
              onPress={() => router.push(nextOpenTask.route as never)}
              tone="money"
            />
          </View>
        </GlassCard>
      ) : null}
    </BudgetPhaseScreen>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  progressTitle: {
    fontFamily: BG_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
    color: BG_TEXT,
  },
  listColumn: {
    gap: 10,
  },
  taskRow: {
    flexDirection: 'row',
    gap: 14,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxDone: {
    backgroundColor: 'rgba(34,197,94,0.22)',
  },
  checkboxMark: {
    fontFamily: BG_FONTS.bold,
    fontSize: 14,
    lineHeight: 16,
    color: '#E8FFF1',
  },
  taskCopy: {
    flex: 1,
    gap: 6,
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  taskTitle: {
    flex: 1,
    fontFamily: BG_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
    color: BG_TEXT,
  },
  taskTitleDone: {
    color: BG_TEXT_SECONDARY,
  },
  taskDescription: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 18,
    color: BG_TEXT_SECONDARY,
  },
  taskDetail: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 18,
    color: BG_TEXT_TERTIARY,
  },
  taskActions: {
    marginTop: 14,
  },
  focusCard: {
    backgroundColor: BG_SURFACES.low,
  },
  focusEyebrow: {
    fontFamily: BG_FONTS.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: BG_TEXT_TERTIARY,
  },
  focusTitle: {
    marginTop: 8,
    fontFamily: BG_FONTS.extraBold,
    fontSize: 24,
    lineHeight: 28,
    color: BG_TEXT,
  },
  focusDescription: {
    marginTop: 8,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 20,
    color: BG_TEXT_SECONDARY,
  },
  focusAction: {
    marginTop: 16,
  },
});
