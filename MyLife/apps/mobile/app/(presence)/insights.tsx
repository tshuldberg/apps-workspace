// pr_app_usage only stores day-level totals today, so the heatmap below approximates peak hours
// from focus-session start times until a finer-grained hourly usage table lands.
import React, { useCallback, useMemo, useState } from 'react';
import {
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Line, Polyline, Rect } from 'react-native-svg';
import {
  buildBadgeStatsSnapshotFromData,
  buildWeeklySummary,
  calculateStreaks,
  computeEarnedBadges,
  generatePresenceInsights,
  getDailyUsageRange,
  getFocusSessions,
  getXPLog,
  GlassPanel,
  MaterialSymbol,
  PR_ACCENT_GLOW,
  PR_ACCENT_LIGHT,
  PR_CYAN_GLOW_STYLE,
  PR_FONTS,
  PR_SURFACES,
  PR_TEXT,
  PR_TEXT_SECONDARY,
  PR_TEXT_TERTIARY,
  PR_TYPOGRAPHY,
  SectionHeader,
  TrendBars,
  type DailyUsage,
  type FocusSession,
  type Insight,
  type XPEntry,
} from '@mylife/presence';
import { useDatabase } from '../../components/DatabaseProvider';

type LoadedState = {
  dailyUsage: DailyUsage[];
  sessions: FocusSession[];
  xpLog: XPEntry[];
  errorMessage: string | null;
};

type HeatmapCell = {
  id: string;
  dayIndex: number;
  hour: number;
  averageMinutes: number;
};

type StreakRun = {
  id: string;
  startDate: string;
  endDate: string;
  days: number;
  current: boolean;
};

type WeeklyCard = {
  id: string;
  weekStart: string;
  weekEnd: string;
  totalMinutes: number;
  averageMinutes: number;
  sessions: number;
  xpEarned: number;
  badgesUnlocked: number;
  daysMetGoal: number;
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const CHART_WIDTH = Math.max(Dimensions.get('window').width - 92, 260);
const CHART_HEIGHT = 144;
const HEATMAP_CELL_SIZE = 10;
const HEATMAP_GAP = 3;
const HEATMAP_WIDTH = 24 * HEATMAP_CELL_SIZE + 23 * HEATMAP_GAP;
const HEATMAP_HEIGHT = 7 * HEATMAP_CELL_SIZE + 6 * HEATMAP_GAP;

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoDateDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function sortDailyAscending(records: DailyUsage[]): DailyUsage[] {
  return [...records].sort((left, right) => left.date.localeCompare(right.date));
}

function findLatestGoalMinutes(records: DailyUsage[]): number {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const goalMinutes = records[index]?.goal_minutes;
    if (goalMinutes != null) {
      return goalMinutes;
    }
  }
  return 180;
}

function getWeekStart(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() - date.getDay());
  return date.toISOString().slice(0, 10);
}

function formatWeekLabel(weekStart: string, weekEnd: string): string {
  const start = new Date(`${weekStart}T00:00:00`);
  const end = new Date(`${weekEnd}T00:00:00`);
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function parseMinutesFromTime(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const source = value.includes('T') ? value : `1970-01-01T${value}`;
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.getHours() * 60 + date.getMinutes();
}

function formatClockTime(totalMinutes: number | null): string {
  if (totalMinutes == null) {
    return 'Not enough data';
  }

  const rounded = Math.round(totalMinutes);
  const hours = Math.floor(rounded / 60) % 24;
  const minutes = rounded % 60;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function averagePickupTime(records: DailyUsage[], key: 'first_pickup' | 'last_pickup'): number | null {
  const values = records.map((record) => parseMinutesFromTime(record[key])).filter((value): value is number => value != null);
  if (values.length === 0) {
    return null;
  }
  return average(values);
}

function buildTrendDirection(records: DailyUsage[]): { label: string; tone: 'positive' | 'neutral' | 'warning' } {
  const sorted = sortDailyAscending(records).slice(-30);
  if (sorted.length < 2) {
    return { label: 'Need more data', tone: 'neutral' };
  }

  const xAverage = (sorted.length - 1) / 2;
  const yAverage = average(sorted.map((record) => record.total_minutes));
  let numerator = 0;
  let denominator = 0;

  sorted.forEach((record, index) => {
    numerator += (index - xAverage) * (record.total_minutes - yAverage);
    denominator += (index - xAverage) ** 2;
  });

  const slope = denominator === 0 ? 0 : numerator / denominator;
  if (slope <= -2) {
    return { label: 'Improving', tone: 'positive' };
  }
  if (slope >= 2) {
    return { label: 'Regressing', tone: 'warning' };
  }
  return { label: 'Steady', tone: 'neutral' };
}

function buildLinePoints(records: DailyUsage[], goalMinutes: number): { points: string; maxValue: number } {
  const sorted = sortDailyAscending(records).slice(-30);
  const maxValue = Math.max(goalMinutes, ...sorted.map((record) => record.total_minutes), 1);
  const xStep = sorted.length <= 1 ? CHART_WIDTH : CHART_WIDTH / (sorted.length - 1);
  const points = sorted.map((record, index) => {
    const x = index * xStep;
    const y = CHART_HEIGHT - (record.total_minutes / maxValue) * CHART_HEIGHT;
    return `${x},${Math.max(8, y)}`;
  }).join(' ');

  return { points, maxValue };
}

function buildHeatmapCells(sessions: FocusSession[], trackedDays: number): HeatmapCell[] {
  const totals = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  const completed = sessions.filter((session) => session.completed === 1);
  const trackedWeeks = Math.max(1, Math.ceil(Math.max(trackedDays, 7) / 7));

  completed.forEach((session) => {
    const date = new Date(session.start_time);
    totals[date.getDay()][date.getHours()] += session.actual_minutes ?? session.planned_minutes;
  });

  return totals.flatMap((row, dayIndex) =>
    row.map((minutes, hour) => ({
      id: `${dayIndex}-${hour}`,
      dayIndex,
      hour,
      averageMinutes: Math.round(minutes / trackedWeeks),
    })),
  );
}

function buildStreakRuns(records: DailyUsage[]): StreakRun[] {
  const ascending = sortDailyAscending(records);
  const runs: StreakRun[] = [];
  let currentRunStart: string | null = null;
  let currentRunDays = 0;

  ascending.forEach((record, index) => {
    if (record.goal_met === 1) {
      currentRunStart ??= record.date;
      currentRunDays += 1;
    }

    const nextRecord = ascending[index + 1];
    const runEndsHere = record.goal_met !== 1 || nextRecord == null || nextRecord.goal_met !== 1;
    if (record.goal_met === 1 && runEndsHere && currentRunStart != null) {
      runs.push({
        id: `${currentRunStart}-${record.date}`,
        startDate: currentRunStart,
        endDate: record.date,
        days: currentRunDays,
        current: nextRecord == null,
      });
      currentRunStart = null;
      currentRunDays = 0;
    }
  });

  return runs.sort((left, right) => right.endDate.localeCompare(left.endDate)).slice(0, 5);
}

function buildWeeklyCards(dailyUsage: DailyUsage[], sessions: FocusSession[], xpLog: XPEntry[]): WeeklyCard[] {
  const byWeek = new Map<string, DailyUsage[]>();
  sortDailyAscending(dailyUsage).forEach((record) => {
    const weekStart = getWeekStart(record.date);
    byWeek.set(weekStart, [...(byWeek.get(weekStart) ?? []), record]);
  });

  let previousBadgeCount = 0;
  const chronologicalWeeks = [...byWeek.entries()].sort((left, right) => left[0].localeCompare(right[0]));

  return chronologicalWeeks.map(([weekStart, records]) => {
    const weekEnd = records[records.length - 1]?.date ?? weekStart;
    const summary = buildWeeklySummary(records, weekStart);
    const weekSessions = sessions.filter((session) => {
      const date = session.start_time.slice(0, 10);
      return date >= weekStart && date <= weekEnd && session.completed === 1;
    });
    const xpEarned = xpLog
      .filter((entry) => entry.date >= weekStart && entry.date <= weekEnd)
      .reduce((sum, entry) => sum + entry.amount, 0);

    const cumulativeDaily = dailyUsage.filter((record) => record.date <= weekEnd);
    const cumulativeSessions = sessions.filter((session) => session.start_time.slice(0, 10) <= weekEnd);
    const cumulativeXP = xpLog
      .filter((entry) => entry.date <= weekEnd)
      .reduce((sum, entry) => sum + entry.amount, 0);
    const badgeStats = buildBadgeStatsSnapshotFromData({
      dailyUsage: cumulativeDaily,
      sessions: cumulativeSessions,
      totalXP: cumulativeXP,
    });
    const badgeCount = computeEarnedBadges(badgeStats).length;
    const badgesUnlocked = Math.max(0, badgeCount - previousBadgeCount);
    previousBadgeCount = badgeCount;

    return {
      id: weekStart,
      weekStart,
      weekEnd,
      totalMinutes: summary.totalMinutes,
      averageMinutes: summary.averageMinutes,
      sessions: weekSessions.length,
      xpEarned,
      badgesUnlocked,
      daysMetGoal: summary.daysMetGoal,
    };
  }).reverse();
}

function getToneColor(tone: 'positive' | 'neutral' | 'warning'): string {
  if (tone === 'positive') {
    return '#30D158';
  }
  if (tone === 'warning') {
    return '#FFB877';
  }
  return PR_TEXT_TERTIARY;
}

export default function PresenceInsightsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [expandedWeekId, setExpandedWeekId] = useState<string | null>(null);
  const [selectedHeatmapId, setSelectedHeatmapId] = useState<string | null>(null);

  const [data, setData] = useState<LoadedState>(() => {
    try {
      return {
        dailyUsage: getDailyUsageRange(db, isoDateDaysAgo(119), todayString(), 400),
        sessions: getFocusSessions(db, 500),
        xpLog: getXPLog(db, 500),
        errorMessage: null,
      };
    } catch (error) {
      console.error('Failed to load presence insights', error);
      return {
        dailyUsage: [],
        sessions: [],
        xpLog: [],
        errorMessage: 'We could not load your presence insights right now.',
      };
    }
  });

  const refreshData = useCallback(() => {
    setRefreshing(true);
    try {
      setData({
        dailyUsage: getDailyUsageRange(db, isoDateDaysAgo(119), todayString(), 400),
        sessions: getFocusSessions(db, 500),
        xpLog: getXPLog(db, 500),
        errorMessage: null,
      });
    } catch (error) {
      console.error('Failed to refresh presence insights', error);
      setData((current) => ({
        ...current,
        errorMessage: 'Refresh failed. Pull again in a moment.',
      }));
    } finally {
      setRefreshing(false);
    }
  }, [db]);

  const sortedDaily = useMemo(() => sortDailyAscending(data.dailyUsage), [data.dailyUsage]);
  const trendRecords = sortedDaily.slice(-30);
  const goalMinutes = useMemo(
    () => findLatestGoalMinutes(trendRecords),
    [trendRecords],
  );
  const trendDirection = useMemo(() => buildTrendDirection(trendRecords), [trendRecords]);
  const lineChart = useMemo(() => buildLinePoints(trendRecords, goalMinutes), [goalMinutes, trendRecords]);
  const trackedDays = sortedDaily.length;
  const notEnoughData = trackedDays < 7;
  const heatmapCells = useMemo(() => buildHeatmapCells(data.sessions, trackedDays), [data.sessions, trackedDays]);
  const peakHeatmapCell = useMemo(
    () => [...heatmapCells]
      .filter((cell) => cell.averageMinutes > 0)
      .sort((left, right) => right.averageMinutes - left.averageMinutes)[0] ?? null,
    [heatmapCells],
  );
  const selectedHeatmapCell = useMemo(
    () => heatmapCells.find((cell) => cell.id === selectedHeatmapId) ?? peakHeatmapCell,
    [heatmapCells, peakHeatmapCell, selectedHeatmapId],
  );
  const heatmapMax = Math.max(1, ...heatmapCells.map((cell) => cell.averageMinutes));
  const pickupData = sortedDaily.slice(-14);
  const firstPickupAverage = useMemo(() => averagePickupTime(sortedDaily, 'first_pickup'), [sortedDaily]);
  const lastPickupAverage = useMemo(() => averagePickupTime(sortedDaily, 'last_pickup'), [sortedDaily]);
  const streaks = useMemo(() => calculateStreaks(sortedDaily), [sortedDaily]);
  const streakRuns = useMemo(() => buildStreakRuns(sortedDaily), [sortedDaily]);
  const weeklyCards = useMemo(
    () => buildWeeklyCards(sortedDaily, data.sessions, data.xpLog),
    [data.sessions, data.xpLog, sortedDaily],
  );
  const generatedInsights = useMemo<Insight[]>(
    () => generatePresenceInsights(sortedDaily, data.sessions),
    [data.sessions, sortedDaily],
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshData} tintColor={PR_ACCENT_LIGHT} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable style={styles.iconButton} onPress={() => router.back()}>
            <MaterialSymbol name="arrow_back" size={22} color={PR_TEXT} />
          </Pressable>
          <Text style={styles.topBarTitle}>Insights</Text>
          <Pressable style={styles.iconButton} onPress={() => router.push('/(presence)/settings' as never)}>
            <MaterialSymbol name="settings" size={20} color={PR_TEXT} />
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Patterns</Text>
          <Text style={styles.heroTitle}>Your Insights</Text>
          <Text style={styles.heroCopy}>
            Where your attention slips, where it steadies, and what the recent data suggests you should protect next.
          </Text>
        </View>

        {data.errorMessage ? (
          <GlassPanel padding={18} style={styles.errorCard}>
            <Text style={styles.errorTitle}>Insights unavailable</Text>
            <Text style={styles.errorCopy}>{data.errorMessage}</Text>
          </GlassPanel>
        ) : null}

        {notEnoughData ? (
          <GlassPanel padding={20} style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Keep tracking for a few more days</Text>
            <Text style={styles.emptyCopy}>
              MyPresence needs at least 7 tracked days to build the trend line, heatmap, and weekly comparison stack for this screen.
            </Text>
          </GlassPanel>
        ) : (
          <>
            <GlassPanel padding={20} style={styles.panel}>
              <Text style={styles.cardLabel}>30-Day Trend</Text>
              <View style={styles.panelHeaderRow}>
                <Text style={styles.panelTitle}>Focus curve</Text>
                <View style={[styles.statusPill, { backgroundColor: `${getToneColor(trendDirection.tone)}1A` }]}>
                  <Text style={[styles.statusText, { color: getToneColor(trendDirection.tone) }]}>{trendDirection.label}</Text>
                </View>
              </View>
              <Svg width={CHART_WIDTH} height={CHART_HEIGHT} style={{ marginTop: 16 }}>
                <Line
                  x1={0}
                  y1={CHART_HEIGHT - (goalMinutes / lineChart.maxValue) * CHART_HEIGHT}
                  x2={CHART_WIDTH}
                  y2={CHART_HEIGHT - (goalMinutes / lineChart.maxValue) * CHART_HEIGHT}
                  stroke="rgba(34, 211, 238, 0.24)"
                  strokeWidth={2}
                  strokeDasharray="6 6"
                />
                <Polyline
                  points={lineChart.points}
                  fill="none"
                  stroke={PR_ACCENT_GLOW}
                  strokeWidth={6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Polyline
                  points={lineChart.points}
                  fill="none"
                  stroke={PR_ACCENT_LIGHT}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
              <Text style={styles.chartCaption}>Goal line overlay uses your most recent daily target.</Text>
            </GlassPanel>

            <GlassPanel padding={20} style={styles.panel}>
              <Text style={styles.cardLabel}>Peak Usage Hours</Text>
              <Text style={styles.panelTitle}>Heatmap</Text>
              <View style={styles.heatmapWrap}>
                <View style={styles.dayLabels}>
                  {DAY_LABELS.map((label) => (
                    <Text key={label} style={styles.dayLabel}>
                      {label}
                    </Text>
                  ))}
                </View>
                <Svg width={HEATMAP_WIDTH} height={HEATMAP_HEIGHT}>
                  {heatmapCells.map((cell) => {
                    const x = cell.hour * (HEATMAP_CELL_SIZE + HEATMAP_GAP);
                    const y = cell.dayIndex * (HEATMAP_CELL_SIZE + HEATMAP_GAP);
                    const intensity = cell.averageMinutes / heatmapMax;
                    const fill = intensity === 0
                      ? 'rgba(255,255,255,0.04)'
                      : `rgba(34, 211, 238, ${0.16 + intensity * 0.72})`;
                    const isSelected = cell.id === selectedHeatmapCell?.id;
                    return (
                      <Rect
                        key={cell.id}
                        x={x}
                        y={y}
                        width={HEATMAP_CELL_SIZE}
                        height={HEATMAP_CELL_SIZE}
                        rx={3}
                        fill={fill}
                        stroke={isSelected ? PR_ACCENT_LIGHT : 'transparent'}
                        strokeWidth={isSelected ? 1.5 : 0}
                        onPress={() => setSelectedHeatmapId(cell.id)}
                      />
                    );
                  })}
                </Svg>
              </View>
              <Text style={styles.chartCaption}>Approximate from session data until hourly screen-time buckets exist.</Text>
              <Text style={styles.heatmapDetail}>
                {selectedHeatmapCell == null
                  ? 'No focus sessions yet, so the proxy heatmap is still empty.'
                  : `On ${FULL_DAY_NAMES[selectedHeatmapCell.dayIndex]}s around ${selectedHeatmapCell.hour === 0 ? '12 AM' : selectedHeatmapCell.hour < 12 ? `${selectedHeatmapCell.hour} AM` : selectedHeatmapCell.hour === 12 ? '12 PM' : `${selectedHeatmapCell.hour - 12} PM`} you average ${selectedHeatmapCell.averageMinutes} focus minutes.`}
              </Text>
            </GlassPanel>

            <GlassPanel padding={20} style={styles.panel}>
              <Text style={styles.cardLabel}>Pickup Frequency</Text>
              <Text style={styles.panelTitle}>Last 14 days</Text>
              <View style={{ marginTop: 12 }}>
                <TrendBars
                  data={pickupData.map((record, index) => ({
                    label: record.date.slice(5),
                    value: record.pickups ?? 0,
                    isToday: index === pickupData.length - 1,
                  }))}
                  height={72}
                />
              </View>
            </GlassPanel>

            <View style={styles.pickupRow}>
              <GlassPanel padding={18} style={styles.pickupCard}>
                <Text style={styles.cardLabel}>Morning Pickup</Text>
                <Text style={styles.pickupValue}>{formatClockTime(firstPickupAverage)}</Text>
              </GlassPanel>
              <GlassPanel padding={18} style={styles.pickupCard}>
                <Text style={styles.cardLabel}>Evening Pickdown</Text>
                <Text style={styles.pickupValue}>{formatClockTime(lastPickupAverage)}</Text>
              </GlassPanel>
            </View>

            <View style={styles.sectionBlock}>
              <SectionHeader
                title="Streak History"
                accent={PR_ACCENT_LIGHT}
                action={<Text style={styles.sectionMeta}>{`${streaks.current}d current · ${streaks.longest}d best`}</Text>}
              />
              <View style={styles.timeline}>
                {streakRuns.map((run) => {
                  const highlight = run.days === streaks.longest;
                  return (
                    <View key={run.id} style={styles.timelineRow}>
                      <View style={styles.timelineTrack}>
                        <View style={[styles.timelineDot, highlight && styles.timelineDotHighlight]} />
                        <View style={styles.timelineLine} />
                      </View>
                      <GlassPanel padding={16} style={[styles.timelineCard, highlight && styles.timelineCardHighlight]}>
                        <Text style={styles.timelineTitle}>{`${run.days} day${run.days === 1 ? '' : 's'}`}</Text>
                        <Text style={styles.timelineCopy}>
                          {formatWeekLabel(run.startDate, run.endDate)}
                          {run.current ? ' · current streak' : ''}
                        </Text>
                      </GlassPanel>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={styles.sectionBlock}>
              <SectionHeader title="Weekly Summaries" accent={PR_ACCENT_LIGHT} />
              <View style={styles.weeklyStack}>
                {weeklyCards.map((week) => {
                  const expanded = expandedWeekId === week.id;
                  return (
                    <Pressable
                      key={week.id}
                      onPress={() => setExpandedWeekId((current) => (current === week.id ? null : week.id))}
                    >
                      <GlassPanel padding={18} style={styles.weekCard}>
                        <View style={styles.weekHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.weekTitle}>{formatWeekLabel(week.weekStart, week.weekEnd)}</Text>
                            <Text style={styles.weekSubtitle}>{`${week.daysMetGoal} goal days`}</Text>
                          </View>
                          <Text style={styles.weekValue}>{`${week.averageMinutes}m avg`}</Text>
                        </View>
                        {expanded ? (
                          <View style={styles.weekDetailGrid}>
                            <View style={styles.weekDetailCard}>
                              <Text style={styles.weekDetailLabel}>Total</Text>
                              <Text style={styles.weekDetailValue}>{`${Math.round(week.totalMinutes / 60)}h`}</Text>
                            </View>
                            <View style={styles.weekDetailCard}>
                              <Text style={styles.weekDetailLabel}>Sessions</Text>
                              <Text style={styles.weekDetailValue}>{String(week.sessions)}</Text>
                            </View>
                            <View style={styles.weekDetailCard}>
                              <Text style={styles.weekDetailLabel}>XP</Text>
                              <Text style={styles.weekDetailValue}>{`+${week.xpEarned}`}</Text>
                            </View>
                            <View style={styles.weekDetailCard}>
                              <Text style={styles.weekDetailLabel}>Badges</Text>
                              <Text style={styles.weekDetailValue}>{String(week.badgesUnlocked)}</Text>
                            </View>
                          </View>
                        ) : null}
                      </GlassPanel>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.sectionBlock}>
              <SectionHeader title="For You" accent={PR_ACCENT_LIGHT} />
              <View style={styles.recommendationStack}>
                {generatedInsights.length === 0 ? (
                  <GlassPanel padding={18}>
                    <Text style={styles.emptyTitle}>No strong signal yet</Text>
                    <Text style={styles.emptyCopy}>
                      Once your trend and pickup patterns get more distinct, personalized tips will appear here.
                    </Text>
                  </GlassPanel>
                ) : (
                  generatedInsights.map((insight) => (
                    <GlassPanel key={insight.type} padding={18} style={styles.recommendationCard}>
                      <View style={styles.recommendationHeader}>
                        <View style={styles.recommendationIcon}>
                          <MaterialSymbol name="lightbulb" size={18} color={PR_ACCENT_LIGHT} />
                        </View>
                        <Text style={styles.recommendationTitle}>{insight.title}</Text>
                      </View>
                      <Text style={styles.recommendationBody}>{insight.body}</Text>
                      {insight.actionRoute ? (
                        <Pressable style={styles.actionButton} onPress={() => router.push(insight.actionRoute as never)}>
                          <Text style={styles.actionButtonText}>Open</Text>
                        </Pressable>
                      ) : null}
                    </GlassPanel>
                  ))
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PR_SURFACES.lowest,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 120,
    gap: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarTitle: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  hero: {
    gap: 8,
  },
  eyebrow: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_ACCENT_LIGHT,
  },
  heroTitle: {
    fontFamily: PR_FONTS.extraBold,
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -1.1,
    color: PR_TEXT,
    ...PR_CYAN_GLOW_STYLE,
  },
  heroCopy: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
    maxWidth: 320,
  },
  errorCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  errorTitle: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
    marginBottom: 6,
  },
  errorCopy: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
  },
  emptyCard: {
    gap: 10,
  },
  emptyTitle: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  emptyCopy: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
  },
  panel: {
    gap: 10,
  },
  cardLabel: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_TEXT_TERTIARY,
  },
  panelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  panelTitle: {
    ...PR_TYPOGRAPHY.headlineMd,
    color: PR_TEXT,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: {
    ...PR_TYPOGRAPHY.labelTight,
  },
  chartCaption: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_TERTIARY,
  },
  heatmapWrap: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  dayLabels: {
    justifyContent: 'space-between',
    paddingVertical: 2,
    height: HEATMAP_HEIGHT,
  },
  dayLabel: {
    ...PR_TYPOGRAPHY.labelTight,
    color: PR_TEXT_TERTIARY,
  },
  heatmapDetail: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
  },
  pickupRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pickupCard: {
    flex: 1,
    gap: 8,
  },
  pickupValue: {
    ...PR_TYPOGRAPHY.headlineMd,
    color: PR_ACCENT_LIGHT,
    ...PR_CYAN_GLOW_STYLE,
  },
  sectionBlock: {
    gap: 12,
  },
  sectionMeta: {
    ...PR_TYPOGRAPHY.labelTight,
    color: PR_ACCENT_LIGHT,
  },
  timeline: {
    gap: 12,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timelineTrack: {
    alignItems: 'center',
    width: 18,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  timelineDotHighlight: {
    backgroundColor: PR_ACCENT_LIGHT,
    ...PR_CYAN_GLOW_STYLE,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  timelineCard: {
    flex: 1,
  },
  timelineCardHighlight: {
    backgroundColor: 'rgba(8, 145, 178, 0.10)',
  },
  timelineTitle: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  timelineCopy: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_SECONDARY,
    marginTop: 4,
  },
  weeklyStack: {
    gap: 10,
  },
  weekCard: {
    gap: 14,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  weekTitle: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  weekSubtitle: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_SECONDARY,
    marginTop: 4,
  },
  weekValue: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_ACCENT_LIGHT,
  },
  weekDetailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  weekDetailCard: {
    width: '47%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    gap: 6,
  },
  weekDetailLabel: {
    ...PR_TYPOGRAPHY.labelTight,
    color: PR_TEXT_TERTIARY,
  },
  weekDetailValue: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  recommendationStack: {
    gap: 10,
  },
  recommendationCard: {
    gap: 12,
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recommendationIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
  },
  recommendationTitle: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
    flex: 1,
  },
  recommendationBody: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
  },
  actionButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(34, 211, 238, 0.14)',
  },
  actionButtonText: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_ACCENT_LIGHT,
  },
});
