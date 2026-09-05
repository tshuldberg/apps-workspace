import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, StyleSheet, Text, View } from 'react-native';
import {
  BG_FONTS,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  GlassCard,
  calculateNoSpendStats,
  getNoSpendDaysInMonth,
  getSetting,
  listTransactions,
  setSetting,
  type BudgetTransaction,
} from '@mylife/budget';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  BudgetActionButton,
  BudgetEmptyState,
  BudgetHeroCard,
  BudgetMetricCard,
  BudgetPhaseHeader,
  BudgetPhaseScreen,
  BudgetProgressBar,
  BudgetSection,
} from '../../components/budget/BudgetPhase5Kit';

type StreakHistoryEntry = {
  end: string;
  length: number;
  start: string;
};

const CHECKIN_KEY = 'budget_phase5_no_spend_checkins';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftDays(isoDate: string, delta: number): string {
  const copy = new Date(`${isoDate}T00:00:00`);
  copy.setDate(copy.getDate() + delta);
  return copy.toISOString().slice(0, 10);
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

function parseCheckins(raw: string | null): string[] {
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

function buildMonthGrid(month: string, today: string, spendSet: Set<string>, checkinSet: Set<string>) {
  const [year, monthValue] = month.split('-').map(Number);
  const totalDays = new Date(year, monthValue, 0).getDate();
  const startOffset = new Date(year, monthValue - 1, 1).getDay();
  const cells: Array<{ date: string | null; day: number | null; isFuture: boolean; isSpend: boolean; isChecked: boolean }> = [];

  for (let index = 0; index < startOffset; index += 1) {
    cells.push({ date: null, day: null, isChecked: false, isFuture: false, isSpend: false });
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    cells.push({
      date,
      day,
      isChecked: checkinSet.has(date),
      isFuture: date > today,
      isSpend: spendSet.has(date),
    });
  }

  return cells;
}

function buildStreakHistory(spendSet: Set<string>, today: string, lookbackDays = 120): StreakHistoryEntry[] {
  const start = shiftDays(today, -lookbackDays);
  const history: StreakHistoryEntry[] = [];
  let runStart: string | null = null;
  let runLength = 0;

  for (let cursor = start; cursor <= today; cursor = shiftDays(cursor, 1)) {
    if (!spendSet.has(cursor)) {
      runStart = runStart ?? cursor;
      runLength += 1;
      continue;
    }

    if (runStart && runLength >= 2) {
      history.push({ end: shiftDays(cursor, -1), length: runLength, start: runStart });
    }
    runStart = null;
    runLength = 0;
  }

  if (runStart && runLength >= 2) {
    history.push({ end: today, length: runLength, start: runStart });
  }

  return history.sort((left, right) => right.end.localeCompare(left.end)).slice(0, 5);
}

function averageDailySpend(transactions: BudgetTransaction[]): number {
  const grouped = new Map<string, number>();
  transactions.forEach((transaction) => {
    if (transaction.direction !== 'outflow') {
      return;
    }
    grouped.set(transaction.occurred_on, (grouped.get(transaction.occurred_on) ?? 0) + transaction.amount);
  });
  if (grouped.size === 0) {
    return 0;
  }
  const total = Array.from(grouped.values()).reduce((sum, value) => sum + value, 0);
  return Math.round(total / grouped.size);
}

function nextMilestone(streak: number): number {
  return [7, 14, 21, 30, 45, 60].find((milestone) => milestone > streak) ?? streak;
}

export default function NoSpendStreaksScreen() {
  const db = useDatabase();

  const [selectedMonth, setSelectedMonth] = useState(todayIso().slice(0, 7));
  const [outflowDates, setOutflowDates] = useState<string[]>([]);
  const [checkins, setCheckins] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    const lookbackStart = shiftDays(todayIso(), -180);
    const transactions = listTransactions(db, {
      from_date: lookbackStart,
      limit: 4000,
      to_date: todayIso(),
    });

    setOutflowDates(
      transactions
        .filter((transaction) => transaction.direction === 'outflow')
        .map((transaction) => transaction.occurred_on),
    );
    setCheckins(parseCheckins(getSetting(db, CHECKIN_KEY)));
    setRefreshing(false);
  }, [db]);

  useEffect(() => {
    load();
  }, [load]);

  const spendSet = useMemo(() => new Set(outflowDates), [outflowDates]);
  const checkinSet = useMemo(() => new Set(checkins), [checkins]);

  const currentStats = useMemo(
    () => calculateNoSpendStats(outflowDates, todayIso()),
    [outflowDates],
  );

  const selectedMonthCount = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    return getNoSpendDaysInMonth(outflowDates, year, month, todayIso());
  }, [outflowDates, selectedMonth]);

  const monthGrid = useMemo(
    () => buildMonthGrid(selectedMonth, todayIso(), spendSet, checkinSet),
    [checkinSet, selectedMonth, spendSet],
  );

  const history = useMemo(
    () => buildStreakHistory(spendSet, todayIso()),
    [spendSet],
  );

  const averageSaved = useMemo(() => {
    const transactions = listTransactions(db, {
      from_date: shiftDays(todayIso(), -30),
      limit: 800,
      to_date: todayIso(),
    });
    return averageDailySpend(transactions);
  }, [db]);

  const markToday = useCallback(() => {
    if (spendSet.has(todayIso())) {
      Alert.alert('Spend detected today', 'Today already has an outflow, so it cannot be checked in as a no-spend day.');
      return;
    }
    if (checkinSet.has(todayIso())) {
      return;
    }

    const nextCheckins = [...checkins, todayIso()].sort();
    setCheckins(nextCheckins);
    setSetting(db, CHECKIN_KEY, JSON.stringify(nextCheckins));
  }, [checkinSet, checkins, db, spendSet]);

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

  const milestone = nextMilestone(currentStats.currentStreak);

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
              icon="task_alt"
              label={checkinSet.has(todayIso()) ? 'Checked today' : 'Mark Today'}
              onPress={markToday}
              tone="money"
            />
          </View>
        }
        eyebrow="No-spend"
        eyebrowIcon="local_fire_department"
        subtitle="Measured directly from outflow-free days, with optional check-ins to lock the day in."
        title="No Spend Streaks"
      />

      <BudgetHeroCard
        detail={`Estimated ${formatCurrency(averageSaved * currentStats.currentStreak)} preserved across this streak`}
        subtitle={`${currentStats.noSpendDaysThisMonth} no-spend days this month`}
        title="Current streak"
        value={`${currentStats.currentStreak} days`}
      />

      <View style={styles.metricRow}>
        <BudgetMetricCard
          caption="Best run in the current tracking window"
          label="Longest"
          tone="gold"
          value={`${currentStats.longestStreak}d`}
        />
        <BudgetMetricCard
          caption={monthLabel(selectedMonth)}
          label="Month total"
          tone="money"
          value={`${selectedMonthCount}d`}
        />
        <BudgetMetricCard
          caption="Current month no-spend rate"
          label="Rate"
          tone="info"
          value={`${currentStats.noSpendPercent}%`}
        />
      </View>

      <GlassCard padding={20}>
        <Text style={styles.progressTitle}>Next streak badge</Text>
        <Text style={styles.progressDetail}>
          {milestone === currentStats.currentStreak
            ? 'You are at the current milestone ceiling.'
            : `${milestone - currentStats.currentStreak} days until the next badge`}
        </Text>
        <BudgetProgressBar progress={milestone > 0 ? currentStats.currentStreak / milestone : 0} tone="money" />
      </GlassCard>

      <BudgetSection subtitle={monthLabel(selectedMonth)} title="Calendar">
        <GlassCard padding={18}>
          <View style={styles.calendarHeader}>
            <BudgetActionButton
              icon="chevron_left"
              label="Prev"
              onPress={() => setSelectedMonth((current) => shiftMonth(current, -1))}
              quiet
              tone="gold"
            />
            <Text style={styles.calendarTitle}>{monthLabel(selectedMonth)}</Text>
            <BudgetActionButton
              icon="chevron_right"
              label="Next"
              onPress={() => setSelectedMonth((current) => shiftMonth(current, 1))}
              quiet
              tone="info"
            />
          </View>
          <View style={styles.weekdayRow}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label) => (
              <Text key={label} style={styles.weekdayText}>{label}</Text>
            ))}
          </View>
          <View style={styles.calendarGrid}>
            {monthGrid.map((cell, index) => (
              <View
                key={`${cell.date ?? 'blank'}-${index}`}
                style={[
                  styles.calendarCell,
                  cell.date && !cell.isFuture && !cell.isSpend ? styles.calendarNoSpend : null,
                  cell.isSpend ? styles.calendarSpend : null,
                  cell.isChecked ? styles.calendarChecked : null,
                ]}
              >
                {cell.day ? <Text style={styles.calendarDay}>{cell.day}</Text> : null}
              </View>
            ))}
          </View>
        </GlassCard>
      </BudgetSection>

      <BudgetSection subtitle="Recent streak runs of two days or longer." title="History">
        {history.length > 0 ? (
          <View style={styles.historyColumn}>
            {history.map((entry) => (
              <GlassCard key={`${entry.start}-${entry.end}`} padding={16}>
                <View style={styles.historyRow}>
                  <View style={styles.historyCopy}>
                    <Text style={styles.historyTitle}>{entry.length}-day streak</Text>
                    <Text style={styles.historyMeta}>
                      {entry.start} to {entry.end}
                    </Text>
                  </View>
                  <Text style={styles.historyBadge}>{entry.length}d</Text>
                </View>
              </GlassCard>
            ))}
          </View>
        ) : (
          <BudgetEmptyState
            icon="history"
            message="Streak history will appear once you stack together at least two no-spend days."
            title="History is still forming"
          />
        )}
      </BudgetSection>
    </BudgetPhaseScreen>
  );
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
  },
  progressTitle: {
    fontFamily: BG_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
    color: BG_TEXT,
  },
  progressDetail: {
    marginTop: 8,
    marginBottom: 14,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 20,
    color: BG_TEXT_SECONDARY,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  calendarTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: BG_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: BG_TEXT,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  weekdayText: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontFamily: BG_FONTS.bold,
    fontSize: 11,
    lineHeight: 14,
    color: BG_TEXT_TERTIARY,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  calendarCell: {
    width: '12.6%',
    minHeight: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  calendarNoSpend: {
    backgroundColor: 'rgba(34,197,94,0.16)',
  },
  calendarSpend: {
    backgroundColor: 'rgba(255,180,171,0.18)',
  },
  calendarChecked: {
    backgroundColor: 'rgba(255,184,119,0.20)',
  },
  calendarDay: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 18,
    color: BG_TEXT,
  },
  historyColumn: {
    gap: 10,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  historyCopy: {
    flex: 1,
    gap: 4,
  },
  historyTitle: {
    fontFamily: BG_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
    color: BG_TEXT,
  },
  historyMeta: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 18,
    color: BG_TEXT_SECONDARY,
  },
  historyBadge: {
    fontFamily: BG_FONTS.extraBold,
    fontSize: 16,
    lineHeight: 20,
    color: BG_TEXT,
  },
});
