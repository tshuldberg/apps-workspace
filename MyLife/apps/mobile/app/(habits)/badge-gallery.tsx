import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import {
  BADGE_CATALOG,
  BadgeTile,
  GlassCard,
  HB_ACCENT,
  HB_ACCENT_LIGHT,
  HB_SURFACES,
  HB_TEXT,
  HB_TEXT_SECONDARY,
  HB_TEXT_TERTIARY,
  HB_TYPOGRAPHY,
  HB_VIOLET_GLOW_STYLE,
  MaterialSymbol,
  SectionHeader,
  calculateSobrietyDuration,
  getAllFocusSessions,
  getAllSobrietyProfiles,
  getBadgeProgress,
  getCompletions,
  getEarnedBadges,
  getHabits,
  getMilestoneProgress,
  getOverallStats,
  getRecentPledgeDates,
  getStreaks,
  withAlpha,
  type Badge,
  type BadgeDefinition,
  type UserBadgeStats,
} from '@mylife/habits';
import { useDatabase } from '../../components/DatabaseProvider';

type FilterId = 'all' | 'streaks' | 'sessions' | 'milestones' | 'special' | 'recent';

type BadgeSection = {
  key: string;
  title: string;
  accent: string;
  badges: BadgeDefinition[];
};

const FILTERS: Array<{ id: FilterId; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'streaks', label: 'Streaks' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'milestones', label: 'Milestones' },
  { id: 'special', label: 'Special' },
  { id: 'recent', label: 'Recent' },
];

function toDateKey(value: string) {
  return value.slice(0, 10);
}

function dayDiff(a: string, b: string) {
  const left = new Date(`${a}T00:00:00Z`).getTime();
  const right = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((right - left) / (24 * 60 * 60 * 1000));
}

function countConsecutiveDates(dates: string[]) {
  if (dates.length === 0) return 0;

  let best = 1;
  let current = 1;

  for (let index = 1; index < dates.length; index += 1) {
    if (dayDiff(dates[index - 1], dates[index]) === 1) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }

  return best;
}

function getBadgeSymbol(badge: BadgeDefinition) {
  if (badge.category === 'streak') return 'local_fire_department';
  if (badge.category === 'sobriety') return 'health_and_safety';
  if (badge.category === 'collection') return 'list_alt';

  switch (badge.key) {
    case 'special_focus_master':
      return 'timer';
    case 'special_comeback':
      return 'bolt';
    case 'special_pledge_keeper':
      return 'favorite';
    case 'special_perfect_day':
    case 'special_perfect_week':
      return 'military_tech';
    default:
      return 'check_circle';
  }
}

function describeUnlockRequirement(badge: BadgeDefinition) {
  switch (badge.category) {
    case 'streak':
      return `Reach a ${badge.threshold}-day streak.`;
    case 'completion':
      return `Log ${badge.threshold.toLocaleString()} completions.`;
    case 'sobriety':
      return `Stay clean for ${badge.threshold.toLocaleString()} days.`;
    case 'collection':
      return `Create ${badge.threshold.toLocaleString()} habits.`;
    case 'special':
      return badge.description;
  }
}

function buildUserBadgeStats(db: ReturnType<typeof useDatabase>): UserBadgeStats {
  const habits = getHabits(db, { isArchived: false });
  const overall = getOverallStats(db);
  const longestStreak = habits.reduce((best, habit) => Math.max(best, getStreaks(db, habit.id).longestStreak), 0);

  const completionsByDate = new Map<string, Set<string>>();
  let latestCompletionDate: string | null = null;

  for (const habit of habits) {
    const completions = getCompletions(db, habit.id);
    for (const completion of completions) {
      const date = toDateKey(completion.completedAt);
      const bucket = completionsByDate.get(date) ?? new Set<string>();
      bucket.add(habit.id);
      completionsByDate.set(date, bucket);
      if (latestCompletionDate == null || date > latestCompletionDate) {
        latestCompletionDate = date;
      }
    }
  }

  const perfectDates = [...completionsByDate.entries()]
    .filter(([, completedHabits]) => habits.length > 0 && completedHabits.size >= habits.length)
    .map(([date]) => date)
    .sort();

  const focusSessions = getAllFocusSessions(db).filter((session) => session.status === 'completed').length;
  const sobrietyDays = getAllSobrietyProfiles(db).reduce((best, profile) => {
    const duration = calculateSobrietyDuration(profile.quitDate, Date.now());
    return Math.max(best, duration.totalDays);
  }, 0);

  const pledgeStreak = getAllSobrietyProfiles(db).reduce((best, profile) => {
    const dates = getRecentPledgeDates(db, profile.id, 45)
      .map((date) => date.slice(0, 10))
      .sort();
    return Math.max(best, countConsecutiveDates(dates));
  }, 0);

  const today = toDateKey(new Date().toISOString());
  const daysSinceLastCompletion = latestCompletionDate == null ? 0 : Math.max(0, dayDiff(latestCompletionDate, today));

  return {
    longestStreak,
    totalCompletions: overall.totalCompletions,
    sobrietyDays,
    habitCount: habits.length,
    perfectDays: perfectDates.length,
    perfectWeekDays: countConsecutiveDates(perfectDates),
    focusSessions,
    daysSinceLastCompletion,
    pledgeStreak,
  };
}

function HeroProgressRing({
  progress,
  label,
}: {
  progress: number;
  label: string;
}) {
  const size = 96;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <View style={styles.ringWrap}>
      <Svg height={size} width={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={withAlpha(HB_ACCENT_LIGHT, 0.14)}
          strokeWidth={strokeWidth}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          origin={`${size / 2}, ${size / 2}`}
          r={radius}
          rotation="-90"
          stroke={HB_ACCENT_LIGHT}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - clamped)}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
        />
      </Svg>
      <View style={styles.ringLabelWrap}>
        <Text style={styles.ringValue}>{Math.round(clamped * 100)}%</Text>
        <Text style={styles.ringCaption}>{label}</Text>
      </View>
    </View>
  );
}

function EmptySection({
  message,
}: {
  message: string;
}) {
  return (
    <GlassCard level={1} style={styles.emptySection}>
      <Text style={styles.emptySectionText}>{message}</Text>
    </GlassCard>
  );
}

export default function BadgeGalleryScreen() {
  const db = useDatabase();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<FilterId>('all');
  const [selected, setSelected] = useState<BadgeDefinition | null>(null);

  const data = useMemo(() => {
    try {
      const earnedBadges = getEarnedBadges(db);
      const badgeStats = buildUserBadgeStats(db);
      const milestoneProgress = getMilestoneProgress(db);
      const earnedMap = new Map<string, Badge>();

      for (const badge of earnedBadges) {
        earnedMap.set(badge.badgeKey, badge);
      }

      const sections: BadgeSection[] = [
        {
          key: 'streaks',
          title: 'Streaks',
          accent: '#FFB877',
          badges: BADGE_CATALOG.filter((badge) => badge.category === 'streak'),
        },
        {
          key: 'sessions',
          title: 'Sessions',
          accent: HB_ACCENT_LIGHT,
          badges: BADGE_CATALOG.filter((badge) => badge.category === 'completion'),
        },
        {
          key: 'milestones',
          title: 'Milestones',
          accent: '#FFD60A',
          badges: BADGE_CATALOG.filter((badge) => badge.category === 'collection'),
        },
        {
          key: 'special',
          title: 'Special Achievements',
          accent: '#8BCFF0',
          badges: BADGE_CATALOG.filter((badge) => badge.category === 'special' || badge.category === 'sobriety'),
        },
      ];

      return {
        badgeStats,
        earnedBadges,
        earnedMap,
        milestoneProgress,
        sections,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unable to load achievements right now.',
      };
    }
  }, [db]);

  if ('error' in data) {
    return (
      <View style={styles.screen}>
        <GlassCard level={2} style={styles.errorCard}>
          <MaterialSymbol color={HB_ACCENT_LIGHT} filled name="military_tech" size={24} />
          <Text style={styles.errorTitle}>Achievements unavailable</Text>
          <Text style={styles.errorBody}>{data.error}</Text>
        </GlassCard>
      </View>
    );
  }

  const completionRate = BADGE_CATALOG.length === 0
    ? 0
    : data.earnedMap.size / BADGE_CATALOG.length;

  const visibleSections = filter === 'all'
    ? data.sections
    : filter === 'recent'
      ? []
      : data.sections.filter((section) => section.key === filter);

  const recentBadges = data.earnedBadges.slice(0, 6);
  const tileWidth = Math.max(156, (width - 56) / 2);
  const selectedBadgeState = selected == null ? null : data.earnedMap.get(selected.key);
  const selectedProgress = selected == null
    ? null
    : getBadgeProgress(selected, data.badgeStats, selectedBadgeState != null);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <GlassCard level={4} style={styles.heroCard} contentStyle={styles.heroInner}>
          <LinearGradient
            colors={[withAlpha(HB_ACCENT_LIGHT, 0.18), withAlpha(HB_ACCENT, 0.02)]}
            end={{ x: 0.9, y: 1 }}
            start={{ x: 0.1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.heroTextBlock}>
            <Text style={styles.eyebrow}>Collection</Text>
            <Text style={styles.heroTitle}>Your Badges</Text>
            <Text style={styles.heroCount}>
              {data.earnedMap.size} / {BADGE_CATALOG.length} earned
            </Text>
            <Text style={styles.heroSubtitle}>
              Milestones, streak relics, and special wins all land here as your habit system compounds.
            </Text>
          </View>
          <HeroProgressRing label="Complete" progress={completionRate} />
        </GlassCard>

        <ScrollView
          contentContainerStyle={styles.filterRail}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {FILTERS.map((item) => {
            const active = item.id === filter;
            return (
              <Pressable
                key={item.id}
                onPress={() => setFilter(item.id)}
                style={[styles.filterChip, active ? styles.filterChipActive : null]}
              >
                <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {filter === 'recent' ? (
          <>
            <SectionHeader title="Recent Unlocks" />
            {recentBadges.length === 0 ? (
              <EmptySection message="Your latest unlocks will appear here once you start stacking wins." />
            ) : (
              <View style={styles.grid}>
                {recentBadges.map((badge) => (
                  <View key={badge.id} style={[styles.tileWrap, { width: tileWidth }]}>
                    <BadgeTile
                      badge={{
                        name: BADGE_CATALOG.find((entry) => entry.key === badge.badgeKey)?.name ?? badge.badgeKey,
                        description: BADGE_CATALOG.find((entry) => entry.key === badge.badgeKey)?.description ?? 'Achievement unlocked',
                        icon: getBadgeSymbol(BADGE_CATALOG.find((entry) => entry.key === badge.badgeKey) ?? BADGE_CATALOG[0]),
                        category: 'recent',
                      }}
                      earned
                      onPress={() => {
                        const definition = BADGE_CATALOG.find((entry) => entry.key === badge.badgeKey);
                        if (definition) {
                          setSelected(definition);
                        }
                      }}
                    />
                  </View>
                ))}
              </View>
            )}

            <SectionHeader title="Milestone Timeline" />
            {data.milestoneProgress.recentAchievements.length === 0 ? (
              <EmptySection message="Custom and per-habit milestones will show up here as soon as they are achieved." />
            ) : (
              <View style={styles.timelineList}>
                {data.milestoneProgress.recentAchievements.map((milestone) => (
                  <GlassCard key={milestone.id} level={2} style={styles.timelineCard}>
                    <View style={styles.timelineIcon}>
                      <Text style={styles.timelineEmoji}>{milestone.emoji ?? '🏁'}</Text>
                    </View>
                    <View style={styles.timelineBody}>
                      <Text style={styles.timelineTitle}>{milestone.label}</Text>
                      <Text style={styles.timelineMeta}>
                        {milestone.milestoneType.replace('_', ' ')} · {milestone.threshold.toLocaleString()}
                      </Text>
                    </View>
                    <Text style={styles.timelineDate}>
                      {milestone.achievedAt?.slice(0, 10) ?? ''}
                    </Text>
                  </GlassCard>
                ))}
              </View>
            )}
          </>
        ) : (
          visibleSections.map((section) => (
            <View key={section.key} style={styles.sectionBlock}>
              <SectionHeader
                accent={section.accent}
                title={section.title}
              />
              <View style={styles.grid}>
                {section.badges.map((badge) => {
                  const earned = data.earnedMap.has(badge.key);
                  const progress = getBadgeProgress(badge, data.badgeStats, earned);

                  return (
                    <View key={badge.key} style={[styles.tileWrap, { width: tileWidth }]}>
                      <BadgeTile
                        badge={{
                          name: badge.name,
                          description: badge.description,
                          icon: getBadgeSymbol(badge),
                          category: badge.category,
                        }}
                        earned={earned}
                        onPress={() => setSelected(badge)}
                        progress={progress.progress}
                      />
                    </View>
                  );
                })}
              </View>

              {section.key === 'milestones' ? (
                <GlassCard level={2} style={styles.milestoneSummaryCard}>
                  <SectionHeader title="Milestone Board" />
                  <View style={styles.summaryRow}>
                    <View style={styles.summaryStat}>
                      <Text style={styles.summaryValue}>{data.milestoneProgress.achievedCount}</Text>
                      <Text style={styles.summaryLabel}>Achieved</Text>
                    </View>
                    <View style={styles.summaryStat}>
                      <Text style={styles.summaryValue}>{data.milestoneProgress.pendingCount}</Text>
                      <Text style={styles.summaryLabel}>Pending</Text>
                    </View>
                    <View style={styles.summaryStat}>
                      <Text style={styles.summaryValue}>{data.milestoneProgress.total}</Text>
                      <Text style={styles.summaryLabel}>Total</Text>
                    </View>
                  </View>
                </GlassCard>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={() => setSelected(null)}
        transparent
        visible={selected != null}
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setSelected(null)}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.sheetFrame}>
            <GlassCard level={5} style={styles.sheetCard} contentStyle={styles.sheetInner}>
              {selected != null && selectedProgress != null ? (
                <>
                  <View style={styles.sheetHandle} />
                  <View style={styles.sheetBadgeWrap}>
                    <View style={styles.sheetBadgeOrb}>
                      <MaterialSymbol
                        color={HB_TEXT}
                        filled={data.earnedMap.has(selected.key)}
                        name={getBadgeSymbol(selected)}
                        size={38}
                      />
                    </View>
                  </View>
                  <Text style={styles.sheetTitle}>{selected.name}</Text>
                  <Text style={styles.sheetDescription}>{selected.description}</Text>

                  <View style={styles.sheetMetaRow}>
                    <View style={styles.metaPill}>
                      <Text style={styles.metaPillText}>{selected.category}</Text>
                    </View>
                    {selectedBadgeState != null ? (
                      <View style={[styles.metaPill, styles.metaPillEarned]}>
                        <Text style={[styles.metaPillText, styles.metaPillEarnedText]}>Earned</Text>
                      </View>
                    ) : null}
                  </View>

                  <GlassCard level={2} style={styles.detailCard}>
                    <Text style={styles.detailLabel}>Unlock Criteria</Text>
                    <Text style={styles.detailValue}>{describeUnlockRequirement(selected)}</Text>
                  </GlassCard>

                  {selectedBadgeState != null ? (
                    <GlassCard level={2} style={[styles.detailCard, styles.detailCardGlow]}>
                      <Text style={styles.detailLabel}>Earned On</Text>
                      <Text style={styles.detailValue}>{selectedBadgeState.unlockedAt.slice(0, 10)}</Text>
                    </GlassCard>
                  ) : (
                    <GlassCard level={2} style={styles.detailCard}>
                      <View style={styles.progressHeader}>
                        <Text style={styles.detailLabel}>Progress</Text>
                        <Text style={styles.progressText}>
                          {selectedProgress.current.toLocaleString()} / {selectedProgress.target.toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.progressTrack}>
                        <LinearGradient
                          colors={[HB_ACCENT_LIGHT, HB_ACCENT]}
                          end={{ x: 1, y: 0.5 }}
                          start={{ x: 0, y: 0.5 }}
                          style={[styles.progressFill, { width: `${selectedProgress.progress * 100}%` }]}
                        />
                      </View>
                      <Text style={styles.progressHint}>
                        {selectedProgress.remaining.toLocaleString()} remaining
                      </Text>
                    </GlassCard>
                  )}
                </>
              ) : null}
            </GlassCard>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HB_SURFACES.lowest,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
    gap: 20,
  },
  heroCard: {
    overflow: 'hidden',
    ...HB_VIOLET_GLOW_STYLE,
  },
  heroInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    justifyContent: 'space-between',
    minHeight: 180,
  },
  heroTextBlock: {
    flex: 1,
    gap: 8,
  },
  eyebrow: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_ACCENT_LIGHT,
  },
  heroTitle: {
    ...HB_TYPOGRAPHY.displayLg,
    color: HB_TEXT,
    fontSize: 34,
    lineHeight: 38,
  },
  heroCount: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
  },
  heroSubtitle: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  ringWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLabelWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
    fontSize: 18,
  },
  ringCaption: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_TEXT_TERTIARY,
  },
  filterRail: {
    gap: 10,
    paddingRight: 20,
  },
  filterChip: {
    backgroundColor: HB_SURFACES.low,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  filterChipActive: {
    backgroundColor: withAlpha(HB_ACCENT, 0.2),
  },
  filterChipText: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    fontSize: 13,
    lineHeight: 18,
  },
  filterChipTextActive: {
    color: HB_TEXT,
    fontFamily: HB_TYPOGRAPHY.headlineMd.fontFamily,
  },
  sectionBlock: {
    gap: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tileWrap: {
    flexGrow: 1,
  },
  milestoneSummaryCard: {
    marginTop: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  summaryStat: {
    flex: 1,
    backgroundColor: withAlpha(HB_ACCENT_LIGHT, 0.08),
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 6,
  },
  summaryValue: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
    fontSize: 24,
    lineHeight: 28,
  },
  summaryLabel: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_TEXT_TERTIARY,
  },
  timelineList: {
    gap: 12,
  },
  timelineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  timelineIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(HB_ACCENT_LIGHT, 0.12),
  },
  timelineEmoji: {
    fontSize: 22,
  },
  timelineBody: {
    flex: 1,
    gap: 4,
  },
  timelineTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
    fontSize: 17,
    lineHeight: 22,
  },
  timelineMeta: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 16,
    textTransform: 'capitalize',
  },
  timelineDate: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_TEXT_TERTIARY,
  },
  emptySection: {
    minHeight: 88,
  },
  emptySectionText: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 15, 0.8)',
    justifyContent: 'flex-end',
  },
  sheetFrame: {
    paddingHorizontal: 12,
    paddingBottom: 18,
  },
  sheetCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  sheetInner: {
    alignItems: 'center',
    gap: 16,
    paddingTop: 10,
    paddingBottom: 28,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: withAlpha(HB_TEXT_TERTIARY, 0.4),
  },
  sheetBadgeWrap: {
    marginTop: 4,
  },
  sheetBadgeOrb: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(HB_ACCENT_LIGHT, 0.16),
  },
  sheetTitle: {
    ...HB_TYPOGRAPHY.displayLg,
    color: HB_TEXT,
    fontSize: 30,
    lineHeight: 34,
    textAlign: 'center',
  },
  sheetDescription: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    textAlign: 'center',
  },
  sheetMetaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metaPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: HB_SURFACES.high,
  },
  metaPillText: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_TEXT_SECONDARY,
  },
  metaPillEarned: {
    backgroundColor: withAlpha(HB_ACCENT_LIGHT, 0.16),
  },
  metaPillEarnedText: {
    color: HB_ACCENT_LIGHT,
  },
  detailCard: {
    width: '100%',
  },
  detailCardGlow: {
    ...HB_VIOLET_GLOW_STYLE,
  },
  detailLabel: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_TEXT_TERTIARY,
    marginBottom: 8,
  },
  detailValue: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  progressText: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 16,
  },
  progressTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: HB_SURFACES.high,
    overflow: 'hidden',
    marginTop: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressHint: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 10,
  },
  errorCard: {
    margin: 20,
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
  },
  errorTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
  },
  errorBody: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    textAlign: 'center',
  },
});
