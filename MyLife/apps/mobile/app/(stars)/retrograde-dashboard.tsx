import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Text } from '@mylife/ui';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  GlassCard,
  PlanetGlyph,
  SectionHeader,
  ST_ACCENT,
  ST_ACCENT_LIGHT,
  ST_FONTS,
  ST_SURFACES,
  ST_TEXT,
  ST_TEXT_SECONDARY,
  ST_TEXT_TERTIARY,
  computeRetrogradeStatuses,
  getActiveRetrogrades,
  getBirthProfiles,
  getRetrogradePersonalImpact,
  getUpcomingRetrogrades,
  getYearRetrogrades,
  withAlpha,
} from '@mylife/stars';
import type { RetrogradePeriod } from '@mylife/stars';

const PLANET_ORDER = [
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
] as const;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function daysBetween(start: string, end: string): number {
  const startTime = new Date(`${start}T00:00:00Z`).getTime();
  const endTime = new Date(`${end}T00:00:00Z`).getTime();
  return Math.round((endTime - startTime) / 86400000);
}

function formatDate(date: string | null): string {
  if (!date) {
    return 'Unknown';
  }

  const [, month, day] = date.split('-');
  return `${MONTH_NAMES[Number.parseInt(month, 10) - 1]} ${Number.parseInt(day, 10)}`;
}

function clampDate(date: string, year: number, side: 'start' | 'end'): string {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  if (side === 'start') {
    return date < yearStart ? yearStart : date;
  }

  return date > yearEnd ? yearEnd : date;
}

export default function RetrogradeDashboardScreen() {
  const db = useDatabase();
  const { width } = useWindowDimensions();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const currentYear = Number.parseInt(today.slice(0, 4), 10);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const statuses = useMemo(() => computeRetrogradeStatuses(today), [today]);
  const activeRetrogrades = useMemo(() => getActiveRetrogrades(statuses), [statuses]);
  const upcomingRetrogrades = useMemo(() => getUpcomingRetrogrades(statuses), [statuses]);
  const nextRetrograde = upcomingRetrogrades[0] ?? null;
  const yearRetrogrades = useMemo(() => getYearRetrogrades(currentYear), [currentYear]);

  const primaryProfile = useMemo(() => {
    try {
      return getBirthProfiles(db)[0] ?? null;
    } catch {
      return null;
    }
  }, [db]);

  const personalImpacts = useMemo(
    () => getRetrogradePersonalImpact(statuses, primaryProfile),
    [primaryProfile, statuses],
  );

  const historicalRetrogrades = useMemo(
    () => yearRetrogrades.filter((period) => period.end < today).sort((left, right) => right.end.localeCompare(left.end)),
    [today, yearRetrogrades],
  );

  const chartWidth = Math.max(width - 32, 760);
  const labelWidth = 84;
  const innerWidth = chartWidth - labelWidth - 12;
  const rowHeight = 38;
  const chartHeight = PLANET_ORDER.length * rowHeight + 18;
  const yearStart = `${currentYear}-01-01`;
  const yearEnd = `${currentYear}-12-31`;
  const totalDays = Math.max(daysBetween(yearStart, yearEnd), 1);
  const todayProgress = Math.min(Math.max(daysBetween(yearStart, today) / totalDays, 0), 1);
  const todayX = labelWidth + innerWidth * todayProgress;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <GlassCard variant="high" style={styles.heroCard}>
        <SectionHeader eyebrow="Retrogrades" title="Cosmic Navigation System" />
        <Text style={styles.heroSubtitle}>
          {activeRetrogrades.length === 0
            ? 'All clear right now. Use the dashboard to prepare for the next review cycle.'
            : `${activeRetrogrades.length} active retrograde${activeRetrogrades.length === 1 ? '' : 's'} are shaping the tone of the sky.`}
        </Text>

        {activeRetrogrades.length > 0 ? (
          <View style={styles.activeList}>
            {activeRetrogrades.map((retrograde) => (
              <View key={retrograde.body} style={styles.activeRow}>
                <PlanetGlyph planet={retrograde.body} sign={retrograde.retrogradeSign ?? undefined} retrograde size={20} />
                <View style={styles.activeCopy}>
                  <Text style={styles.activeTitle}>
                    {capitalize(retrograde.body)} in {retrograde.retrogradeSign ? capitalize(retrograde.retrogradeSign) : 'Unknown'}
                  </Text>
                  <Text style={styles.activeMeta}>
                    {formatDate(retrograde.retrogradeStart)} to {formatDate(retrograde.retrogradeEnd)}
                  </Text>
                </View>
                <View style={styles.countdownPill}>
                  <Text style={styles.countdownPillText}>
                    {retrograde.retrogradeEnd ? `${Math.max(daysBetween(today, retrograde.retrogradeEnd), 0)}d left` : 'Active'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.allClearCard}>
            <Text style={styles.allClearTitle}>No active retrogrades</Text>
            <Text style={styles.allClearBody}>Use the year chart below to watch the next stations before they arrive.</Text>
          </View>
        )}
      </GlassCard>

      {nextRetrograde ? (
        <GlassCard style={styles.nextCard}>
          <SectionHeader eyebrow="Next Up" title={`${capitalize(nextRetrograde.body)} retrograde`} />
          <View style={styles.nextRow}>
            <PlanetGlyph planet={nextRetrograde.body} sign={nextRetrograde.retrogradeSign ?? undefined} size={22} />
            <View style={styles.nextCopy}>
              <Text style={styles.nextCountdown}>
                Starts in {nextRetrograde.daysUntilStart} day{nextRetrograde.daysUntilStart === 1 ? '' : 's'}
              </Text>
              <Text style={styles.nextMeta}>
                {formatDate(nextRetrograde.retrogradeStart)} to {formatDate(nextRetrograde.retrogradeEnd)}
              </Text>
            </View>
          </View>
        </GlassCard>
      ) : null}

      <GlassCard style={styles.timelineCard}>
        <SectionHeader eyebrow="Annual Chart" title={`${currentYear} retrograde timeline`} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.timelineWrap}>
            <Svg width={chartWidth} height={chartHeight}>
              {PLANET_ORDER.map((planet, index) => {
                const y = index * rowHeight + 10;
                const periods = yearRetrogrades.filter((period) => period.body === planet);
                const activeStatus = activeRetrogrades.find((retrograde) => retrograde.body === planet);

                return (
                  <G key={planet}>
                    <Rect
                      x={labelWidth}
                      y={y + 12}
                      width={innerWidth}
                      height={12}
                      rx={6}
                      fill={withAlpha(ST_SURFACES.highest, 0.88)}
                    />

                    {periods.map((period) => {
                      const clampedStart = clampDate(period.start, currentYear, 'start');
                      const clampedEnd = clampDate(period.end, currentYear, 'end');
                      const startOffset = daysBetween(yearStart, clampedStart);
                      const endOffset = daysBetween(yearStart, clampedEnd);
                      const barX = labelWidth + (startOffset / totalDays) * innerWidth;
                      const barWidth = Math.max(((endOffset - startOffset) / totalDays) * innerWidth, 8);
                      const isActive = period.start <= today && period.end >= today;

                      return (
                        <Rect
                          key={`${period.body}-${period.start}`}
                          x={barX}
                          y={y + 12}
                          width={barWidth}
                          height={12}
                          rx={6}
                          fill={isActive ? '#FF8A80' : withAlpha(ST_ACCENT, 0.7)}
                        />
                      );
                    })}

                    <Line
                      x1={todayX}
                      x2={todayX}
                      y1={8}
                      y2={chartHeight - 12}
                      stroke={withAlpha(ST_TEXT, 0.35)}
                      strokeWidth={2}
                      strokeDasharray="4 4"
                    />

                    <SvgText
                      x={0}
                      y={y + 22}
                      fontFamily={ST_FONTS.medium}
                      fontSize={12}
                      fill={activeStatus ? ST_ACCENT_LIGHT : ST_TEXT_SECONDARY}
                    >
                      {capitalize(planet)}
                    </SvgText>
                  </G>
                );
              })}
            </Svg>

            <View style={[styles.monthAxis, { width: chartWidth - labelWidth, marginLeft: labelWidth }]}>
              {MONTH_NAMES.map((month) => (
                <Text key={month} style={styles.monthAxisLabel}>
                  {month}
                </Text>
              ))}
            </View>
          </View>
        </ScrollView>
      </GlassCard>

      {activeRetrogrades.length > 0 ? (
        <View style={styles.sectionStack}>
          {activeRetrogrades.map((retrograde) => (
            <GlassCard key={retrograde.body} style={styles.tipCard}>
              <SectionHeader
                eyebrow="Survival Tips"
                title={`${capitalize(retrograde.body)} retrograde`}
                action={
                  <Text style={styles.tipMeta}>
                    {retrograde.retrogradeSign ? capitalize(retrograde.retrogradeSign) : 'Unknown sign'}
                  </Text>
                }
              />
              <Text style={styles.tipBody}>{retrograde.interpretation}</Text>
              <View style={styles.tipList}>
                {retrograde.survivalTips.slice(0, 4).map((tip) => (
                  <View key={tip} style={styles.tipRow}>
                    <View style={styles.tipDot} />
                    <Text style={styles.tipText}>{tip}</Text>
                  </View>
                ))}
              </View>
            </GlassCard>
          ))}
        </View>
      ) : null}

      <GlassCard style={styles.personalCard}>
        <SectionHeader eyebrow="Personal Impact" title="How it hits your chart" />
        {primaryProfile ? (
          personalImpacts.length > 0 ? (
            <View style={styles.impactList}>
              {personalImpacts.map((impact) => (
                <View key={impact.body} style={styles.impactRow}>
                  <PlanetGlyph planet={impact.body} sign={impact.sign} retrograde size={18} />
                  <View style={styles.impactCopy}>
                    <Text style={styles.impactTitle}>
                      {capitalize(impact.body)} through {capitalize(impact.sign)}
                    </Text>
                    <Text style={styles.impactBody}>{impact.summary}</Text>
                    {impact.aspectNotes.length > 0 ? (
                      <Text style={styles.impactMeta}>{impact.aspectNotes.join(' • ')}</Text>
                    ) : null}
                  </View>
                  {impact.houseNumber != null ? (
                    <View style={styles.housePill}>
                      <Text style={styles.housePillText}>House {impact.houseNumber}</Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.personalBody}>No active retrogrades are strongly aspecting your current saved placements.</Text>
          )
        ) : (
          <Text style={styles.personalBody}>
            Add a birth profile to map retrogrades to your rising sign, houses, and major placements.
          </Text>
        )}
      </GlassCard>

      <GlassCard style={styles.historyCard}>
        <Pressable onPress={() => setHistoryExpanded((value) => !value)} style={styles.historyHeader}>
          <View style={styles.historyHeaderCopy}>
            <Text style={styles.historyEyebrow}>History</Text>
            <Text style={styles.historyTitle}>Past retrogrades this year</Text>
          </View>
          <View style={styles.historyToggle}>
            <Text style={styles.historyToggleText}>{historyExpanded ? 'Hide' : 'Show'}</Text>
          </View>
        </Pressable>

        {historyExpanded ? (
          historicalRetrogrades.length > 0 ? (
            <View style={styles.historyList}>
              {historicalRetrogrades.map((period) => (
                <RetrogradeHistoryRow key={`${period.body}-${period.start}`} period={period} />
              ))}
            </View>
          ) : (
            <Text style={styles.personalBody}>No retrograde periods have completed yet this year.</Text>
          )
        ) : null}
      </GlassCard>
    </ScrollView>
  );
}

function RetrogradeHistoryRow({ period }: { period: RetrogradePeriod }) {
  return (
    <View style={styles.historyRow}>
      <PlanetGlyph planet={period.body} sign={period.sign} retrograde size={18} />
      <View style={styles.historyCopy}>
        <Text style={styles.historyItemTitle}>
          {capitalize(period.body)} in {capitalize(period.sign)}
        </Text>
        <Text style={styles.historyItemMeta}>
          {formatDate(period.start)} to {formatDate(period.end)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ST_SURFACES.base,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
    gap: 16,
  },
  heroCard: {
    gap: 12,
  },
  heroSubtitle: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: ST_TEXT_SECONDARY,
  },
  activeList: {
    gap: 10,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: withAlpha(ST_SURFACES.highest, 0.42),
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  activeCopy: {
    flex: 1,
    gap: 3,
  },
  activeTitle: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 15,
    color: ST_TEXT,
  },
  activeMeta: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: ST_TEXT_SECONDARY,
  },
  countdownPill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: withAlpha('#FF8A80', 0.18),
  },
  countdownPillText: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 11,
    color: '#FFB4AB',
    letterSpacing: 0.3,
  },
  allClearCard: {
    gap: 6,
    paddingTop: 4,
  },
  allClearTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 18,
    color: ST_TEXT,
  },
  allClearBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: ST_TEXT_SECONDARY,
  },
  nextCard: {
    gap: 12,
  },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nextCopy: {
    flex: 1,
    gap: 4,
  },
  nextCountdown: {
    fontFamily: ST_FONTS.bold,
    fontSize: 18,
    color: ST_TEXT,
  },
  nextMeta: {
    fontFamily: ST_FONTS.medium,
    fontSize: 13,
    color: ST_TEXT_SECONDARY,
  },
  timelineCard: {
    gap: 14,
  },
  timelineWrap: {
    gap: 12,
  },
  monthAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingRight: 8,
  },
  monthAxisLabel: {
    fontFamily: ST_FONTS.medium,
    fontSize: 10,
    color: ST_TEXT_TERTIARY,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionStack: {
    gap: 16,
  },
  tipCard: {
    gap: 12,
  },
  tipMeta: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: ST_ACCENT_LIGHT,
  },
  tipBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: ST_TEXT_SECONDARY,
  },
  tipList: {
    gap: 10,
  },
  tipRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  tipDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    marginTop: 8,
    backgroundColor: ST_ACCENT_LIGHT,
  },
  tipText: {
    flex: 1,
    fontFamily: ST_FONTS.medium,
    fontSize: 13,
    lineHeight: 20,
    color: ST_TEXT_SECONDARY,
  },
  personalCard: {
    gap: 12,
  },
  personalBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: ST_TEXT_SECONDARY,
  },
  impactList: {
    gap: 12,
  },
  impactRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: withAlpha(ST_SURFACES.highest, 0.38),
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  impactCopy: {
    flex: 1,
    gap: 4,
  },
  impactTitle: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 15,
    color: ST_TEXT,
  },
  impactBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: ST_TEXT_SECONDARY,
  },
  impactMeta: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: ST_TEXT_TERTIARY,
  },
  housePill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: withAlpha(ST_ACCENT, 0.16),
  },
  housePillText: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 11,
    color: ST_ACCENT_LIGHT,
  },
  historyCard: {
    gap: 12,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  historyHeaderCopy: {
    gap: 4,
  },
  historyEyebrow: {
    fontFamily: ST_FONTS.medium,
    fontSize: 11,
    color: ST_TEXT_TERTIARY,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  historyTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 18,
    color: ST_TEXT,
  },
  historyToggle: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: withAlpha(ST_SURFACES.highest, 0.72),
  },
  historyToggleText: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 11,
    color: ST_TEXT_SECONDARY,
  },
  historyList: {
    gap: 10,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyCopy: {
    flex: 1,
    gap: 2,
  },
  historyItemTitle: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 14,
    color: ST_TEXT,
  },
  historyItemMeta: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: ST_TEXT_SECONDARY,
  },
});
