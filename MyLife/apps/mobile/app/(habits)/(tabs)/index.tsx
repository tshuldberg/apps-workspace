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
import {
  calculatePetMood,
  deleteCompletion,
  deleteMeasurement,
  deleteSession,
  endSession,
  getAllSobrietyProfiles,
  getAreas,
  getCompletionsForDate,
  getFreezesInMonth,
  getHabits,
  getMeasurementsForDate,
  getMeasurableStreaks,
  getNegativeStreaks,
  getPetState,
  getPlayerProfile,
  getSessionsForDate,
  getSleepRoutineContext,
  getStreaks,
  getXPProgress,
  recordCompletion,
  recordMeasurement,
  remainingFreezes,
  startSession,
  type Area,
  type Completion,
  type DayOfWeek,
  type Habit,
  type Measurement,
  type SleepRoutineContext,
  type TimedSession,
  GlassCard,
  HabitRow,
  MaterialSymbol,
  PetAvatar,
  SectionHeader,
  StreakFlame,
  XPBar,
  HB_ACCENT,
  HB_ACCENT_LIGHT,
  HB_STREAK,
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
  HeaderIconButton,
  resolveAreaColor,
} from '../../../components/habits/phase1-shared';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';

const TIME_GROUPS = [
  { key: 'morning', title: 'Morning', subtitle: '6am to 12pm' },
  { key: 'afternoon', title: 'Afternoon', subtitle: '12pm to 6pm' },
  { key: 'evening', title: 'Evening', subtitle: '6pm to 10pm' },
  { key: 'anytime', title: 'Anytime', subtitle: 'Flexible rituals' },
] as const;

type TimeGroupKey = (typeof TIME_GROUPS)[number]['key'];

const DAY_MAP: Record<number, DayOfWeek> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
};

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatTodayLabel(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function isDueOnDate(habit: Habit, date: Date) {
  const dateKey = toDateKey(date);

  if (habit.startDate && dateKey < habit.startDate) return false;
  if (habit.endDate && dateKey > habit.endDate) return false;

  const dayOfWeek = DAY_MAP[date.getDay()];

  if (habit.frequency === 'daily') return true;
  if (habit.frequency === 'specific_days' && habit.specificDays) {
    return habit.specificDays.includes(dayOfWeek);
  }
  if (habit.frequency === 'weekly') {
    return dayOfWeek === 'mon';
  }
  if (habit.frequency === 'monthly') {
    return date.getDate() === 1;
  }

  return true;
}

function getStreakForHabit(
  db: ReturnType<typeof useDatabase>,
  habit: Habit,
) {
  if (habit.habitType === 'measurable') {
    return getMeasurableStreaks(db, habit.id, habit.gracePeriod).currentStreak;
  }

  if (habit.habitType === 'negative') {
    return getNegativeStreaks(db, habit.id).daysSinceLastSlip;
  }

  return getStreaks(db, habit.id).currentStreak;
}

function getCompletionState(
  habit: Habit,
  completionsByHabitId: Map<string, Completion[]>,
  measurementsByHabitId: Map<string, Measurement[]>,
  sessionsByHabitId: Map<string, TimedSession[]>,
) {
  const completion = completionsByHabitId.get(habit.id)?.[0] ?? null;
  const measurement = measurementsByHabitId.get(habit.id)?.[0] ?? null;
  const session = sessionsByHabitId.get(habit.id)?.[0] ?? null;

  if (habit.habitType === 'measurable') {
    const progressLabel = measurement
      ? `${measurement.value}/${measurement.target}${habit.unit ? ` ${habit.unit}` : ''}`
      : `0/${habit.targetCount}${habit.unit ? ` ${habit.unit}` : ''}`;
    return {
      checked: measurement ? measurement.value >= measurement.target : false,
      completion,
      measurement,
      session,
      progressLabel,
    };
  }

  if (habit.habitType === 'timed') {
    return {
      checked: session?.completed ?? false,
      completion,
      measurement,
      session,
      progressLabel: session?.completed ? 'Done' : `${habit.targetCount}m`,
    };
  }

  if (habit.habitType === 'negative') {
    return {
      checked: false,
      completion,
      measurement,
      session,
      progressLabel: 'Track',
    };
  }

  return {
    checked: completion != null,
    completion,
    measurement,
    session,
    progressLabel: undefined,
  };
}

function buildLookup<T extends { habitId: string }>(items: T[]) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const existing = map.get(item.habitId) ?? [];
    existing.push(item);
    map.set(item.habitId, existing);
  }
  return map;
}

function QuickActionCard({
  icon,
  label,
  caption,
  color,
  onPress,
}: {
  icon: string;
  label: string;
  caption: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.quickActionWrap}>
      <GlassCard level={2} contentStyle={styles.quickActionCard}>
        <View style={[styles.quickActionIcon, { backgroundColor: withAlpha(color, 0.18) }]}>
          <MaterialSymbol
            name={icon}
            size={18}
            color={color}
            filled
          />
        </View>
        <Text style={styles.quickActionLabel}>
          {label}
        </Text>
        <Text style={styles.quickActionCaption}>
          {caption}
        </Text>
      </GlassCard>
    </Pressable>
  );
}

export default function HabitsTodayScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<TimeGroupKey, boolean>>({
    morning: false,
    afternoon: false,
    evening: false,
    anytime: false,
  });

  const today = useMemo(() => new Date(), [refreshKey]);
  const todayKey = toDateKey(today);
  const monthKey = todayKey.slice(0, 7);

  const screenState = useMemo(() => {
    try {
      const habits = getHabits(db, { isArchived: false, activeOnDate: todayKey });
      const areas = getAreas(db);
      const completions = getCompletionsForDate(db, todayKey);
      const measurements = getMeasurementsForDate(db, todayKey);
      const sessions = getSessionsForDate(db, todayKey);
      const playerProfile = getPlayerProfile(db);
      const petState = getPetState(db);
      const sobrietyProfiles = getAllSobrietyProfiles(db);
      const sleepRoutineContext = getSleepRoutineContext(db, { date: todayKey });
      const areasById = new Map(areas.map((area) => [area.id, area]));
      const completionsByHabitId = buildLookup(completions);
      const measurementsByHabitId = buildLookup(measurements);
      const sessionsByHabitId = buildLookup(sessions);
      const dueHabits = habits.filter((habit) => isDueOnDate(habit, today));
      const trackableHabits = dueHabits.filter((habit) => habit.habitType !== 'negative');

      const habitStates = new Map(
        dueHabits.map((habit) => [
          habit.id,
          getCompletionState(habit, completionsByHabitId, measurementsByHabitId, sessionsByHabitId),
        ]),
      );

      const sections = TIME_GROUPS.map((group) => {
        const items = dueHabits.filter((habit) => habit.timeOfDay === group.key);
        const completed = items.filter((habit) => habitStates.get(habit.id)?.checked).length;
        return {
          ...group,
          habits: items,
          completed,
        };
      });

      const completedTrackable = trackableHabits.filter((habit) => habitStates.get(habit.id)?.checked).length;
      const completionRate = trackableHabits.length > 0
        ? Math.round((completedTrackable / trackableHabits.length) * 100)
        : 0;

      const streakLeaders = dueHabits.map((habit) => {
        const currentStreak = getStreakForHabit(db, habit);
        return { habit, currentStreak };
      });
      const leadingStreak = streakLeaders.sort((left, right) => right.currentStreak - left.currentStreak)[0] ?? null;
      const freezeCount = leadingStreak ? getFreezesInMonth(db, leadingStreak.habit.id, monthKey).map((item) => item.freezeDate) : [];

      const xpProgress = getXPProgress(playerProfile?.totalXP ?? 0);
      const dailyXp = completions.length * 10 + measurements.length * 12 + sessions.filter((session) => session.completed).length * 15;
      const petMood = calculatePetMood(completedTrackable, Math.max(trackableHabits.length, 1));

      return {
        error: null as string | null,
        areasById,
        dueHabits,
        trackableHabits,
        habitStates,
        sections,
        completedTrackable,
        completionRate,
        leadingStreak,
        remainingFreezeCount: leadingStreak ? remainingFreezes(freezeCount, monthKey) : 0,
        playerProfile,
        xpProgress,
        dailyXp,
        petState,
        petMood,
        sleepRoutineContext,
        hasSobrietyMode: sobrietyProfiles.length > 0 || dueHabits.some((habit) => habit.habitType === 'negative'),
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Something went wrong loading Today.',
        areasById: new Map<string, Area>(),
        dueHabits: [] as Habit[],
        trackableHabits: [] as Habit[],
        habitStates: new Map<string, ReturnType<typeof getCompletionState>>(),
        sections: TIME_GROUPS.map((group) => ({ ...group, habits: [] as Habit[], completed: 0 })),
        completedTrackable: 0,
        completionRate: 0,
        leadingStreak: null as { habit: Habit; currentStreak: number } | null,
        remainingFreezeCount: 0,
        playerProfile: null,
        xpProgress: getXPProgress(0),
        dailyXp: 0,
        petState: null,
        petMood: 'neutral' as const,
        sleepRoutineContext: null as SleepRoutineContext | null,
        hasSobrietyMode: false,
      };
    }
  }, [db, monthKey, refreshKey, today, todayKey]);

  const insightCopy = useMemo(() => {
    if (screenState.completionRate >= 100) {
      return 'Perfect run today. Your sanctuary is glowing.';
    }
    if (screenState.completionRate >= 70) {
      return 'Momentum is building. One more check-in keeps the streak hot.';
    }
    if (screenState.completionRate > 0) {
      return 'Progress counts. Stack a small win before the day closes.';
    }
    return 'Fresh slate. Start with the easiest ritual and let the rest follow.';
  }, [screenState.completionRate]);

  const petDescriptor = useMemo(() => {
    const level = screenState.playerProfile?.currentLevel ?? screenState.xpProgress.level;
    const totalHabits = Math.max(screenState.trackableHabits.length, 1);
    const completionRatio = screenState.completedTrackable / totalHabits;
    return {
      pet: {
        name: screenState.petState?.name ?? 'Nova',
        species: screenState.petState?.species ?? 'fox',
        level,
      },
      stats: {
        hunger: Math.max(0.2, completionRatio),
        happiness: Math.min(1, completionRatio + 0.2),
        energy: Math.min(1, 0.35 + completionRatio * 0.65),
      },
    };
  }, [
    screenState.completedTrackable,
    screenState.petState?.name,
    screenState.petState?.species,
    screenState.playerProfile?.currentLevel,
    screenState.trackableHabits.length,
    screenState.xpProgress.level,
  ]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((value) => value + 1);
    setTimeout(() => setRefreshing(false), 160);
  }, []);

  const handleToggleHabit = useCallback((habit: Habit) => {
    const state = screenState.habitStates.get(habit.id);
    const now = new Date().toISOString();

    if (habit.habitType === 'negative') {
      router.push('/(habits)/sobriety-clock');
      return;
    }

    try {
      if (habit.habitType === 'standard') {
        if (state?.completion) {
          deleteCompletion(db, state.completion.id);
        } else {
          recordCompletion(db, uuid(), habit.id, now, 1);
        }
      } else if (habit.habitType === 'measurable') {
        if (state?.measurement) {
          deleteMeasurement(db, state.measurement.id);
        } else {
          recordMeasurement(db, uuid(), habit.id, now, habit.targetCount, habit.targetCount);
        }
      } else if (habit.habitType === 'timed') {
        if (state?.session) {
          deleteSession(db, state.session.id);
        }
        if (state?.completion) {
          deleteCompletion(db, state.completion.id);
        }
        if (!state?.session?.completed) {
          const sessionId = uuid();
          startSession(db, sessionId, habit.id, habit.targetCount);
          endSession(db, sessionId, habit.targetCount);
          recordCompletion(db, uuid(), habit.id, now, habit.targetCount);
        }
      }
      setRefreshKey((value) => value + 1);
    } catch {
      setRefreshKey((value) => value + 1);
    }
  }, [db, router, screenState.habitStates]);

  const toggleSection = useCallback((key: TimeGroupKey) => {
    setCollapsed((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }, []);

  if (screenState.error) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <EmptyGlassState
            title="Today is unavailable"
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
        <GlassCard level={4} contentStyle={styles.heroCard}>
          <View style={styles.heroEyebrowRow}>
            <FilterChip
              color={HB_STREAK.legendary}
              icon="bolt"
              label={screenState.leadingStreak?.habit.name ?? 'Fresh streak'}
              selected
            />
            {screenState.leadingStreak ? (
              <Text style={styles.freezeLabel}>
                {screenState.remainingFreezeCount} freeze{screenState.remainingFreezeCount === 1 ? '' : 's'} left
              </Text>
            ) : null}
          </View>
          <StreakFlame
            count={screenState.leadingStreak?.currentStreak ?? 0}
            frozen={screenState.remainingFreezeCount === 0 && (screenState.leadingStreak?.currentStreak ?? 0) > 0}
            showNumber={false}
            size={72}
          />
          <Text style={styles.heroValue}>
            {screenState.leadingStreak?.currentStreak ?? 0}
          </Text>
          <Text style={styles.heroLabel}>
            day streak
          </Text>
          <Text style={styles.heroCaption}>
            Best live streak across your active rituals.
          </Text>
        </GlassCard>

        <GlassCard level={2} contentStyle={styles.progressCard}>
          <View style={styles.progressHeaderRow}>
            <View>
              <Text style={styles.sectionEyebrow}>Daily progress</Text>
              <Text style={styles.progressValue}>
                {screenState.completionRate}%
              </Text>
            </View>
            <View style={styles.progressMeta}>
              <Text style={styles.progressMetaValue}>
                {screenState.completedTrackable}/{screenState.trackableHabits.length}
              </Text>
              <Text style={styles.progressMetaLabel}>habits done</Text>
            </View>
          </View>
          <XPBar
            current={screenState.completedTrackable}
            max={Math.max(screenState.trackableHabits.length, 1)}
            level={screenState.playerProfile?.currentLevel ?? screenState.xpProgress.level}
            showLevel={false}
          />
          <View style={styles.progressFooterRow}>
            <Text style={styles.progressFooterText}>
              {screenState.dailyXp} XP earned today
            </Text>
            <Text style={styles.progressFooterText}>
              Lv {screenState.xpProgress.level}
            </Text>
          </View>
        </GlassCard>

        {screenState.sleepRoutineContext ? (
          <GlassCard level={2} contentStyle={styles.sleepBridgeCard}>
            <View style={styles.sleepBridgeHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>Sleep routine context</Text>
                <Text style={styles.sleepBridgeTitle}>
                  {screenState.sleepRoutineContext.qualityRating}/5 sleep quality
                </Text>
              </View>
              <View style={styles.sleepBridgePill}>
                <Text style={styles.sleepBridgePillText}>
                  {screenState.sleepRoutineContext.completionRate}%
                </Text>
              </View>
            </View>
            <Text style={styles.sleepBridgeBody}>
              {screenState.sleepRoutineContext.context}
            </Text>
          </GlassCard>
        ) : null}

        <Pressable onPress={() => router.push('/(habits)/pet-detail')}>
          <GlassCard level={2} contentStyle={styles.petCard}>
            <View style={styles.petCopy}>
              <Text style={styles.sectionEyebrow}>Companion</Text>
              <Text style={styles.petTitle}>
                {petDescriptor.pet.name}
              </Text>
              <Text style={styles.petMood}>
                {screenState.petMood}
              </Text>
              <Text style={styles.petBody}>
                {screenState.completedTrackable === 0
                  ? 'Feed your momentum with one simple completion.'
                  : 'Your companion is brighter every time you keep the streak alive.'}
              </Text>
              <FilterChip
                color={HB_ACCENT}
                icon="pets"
                label={screenState.completedTrackable === 0 ? 'Check in' : 'Visit sanctuary'}
                selected
              />
            </View>
            <PetAvatar
              animate={false}
              pet={petDescriptor.pet}
              size={92}
              stats={petDescriptor.stats}
            />
          </GlassCard>
        </Pressable>

        <View style={styles.groupList}>
          {screenState.sections.map((section) => {
            if (section.habits.length === 0) {
              return null;
            }

            return (
              <GlassCard key={section.key} level={1} contentStyle={styles.groupCard}>
                <Pressable onPress={() => toggleSection(section.key)} style={styles.groupHeader}>
                  <View style={styles.groupHeaderCopy}>
                    <SectionHeader title={section.title} />
                    <Text style={styles.groupSubtitle}>
                      {section.subtitle}
                    </Text>
                  </View>
                  <View style={styles.groupMeta}>
                    <Text style={styles.groupCount}>
                      {section.completed}/{section.habits.length}
                    </Text>
                    <MaterialSymbol
                      name={collapsed[section.key] ? 'expand_more' : 'expand_less'}
                      size={18}
                      color={HB_TEXT_TERTIARY}
                    />
                  </View>
                </Pressable>

                {!collapsed[section.key] ? (
                  <View style={styles.groupHabits}>
                    {section.habits.map((habit) => {
                      const area = habit.areaId ? screenState.areasById.get(habit.areaId) ?? null : null;
                      const state = screenState.habitStates.get(habit.id);
                      return (
                        <HabitRow
                          key={habit.id}
                          area={area ? { name: area.name, color: resolveAreaColor(area.name, area.color), icon: area.icon } : null}
                          checked={state?.checked ?? false}
                          habit={habit}
                          onCheck={() => handleToggleHabit(habit)}
                          onPress={() => router.push(`/(habits)/${habit.id}`)}
                          progressLabel={state?.progressLabel}
                          streakCount={screenState.leadingStreak?.habit.id === habit.id ? screenState.leadingStreak.currentStreak : getStreakForHabit(db, habit)}
                        />
                      );
                    })}
                  </View>
                ) : null}
              </GlassCard>
            );
          })}
        </View>

        {screenState.sections.every((section) => section.habits.length === 0) ? (
          <EmptyGlassState
            title="No habits due right now"
            message="Your schedule is clear for today. Add a new ritual or browse the full habits library."
            actionLabel="Add habit"
            onPress={() => router.push('/(habits)/add-habit')}
          />
        ) : null}

        <View style={styles.quickActionsSection}>
          <SectionHeader title="Quick actions" />
          <View style={styles.quickActionGrid}>
            <QuickActionCard
              caption="Jump straight into a timer."
              color={HB_ACCENT}
              icon="timer"
              label="Focus Timer"
              onPress={() => router.push('/(habits)/focus-timer')}
            />
            {screenState.hasSobrietyMode ? (
              <QuickActionCard
                caption="Capture the moment and trigger."
                color={HB_STREAK.fire}
                icon="health_and_safety"
                label="Log Craving"
                onPress={() => router.push('/(habits)/log-craving')}
              />
            ) : null}
            <QuickActionCard
              caption="Reinforce routines that flow together."
              color={HB_ACCENT_LIGHT}
              icon="link"
              label="Stacking"
              onPress={() => router.push('/(habits)/stacking')}
            />
          </View>
        </View>

        <GlassCard level={1} contentStyle={styles.insightCard}>
          <Text style={styles.sectionEyebrow}>Daily insight</Text>
          <Text style={styles.insightText}>
            {insightCopy}
          </Text>
        </GlassCard>
      </ScrollView>
    </View>
  );
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
  headerCard: {
    paddingVertical: 14,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatarBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(HB_ACCENT, 0.24),
  },
  avatarInitials: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_TEXT,
    fontSize: 12,
    lineHeight: 14,
  },
  brandCopy: {
    gap: 2,
    flex: 1,
  },
  brandTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_ACCENT_LIGHT,
    fontSize: 22,
    lineHeight: 26,
  },
  brandSubtitle: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 16,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroCard: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  heroEyebrowRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  freezeLabel: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_TERTIARY,
    fontSize: 12,
    lineHeight: 16,
  },
  heroValue: {
    ...HB_TYPOGRAPHY.streakDisplay,
    color: HB_TEXT,
    fontSize: 56,
    lineHeight: 60,
  },
  heroLabel: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT_SECONDARY,
    textTransform: 'lowercase',
  },
  heroCaption: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_TERTIARY,
    textAlign: 'center',
  },
  progressCard: {
    gap: 14,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionEyebrow: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_ACCENT_LIGHT,
    fontSize: 10,
    lineHeight: 12,
  },
  progressValue: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
    fontSize: 38,
    lineHeight: 42,
    marginTop: 6,
  },
  progressMeta: {
    alignItems: 'flex-end',
    gap: 2,
  },
  progressMetaValue: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
    fontSize: 24,
    lineHeight: 28,
  },
  progressMetaLabel: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_TERTIARY,
    fontSize: 12,
    lineHeight: 16,
  },
  progressFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  progressFooterText: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 16,
  },
  sleepBridgeCard: {
    gap: 12,
  },
  sleepBridgeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  sleepBridgeTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
    fontSize: 22,
    lineHeight: 28,
    marginTop: 6,
  },
  sleepBridgePill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: withAlpha(HB_ACCENT_LIGHT, 0.18),
  },
  sleepBridgePillText: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_ACCENT_LIGHT,
    fontSize: 11,
    lineHeight: 13,
  },
  sleepBridgeBody: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    fontSize: 14,
    lineHeight: 21,
  },
  petCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  petCopy: {
    flex: 1,
    gap: 8,
  },
  petTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
    fontSize: 24,
    lineHeight: 28,
  },
  petMood: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_ACCENT_LIGHT,
    textTransform: 'capitalize',
  },
  petBody: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 18,
  },
  groupList: {
    gap: 16,
  },
  groupCard: {
    gap: 12,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  groupHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  groupSubtitle: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_TERTIARY,
    fontSize: 12,
    lineHeight: 16,
  },
  groupMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  groupCount: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_TEXT_SECONDARY,
    fontSize: 10,
    lineHeight: 12,
  },
  groupHabits: {
    gap: 10,
  },
  quickActionsSection: {
    gap: 12,
  },
  quickActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionWrap: {
    width: '47%',
  },
  quickActionCard: {
    minHeight: 118,
    gap: 10,
  },
  quickActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
    fontSize: 16,
    lineHeight: 20,
  },
  quickActionCaption: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 17,
  },
  insightCard: {
    gap: 8,
  },
  insightText: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT,
    fontSize: 15,
    lineHeight: 22,
  },
});
