import { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';
import {
  GlassCard,
  HB_ACCENT,
  HB_ACCENT_LIGHT,
  HB_FONTS,
  HB_SURFACES,
  HB_TEXT,
  HB_TEXT_SECONDARY,
  HB_TEXT_TERTIARY,
  MaterialSymbol,
  getAllFocusSessions,
} from '@mylife/habits';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  buildFocusDailySeries,
  buildFocusHourBuckets,
  calculateFocusStreakDays,
  formatCompactDuration,
  formatStartedAtLabel,
  getPhase3Range,
  summarizeFocusSessions,
  type HabitsPhase3PeriodKey,
} from '../../lib/habits/phase3';

const PERIOD_OPTIONS: HabitsPhase3PeriodKey[] = ['today', 'week', 'month'];

export default function FocusAnalyticsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [period, setPeriod] = useState<HabitsPhase3PeriodKey>('week');
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const range = useMemo(() => getPhase3Range(period, new Date()), [period]);
  const sessions = useMemo(() => getAllFocusSessions(db), [db, tick]);
  const summary = useMemo(() => summarizeFocusSessions(sessions, range), [range, sessions]);
  const dailySeries = useMemo(() => buildFocusDailySeries(sessions, range), [range, sessions]);
  const hourBuckets = useMemo(() => buildFocusHourBuckets(sessions, range), [range, sessions]);
  const focusStreak = useMemo(() => calculateFocusStreakDays(sessions, new Date()), [sessions]);

  const maxDaySeconds = Math.max(1, ...dailySeries.map((point) => point.totalSeconds));
  const maxHourSeconds = Math.max(1, ...hourBuckets.map((bucket) => bucket.totalSeconds));
  const chartWidth = Math.max(260, width - 88);
  const lineHeight = 160;
  const linePoints = dailySeries.map((point, index) => {
    const x = dailySeries.length === 1 ? chartWidth / 2 : (index / (dailySeries.length - 1)) * chartWidth;
    const y = lineHeight - (point.totalSeconds / maxDaySeconds) * (lineHeight - 20) - 10;
    return `${x},${y}`;
  }).join(' ');
  const topDays = [...dailySeries]
    .filter((point) => point.totalSeconds > 0)
    .sort((left, right) => right.totalSeconds - left.totalSeconds)
    .slice(0, 3);
  const logSessions = sessions
    .filter((session) => session.startedAt.slice(0, 10) >= range.start && session.startedAt.slice(0, 10) <= range.end)
    .slice(0, 8);

  const handleRefresh = () => {
    setRefreshing(true);
    setTick((value) => value + 1);
    setRefreshing(false);
  };

  if (sessions.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerButton}>
            <MaterialSymbol name="arrow_back" size={20} color={HB_TEXT} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.headerEyebrow}>Mission Control</Text>
            <Text style={styles.headerTitle}>Focus Analytics</Text>
          </View>
          <View style={styles.headerButton} />
        </View>

        <View style={styles.emptyWrap}>
          <GlassCard level={2} style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <MaterialSymbol name="insights" size={24} color={HB_ACCENT_LIGHT} />
            </View>
            <Text style={styles.emptyTitle}>No focus sessions yet</Text>
            <Text style={styles.emptyBody}>
              Start one focus session to unlock time trends, hour distribution, and your strongest days.
            </Text>
            <Pressable onPress={() => router.push('/(habits)/focus-timer')} style={styles.emptyButton}>
              <Text style={styles.emptyButtonText}>Open focus timer</Text>
            </Pressable>
          </GlassCard>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={HB_ACCENT_LIGHT} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerButton}>
            <MaterialSymbol name="arrow_back" size={20} color={HB_TEXT} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.headerEyebrow}>Mission Control</Text>
            <Text style={styles.headerTitle}>Focus Analytics</Text>
          </View>
          <Pressable onPress={() => router.push('/(habits)/focus-timer')} style={styles.headerButton}>
            <MaterialSymbol name="timer" size={20} color={HB_ACCENT_LIGHT} />
          </Pressable>
        </View>

        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>See where your deep work actually lands.</Text>
          <Text style={styles.heroSubtitle}>
            {range.label} across saved focus sessions, completed rounds, and repeatable momentum.
          </Text>
        </View>

        <View style={styles.periodRow}>
          {PERIOD_OPTIONS.map((option) => {
            const selected = period === option;
            return (
              <Pressable
                key={option}
                onPress={() => setPeriod(option)}
                style={[styles.periodChip, selected && styles.periodChipSelected]}
              >
                <Text style={[styles.periodChipText, selected && styles.periodChipTextSelected]}>
                  {option === 'today' ? 'Today' : option === 'week' ? 'This Week' : 'This Month'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <GlassCard level={2} style={styles.heroCard}>
          <Text style={styles.heroCardLabel}>Total focus time</Text>
          <Text style={styles.heroCardValue}>{formatCompactDuration(summary.totalSeconds)}</Text>
          <View style={styles.heroCardMeta}>
            <View style={styles.heroMetaPill}>
              <MaterialSymbol name="task_alt" size={14} color={HB_ACCENT_LIGHT} />
              <Text style={styles.heroMetaText}>{summary.completedCount} completed</Text>
            </View>
            <View style={styles.heroMetaPill}>
              <MaterialSymbol name="local_fire_department" size={14} color={HB_ACCENT_LIGHT} />
              <Text style={styles.heroMetaText}>{focusStreak}d streak</Text>
            </View>
          </View>
        </GlassCard>

        <View style={styles.metricRow}>
          <GlassCard level={1} style={styles.metricCard}>
            <Text style={styles.metricLabel}>Average session</Text>
            <Text style={styles.metricValue}>{formatCompactDuration(summary.averageSeconds)}</Text>
          </GlassCard>
          <GlassCard level={1} style={styles.metricCard}>
            <Text style={styles.metricLabel}>Longest session</Text>
            <Text style={styles.metricValue}>{formatCompactDuration(summary.longestSessionSeconds)}</Text>
          </GlassCard>
        </View>

        <GlassCard level={1} style={styles.chartCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Daily focus trend</Text>
            <Text style={styles.cardMeta}>{range.label}</Text>
          </View>
          <Svg width={chartWidth} height={188}>
            <Line x1="0" y1="170" x2={chartWidth} y2="170" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <Polyline
              points={linePoints}
              fill="none"
              stroke={HB_ACCENT_LIGHT}
              strokeWidth="4"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {dailySeries.map((point, index) => {
              const x = dailySeries.length === 1 ? chartWidth / 2 : (index / (dailySeries.length - 1)) * chartWidth;
              const y = lineHeight - (point.totalSeconds / maxDaySeconds) * (lineHeight - 20) - 10;
              return (
                <Circle key={point.date} cx={x} cy={y} r="5" fill={HB_ACCENT} />
              );
            })}
          </Svg>
          <View style={styles.chartLabels}>
            {dailySeries.map((point) => (
              <Text key={point.date} style={styles.chartLabel}>
                {point.label}
              </Text>
            ))}
          </View>
        </GlassCard>

        <GlassCard level={1} style={styles.chartCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Session distribution by hour</Text>
            <Text style={styles.cardMeta}>Peak focus window</Text>
          </View>
          <Svg width={chartWidth} height={156}>
            {hourBuckets.map((bucket, index) => {
              const barWidth = chartWidth / hourBuckets.length - 3;
              const x = index * (barWidth + 3);
              const heightValue = Math.max(6, (bucket.totalSeconds / maxHourSeconds) * 120);
              const y = 136 - heightValue;
              return (
                <Rect
                  key={bucket.hour}
                  x={x}
                  y={y}
                  width={barWidth}
                  height={heightValue}
                  rx={barWidth / 2}
                  fill={bucket.totalSeconds > 0 ? HB_ACCENT_LIGHT : 'rgba(255,255,255,0.08)'}
                />
              );
            })}
          </Svg>
          <View style={styles.hourLabels}>
            {[0, 6, 12, 18, 23].map((hour) => (
              <Text key={hour} style={styles.hourLabel}>
                {hour}
              </Text>
            ))}
          </View>
        </GlassCard>

        <GlassCard level={1} style={styles.listCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Most focused days</Text>
            <Text style={styles.cardMeta}>{topDays.length} days</Text>
          </View>
          {topDays.length === 0 ? (
            <Text style={styles.placeholderText}>No completed sessions landed in this range yet.</Text>
          ) : (
            topDays.map((point, index) => (
              <View key={point.date} style={[styles.rankRow, index < topDays.length - 1 && styles.rankDivider]}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankBadgeText}>{index + 1}</Text>
                </View>
                <View style={styles.rankCopy}>
                  <Text style={styles.rankTitle}>{point.date}</Text>
                  <Text style={styles.rankBody}>{formatCompactDuration(point.totalSeconds)} focused</Text>
                </View>
              </View>
            ))
          )}
        </GlassCard>

        <GlassCard level={1} style={styles.listCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Session log</Text>
            <Text style={styles.cardMeta}>{logSessions.length} recent</Text>
          </View>
          {logSessions.map((session, index) => (
            <View key={session.id} style={[styles.logRow, index < logSessions.length - 1 && styles.rankDivider]}>
              <View style={styles.logIcon}>
                <MaterialSymbol
                  name={session.status === 'completed' ? 'check_circle' : 'schedule'}
                  size={16}
                  color={session.status === 'completed' ? HB_ACCENT_LIGHT : HB_TEXT_TERTIARY}
                  filled={session.status === 'completed'}
                />
              </View>
              <View style={styles.logCopy}>
                <Text style={styles.logTitle}>{formatStartedAtLabel(session.startedAt)}</Text>
                <Text style={styles.logBody}>
                  {formatCompactDuration(session.totalFocusSeconds)} • {session.roundsCompleted} rounds
                </Text>
              </View>
              <Text style={styles.logStatus}>{session.status}</Text>
            </View>
          ))}
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: HB_SURFACES.lowest,
  },
  container: {
    flex: 1,
    backgroundColor: HB_SURFACES.lowest,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 18,
  },
  header: {
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: HB_SURFACES.low,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  headerEyebrow: {
    fontFamily: HB_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: HB_ACCENT_LIGHT,
  },
  headerTitle: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.8,
    color: HB_TEXT,
  },
  heroCopy: {
    gap: 6,
  },
  heroTitle: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -1,
    color: HB_TEXT,
  },
  heroSubtitle: {
    fontFamily: HB_FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    color: HB_TEXT_SECONDARY,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 10,
  },
  periodChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: HB_SURFACES.low,
    alignItems: 'center',
  },
  periodChipSelected: {
    backgroundColor: HB_ACCENT,
  },
  periodChipText: {
    fontFamily: HB_FONTS.bold,
    fontSize: 13,
    lineHeight: 16,
    color: HB_TEXT_SECONDARY,
  },
  periodChipTextSelected: {
    color: '#130F1D',
  },
  heroCard: {
    borderRadius: 26,
    gap: 14,
  },
  heroCardLabel: {
    fontFamily: HB_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: HB_TEXT_TERTIARY,
  },
  heroCardValue: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 42,
    lineHeight: 46,
    letterSpacing: -1.6,
    color: HB_TEXT,
  },
  heroCardMeta: {
    flexDirection: 'row',
    gap: 10,
  },
  heroMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(139,92,246,0.12)',
  },
  heroMetaText: {
    fontFamily: HB_FONTS.medium,
    fontSize: 12,
    lineHeight: 14,
    color: HB_TEXT_SECONDARY,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    minHeight: 100,
    borderRadius: 22,
    justifyContent: 'space-between',
  },
  metricLabel: {
    fontFamily: HB_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: HB_TEXT_SECONDARY,
  },
  metricValue: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.8,
    color: HB_TEXT,
  },
  chartCard: {
    borderRadius: 26,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: HB_TEXT,
  },
  cardMeta: {
    fontFamily: HB_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: HB_TEXT_TERTIARY,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  chartLabel: {
    fontFamily: HB_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    color: HB_TEXT_TERTIARY,
  },
  hourLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hourLabel: {
    fontFamily: HB_FONTS.medium,
    fontSize: 10,
    lineHeight: 12,
    color: HB_TEXT_TERTIARY,
  },
  listCard: {
    borderRadius: 26,
    gap: 4,
  },
  placeholderText: {
    marginTop: 8,
    fontFamily: HB_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: HB_TEXT_SECONDARY,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  rankDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rankBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(139,92,246,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: {
    fontFamily: HB_FONTS.bold,
    fontSize: 12,
    lineHeight: 14,
    color: HB_ACCENT_LIGHT,
  },
  rankCopy: {
    flex: 1,
    gap: 2,
  },
  rankTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
    color: HB_TEXT,
  },
  rankBody: {
    fontFamily: HB_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
    color: HB_TEXT_SECONDARY,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  logIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: HB_SURFACES.low,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logCopy: {
    flex: 1,
    gap: 2,
  },
  logTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
    color: HB_TEXT,
  },
  logBody: {
    fontFamily: HB_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
    color: HB_TEXT_SECONDARY,
  },
  logStatus: {
    fontFamily: HB_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    textTransform: 'uppercase',
    color: HB_TEXT_TERTIARY,
  },
  emptyWrap: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 28,
    alignItems: 'center',
    gap: 14,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(139,92,246,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.8,
    color: HB_TEXT,
  },
  emptyBody: {
    fontFamily: HB_FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: HB_TEXT_SECONDARY,
  },
  emptyButton: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: HB_ACCENT,
  },
  emptyButtonText: {
    fontFamily: HB_FONTS.bold,
    fontSize: 14,
    lineHeight: 16,
    color: '#130F1D',
  },
});
