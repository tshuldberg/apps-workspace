import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  BG_ACCENT,
  BG_ACCENT_LIGHT,
  BG_FONTS,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  GlassCard,
  MaterialSymbol,
  SectionHeader,
  calculateNoSpendStats,
  getSpendingHeatmap,
  listTransactions,
  type DailySpendingEntry,
  type HeatmapDay,
  type HeatmapMonth,
} from '@mylife/budget';
import { useDatabase } from '../../components/DatabaseProvider';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function buildDateRange(year: number, month: number): { from: string; to: string } {
  return {
    from: `${year}-${String(month).padStart(2, '0')}-01`,
    to: `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth(year, month)).padStart(2, '0')}`,
  };
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function monthShortLabel(month: number): string {
  return new Date(2026, month - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
  });
}

function normalizeOpacity(intensity: number): number {
  if (intensity <= 0) {
    return 0.14;
  }
  return Math.max(0.2, Math.min(0.95, intensity));
}

export default function SpendingHeatmapScreen() {
  const db = useDatabase();
  const today = isoToday();
  const currentDate = new Date();

  const [year, setYear] = useState(currentDate.getFullYear());
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [heatmap, setHeatmap] = useState<HeatmapMonth | null>(null);
  const [selectedDay, setSelectedDay] = useState<HeatmapDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    try {
      const range = buildDateRange(year, month);
      const transactions = listTransactions(db, {
        from_date: range.from,
        limit: 2000,
        to_date: range.to,
      });

      const dailyTotals = new Map<string, { totalCents: number; transactionCount: number }>();
      transactions.forEach((transaction) => {
        if (transaction.direction !== 'outflow') {
          return;
        }
        const current = dailyTotals.get(transaction.occurred_on) ?? {
          totalCents: 0,
          transactionCount: 0,
        };
        current.totalCents += Math.abs(transaction.amount);
        current.transactionCount += 1;
        dailyTotals.set(transaction.occurred_on, current);
      });

      const dailySpending: DailySpendingEntry[] = [...dailyTotals.entries()].map(
        ([date, value]) => ({
          date,
          totalCents: value.totalCents,
          transactionCount: value.transactionCount,
        }),
      );

      const nextHeatmap = getSpendingHeatmap(dailySpending, year, month, today);
      setHeatmap(nextHeatmap);
      setSelectedDay(nextHeatmap.days[nextHeatmap.days.length - 1] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the spending heatmap.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, month, today, year]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const dayOffset = useMemo(
    () => new Date(year, month - 1, 1).getDay(),
    [month, year],
  );

  const outflowDates = useMemo(
    () =>
      heatmap?.days.filter((day) => day.totalCents > 0).map((day) => day.date) ?? [],
    [heatmap],
  );

  const noSpendStats = useMemo(() => {
    if (!heatmap) {
      return null;
    }
    const referenceDate = `${heatmap.year}-${String(heatmap.month).padStart(2, '0')}-${String(
      heatmap.days.length,
    ).padStart(2, '0')}`;
    return calculateNoSpendStats(outflowDates, referenceDate);
  }, [heatmap, outflowDates]);

  const busiestDay = useMemo(() => {
    if (!heatmap || heatmap.days.length === 0) {
      return null;
    }
    return heatmap.days.reduce((best, day) =>
      day.transactionCount > best.transactionCount ? day : best,
    );
  }, [heatmap]);

  const highestSpendDay = useMemo(() => {
    if (!heatmap || heatmap.days.length === 0) {
      return null;
    }
    return heatmap.days.reduce((best, day) =>
      day.totalCents > best.totalCents ? day : best,
    );
  }, [heatmap]);

  const gridCells = useMemo(() => {
    if (!heatmap) {
      return [];
    }
    const cells: Array<{ empty?: boolean; day?: HeatmapDay }> = [];
    for (let index = 0; index < dayOffset; index += 1) {
      cells.push({ empty: true });
    }
    heatmap.days.forEach((day) => cells.push({ day }));
    return cells;
  }, [dayOffset, heatmap]);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          colors={[BG_ACCENT]}
          onRefresh={onRefresh}
          refreshing={refreshing}
          tintColor={BG_ACCENT}
        />
      }
      style={styles.container}
    >
      <GlassCard style={styles.heroCard}>
        <Text style={styles.eyebrow}>Spending Heatmap</Text>
        <Text style={styles.heroTitle}>Spot the hot days before they become a pattern.</Text>
        <Text style={styles.heroMeta}>
          {loading
            ? 'Loading monthly intensity...'
            : heatmap
            ? `${monthLabel(year, month)} • ${formatCurrency(heatmap.monthTotalCents)} total spend`
            : 'No heatmap data yet.'}
        </Text>
      </GlassCard>

      <View style={styles.selectorBlock}>
        <View style={styles.yearRow}>
          <Pressable
            onPress={() => setYear((current) => current - 1)}
            style={styles.selectorButton}
          >
            <MaterialSymbol color={BG_TEXT} name="arrow_back" size={16} />
          </Pressable>
          <Text style={styles.yearLabel}>{year}</Text>
          <Pressable
            onPress={() => setYear((current) => current + 1)}
            style={styles.selectorButton}
          >
            <MaterialSymbol color={BG_TEXT} name="arrow_forward" size={16} />
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.monthRail}>
            {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
              <Pressable
                key={value}
                onPress={() => setMonth(value)}
                style={[
                  styles.monthChip,
                  {
                    backgroundColor:
                      value === month ? `${BG_ACCENT}22` : BG_SURFACES.high,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.monthChipLabel,
                    { color: value === month ? BG_ACCENT_LIGHT : BG_TEXT_SECONDARY },
                  ]}
                >
                  {monthShortLabel(value)}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      {error ? (
        <GlassCard style={styles.errorCard}>
          <Text style={styles.errorTitle}>Heatmap unavailable</Text>
          <Text style={styles.errorMessage}>{error}</Text>
        </GlassCard>
      ) : null}

      <View style={styles.statsRow}>
        <GlassCard style={styles.statCard}>
          <Text style={styles.statLabel}>Highest Spend</Text>
          <Text style={styles.statValue}>
            {highestSpendDay ? formatCurrency(highestSpendDay.totalCents) : '$0.00'}
          </Text>
          <Text style={styles.statMeta}>{highestSpendDay?.date ?? 'No activity yet'}</Text>
        </GlassCard>
        <GlassCard style={styles.statCard}>
          <Text style={styles.statLabel}>Busiest Day</Text>
          <Text style={styles.statValue}>
            {busiestDay ? `${busiestDay.transactionCount}` : '0'}
          </Text>
          <Text style={styles.statMeta}>{busiestDay?.date ?? 'No activity yet'}</Text>
        </GlassCard>
        <GlassCard style={styles.statCard}>
          <Text style={styles.statLabel}>No-spend Streak</Text>
          <Text style={styles.statValue}>{noSpendStats?.currentStreak ?? 0}d</Text>
          <Text style={styles.statMeta}>
            Longest {noSpendStats?.longestStreak ?? 0}d
          </Text>
        </GlassCard>
      </View>

      <GlassCard style={styles.calendarCard}>
        <SectionHeader
          action={
            <Text style={styles.sectionMeta}>
              {heatmap ? `${formatCurrency(heatmap.averageDailyCents)}/day` : '$0.00/day'}
            </Text>
          }
          title={monthLabel(year, month)}
        />

        <View style={styles.weekdayRow}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <Text key={day} style={styles.weekdayLabel}>
              {day}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {gridCells.map((cell, index) => {
            if (cell.empty || !cell.day) {
              return <View key={`empty-${index}`} style={styles.emptyCell} />;
            }

            const isSelected = selectedDay?.date === cell.day.date;
            const hasSpend = cell.day.totalCents > 0;
            return (
              <Pressable
                key={cell.day.date}
                onPress={() => setSelectedDay(cell.day ?? null)}
                style={[
                  styles.dayCell,
                  {
                    backgroundColor: hasSpend
                      ? `rgba(34, 197, 94, ${normalizeOpacity(cell.day.intensity)})`
                      : BG_SURFACES.high,
                  },
                  isSelected ? styles.dayCellSelected : null,
                ]}
              >
                <Text style={styles.dayLabel}>
                  {Number(cell.day.date.slice(-2))}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.legendRow}>
          <Text style={styles.legendLabel}>No spend</Text>
          <View style={styles.legendScale}>
            {[0, 0.25, 0.5, 0.75, 1].map((value) => (
              <View
                key={value}
                style={[
                  styles.legendCell,
                  {
                    backgroundColor: `rgba(34, 197, 94, ${normalizeOpacity(value)})`,
                  },
                ]}
              />
            ))}
          </View>
          <Text style={styles.legendLabel}>Heavy spend</Text>
        </View>
      </GlassCard>

      {selectedDay ? (
        <GlassCard style={styles.detailCard}>
          <Text style={styles.detailTitle}>{selectedDay.date}</Text>
          <Text style={styles.detailAmount}>
            {selectedDay.totalCents > 0
              ? formatCurrency(selectedDay.totalCents)
              : 'No spending'}
          </Text>
          <Text style={styles.detailMeta}>
            {selectedDay.transactionCount} transaction{selectedDay.transactionCount === 1 ? '' : 's'}
          </Text>
        </GlassCard>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: BG_SURFACES.lowest,
    flex: 1,
  },
  content: {
    gap: 16,
    paddingBottom: 80,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  heroCard: {
    gap: 8,
  },
  eyebrow: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 24,
    lineHeight: 30,
  },
  heroMeta: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  selectorBlock: {
    gap: 12,
  },
  yearRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  selectorButton: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.high,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  yearLabel: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    minWidth: 72,
    textAlign: 'center',
  },
  monthRail: {
    flexDirection: 'row',
    gap: 8,
  },
  monthChip: {
    borderRadius: 999,
    minHeight: 34,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  monthChipLabel: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  errorCard: {
    gap: 6,
  },
  errorTitle: {
    color: BG_ACCENT,
    fontFamily: BG_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  errorMessage: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    gap: 8,
    minHeight: 120,
  },
  statLabel: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  statValue: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
  },
  statMeta: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  calendarCard: {
    gap: 14,
  },
  sectionMeta: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 18,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekdayLabel: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
    width: '13%',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  emptyCell: {
    width: '13%',
  },
  dayCell: {
    alignItems: 'center',
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    width: '13%',
  },
  dayCellSelected: {
    borderColor: BG_ACCENT_LIGHT,
    borderWidth: 2,
  },
  dayLabel: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  legendRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  legendLabel: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  legendScale: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  legendCell: {
    borderRadius: 8,
    height: 14,
    width: 26,
  },
  detailCard: {
    gap: 6,
  },
  detailTitle: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  detailAmount: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 24,
    lineHeight: 30,
  },
  detailMeta: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
});
