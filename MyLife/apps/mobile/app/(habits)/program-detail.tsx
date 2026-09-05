import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  BUILT_IN_PROGRAMS,
  HB_ACCENT,
  HB_ACCENT_LIGHT,
  HB_FONTS,
  HB_STREAK,
  HB_SURFACES,
  HB_TEXT,
  HB_TEXT_SECONDARY,
  HB_TEXT_TERTIARY,
  HB_TYPOGRAPHY,
  GlassCard,
  MaterialSymbol,
  enrollInProgram,
  getProgramDayPlan,
  getProgramProgress,
  unenrollFromProgram,
  withAlpha,
} from '@mylife/habits';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  buildProgramCoverUri,
  formatProgramDifficulty,
  getProgramDifficultyColor,
} from './programs-ui';

export default function ProgramDetailScreen() {
  const { programId } = useLocalSearchParams<{ programId: string }>();
  const db = useDatabase();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedDays, setExpandedDays] = useState<number[]>([]);

  useFocusEffect(
    useCallback(() => {
      setRefreshKey((value) => value + 1);
    }, []),
  );

  const program = BUILT_IN_PROGRAMS.find((entry) => entry.id === programId) ?? null;
  const progress = useMemo(
    () => (programId ? getProgramProgress(db, programId) : null),
    [db, programId, refreshKey],
  );

  const scheduleDays = useMemo(() => {
    if (!program) {
      return [];
    }

    if (progress) {
      return progress.days;
    }

    return Array.from({ length: program.durationDays }, (_, index) => {
      const day = index + 1;
      return {
        day,
        target: program.schedule[index] ?? null,
        completed: false,
        items: getProgramDayPlan(program, day),
      };
    });
  }, [program, progress]);

  const activeDay = program
    ? Math.min(progress?.currentDay ?? 1, program.durationDays)
    : 1;

  useEffect(() => {
    if (!program) return;
    setExpandedDays((current) => {
      if (current.length > 0) return current;
      return uniqueNumbers([activeDay, 1]);
    });
  }, [activeDay, program]);

  const toggleDay = useCallback((day: number) => {
    setExpandedDays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day],
    );
  }, []);

  const handleShare = useCallback(async () => {
    if (!program) return;
    try {
      await Share.share({
        message: `${program.name}: ${program.description}`,
      });
    } catch {
      Alert.alert('Could not share', 'Try again in a moment.');
    }
  }, [program]);

  const handlePrimaryAction = useCallback(() => {
    if (!program) return;

    try {
      if (!progress) {
        enrollInProgram(db, program.id);
        setRefreshKey((value) => value + 1);
        return;
      }

      if (progress.status === 'active' && progress.habitIds[0]) {
        router.push({
          pathname: '/(habits)/[id]',
          params: { id: progress.habitIds[0] },
        });
        return;
      }

      enrollInProgram(db, program.id);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      Alert.alert(
        'Could not update program',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }, [db, program, progress, router]);

  const handleUnenroll = useCallback(() => {
    if (!program || !progress || progress.status !== 'active') return;

    Alert.alert(
      'Leave this program?',
      'Your progress stays visible, but the active challenge will stop tracking new days.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unenroll',
          style: 'destructive',
          onPress: () => {
            try {
              unenrollFromProgram(db, program.id);
              setRefreshKey((value) => value + 1);
            } catch (error) {
              Alert.alert(
                'Could not unenroll',
                error instanceof Error ? error.message : 'Please try again.',
              );
            }
          },
        },
      ],
    );
  }, [db, program, progress]);

  if (!program) {
    return (
      <View style={styles.emptyScreen}>
        <GlassCard level={1} contentStyle={styles.emptyCard}>
          <MaterialSymbol name="close" size={22} color={HB_TEXT_TERTIARY} />
          <RNText style={styles.emptyTitle}>Program not found</RNText>
          <RNText style={styles.emptyBody}>
            This challenge is not available in the current build.
          </RNText>
        </GlassCard>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <GlassCard level={2} contentStyle={styles.heroCard}>
          <Image
            source={{ uri: buildProgramCoverUri(program) }}
            contentFit="cover"
            style={styles.heroImage}
          />
          <LinearGradient
            colors={['rgba(14,14,19,0)', 'rgba(14,14,19,0.95)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.heroGradient}
          />

          <View style={styles.heroContent}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroStatusChip}>
                <RNText style={styles.heroStatusText}>
                  {progress?.status === 'active'
                    ? 'Active'
                    : progress?.status === 'completed'
                      ? 'Completed'
                      : 'Browse'}
                </RNText>
              </View>
              <Pressable onPress={handleShare} style={styles.shareButton}>
                <MaterialSymbol name="share" size={18} color={HB_TEXT} />
              </Pressable>
            </View>

            <RNText style={styles.heroTitle}>{program.name}</RNText>
            <RNText style={styles.heroBody}>{program.description}</RNText>

            <View style={styles.heroStatsRow}>
              <StatPill label="Days" value={String(program.durationDays)} />
              <StatPill label="Difficulty" value={formatProgramDifficulty(program.difficulty)} />
              <StatPill label="Habits" value={String(program.habitBlueprints.length)} />
              <StatPill label="Outcomes" value={String(program.expectedOutcomes.length)} />
            </View>
          </View>
        </GlassCard>

        <GlassCard level={1} contentStyle={styles.progressCard}>
          <View style={styles.progressHeader}>
            <View>
              <RNText style={styles.sectionLabel}>Program progress</RNText>
              <RNText style={styles.sectionTitle}>
                {progress
                  ? `${progress.completedDays} tracked days`
                  : 'Preview before you enroll'}
              </RNText>
            </View>
            <RNText style={styles.progressPercent}>
              {progress ? `${progress.completionRate}%` : '--'}
            </RNText>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress?.elapsedPercent ?? 0}%` },
              ]}
            />
          </View>

          <View style={styles.progressMetrics}>
            <ProgressMetric label="Current day" value={String(activeDay)} />
            <ProgressMetric
              label="Today target"
              value={progress?.todayTarget != null ? String(progress.todayTarget) : '--'}
            />
            <ProgressMetric label="Streak" value={progress ? `${progress.streak}` : '--'} />
            <ProgressMetric label="Enrolled" value={program.enrolledCount.toLocaleString()} />
          </View>
        </GlassCard>

        <GlassCard level={1} contentStyle={styles.scheduleCard}>
          <View style={styles.scheduleHeader}>
            <View>
              <RNText style={styles.sectionLabel}>Day-by-day schedule</RNText>
              <RNText style={styles.sectionTitle}>Follow the plan at your pace</RNText>
            </View>
            <RNText style={styles.scheduleHint}>Tap a day to expand it.</RNText>
          </View>

          <View style={styles.scheduleList}>
            {scheduleDays.map((dayEntry) => {
              const expanded = expandedDays.includes(dayEntry.day);
              const current = dayEntry.day === activeDay;

              return (
                <View key={dayEntry.day} style={styles.dayCard}>
                  <Pressable
                    onPress={() => toggleDay(dayEntry.day)}
                    style={[
                      styles.dayHeader,
                      current ? styles.dayHeaderCurrent : null,
                    ]}
                  >
                    <View style={styles.dayHeaderLeft}>
                      <View
                        style={[
                          styles.dayBadge,
                          dayEntry.completed ? styles.dayBadgeDone : current ? styles.dayBadgeCurrent : null,
                        ]}
                      >
                        <RNText style={styles.dayBadgeText}>{dayEntry.day}</RNText>
                      </View>
                      <View style={styles.dayCopy}>
                        <RNText style={styles.dayTitle}>Day {dayEntry.day}</RNText>
                        <RNText style={styles.dayMeta}>
                          Target {dayEntry.target ?? '--'} {dayEntry.items[0]?.unit ?? ''}
                        </RNText>
                      </View>
                    </View>
                    <View style={styles.dayHeaderRight}>
                      {dayEntry.completed ? (
                        <MaterialSymbol name="check_circle" size={18} color={HB_STREAK.fire} filled />
                      ) : current ? (
                        <RNText style={styles.currentChip}>Current</RNText>
                      ) : null}
                      <MaterialSymbol
                        name="chevron_right"
                        size={18}
                        color={HB_TEXT_TERTIARY}
                        style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}
                      />
                    </View>
                  </Pressable>

                  {expanded ? (
                    <View style={styles.dayBody}>
                      {dayEntry.items.map((item) => (
                        <View key={item.key} style={styles.dayPlanRow}>
                          <View style={styles.dayPlanLeft}>
                            <RNText style={styles.dayPlanEmoji}>{item.icon}</RNText>
                            <View style={styles.dayPlanCopy}>
                              <RNText style={styles.dayPlanTitle}>{item.name}</RNText>
                              <RNText style={styles.dayPlanMeta}>
                                {item.description}
                              </RNText>
                            </View>
                          </View>
                          <RNText style={styles.dayPlanTarget}>
                            {item.target} {item.unit ?? ''}
                          </RNText>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </GlassCard>

        <GlassCard level={1} contentStyle={styles.benefitsCard}>
          <RNText style={styles.sectionLabel}>Benefits / science</RNText>
          <RNText style={styles.sectionTitle}>Why this program works</RNText>
          <View style={styles.benefitList}>
            {program.benefits.map((benefit) => (
              <View key={benefit} style={styles.benefitRow}>
                <View style={styles.bullet} />
                <RNText style={styles.benefitText}>{benefit}</RNText>
              </View>
            ))}
          </View>

          <View style={styles.scienceCard}>
            <MaterialSymbol name="psychology" size={18} color={HB_ACCENT_LIGHT} />
            <RNText style={styles.scienceText}>{program.scienceNote}</RNText>
          </View>
        </GlassCard>

        <GlassCard level={1} contentStyle={styles.outcomesCard}>
          <View style={styles.outcomesHeader}>
            <View>
              <RNText style={styles.sectionLabel}>Expected outcomes</RNText>
              <RNText style={styles.sectionTitle}>What you should feel by the end</RNText>
            </View>
            <RNText style={[styles.enrolledCount, { color: getProgramDifficultyColor(program.difficulty) }]}>
              {program.enrolledCount.toLocaleString()} enrolled
            </RNText>
          </View>

          <View style={styles.outcomesPills}>
            {program.expectedOutcomes.map((outcome) => (
              <View key={outcome} style={styles.outcomePill}>
                <RNText style={styles.outcomeText}>{outcome}</RNText>
              </View>
            ))}
          </View>
        </GlassCard>

        <View style={styles.footerActions}>
          <Pressable onPress={handlePrimaryAction} style={styles.primaryButton}>
            <LinearGradient
              colors={[HB_ACCENT_LIGHT, HB_ACCENT]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryGradient}
            >
              <RNText style={styles.primaryText}>
                {!progress
                  ? 'Enroll'
                  : progress.status === 'active'
                    ? 'Continue'
                    : 'Start again'}
              </RNText>
            </LinearGradient>
          </Pressable>

          {progress?.status === 'active' ? (
            <Pressable onPress={handleUnenroll} style={styles.secondaryButton}>
              <RNText style={styles.secondaryText}>Unenroll</RNText>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statPill}>
      <RNText style={styles.statPillLabel}>{label}</RNText>
      <RNText style={styles.statPillValue}>{value}</RNText>
    </View>
  );
}

function ProgressMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.progressMetric}>
      <RNText style={styles.progressMetricValue}>{value}</RNText>
      <RNText style={styles.progressMetricLabel}>{label}</RNText>
    </View>
  );
}

function uniqueNumbers(values: number[]) {
  return [...new Set(values)];
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HB_SURFACES.lowest,
  },
  content: {
    padding: 20,
    paddingBottom: 140,
    gap: 16,
  },
  heroCard: {
    padding: 0,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: 280,
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroContent: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
    gap: 14,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroStatusChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: withAlpha(HB_ACCENT, 0.28),
  },
  heroStatusText: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 11,
    color: HB_TEXT,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(HB_SURFACES.base, 0.56),
  },
  heroTitle: {
    ...HB_TYPOGRAPHY.displayLg,
    color: HB_TEXT,
  },
  heroBody: {
    fontFamily: HB_FONTS.regular,
    fontSize: 15,
    lineHeight: 24,
    color: HB_TEXT_SECONDARY,
    maxWidth: '90%',
  },
  heroStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statPill: {
    minWidth: '47%',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: withAlpha(HB_SURFACES.base, 0.56),
    gap: 4,
  },
  statPillLabel: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_TEXT_TERTIARY,
  },
  statPillValue: {
    fontFamily: HB_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
    color: HB_TEXT,
  },
  progressCard: {
    gap: 14,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-end',
  },
  sectionLabel: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_ACCENT_LIGHT,
  },
  sectionTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 20,
    lineHeight: 24,
    color: HB_TEXT,
    marginTop: 6,
  },
  progressPercent: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 26,
    lineHeight: 30,
    color: HB_ACCENT_LIGHT,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: withAlpha(HB_SURFACES.highest, 0.82),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: HB_ACCENT_LIGHT,
  },
  progressMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  progressMetric: {
    flex: 1,
    minWidth: '45%',
    padding: 14,
    borderRadius: 18,
    backgroundColor: withAlpha(HB_SURFACES.high, 0.72),
    gap: 4,
  },
  progressMetricValue: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 22,
    lineHeight: 26,
    color: HB_TEXT,
  },
  progressMetricLabel: {
    fontFamily: HB_FONTS.medium,
    fontSize: 12,
    color: HB_TEXT_TERTIARY,
  },
  scheduleCard: {
    gap: 14,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-end',
  },
  scheduleHint: {
    fontFamily: HB_FONTS.medium,
    fontSize: 12,
    color: HB_TEXT_TERTIARY,
    maxWidth: '42%',
    textAlign: 'right',
  },
  scheduleList: {
    gap: 10,
  },
  dayCard: {
    borderRadius: 20,
    backgroundColor: withAlpha(HB_SURFACES.high, 0.72),
    overflow: 'hidden',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dayHeaderCurrent: {
    backgroundColor: withAlpha(HB_ACCENT, 0.12),
  },
  dayHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  dayHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dayBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(HB_SURFACES.highest, 0.86),
  },
  dayBadgeDone: {
    backgroundColor: withAlpha(HB_STREAK.fire, 0.3),
  },
  dayBadgeCurrent: {
    backgroundColor: withAlpha(HB_ACCENT, 0.3),
  },
  dayBadgeText: {
    fontFamily: HB_FONTS.bold,
    fontSize: 13,
    color: HB_TEXT,
  },
  dayCopy: {
    flex: 1,
  },
  dayTitle: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 15,
    color: HB_TEXT,
  },
  dayMeta: {
    fontFamily: HB_FONTS.medium,
    fontSize: 12,
    color: HB_TEXT_SECONDARY,
    marginTop: 2,
  },
  currentChip: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 11,
    color: HB_ACCENT_LIGHT,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dayBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  dayPlanRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: withAlpha(HB_SURFACES.base, 0.58),
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dayPlanLeft: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    flex: 1,
  },
  dayPlanEmoji: {
    fontSize: 20,
  },
  dayPlanCopy: {
    flex: 1,
  },
  dayPlanTitle: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 14,
    color: HB_TEXT,
  },
  dayPlanMeta: {
    fontFamily: HB_FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
    color: HB_TEXT_SECONDARY,
    marginTop: 2,
  },
  dayPlanTarget: {
    fontFamily: HB_FONTS.bold,
    fontSize: 13,
    color: HB_ACCENT_LIGHT,
  },
  benefitsCard: {
    gap: 14,
  },
  benefitList: {
    gap: 10,
  },
  benefitRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: HB_ACCENT_LIGHT,
    marginTop: 8,
  },
  benefitText: {
    flex: 1,
    fontFamily: HB_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: HB_TEXT_SECONDARY,
  },
  scienceCard: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: withAlpha(HB_ACCENT, 0.12),
  },
  scienceText: {
    flex: 1,
    fontFamily: HB_FONTS.medium,
    fontSize: 13,
    lineHeight: 20,
    color: HB_TEXT,
  },
  outcomesCard: {
    gap: 12,
  },
  outcomesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-end',
  },
  enrolledCount: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 12,
  },
  outcomesPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  outcomePill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: withAlpha(HB_SURFACES.high, 0.82),
  },
  outcomeText: {
    fontFamily: HB_FONTS.medium,
    fontSize: 12,
    color: HB_TEXT,
  },
  footerActions: {
    gap: 10,
  },
  primaryButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: withAlpha(HB_ACCENT, 1),
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  primaryGradient: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontFamily: HB_FONTS.bold,
    fontSize: 15,
    color: '#120B26',
  },
  secondaryButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: withAlpha(HB_SURFACES.high, 0.76),
  },
  secondaryText: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 14,
    color: HB_TEXT_SECONDARY,
  },
  emptyScreen: {
    flex: 1,
    backgroundColor: HB_SURFACES.lowest,
    padding: 20,
  },
  emptyCard: {
    gap: 10,
  },
  emptyTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 18,
    color: HB_TEXT,
  },
  emptyBody: {
    fontFamily: HB_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: HB_TEXT_SECONDARY,
  },
});
