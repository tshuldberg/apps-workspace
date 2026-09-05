import { useState, useCallback, useEffect, useMemo } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { Stack } from 'expo-router';
import { Text, colors } from '@mylife/ui';
import { BarChart3 } from 'lucide-react-native';
import {
  listHangouts,
  listPeople,
  getWeekStart,
  generateWeeklySummary,
  getAverageWeeklySocialHours,
  getSocialPattern,
  detectOverSocializing,
  detectUnderSocializing,
  generatePatternInsight,
  type WeeklySummary,
  type SocialPattern,
} from '@mylife/friends';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.friends;
const BG = '#131318';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const GLASS = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';
const SURFACE = '#2A292F';

// ── Bar colors ─────────────────────────────────────────────────────

const BAR_COLORS = {
  current_normal: '#10B981', // green -- near average
  current_above: '#8BCFF0', // blue -- above average
  current_below: '#9F8E81', // gray -- below average
  past: 'rgba(255,255,255,0.12)',
};

// ── Pattern badge colors ───────────────────────────────────────────

const PATTERN_COLORS: Record<SocialPattern, { bg: string; text: string }> = {
  consistent: { bg: 'rgba(16,185,129,0.15)', text: '#10B981' },
  increasing: { bg: 'rgba(139,207,240,0.15)', text: '#8BCFF0' },
  decreasing: { bg: 'rgba(159,142,129,0.15)', text: '#9F8E81' },
  variable: { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B' },
  insufficient_data: { bg: 'rgba(255,255,255,0.05)', text: '#9F8E81' },
};

const PATTERN_LABELS: Record<SocialPattern, string> = {
  consistent: 'Consistent',
  increasing: 'Increasing',
  decreasing: 'Decreasing',
  variable: 'Variable',
  insufficient_data: 'Building data...',
};

// ── Main component ─────────────────────────────────────────────────

export default function FriendsInsightsScreen() {
  const db = useDatabase();

  const [summaries, setSummaries] = useState<WeeklySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(() => {
    const people = listPeople(db, { is_archived: false });
    const hangouts = listHangouts(db, {});

    // Convert hangouts to the input format the engine expects
    const hangoutInputs = hangouts.map((h) => ({
      happened_at: h.happened_at,
      duration_minutes: h.duration_minutes,
      people_ids: h.people_ids ?? [],
      quality_rating: h.quality_rating,
    }));

    const personInputs = people.map((p) => ({
      id: p.id,
      display_name: p.display_name,
    }));

    // Generate last 8 weeks of summaries
    const now = new Date();
    const currentWeekStart = getWeekStart(now);
    const weeks: WeeklySummary[] = [];

    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(currentWeekStart);
      weekStart.setDate(weekStart.getDate() - i * 7);
      const summary = generateWeeklySummary(hangoutInputs, personInputs, weekStart);
      weeks.push(summary);
    }

    setSummaries(weeks);
    setLoading(false);
  }, [db]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
    setRefreshing(false);
  }, [loadData]);

  // Derived data
  const avgHours = useMemo(() => getAverageWeeklySocialHours(summaries), [summaries]);
  const pattern = useMemo(() => getSocialPattern(summaries), [summaries]);
  const insight = useMemo(() => generatePatternInsight(pattern, avgHours), [pattern, avgHours]);

  const currentWeek = summaries[summaries.length - 1] ?? null;
  const currentMinutes = currentWeek?.totalMinutes ?? 0;
  const avgMinutes = summaries.length > 0
    ? summaries.reduce((s, w) => s + w.totalMinutes, 0) / summaries.length
    : 0;

  const isOver = detectOverSocializing(currentMinutes, avgMinutes);
  const isUnder = detectUnderSocializing(currentMinutes, avgMinutes);

  // Max for bar scaling
  const maxMinutes = Math.max(...summaries.map((s) => s.totalMinutes), 1);

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptySubtitle}>Loading...</Text>
        </View>
      </>
    );
  }

  const hasData = summaries.some((s) => s.totalMinutes > 0);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {!hasData ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <BarChart3 size={48} color={ACCENT} strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyTitle}>No insights yet</Text>
            <Text style={styles.emptySubtitle}>
              Log some hangouts and your social energy patterns will appear here.
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />
            }
          >
            {/* Current Week Summary */}
            {currentWeek && (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>This Week</Text>
                <View style={styles.summaryRow}>
                  <SummaryStat
                    value={`${Math.round(currentMinutes / 60 * 10) / 10}`}
                    unit="hrs"
                    label="Social time"
                  />
                  <SummaryStat
                    value={`${currentWeek.hangoutCount}`}
                    unit=""
                    label="Hangouts"
                  />
                  <SummaryStat
                    value={`${currentWeek.uniquePeople}`}
                    unit=""
                    label="People"
                  />
                </View>
                {avgMinutes > 0 && (
                  <Text style={styles.comparisonText}>
                    {currentMinutes > avgMinutes
                      ? `${Math.round(((currentMinutes - avgMinutes) / avgMinutes) * 100)}% above your average`
                      : currentMinutes < avgMinutes
                        ? `${Math.round(((avgMinutes - currentMinutes) / avgMinutes) * 100)}% below your average`
                        : 'Right at your average'}
                  </Text>
                )}
              </View>
            )}

            {/* Pattern Badge */}
            <View style={styles.patternCard}>
              <Text style={styles.patternLabel}>Your rhythm</Text>
              <View style={[styles.patternBadge, { backgroundColor: PATTERN_COLORS[pattern].bg }]}>
                <Text style={[styles.patternBadgeText, { color: PATTERN_COLORS[pattern].text }]}>
                  {PATTERN_LABELS[pattern]}
                </Text>
              </View>
              <Text style={styles.insightText}>{insight}</Text>
            </View>

            {/* Over/Under Alert */}
            {(isOver || isUnder) && (
              <View style={[styles.alertCard, { borderLeftColor: isOver ? '#8BCFF0' : '#9F8E81' }]}>
                <Text style={styles.alertText}>
                  {isOver
                    ? 'This was a full week with more social time than usual.'
                    : 'This was a lighter week with less social time than usual.'}
                </Text>
              </View>
            )}

            {/* Weekly Bar Chart */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Last 8 Weeks</Text>
              {summaries.map((week, i) => {
                const isCurrent = i === summaries.length - 1;
                const hours = Math.round(week.totalMinutes / 60 * 10) / 10;
                const barWidth = maxMinutes > 0
                  ? Math.max((week.totalMinutes / maxMinutes) * 100, 2)
                  : 2;

                let barColor: string;
                if (isCurrent) {
                  if (week.totalMinutes > avgMinutes * 1.3) barColor = BAR_COLORS.current_above;
                  else if (week.totalMinutes < avgMinutes * 0.7) barColor = BAR_COLORS.current_below;
                  else barColor = BAR_COLORS.current_normal;
                } else {
                  barColor = BAR_COLORS.past;
                }

                return (
                  <View key={week.weekStart} style={styles.barRow}>
                    <Text style={styles.barLabel}>
                      {isCurrent ? 'Now' : formatWeekLabel(week.weekStart)}
                    </Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${barWidth}%`, backgroundColor: barColor },
                        ]}
                      />
                    </View>
                    <Text style={[styles.barValue, isCurrent && { color: TEXT_PRIMARY }]}>
                      {hours}h
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Top Person This Week */}
            {currentWeek?.topPerson && (
              <View style={styles.topPersonCard}>
                <Text style={styles.topPersonLabel}>Most time with this week</Text>
                <Text style={styles.topPersonName}>{currentWeek.topPerson.name}</Text>
                <Text style={styles.topPersonMinutes}>
                  {Math.round(currentWeek.topPerson.minutes / 60 * 10) / 10} hours
                </Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </>
  );
}

// ── Summary stat ───────────────────────────────────────────────────

function SummaryStat({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <View style={styles.statItem}>
      <View style={styles.statValueRow}>
        <Text style={styles.statValue}>{value}</Text>
        {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 100,
  },

  // Summary card
  summaryCard: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: TEXT_SECONDARY,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 14,
  },
  statItem: {
    alignItems: 'center',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  statUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  statLabel: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginTop: 4,
  },
  comparisonText: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    textAlign: 'center',
  },

  // Pattern card
  patternCard: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    marginBottom: 16,
    alignItems: 'center',
  },
  patternLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    marginBottom: 10,
  },
  patternBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10,
  },
  patternBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  insightText: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Alert card
  alertCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderLeftWidth: 4,
    marginBottom: 16,
  },
  alertText: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    lineHeight: 20,
  },

  // Chart card
  chartCard: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 14,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  barLabel: {
    width: 36,
    fontSize: 11,
    color: TEXT_SECONDARY,
    textAlign: 'right',
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: SURFACE,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  barValue: {
    width: 36,
    fontSize: 11,
    color: TEXT_SECONDARY,
    textAlign: 'right',
  },

  // Top person card
  topPersonCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    marginBottom: 16,
    alignItems: 'center',
  },
  topPersonLabel: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginBottom: 6,
  },
  topPersonName: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 2,
  },
  topPersonMinutes: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(236, 72, 153, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 15,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
});
