import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import {
  AppRow,
  GlassPanel,
  PR_ACCENT,
  PR_ACCENT_LIGHT,
  PR_CATEGORY_COLORS,
  PR_CATEGORY_GRADIENTS,
  PR_SURFACES,
  PR_TEXT,
  PR_TEXT_SECONDARY,
  PR_TEXT_TERTIARY,
  PR_TYPOGRAPHY,
  SectionHeader,
  buildCategoryBreakdown,
  formatScreenTime,
  getActiveGoal,
  getAppUsageRange,
  getDailyUsageRange,
  getTopApps,
} from '@mylife/presence';
import { EmptyState, ErrorState } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';

interface StatsLoadedState {
  error: null;
  empty: boolean;
  range: ReturnType<typeof getDateRange>;
  totalMinutes: number;
  averageMinutes: number;
  goalMinutes: number;
  goalMetDays: number;
  bestDay: { date: string; total_minutes: number } | null;
  worstDay: { date: string; total_minutes: number } | null;
  categoryBreakdown: Array<{ category: string; minutes: number; percentage: number }>;
  visibleDaily: Array<{ date: string; total_minutes: number }>;
  appUsageByDate: Map<string, ReturnType<typeof getAppUsageRange>>;
  maxDayMinutes: number;
  topApps: Array<{
    app_name: string;
    category: string;
    total_minutes: number;
    total_opens: number;
    iconName: ReturnType<typeof getCategoryIcon>;
    gradientFrom: string;
    gradientTo: string;
    deltaPercent: number | null;
  }>;
}

type StatsScreenState = StatsLoadedState | { error: string };

type Period = 'today' | '7d' | '30d' | '90d';

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getDateRange(period: Period): { start: string; end: string; label: string; days: number } {
  const now = new Date();
  const end = toDateKey(now);
  const start = new Date(now);

  if (period === 'today') {
    return { start: end, end, label: 'Today', days: 1 };
  }

  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  start.setDate(start.getDate() - (days - 1));
  return {
    start: toDateKey(start),
    end,
    label: period === '7d' ? '7 Days' : period === '30d' ? '30 Days' : '90 Days',
    days,
  };
}

function getPreviousRange(period: Period) {
  const { start, days } = getDateRange(period);
  const currentStart = new Date(`${start}T00:00:00`);
  const previousEnd = new Date(currentStart);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - (days - 1));
  return {
    start: toDateKey(previousStart),
    end: toDateKey(previousEnd),
  };
}

function normalizeCategoryKey(category: string): keyof typeof PR_CATEGORY_COLORS {
  const key = category.toLowerCase();

  if (key in PR_CATEGORY_COLORS) {
    return key as keyof typeof PR_CATEGORY_COLORS;
  }

  if (key === 'games') return 'gaming';
  return 'other';
}

function getCategoryIcon(category: string) {
  switch (normalizeCategoryKey(category)) {
    case 'social':
      return 'share' as const;
    case 'communication':
      return 'chat' as const;
    case 'utilities':
      return 'explore' as const;
    case 'media':
      return 'play_circle' as const;
    case 'audio':
      return 'music_note' as const;
    case 'productivity':
    case 'work':
      return 'task_alt' as const;
    case 'gaming':
      return 'bolt' as const;
    case 'education':
      return 'psychology' as const;
    default:
      return 'diamond' as const;
  }
}

function calculateDeltaPercent(current: number, previous: number | null): number | null {
  if (previous == null || previous <= 0) {
    return current > 0 ? null : 0;
  }

  return Math.round(((current - previous) / previous) * 100);
}

function DonutChart({
  segments,
  totalMinutes,
}: {
  segments: { category: string; minutes: number; percentage: number }[];
  totalMinutes: number;
}) {
  const size = 208;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <View style={styles.donutCard}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={PR_SURFACES.highest}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {segments.map((segment) => {
          const dash = (segment.minutes / Math.max(totalMinutes, 1)) * circumference;
          const circle = (
            <Circle
              key={segment.category}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={PR_CATEGORY_COLORS[normalizeCategoryKey(segment.category)] ?? PR_CATEGORY_COLORS.other}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              fill="none"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          offset += dash;
          return circle;
        })}
      </Svg>

      <View style={styles.donutCenter}>
        <Text style={styles.donutValue}>{formatScreenTime(totalMinutes)}</Text>
        <Text style={styles.donutLabel}>Total tracked</Text>
      </View>
    </View>
  );
}

export default function StatsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>('7d');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const range = useMemo(() => getDateRange(period), [period]);

  const state = useMemo<StatsScreenState>(() => {
    try {
      const previousRange = getPreviousRange(period);
      const dailyRecords = getDailyUsageRange(db, range.start, range.end, 120)
        .sort((left, right) => left.date.localeCompare(right.date));
      const appUsageRecords = getAppUsageRange(db, range.start, range.end, 3000);
      const categoryBreakdown = buildCategoryBreakdown(appUsageRecords);
      const activeGoal = getActiveGoal(db, range.end);
      const goalMinutes = activeGoal?.daily_minutes ?? 180;
      const visibleDaily = dailyRecords.slice(-(period === 'today' ? 1 : Math.min(dailyRecords.length, 7)));
      const currentTopApps = getTopApps(db, range.start, range.end, 10);
      const previousTopApps = getTopApps(db, previousRange.start, previousRange.end, 20);
      const previousMinutesByName = new Map(
        previousTopApps.map((app) => [app.app_name, app.total_minutes]),
      );

      const totalMinutes = dailyRecords.reduce((sum, record) => sum + record.total_minutes, 0);
      const averageMinutes = dailyRecords.length > 0 ? Math.round(totalMinutes / dailyRecords.length) : 0;
      const goalMetDays = dailyRecords.filter((record) => record.goal_met === 1).length;
      const bestDay = dailyRecords.length > 0
        ? [...dailyRecords].sort((left, right) => left.total_minutes - right.total_minutes)[0] ?? null
        : null;
      const worstDay = dailyRecords.length > 0
        ? [...dailyRecords].sort((left, right) => right.total_minutes - left.total_minutes)[0] ?? null
        : null;

      const appUsageByDate = new Map<string, typeof appUsageRecords>();
      for (const record of appUsageRecords) {
        const current = appUsageByDate.get(record.date) ?? [];
        current.push(record);
        appUsageByDate.set(record.date, current);
      }

      const maxDayMinutes = Math.max(
        ...visibleDaily.map((record) => record.total_minutes),
        goalMinutes,
        1,
      );

      return {
        error: null,
        empty: dailyRecords.length === 0,
        range,
        totalMinutes,
        averageMinutes,
        goalMinutes,
        goalMetDays,
        bestDay,
        worstDay,
        categoryBreakdown,
        visibleDaily,
        appUsageByDate,
        maxDayMinutes,
        topApps: currentTopApps.map((app) => {
          const categoryKey = normalizeCategoryKey(app.category);
          const gradient = PR_CATEGORY_GRADIENTS[categoryKey] ?? PR_CATEGORY_GRADIENTS.other;

          return {
            ...app,
            iconName: getCategoryIcon(app.category),
            gradientFrom: gradient[0],
            gradientTo: gradient[1],
            deltaPercent: calculateDeltaPercent(
              app.total_minutes,
              previousMinutesByName.get(app.app_name) ?? null,
            ),
          };
        }),
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to load analytics.',
      };
    }
  }, [db, period, range, refreshKey]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((current) => current + 1);
    setRefreshing(false);
  }, []);

  if (state.error) {
    return (
      <View style={styles.screen}>
        <View style={styles.errorWrap}>
          <ErrorState message={state.error} onRetry={refresh} />
        </View>
      </View>
    );
  }

  const content = state as StatsLoadedState;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        stickyHeaderIndices={[0]}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={PR_ACCENT_LIGHT}
            colors={[PR_ACCENT_LIGHT]}
          />
        )}
      >
        <View style={styles.segmentShell}>
          <View style={styles.segmentRow}>
            {(['today', '7d', '30d', '90d'] as Period[]).map((value) => {
              const selected = value === period;
              return (
                <Pressable
                  key={value}
                  style={[styles.segmentChip, selected && styles.segmentChipActive]}
                  onPress={() => setPeriod(value)}
                >
                  <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>
                    {getDateRange(value).label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.heroBlock}>
          <Text style={styles.heroEyebrow}>Usage Analytics</Text>
          <Text style={styles.heroTitle}>Screen Time</Text>
          <Text style={styles.heroCopy}>
            {`A calm view of where your attention went across ${content.range.label.toLowerCase()}.`}
          </Text>
        </View>

        {content.empty ? (
          <View style={styles.stack}>
            <EmptyState
              icon="📊"
              title="No presence data yet"
              message="Start tracking screen time and this analytics view will light up with category splits, day bars, and app rankings."
            />
          </View>
        ) : (
          <>
            <View style={styles.stack}>
              <GlassPanel padding={20} style={styles.analyticsCard}>
                <DonutChart
                  segments={content.categoryBreakdown.map((entry) => ({
                    category: entry.category,
                    minutes: entry.minutes,
                    percentage: entry.percentage,
                  }))}
                  totalMinutes={content.totalMinutes}
                />

                <View style={styles.legendWrap}>
                  {content.categoryBreakdown.map((entry) => (
                    <View key={entry.category} style={styles.legendRow}>
                      <View
                        style={[
                          styles.legendDot,
                          {
                            backgroundColor:
                              PR_CATEGORY_COLORS[normalizeCategoryKey(entry.category)] ?? PR_CATEGORY_COLORS.other,
                          },
                        ]}
                      />
                      <View style={styles.legendCopy}>
                        <Text style={styles.legendTitle}>{entry.category}</Text>
                        <Text style={styles.legendSub}>
                          {`${formatScreenTime(entry.minutes)} · ${entry.percentage}%`}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </GlassPanel>

              <GlassPanel padding={20} style={styles.chartCard}>
                <SectionHeader
                    title="Activity Trend"
                    action={<Text style={styles.goalCaption}>{`Goal ${formatScreenTime(content.goalMinutes)}`}</Text>}
                  />

                  <View style={styles.activityChart}>
                    <View
                      style={[
                        styles.goalLine,
                        {
                          top: `${100 - (content.goalMinutes / content.maxDayMinutes) * 100}%`,
                        },
                      ]}
                    />

                    <View style={styles.barRow}>
                      {content.visibleDaily.map((record) => {
                        const breakdown = content.appUsageByDate.get(record.date) ?? [];
                        const totalForDay = Math.max(record.total_minutes, 1);
                        const totalHeightPercent = (record.total_minutes / content.maxDayMinutes) * 100;

                      return (
                        <Pressable
                          key={record.date}
                          style={styles.barColumn}
                          onPress={() =>
                            router.push({
                              pathname: '/(presence)/report',
                              params: { date: record.date },
                            } as never)
                          }
                        >
                          <View style={styles.barTrack}>
                            <View
                              style={[
                                styles.barStack,
                                {
                                  height: `${Math.max(totalHeightPercent, 8)}%`,
                                },
                              ]}
                            >
                              {breakdown
                                .slice()
                                .sort((left, right) => left.minutes - right.minutes)
                                .map((entry) => (
                                  <View
                                    key={`${record.date}-${entry.app_id}`}
                                    style={[
                                      styles.barSegment,
                                      {
                                        height: `${Math.max((entry.minutes / totalForDay) * 100, 6)}%`,
                                        backgroundColor:
                                          PR_CATEGORY_COLORS[normalizeCategoryKey(entry.category)] ?? PR_CATEGORY_COLORS.other,
                                      },
                                    ]}
                                  />
                                ))}
                            </View>
                          </View>
                          <Text style={styles.barLabel}>
                            {new Date(`${record.date}T00:00:00`).toLocaleDateString('en-US', {
                              weekday: 'short',
                            })}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </GlassPanel>
            </View>

            <View style={styles.section}>
              <SectionHeader title="Top Applications" />
              <View style={styles.stack}>
                {content.topApps.map((app) => (
                  <AppRow
                    key={app.app_name}
                    appName={app.app_name}
                    appCategory={app.category}
                    minutes={app.total_minutes}
                    deltaPercent={app.deltaPercent}
                    iconName={app.iconName}
                    gradientFrom={app.gradientFrom}
                    gradientTo={app.gradientTo}
                  />
                ))}
              </View>
            </View>

            <View style={styles.statPillRow}>
              <GlassPanel padding={16} style={styles.statPill}>
                <Text style={styles.statPillLabel}>Daily Avg</Text>
                <Text style={styles.statPillValue}>{formatScreenTime(content.averageMinutes)}</Text>
              </GlassPanel>
              <GlassPanel padding={16} style={styles.statPill}>
                <Text style={styles.statPillLabel}>Goal Days</Text>
                <Text style={styles.statPillValue}>{String(content.goalMetDays)}</Text>
              </GlassPanel>
              <GlassPanel padding={16} style={styles.statPill}>
                <Text style={styles.statPillLabel}>Best Day</Text>
                <Text style={styles.statPillValue}>
                  {content.bestDay ? formatScreenTime(content.bestDay.total_minutes) : '—'}
                </Text>
              </GlassPanel>
              <GlassPanel padding={16} style={styles.statPill}>
                <Text style={styles.statPillLabel}>Worst Day</Text>
                <Text style={styles.statPillValue}>
                  {content.worstDay ? formatScreenTime(content.worstDay.total_minutes) : '—'}
                </Text>
              </GlassPanel>
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
    paddingBottom: 160,
    gap: 20,
  },
  stickyShell: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    backgroundColor: 'rgba(14, 14, 19, 0.92)',
  },
  segmentShell: {
    paddingHorizontal: 20,
    paddingBottom: 4,
    backgroundColor: 'rgba(14, 14, 19, 0.96)',
  },
  topBar: {
    minHeight: 64,
    borderRadius: 24,
    backgroundColor: 'rgba(19, 19, 24, 0.76)',
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: PR_ACCENT,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    ...PR_TYPOGRAPHY.titleMd,
    color: '#03151A',
  },
  topBarEyebrow: {
    ...PR_TYPOGRAPHY.labelTight,
    color: PR_TEXT_TERTIARY,
  },
  topBarTitle: {
    ...PR_TYPOGRAPHY.headlineMd,
    color: PR_ACCENT_LIGHT,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 999,
    backgroundColor: PR_SURFACES.low,
    padding: 6,
  },
  segmentChip: {
    flex: 1,
    minHeight: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  segmentChipActive: {
    backgroundColor: PR_ACCENT_LIGHT,
  },
  segmentText: {
    ...PR_TYPOGRAPHY.labelTight,
    color: PR_TEXT_TERTIARY,
  },
  segmentTextActive: {
    color: '#03212A',
  },
  heroBlock: {
    paddingHorizontal: 20,
    gap: 6,
  },
  heroEyebrow: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_ACCENT_LIGHT,
  },
  heroTitle: {
    ...PR_TYPOGRAPHY.displayLg,
    color: PR_TEXT,
    lineHeight: 52,
  },
  heroCopy: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
  },
  stack: {
    paddingHorizontal: 20,
    gap: 14,
  },
  section: {
    paddingHorizontal: 20,
    gap: 14,
  },
  analyticsCard: {
    gap: 20,
  },
  donutCard: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
    gap: 6,
  },
  donutValue: {
    ...PR_TYPOGRAPHY.displayLg,
    color: PR_TEXT,
    fontSize: 30,
    lineHeight: 34,
  },
  donutLabel: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_TEXT_TERTIARY,
  },
  legendWrap: {
    gap: 12,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendCopy: {
    flex: 1,
  },
  legendTitle: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
    textTransform: 'capitalize',
  },
  legendSub: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_SECONDARY,
  },
  chartCard: {
    gap: 18,
  },
  goalCaption: {
    ...PR_TYPOGRAPHY.labelTight,
    color: PR_TEXT_TERTIARY,
  },
  activityChart: {
    position: 'relative',
    minHeight: 192,
    paddingTop: 16,
  },
  goalLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0,
    borderTopWidth: 1,
    borderColor: 'rgba(34,211,238,0.24)',
    borderStyle: 'dashed',
  },
  barRow: {
    minHeight: 176,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
  },
  barTrack: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    backgroundColor: PR_SURFACES.low,
    borderRadius: 16,
    padding: 6,
  },
  barStack: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  barSegment: {
    width: '100%',
    minHeight: 6,
  },
  barLabel: {
    ...PR_TYPOGRAPHY.labelTight,
    color: PR_TEXT_TERTIARY,
  },
  statPillRow: {
    paddingHorizontal: 20,
    gap: 12,
  },
  statPill: {
    gap: 6,
  },
  statPillLabel: {
    ...PR_TYPOGRAPHY.labelTight,
    color: PR_TEXT_TERTIARY,
  },
  statPillValue: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  errorWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
});
