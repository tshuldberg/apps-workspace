import { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, G, Line, Polyline, Text as SvgText } from 'react-native-svg';
import {
  GlassCard,
  HabitRow,
  HeatmapCalendar,
  MaterialSymbol,
  SectionHeader,
  StatTile,
  getAllFocusSessions,
  getAreas,
  getCompletions,
  getHabits,
  getMeasurementsForHabit,
  getMeasurableStreaks,
  getNegativeStreaks,
  getSessionsForHabit,
  getStreaks,
  type Area,
  type Habit,
  HB_ACCENT,
  HB_ACCENT_LIGHT,
  HB_AREAS,
  HB_SURFACES,
  HB_TEXT,
  HB_TEXT_SECONDARY,
  HB_TEXT_TERTIARY,
  HB_TYPOGRAPHY,
  withAlpha,
} from '@mylife/habits';
import {
  EmptyGlassState,
  FilterChip,
  resolveAreaColor,
  resolveAreaIcon,
} from '../../../components/habits/phase1-shared';
import { useDatabase } from '../../../components/DatabaseProvider';

type PeriodKey = '7d' | '30d' | '90d' | '1y' | 'all';

const PERIODS: Array<{ key: PeriodKey; label: string }> = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: '1y', label: '1y' },
  { key: 'all', label: 'All' },
];

const DAY_MAP = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
} as const;

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDateKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function buildDateKeys(from: Date, to: Date) {
  const dates: string[] = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    dates.push(toDateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isDueOnDate(habit: Habit, date: Date) {
  const dateKey = toDateKey(date);
  if (habit.startDate && dateKey < habit.startDate) return false;
  if (habit.endDate && dateKey > habit.endDate) return false;

  const dayOfWeek = DAY_MAP[date.getUTCDay() as keyof typeof DAY_MAP];

  if (habit.frequency === 'daily') return true;
  if (habit.frequency === 'specific_days' && habit.specificDays) {
    return habit.specificDays.includes(dayOfWeek);
  }
  if (habit.frequency === 'weekly') return dayOfWeek === 'mon';
  if (habit.frequency === 'monthly') return date.getUTCDate() === 1;
  return true;
}

function getHabitStreakMetrics(
  db: ReturnType<typeof useDatabase>,
  habit: Habit,
) {
  if (habit.habitType === 'measurable') {
    return getMeasurableStreaks(db, habit.id, habit.gracePeriod);
  }
  if (habit.habitType === 'negative') {
    const metrics = getNegativeStreaks(db, habit.id);
    return {
      currentStreak: metrics.daysSinceLastSlip,
      longestStreak: metrics.longestCleanStreak,
    };
  }
  return getStreaks(db, habit.id);
}

function rangeForPeriod(period: PeriodKey, habits: Habit[]) {
  const today = parseDateKey(toDateKey(new Date()));
  if (period === '7d') return { from: addDays(today, -6), to: today };
  if (period === '30d') return { from: addDays(today, -29), to: today };
  if (period === '90d') return { from: addDays(today, -89), to: today };
  if (period === '1y') return { from: addDays(today, -364), to: today };

  const earliestCreated = habits
    .map((habit) => habit.createdAt.slice(0, 10))
    .sort()[0];

  return {
    from: earliestCreated ? parseDateKey(earliestCreated) : today,
    to: today,
  };
}

function formatDateLabel(dateKey: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(parseDateKey(dateKey));
}

function formatHours(value: number) {
  return `${value.toFixed(value >= 10 ? 0 : 1)}h`;
}

function CompletionTrendChart({
  points,
  target = 0.8,
}: {
  points: Array<{ date: string; rate: number }>;
  target?: number;
}) {
  const width = 320;
  const height = 140;
  const pad = 16;

  if (points.length === 0) {
    return <View style={{ minHeight: height }} />;
  }

  const coords = points.map((point, index) => {
    const x = pad + ((width - pad * 2) / Math.max(points.length - 1, 1)) * index;
    const y = height - pad - clamp(point.rate, 0, 1) * (height - pad * 2);
    return `${x},${y}`;
  }).join(' ');

  const targetY = height - pad - clamp(target, 0, 1) * (height - pad * 2);

  return (
    <Svg height={height} viewBox={`0 0 ${width} ${height}`} width="100%">
      <Line
        stroke={withAlpha(HB_TEXT_TERTIARY, 0.32)}
        strokeDasharray="6 6"
        strokeWidth={2}
        x1={pad}
        x2={width - pad}
        y1={targetY}
        y2={targetY}
      />
      <Polyline
        fill="none"
        points={coords}
        stroke={HB_ACCENT_LIGHT}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={4}
      />
      {points.map((point, index) => {
        const x = pad + ((width - pad * 2) / Math.max(points.length - 1, 1)) * index;
        const y = height - pad - clamp(point.rate, 0, 1) * (height - pad * 2);
        return (
          <Circle
            key={point.date}
            cx={x}
            cy={y}
            fill={HB_SURFACES.lowest}
            r={4}
            stroke={HB_ACCENT}
            strokeWidth={3}
          />
        );
      })}
    </Svg>
  );
}

function AreaDonutChart({
  segments,
}: {
  segments: Array<{ label: string; color: string; count: number; share: number }>;
}) {
  const size = 150;
  const radius = 48;
  const strokeWidth = 18;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <View style={styles.donutWrap}>
      <Svg height={size} viewBox={`0 0 ${size} ${size}`} width={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={withAlpha(HB_TEXT_TERTIARY, 0.16)}
          strokeWidth={strokeWidth}
        />
        {segments.map((segment) => {
          const dash = circumference * segment.share;
          const circle = (
            <Circle
              key={segment.label}
              cx={size / 2}
              cy={size / 2}
              fill="none"
              origin={`${size / 2}, ${size / 2}`}
              r={radius}
              rotation="-90"
              stroke={segment.color}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              strokeWidth={strokeWidth}
            />
          );
          offset += dash;
          return circle;
        })}
        <G>
          <SvgText
            fill={HB_TEXT}
            fontFamily={HB_TYPOGRAPHY.headlineMd.fontFamily}
            fontSize="18"
            fontWeight="700"
            textAnchor="middle"
            x={size / 2}
            y={size / 2 - 4}
          >
            {segments.reduce((sum, segment) => sum + segment.count, 0)}
          </SvgText>
          <SvgText
            fill={HB_TEXT_SECONDARY}
            fontFamily={HB_TYPOGRAPHY.bodyMd.fontFamily}
            fontSize="10"
            textAnchor="middle"
            x={size / 2}
            y={size / 2 + 14}
          >
            completions
          </SvgText>
        </G>
      </Svg>
    </View>
  );
}

export default function HabitsStatsScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState<{ date: string; count: number; habits: string[] } | null>(null);

  const screenState = useMemo(() => {
    try {
      const habits = getHabits(db, { isArchived: false });
      const areas = getAreas(db);
      const areasById = new Map(areas.map((area) => [area.id, area]));
      const range = rangeForPeriod(period, habits);
      const fromKey = toDateKey(range.from);
      const toKey = toDateKey(range.to);
      const dateKeys = buildDateKeys(range.from, range.to);

      const accumulateRange = (startKey: string, endKey: string) => {
        const eventCounts = new Map<string, number>();
        const habitNamesByDay = new Map<string, Set<string>>();
        const successDaysByHabit = new Map<string, Set<string>>();
        const areaCounts = new Map<string, { label: string; color: string; count: number }>();
        let totalEvents = 0;

        const incrementDay = (habit: Habit, dateKey: string) => {
          eventCounts.set(dateKey, (eventCounts.get(dateKey) ?? 0) + 1);
          totalEvents += 1;

          const names = habitNamesByDay.get(dateKey) ?? new Set<string>();
          names.add(habit.name);
          habitNamesByDay.set(dateKey, names);

          const successDays = successDaysByHabit.get(habit.id) ?? new Set<string>();
          successDays.add(dateKey);
          successDaysByHabit.set(habit.id, successDays);

          const area = habit.areaId ? areasById.get(habit.areaId) ?? null : null;
          const label = area?.name ?? 'Other';
          const color = resolveAreaColor(area?.name ?? label, area?.color ?? HB_AREAS.other);
          areaCounts.set(label, {
            label,
            color,
            count: (areaCounts.get(label)?.count ?? 0) + 1,
          });
        };

        for (const habit of habits) {
          const completions = getCompletions(db, habit.id, {
            from: startKey,
            limit: 5000,
            to: `${endKey}T23:59:59.999Z`,
          }).filter((completion) => completion.value == null || completion.value >= 0);

          const measurements = getMeasurementsForHabit(db, habit.id, {
            from: startKey,
            to: `${endKey}T23:59:59.999Z`,
          }).filter((measurement) => measurement.value >= measurement.target);

          const sessions = getSessionsForHabit(db, habit.id, {
            from: startKey,
            to: `${endKey}T23:59:59.999Z`,
          }).filter((session) => session.completed);

          completions.forEach((completion) => incrementDay(habit, completion.completedAt.slice(0, 10)));
          measurements.forEach((measurement) => incrementDay(habit, measurement.measuredAt.slice(0, 10)));
          sessions.forEach((session) => incrementDay(habit, session.startedAt.slice(0, 10)));
        }

        return {
          eventCounts,
          habitNamesByDay,
          successDaysByHabit,
          areaCounts,
          totalEvents,
        };
      };

      const selectedRange = accumulateRange(fromKey, toKey);
      const heatmapTo = toDateKey(new Date());
      const heatmapFrom = toDateKey(addDays(parseDateKey(heatmapTo), -364));
      const heatmapRange = accumulateRange(heatmapFrom, heatmapTo);
      const heatmapDates = buildDateKeys(parseDateKey(heatmapFrom), parseDateKey(heatmapTo));
      const heatmapData = heatmapDates.map((date) => ({
        date,
        value: heatmapRange.eventCounts.get(date) ?? 0,
      }));

      const performance = habits.map((habit) => {
        const area = habit.areaId ? areasById.get(habit.areaId) ?? null : null;
        const successDays = selectedRange.successDaysByHabit.get(habit.id) ?? new Set<string>();
        const dueDates = dateKeys.filter((dateKey) => habit.habitType !== 'negative' && isDueOnDate(habit, parseDateKey(dateKey)));
        const dueCount = dueDates.length;
        const successCount = dueDates.filter((dateKey) => successDays.has(dateKey)).length;
        const streak = getHabitStreakMetrics(db, habit);

        return {
          habit,
          area,
          dueCount,
          successCount,
          successDays,
          currentStreak: streak.currentStreak,
          longestStreak: streak.longestStreak,
          successRate: dueCount > 0 ? successCount / dueCount : 0,
        };
      });

      const totalDue = performance.reduce((sum, item) => sum + item.dueCount, 0);
      const totalSuccessfulDays = performance.reduce((sum, item) => sum + item.successCount, 0);
      const completionRate = totalDue > 0 ? totalSuccessfulDays / totalDue : 0;
      const longestStreak = performance.reduce((max, item) => Math.max(max, item.longestStreak), 0);
      const dailyRates = dateKeys.map((dateKey) => {
        const due = habits.filter((habit) => habit.habitType !== 'negative' && isDueOnDate(habit, parseDateKey(dateKey))).length;
        const done = performance.reduce((sum, item) => sum + (item.successDays.has(dateKey) ? 1 : 0), 0);
        return {
          date: dateKey,
          rate: due > 0 ? done / due : 0,
        };
      });

      const areaBreakdown = Array.from(selectedRange.areaCounts.values())
        .sort((left, right) => right.count - left.count)
        .map((segment) => ({
          ...segment,
          share: selectedRange.totalEvents > 0 ? segment.count / selectedRange.totalEvents : 0,
        }));

      const topHabits = [...performance]
        .sort((left, right) => right.currentStreak - left.currentStreak || left.habit.name.localeCompare(right.habit.name))
        .slice(0, 5);

      const strugglingHabits = [...performance]
        .filter((item) => item.dueCount >= 3 && item.successRate < 0.55)
        .sort((left, right) => left.successRate - right.successRate || left.habit.name.localeCompare(right.habit.name))
        .slice(0, 5);

      const focusSessions = getAllFocusSessions(db, { from: fromKey })
        .filter((session) => session.startedAt.slice(0, 10) <= toKey);
      const focusHours = focusSessions.reduce((sum, session) => sum + session.totalFocusSeconds / 3600, 0);

      const overallAverage = dateKeys.length > 0 ? selectedRange.totalEvents / dateKeys.length : 0;

      return {
        error: null as string | null,
        habits,
        performance,
        areasById,
        completionRate,
        totalEvents: selectedRange.totalEvents,
        longestStreak,
        activeHabits: habits.length,
        heatmapData,
        heatmapHabitNamesByDay: heatmapRange.habitNamesByDay,
        dailyRates,
        areaBreakdown,
        topHabits,
        strugglingHabits,
        focusHours,
        focusSessionsCount: focusSessions.length,
        overallAverage,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Could not load stats.',
        habits: [] as Habit[],
        performance: [] as Array<{
          habit: Habit;
          area: Area | null;
          dueCount: number;
          successCount: number;
          successDays: Set<string>;
          currentStreak: number;
          longestStreak: number;
          successRate: number;
        }>,
        areasById: new Map<string, Area>(),
        completionRate: 0,
        totalEvents: 0,
        longestStreak: 0,
        activeHabits: 0,
        heatmapData: [] as Array<{ date: string; value: number }>,
        heatmapHabitNamesByDay: new Map<string, Set<string>>(),
        dailyRates: [] as Array<{ date: string; rate: number }>,
        areaBreakdown: [] as Array<{ label: string; color: string; count: number; share: number }>,
        topHabits: [] as Array<{
          habit: Habit;
          area: Area | null;
          dueCount: number;
          successCount: number;
          successDays: Set<string>;
          currentStreak: number;
          longestStreak: number;
          successRate: number;
        }>,
        strugglingHabits: [] as Array<{
          habit: Habit;
          area: Area | null;
          dueCount: number;
          successCount: number;
          successDays: Set<string>;
          currentStreak: number;
          longestStreak: number;
          successRate: number;
        }>,
        focusHours: 0,
        focusSessionsCount: 0,
        overallAverage: 0,
      };
    }
  }, [db, period, refreshKey]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((value) => value + 1);
    setTimeout(() => setRefreshing(false), 160);
  }, []);

  if (screenState.error) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <EmptyGlassState
            title="Stats are unavailable"
            message={screenState.error}
            actionLabel="Refresh"
            onPress={onRefresh}
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={HB_ACCENT_LIGHT} />}
      >
        <GlassCard level={1} contentStyle={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Performance analytics</Text>
          <Text style={styles.heroTitle}>Stats</Text>
          <Text style={styles.heroSubtitle}>
            Heatmaps, rhythm shifts, and area momentum for the habits that actually move your week.
          </Text>
        </GlassCard>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodRail}>
          {PERIODS.map((option) => (
            <FilterChip
              key={option.key}
              label={option.label}
              onPress={() => setPeriod(option.key)}
              selected={period === option.key}
            />
          ))}
        </ScrollView>

        <View style={styles.summaryGrid}>
          <StatTile color={HB_ACCENT_LIGHT} icon="check_circle" label="Completions" value={screenState.totalEvents} />
          <StatTile color={HB_ACCENT} icon="bar_chart" label="Rate" value={`${Math.round(screenState.completionRate * 100)}%`} />
          <StatTile color={HB_AREAS.social} icon="local_fire_department" label="Longest" value={screenState.longestStreak} />
          <StatTile color={HB_AREAS.learning} icon="list_alt" label="Active" value={screenState.activeHabits} />
        </View>

        <GlassCard level={1} contentStyle={styles.card}>
          <SectionHeader title="Completion heatmap" />
          <Text style={styles.cardCaption}>Tap a day to see which habits landed. Violet intensity scales with daily volume.</Text>
          <HeatmapCalendar
            data={screenState.heatmapData}
            months={12}
            onDayPress={(day) => {
              setSelectedDay({
                date: day.date,
                count: day.value,
                habits: Array.from(screenState.heatmapHabitNamesByDay.get(day.date) ?? []),
              });
            }}
          />
        </GlassCard>

        <GlassCard level={1} contentStyle={styles.card}>
          <SectionHeader title="Completion trend" />
          <Text style={styles.cardCaption}>Daily completion rate against an 80% target line.</Text>
          <CompletionTrendChart points={screenState.dailyRates} />
        </GlassCard>

        <GlassCard level={1} contentStyle={styles.card}>
          <SectionHeader title="Area breakdown" />
          <Text style={styles.cardCaption}>Where your successful reps are concentrating right now.</Text>
          <AreaDonutChart segments={screenState.areaBreakdown.slice(0, 6)} />
          <View style={styles.legendList}>
            {screenState.areaBreakdown.map((segment) => (
              <View key={segment.label} style={styles.legendRow}>
                <View style={styles.legendCopy}>
                  <View style={[styles.legendDot, { backgroundColor: segment.color }]} />
                  <Text style={styles.legendLabel}>{segment.label}</Text>
                </View>
                <Text style={styles.legendValue}>
                  {segment.count} • {Math.round(segment.share * 100)}%
                </Text>
              </View>
            ))}
          </View>
        </GlassCard>

        <GlassCard level={1} contentStyle={styles.card}>
          <SectionHeader title="Top habits" />
          <View style={styles.rowList}>
            {screenState.topHabits.map((item) => (
              <HabitRow
                key={item.habit.id}
                area={item.area ? { name: item.area.name, color: resolveAreaColor(item.area.name, item.area.color), icon: resolveAreaIcon(item.area.name, item.area.icon) } : null}
                checked={false}
                habit={item.habit}
                onPress={() => router.push(`/(habits)/${item.habit.id}`)}
                showArea={item.area != null}
                streakCount={item.currentStreak}
              />
            ))}
          </View>
        </GlassCard>

        <GlassCard level={1} contentStyle={styles.card}>
          <SectionHeader title="Struggling habits" />
          <View style={styles.struggleList}>
            {screenState.strugglingHabits.length === 0 ? (
              <Text style={styles.supportingText}>No obvious strugglers in this period. Keep the tempo steady.</Text>
            ) : (
              screenState.strugglingHabits.map((item) => (
                <View key={item.habit.id} style={styles.struggleRow}>
                  <View style={styles.struggleCopy}>
                    <Text style={styles.struggleTitle}>{item.habit.name}</Text>
                    <Text style={styles.struggleCaption}>
                      {Math.round(item.successRate * 100)}% success over {item.dueCount} due windows
                    </Text>
                  </View>
                  <Text style={styles.struggleAdvice}>
                    {item.habit.timeOfDay === 'anytime'
                      ? 'Give it a fixed slot.'
                      : `Protect the ${item.habit.timeOfDay} window.`}
                  </Text>
                </View>
              ))
            )}
          </View>
        </GlassCard>

        {screenState.focusSessionsCount > 0 ? (
          <Pressable onPress={() => router.push('/(habits)/time-reports')}>
            <GlassCard level={1} contentStyle={styles.linkCard}>
              <View>
                <Text style={styles.linkTitle}>Time tracking</Text>
                <Text style={styles.linkBody}>
                  {formatHours(screenState.focusHours)} of focused time across {screenState.focusSessionsCount} sessions.
                </Text>
              </View>
              <MaterialSymbol color={HB_ACCENT_LIGHT} name="chevron_right" size={18} />
            </GlassCard>
          </Pressable>
        ) : null}
      </ScrollView>

      <Modal animationType="fade" transparent visible={selectedDay != null} onRequestClose={() => setSelectedDay(null)}>
        <Pressable onPress={() => setSelectedDay(null)} style={styles.modalBackdrop}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.modalCardWrap}>
            <GlassCard level={3} contentStyle={styles.modalCard}>
              <Text style={styles.modalTitle}>{selectedDay ? formatDateLabel(selectedDay.date) : ''}</Text>
              <Text style={styles.modalCaption}>
                {selectedDay?.count ?? 0} completion{selectedDay?.count === 1 ? '' : 's'}
              </Text>
              <View style={styles.modalHabitList}>
                {(selectedDay?.habits ?? []).length === 0 ? (
                  <Text style={styles.supportingText}>No completed habits on this date.</Text>
                ) : (
                  (selectedDay?.habits ?? []).map((habitName) => (
                    <View key={habitName} style={styles.modalHabitRow}>
                      <RectFill />
                      <Text style={styles.modalHabitName}>{habitName}</Text>
                    </View>
                  ))
                )}
              </View>
            </GlassCard>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function RectFill() {
  return <View style={styles.modalHabitDot} />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HB_SURFACES.lowest,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 136,
    gap: 16,
  },
  heroCard: {
    gap: 10,
  },
  heroEyebrow: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_ACCENT_LIGHT,
    fontSize: 10,
    lineHeight: 12,
  },
  heroTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
    fontSize: 34,
    lineHeight: 38,
  },
  heroSubtitle: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  periodRail: {
    gap: 10,
    paddingRight: 8,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    gap: 12,
  },
  cardCaption: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_TERTIARY,
    fontSize: 12,
    lineHeight: 17,
  },
  donutWrap: {
    alignItems: 'center',
    marginVertical: 8,
  },
  legendList: {
    gap: 10,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  legendCopy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT,
  },
  legendValue: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_TERTIARY,
    fontSize: 12,
    lineHeight: 16,
  },
  rowList: {
    gap: 10,
  },
  struggleList: {
    gap: 12,
  },
  struggleRow: {
    borderRadius: 18,
    backgroundColor: HB_SURFACES.low,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  struggleCopy: {
    gap: 3,
  },
  struggleTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
    fontSize: 16,
    lineHeight: 20,
  },
  struggleCaption: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 16,
  },
  struggleAdvice: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_ACCENT_LIGHT,
    fontSize: 12,
    lineHeight: 16,
  },
  supportingText: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  linkTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
    fontSize: 18,
    lineHeight: 22,
  },
  linkBody: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    marginTop: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: withAlpha('#000000', 0.7),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalCardWrap: {
    width: '100%',
  },
  modalCard: {
    gap: 10,
  },
  modalTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
    fontSize: 24,
    lineHeight: 28,
  },
  modalCaption: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  modalHabitList: {
    gap: 8,
  },
  modalHabitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalHabitDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: HB_ACCENT_LIGHT,
  },
  modalHabitName: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT,
  },
});
