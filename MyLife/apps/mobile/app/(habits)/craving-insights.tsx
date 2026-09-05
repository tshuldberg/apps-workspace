import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
  analyzeCopingEffectiveness,
  analyzeIntensityTrend,
  analyzeTriggerFrequency,
  getAllSobrietyProfiles,
  getCravingsForHabit,
  getTriggersForCraving,
  withAlpha,
} from '@mylife/habits';
import { EmptyState, Text } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  formatFriendlyDate,
  formatRelativeTimestamp,
  parseCravingContext,
} from '../../components/habits/phase5';

const DONUT_COLORS = ['#A78BFA', '#8BCFF0', '#30D158', '#FFB877', '#FF8A80'];

function formatHour(hour: number): string {
  const normalized = hour % 24;
  const suffix = normalized >= 12 ? 'PM' : 'AM';
  const hour12 = normalized % 12 || 12;
  return `${hour12}${suffix}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildLinePath(values: number[], width: number, height: number): string {
  if (values.length === 0) {
    return '';
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
}

export default function CravingInsightsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ habitId?: string }>();
  const fallbackHabitId = useMemo(
    () => getAllSobrietyProfiles(db)[0]?.habitId ?? null,
    [db],
  );
  const activeHabitId = params.habitId ?? fallbackHabitId;

  const cravings = useMemo(
    () => (activeHabitId ? getCravingsForHabit(db, activeHabitId) : []),
    [activeHabitId, db],
  );

  const cravingRows = useMemo(
    () => cravings.map((craving) => ({
      craving,
      triggers: getTriggersForCraving(db, craving.id),
      context: parseCravingContext(craving.notes),
    })),
    [cravings, db],
  );

  const allTriggers = useMemo(
    () => cravingRows.flatMap((row) => row.triggers),
    [cravingRows],
  );

  const triggerFrequency = useMemo(
    () => analyzeTriggerFrequency(allTriggers),
    [allTriggers],
  );

  const intensityTrend = useMemo(
    () => analyzeIntensityTrend(cravings).slice(-8),
    [cravings],
  );

  const hourlyCounts = useMemo(() => {
    const counts = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
    cravings.forEach((craving) => {
      const hour = new Date(craving.loggedAt).getHours();
      counts[hour].count += 1;
    });
    return counts;
  }, [cravings]);

  const outcomeStats = useMemo(
    () => analyzeCopingEffectiveness(cravings),
    [cravings],
  );

  const strategyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    cravings.forEach((craving) => {
      if (!craving.copingStrategy) {
        return;
      }
      counts.set(
        craving.copingStrategy,
        (counts.get(craving.copingStrategy) ?? 0) + 1,
      );
    });

    return Array.from(counts.entries())
      .map(([strategy, count]) => ({ strategy, count }))
      .sort((a, b) => b.count - a.count);
  }, [cravings]);

  const locationCounts = useMemo(() => {
    const counts = new Map<string, number>();
    cravingRows.forEach((row) => {
      if (!row.context.location) {
        return;
      }
      counts.set(row.context.location, (counts.get(row.context.location) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count);
  }, [cravingRows]);

  const averageIntensity = cravings.length > 0
    ? (cravings.reduce((sum, craving) => sum + craving.intensity, 0) / cravings.length).toFixed(1)
    : '0.0';

  const peakHour = hourlyCounts.reduce(
    (best, slot) => (slot.count > best.count ? slot : best),
    hourlyCounts[0] ?? { hour: 0, count: 0 },
  );

  if (!activeHabitId) {
    return (
      <View style={styles.emptyState}>
        <EmptyState
          icon={'\u23F0'}
          title="No sobriety tracker"
          message="Create a sobriety tracker before opening craving insights."
        />
      </View>
    );
  }

  if (cravings.length === 0) {
    return (
      <View style={styles.emptyState}>
        <GlassCard level={3} contentStyle={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No cravings logged yet</Text>
          <Text style={styles.emptyText}>
            Save your first craving and the pattern dashboard will start populating.
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push(`/(habits)/log-craving?habitId=${activeHabitId}`)}
          >
            <Text style={styles.primaryButtonText}>Log craving</Text>
          </Pressable>
        </GlassCard>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <View style={styles.headingBlock}>
          <Text style={styles.overline}>Insight layer</Text>
          <Text style={styles.title}>Craving insights</Text>
          <Text style={styles.subtitle}>
            Track what is happening around the moment, then look for repeatable escape routes.
          </Text>
        </View>
        <Pressable
          style={styles.linkButton}
          onPress={() => router.push(`/(habits)/log-craving?habitId=${activeHabitId}`)}
        >
          <MaterialSymbol name="add" size={16} color={HB_TEXT} />
          <Text style={styles.linkButtonText}>Log</Text>
        </Pressable>
      </View>

      <GlassCard level={4} style={styles.heroCard} contentStyle={styles.heroContent}>
        <View style={styles.heroStats}>
          <HeroStat label="Logged" value={String(cravings.length)} />
          <HeroStat label="Avg intensity" value={averageIntensity} />
          <HeroStat label="Resist rate" value={`${outcomeStats.resistRate}%`} />
        </View>
        <Text style={styles.heroInsight}>
          Peak pressure is currently around {formatHour(peakHour.hour)}.
        </Text>
      </GlassCard>

      <GlassCard level={3} contentStyle={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Trigger distribution</Text>
        <View style={styles.triggerSection}>
          <DonutChart
            data={triggerFrequency.slice(0, 5).map((item, index) => ({
              label: item.triggerName,
              value: item.count,
              color: DONUT_COLORS[index % DONUT_COLORS.length],
            }))}
          />
          <View style={styles.legendList}>
            {triggerFrequency.slice(0, 5).map((item, index) => (
              <View key={item.triggerName} style={styles.legendRow}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] },
                  ]}
                />
                <Text style={styles.legendText}>
                  {item.triggerName} · {item.count}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </GlassCard>

      <GlassCard level={3} contentStyle={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Time pattern</Text>
        <HourlyPatternChart data={hourlyCounts} />
        <Text style={styles.helperText}>
          {peakHour.count > 0
            ? `${peakHour.count} cravings were logged around ${formatHour(peakHour.hour)}.`
            : 'More logs will make the hourly pattern clearer.'}
        </Text>
      </GlassCard>

      <GlassCard level={3} contentStyle={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Intensity trend</Text>
        <IntensityTrendChart data={intensityTrend} />
        {intensityTrend.length > 0 ? (
          <View style={styles.trendLabels}>
            <Text style={styles.helperText}>{formatFriendlyDate(intensityTrend[0].weekStart)}</Text>
            <Text style={styles.helperText}>
              {formatFriendlyDate(intensityTrend[intensityTrend.length - 1].weekStart)}
            </Text>
          </View>
        ) : null}
      </GlassCard>

      <GlassCard level={3} contentStyle={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Strategy effectiveness</Text>
        <View style={styles.summaryStrip}>
          <SummaryPill label="Resisted" value={outcomeStats.resisted} color="#30D158" />
          <SummaryPill label="Delayed" value={outcomeStats.delayed} color="#8BCFF0" />
          <SummaryPill label="Distracted" value={outcomeStats.distracted} color="#FFB877" />
          <SummaryPill label="Gave in" value={outcomeStats.gaveIn} color="#FF8A80" />
        </View>
        <View style={styles.strategyList}>
          {strategyCounts.length > 0 ? strategyCounts.slice(0, 5).map((item) => (
            <View key={item.strategy} style={styles.strategyRow}>
              <Text style={styles.strategyText}>{item.strategy}</Text>
              <Text style={styles.strategyValue}>{item.count}</Text>
            </View>
          )) : (
            <Text style={styles.helperText}>No coping strategies logged yet.</Text>
          )}
        </View>
      </GlassCard>

      <GlassCard level={3} contentStyle={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Location heatmap</Text>
        {locationCounts.length > 0 ? (
          <View style={styles.locationList}>
            {locationCounts.slice(0, 5).map((entry, index) => (
              <View key={entry.location} style={styles.locationRow}>
                <Text style={styles.locationName}>{entry.location}</Text>
                <View style={styles.locationTrack}>
                  <View
                    style={[
                      styles.locationFill,
                      {
                        width: `${clamp(
                          (entry.count / locationCounts[0].count) * 100,
                          8,
                          100,
                        )}%`,
                        backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length],
                      },
                    ]}
                  />
                </View>
                <Text style={styles.locationCount}>{entry.count}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.helperText}>
            Location context has not been captured yet. New logs can include manual locations.
          </Text>
        )}
      </GlassCard>

      <GlassCard level={3} contentStyle={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Recent cravings</Text>
        <View style={styles.recentList}>
          {cravingRows.slice(0, 6).map((row) => (
            <View key={row.craving.id} style={styles.recentRow}>
              <View style={styles.recentBadge}>
                <Text style={styles.recentBadgeText}>{row.craving.intensity}</Text>
              </View>
              <View style={styles.recentCopy}>
                <Text style={styles.recentTitle}>
                  {row.triggers.slice(0, 2).map((trigger) => trigger.triggerName).join(' + ') || 'Craving logged'}
                </Text>
                <Text style={styles.recentMeta}>
                  {formatRelativeTimestamp(row.craving.loggedAt)}
                  {row.context.location ? ` · ${row.context.location}` : ''}
                  {row.craving.copingStrategy ? ` · ${row.craving.copingStrategy}` : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </GlassCard>
    </ScrollView>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

function SummaryPill({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={[styles.summaryPill, { backgroundColor: withAlpha(color, 0.14) }]}>
      <Text style={[styles.summaryPillValue, { color }]}>{value}</Text>
      <Text style={styles.summaryPillLabel}>{label}</Text>
    </View>
  );
}

function DonutChart({
  data,
}: {
  data: Array<{ label: string; value: number; color: string }>;
}) {
  const size = 156;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((sum, entry) => sum + entry.value, 0) || 1;
  let offset = 0;

  return (
    <View style={styles.donutWrap}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {data.map((entry) => {
          const dashLength = (entry.value / total) * circumference;
          const circle = (
            <Circle
              key={entry.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={entry.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${dashLength} ${circumference}`}
              strokeDashoffset={-offset}
              rotation={-90}
              origin={`${size / 2}, ${size / 2}`}
            />
          );
          offset += dashLength;
          return circle;
        })}
      </Svg>
      <View style={styles.donutCenter}>
        <Text style={styles.donutValue}>{total}</Text>
        <Text style={styles.donutLabel}>triggers</Text>
      </View>
    </View>
  );
}

function HourlyPatternChart({
  data,
}: {
  data: Array<{ hour: number; count: number }>;
}) {
  const max = Math.max(1, ...data.map((slot) => slot.count));

  return (
    <View style={styles.hourlyChart}>
      {data.map((slot) => (
        <View key={slot.hour} style={styles.hourlyColumn}>
          <View style={styles.hourlyTrack}>
            <View
              style={[
                styles.hourlyFill,
                {
                  height: `${clamp((slot.count / max) * 100, slot.count > 0 ? 8 : 0, 100)}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.hourlyLabel}>{slot.hour}</Text>
        </View>
      ))}
    </View>
  );
}

function IntensityTrendChart({
  data,
}: {
  data: Array<{ weekStart: string; averageIntensity: number; count: number }>;
}) {
  if (data.length <= 1) {
    return (
      <Text style={styles.helperText}>
        Weekly trend lines appear after multiple weeks of data.
      </Text>
    );
  }

  const width = 280;
  const height = 120;
  const values = data.map((point) => point.averageIntensity);
  const path = buildLinePath(values, width, height - 16);

  return (
    <View style={styles.lineChartWrap}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path
          d={`M 0 ${height - 16} H ${width}`}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
          fill="none"
        />
        <Path
          d={path}
          stroke={HB_ACCENT_LIGHT}
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {values.map((value, index) => {
          const x = (index / (values.length - 1)) * width;
          const min = Math.min(...values);
          const max = Math.max(...values);
          const range = max - min || 1;
          const y = (height - 16) - ((value - min) / range) * (height - 16);
          return (
            <Circle
              key={`${data[index].weekStart}-${value}`}
              cx={x}
              cy={y}
              r={5}
              fill={HB_SURFACES.base}
              stroke={HB_ACCENT_LIGHT}
              strokeWidth={3}
            />
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HB_SURFACES.base,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
    gap: 18,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: HB_SURFACES.base,
  },
  emptyCard: {
    gap: 12,
    alignItems: 'flex-start',
  },
  emptyTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 24,
    lineHeight: 28,
    color: HB_TEXT,
  },
  emptyText: {
    fontFamily: HB_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: HB_TEXT_SECONDARY,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  headingBlock: {
    flex: 1,
    gap: 4,
  },
  overline: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: HB_ACCENT_LIGHT,
  },
  title: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1,
    color: HB_TEXT,
  },
  subtitle: {
    fontFamily: HB_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: HB_TEXT_SECONDARY,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  linkButtonText: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
    color: HB_TEXT,
  },
  primaryButton: {
    borderRadius: 18,
    backgroundColor: HB_ACCENT_LIGHT,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  primaryButtonText: {
    fontFamily: HB_FONTS.bold,
    fontSize: 15,
    lineHeight: 18,
    color: HB_SURFACES.lowest,
  },
  heroCard: {
    shadowColor: HB_ACCENT,
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  heroContent: {
    gap: 16,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 12,
  },
  heroStat: {
    flex: 1,
    gap: 4,
  },
  heroStatValue: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 30,
    lineHeight: 34,
    color: HB_TEXT,
    fontVariant: ['tabular-nums'],
  },
  heroStatLabel: {
    fontFamily: HB_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: HB_TEXT_TERTIARY,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroInsight: {
    fontFamily: HB_FONTS.medium,
    fontSize: 14,
    lineHeight: 20,
    color: HB_ACCENT_LIGHT,
  },
  sectionCard: {
    gap: 14,
  },
  sectionLabel: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: HB_ACCENT_LIGHT,
  },
  triggerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  donutWrap: {
    width: 156,
    height: 156,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
    gap: 2,
  },
  donutValue: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 28,
    lineHeight: 32,
    color: HB_TEXT,
    fontVariant: ['tabular-nums'],
  },
  donutLabel: {
    fontFamily: HB_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    color: HB_TEXT_TERTIARY,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  legendList: {
    flex: 1,
    gap: 10,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontFamily: HB_FONTS.medium,
    fontSize: 13,
    lineHeight: 17,
    color: HB_TEXT,
    textTransform: 'capitalize',
  },
  helperText: {
    fontFamily: HB_FONTS.regular,
    fontSize: 12,
    lineHeight: 16,
    color: HB_TEXT_TERTIARY,
  },
  hourlyChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    minHeight: 120,
  },
  hourlyColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  hourlyTrack: {
    width: '100%',
    height: 90,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  hourlyFill: {
    width: '100%',
    borderRadius: 999,
    backgroundColor: HB_ACCENT_LIGHT,
    minHeight: 2,
  },
  hourlyLabel: {
    fontFamily: HB_FONTS.medium,
    fontSize: 9,
    lineHeight: 12,
    color: HB_TEXT_TERTIARY,
    fontVariant: ['tabular-nums'],
  },
  lineChartWrap: {
    alignItems: 'center',
  },
  trendLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryPillValue: {
    fontFamily: HB_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
  summaryPillLabel: {
    fontFamily: HB_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: HB_TEXT,
  },
  strategyList: {
    gap: 10,
  },
  strategyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  strategyText: {
    flex: 1,
    fontFamily: HB_FONTS.medium,
    fontSize: 14,
    lineHeight: 18,
    color: HB_TEXT,
  },
  strategyValue: {
    fontFamily: HB_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
    color: HB_ACCENT_LIGHT,
    fontVariant: ['tabular-nums'],
  },
  locationList: {
    gap: 10,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locationName: {
    width: 88,
    fontFamily: HB_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: HB_TEXT,
  },
  locationTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  locationFill: {
    height: 8,
    borderRadius: 999,
  },
  locationCount: {
    width: 20,
    textAlign: 'right',
    fontFamily: HB_FONTS.bold,
    fontSize: 12,
    lineHeight: 16,
    color: HB_TEXT_SECONDARY,
    fontVariant: ['tabular-nums'],
  },
  recentList: {
    gap: 12,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recentBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(167,139,250,0.16)',
  },
  recentBadgeText: {
    fontFamily: HB_FONTS.bold,
    fontSize: 15,
    lineHeight: 18,
    color: HB_ACCENT_LIGHT,
    fontVariant: ['tabular-nums'],
  },
  recentCopy: {
    flex: 1,
    gap: 2,
  },
  recentTitle: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: HB_TEXT,
    textTransform: 'capitalize',
  },
  recentMeta: {
    fontFamily: HB_FONTS.regular,
    fontSize: 12,
    lineHeight: 16,
    color: HB_TEXT_TERTIARY,
  },
});
