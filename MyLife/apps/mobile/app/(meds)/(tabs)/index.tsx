import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  decrementPillCount,
  getLowSupplyAlerts,
  getMoodEntriesForDate,
  getRegimenSummary,
  getRemindersForMedication,
  getWellnessScore,
  logDose,
  snoozeReminder,
  type ScheduledDose,
} from '@mylife/meds';
import {
  DoseCard,
  GlassCard,
  MD_ACCENT_LIGHT,
  MD_CHROME_GOLD,
  MD_DOSE_STATUS,
  MD_FONTS,
  MD_SURFACES,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TEXT_TERTIARY,
  MD_TYPOGRAPHY,
  MoodChip,
  SectionHeader,
  VitalStat,
  WellnessRing,
  withAlpha,
} from '@mylife/meds/ui';
import {
  EmptyGlassState,
  MetricBadge,
  ProgressBar,
  ScreenTitleBlock,
  SectionStack,
  createDoseTone,
  formatRelativeMinutes,
  getPartOfDayLabel,
  parseMedsDashboardSections,
  toDateKey,
  type MedsHomeStyle,
} from '../../../components/meds/phase1';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';

type SummaryState = ReturnType<typeof getRegimenSummary>;

type TodayVital = {
  id: string;
  label: string;
  route: string;
  status: string;
  unit: string;
  value: string;
};

function mapBPStatus(status: string) {
  switch (status) {
    case 'hypertension_1':
      return 'stage1';
    case 'hypertension_2':
      return 'stage2';
    default:
      return status;
  }
}

function mapGlucoseStatus(status: string) {
  switch (status) {
    case 'in_range':
      return 'normal';
    case 'very_low':
      return 'low';
    case 'very_high':
      return 'high';
    default:
      return status;
  }
}

function buildTodaysGroups(summary: SummaryState, now: Date, homeStyle: MedsHomeStyle) {
  if (homeStyle === 'timeline' || homeStyle === 'simple') {
    const title = homeStyle === 'timeline' ? 'Timeline' : 'Today';
    return [{
      title,
      doses: [...summary.todaySchedule]
        .sort((left, right) => left.scheduledTime.localeCompare(right.scheduledTime))
        .map((item) => ({
          ...item,
          tone: createDoseTone(item.status, item.scheduledTime, now),
        })),
    }];
  }

  const grouped = new Map<string, Array<ScheduledDose & { tone: keyof typeof MD_DOSE_STATUS }>>();

  for (const item of summary.todaySchedule) {
    const label = getPartOfDayLabel(item.scheduledTime);
    const list = grouped.get(label) ?? [];
    list.push({
      ...item,
      tone: createDoseTone(item.status, item.scheduledTime, now),
    });
    grouped.set(label, list);
  }

  return Array.from(grouped.entries()).map(([title, doses]) => ({
    title,
    doses: doses.sort((left, right) => left.scheduledTime.localeCompare(right.scheduledTime)),
  }));
}

function buildVitalCards(db: ReturnType<typeof useDatabase>, summary: SummaryState): TodayVital[] {
  const heartRateRows = db.query<{ value: string; measured_at: string }>(
    `SELECT value, measured_at
     FROM md_measurements
     WHERE type = 'heart_rate'
     ORDER BY measured_at DESC
     LIMIT 1`,
  );
  const weightRows = db.query<{ value: string; measured_at: string }>(
    `SELECT value, measured_at
     FROM md_measurements
     WHERE type = 'weight'
     ORDER BY measured_at DESC
     LIMIT 1`,
  );

  const latestBP = summary.vitals.latestBP
    ? {
        id: 'bp',
        label: 'BP',
        route: '/(meds)/bp-history',
        status: mapBPStatus(summary.vitals.latestBP.category),
        unit: 'mmHg',
        value: `${summary.vitals.latestBP.systolic}/${summary.vitals.latestBP.diastolic}`,
      }
    : null;

  const latestGlucose = summary.vitals.latestGlucose
    ? {
        id: 'glucose',
        label: 'Glucose',
        route: '/(meds)/glucose-history',
        status: mapGlucoseStatus(summary.vitals.latestGlucose.rangeStatus),
        unit: summary.vitals.latestGlucose.unit,
        value: `${Math.round(summary.vitals.latestGlucose.value)}`,
      }
    : null;

  const latestHeartRate = heartRateRows[0]
    ? {
        id: 'heart-rate',
        label: 'Heart Rate',
        route: '/(meds)/(tabs)/measurement-trends',
        status: Number(heartRateRows[0].value) > 100 ? 'stage1' : 'normal',
        unit: 'bpm',
        value: `${Math.round(Number(heartRateRows[0].value))}`,
      }
    : null;

  const latestWeight = weightRows[0]
    ? {
        id: 'weight',
        label: 'Weight',
        route: '/(meds)/(tabs)/measurement-trends',
        status: 'normal',
        unit: 'lbs',
        value: `${Math.round(Number(weightRows[0].value))}`,
      }
    : null;

  return [latestBP, latestGlucose, latestHeartRate ?? latestWeight].filter(
    (item): item is TodayVital => Boolean(item),
  );
}

export default function TodayScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [minuteTick, setMinuteTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMinuteTick((value) => value + 1);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const now = useMemo(() => new Date(), [minuteTick]);
  const todayKey = toDateKey(now);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((value) => value + 1);
    setTimeout(() => setRefreshing(false), 250);
  }, []);

  const screenState = useMemo(() => {
    try {
      const summary = getRegimenSummary(db, now);
      const moodEntries = getMoodEntriesForDate(db, todayKey);
      const wellness = getWellnessScore(db);
      const refillAlerts = getLowSupplyAlerts(db);
      const vitals = buildVitalCards(db, summary);
      const homeStyleRows = db.query<{ value: string }>(
        'SELECT value FROM hub_settings WHERE key = ?',
        ['meds.home_style'],
      );
      const sectionsRows = db.query<{ value: string }>(
        'SELECT value FROM hub_settings WHERE key = ?',
        ['meds.dashboard_sections'],
      );
      return {
        dashboardSections: parseMedsDashboardSections(sectionsRows[0]?.value),
        error: null,
        homeStyle: (homeStyleRows[0]?.value as MedsHomeStyle | undefined) ?? 'timeline',
        moodEntries,
        refillAlerts,
        summary,
        vitals,
        wellness,
      };
    } catch (error) {
      console.error('TodayScreen load failed', error);
      return {
        error: 'Unable to load today’s clinical dashboard.',
        dashboardSections: parseMedsDashboardSections(null),
        homeStyle: 'timeline' as MedsHomeStyle,
        moodEntries: [],
        refillAlerts: [],
        summary: null,
        vitals: [],
        wellness: null,
      };
    }
  }, [db, now, refreshKey, todayKey]);

  const summary = screenState.summary;
  const wellness = screenState.wellness;

  const groupedSchedule = useMemo(
    () => (summary ? buildTodaysGroups(summary, now, screenState.homeStyle) : []),
    [now, screenState.homeStyle, summary],
  );

  const nextDose = useMemo(() => {
    if (!summary) {
      return null;
    }

    const schedule = [...summary.todaySchedule].sort((left, right) =>
      left.scheduledTime.localeCompare(right.scheduledTime),
    );

    return schedule.find((item) => !['taken', 'late', 'skipped'].includes(item.status)) ?? schedule[0] ?? null;
  }, [summary]);

  const completionRate = summary?.todayProgress.total
    ? Math.round((summary.todayProgress.taken / summary.todayProgress.total) * 100)
    : 0;

  const handleTakeDose = useCallback((dose: ScheduledDose) => {
    logDose(db, uuid(), {
      medicationId: dose.medicationId,
      scheduledTime: dose.scheduledTime,
      actualTime: new Date().toISOString(),
      status: 'taken',
    });
    decrementPillCount(db, dose.medicationId);
    setRefreshKey((value) => value + 1);
  }, [db]);

  const handleSkipDose = useCallback((dose: ScheduledDose) => {
    logDose(db, uuid(), {
      medicationId: dose.medicationId,
      scheduledTime: dose.scheduledTime,
      status: 'skipped',
    });
    setRefreshKey((value) => value + 1);
  }, [db]);

  const handleSnoozeDose = useCallback((dose: ScheduledDose) => {
    const reminderTime = dose.scheduledTime.slice(11, 16);
    const reminder = getRemindersForMedication(db, dose.medicationId).find(
      (item) => item.time === reminderTime && item.isActive,
    );

    if (!reminder) {
      Alert.alert('No reminder found', 'This dose does not have a reminder to snooze.');
      return;
    }

    snoozeReminder(db, reminder.id, 15);
    setRefreshKey((value) => value + 1);
  }, [db]);

  if (screenState.error || !summary || !wellness) {
    return (
      <View style={styles.screen}>
        <EmptyGlassState
          actionLabel="Retry"
          message={screenState.error ?? 'Unable to load today’s dashboard.'}
          onPress={onRefresh}
          title="Clinical feed unavailable"
        />
      </View>
    );
  }

  if (summary.activeMedicationCount === 0) {
    return (
      <View style={styles.screen}>
        <EmptyGlassState
          actionLabel="Start setup"
          message="Add your first medication to unlock schedules, vitals, and wellness trends."
          onPress={() => router.push('/(meds)/onboarding')}
          title="No medications yet"
        />
      </View>
    );
  }

  const topInsight = summary.topInsights[0] ?? null;
  const nextDoseTone = nextDose
    ? createDoseTone(nextDose.status, nextDose.scheduledTime, now)
    : 'upcoming';
  const compactSections = new Set(
    screenState.dashboardSections
      .filter((section) => section.density === 'compact')
      .map((section) => section.id),
  );

  const scheduleSection = (
    <GlassCard
      padding={compactSections.has('schedule') ? 14 : 18}
      style={styles.scheduleCard}
    >
      <SectionHeader
        action={
          <Text style={styles.sectionMeta}>
            {new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </Text>
        }
        title={screenState.homeStyle === 'pillbox' ? 'Today by time of day' : 'Today timeline'}
      />
      <ProgressBar value={completionRate} />
      {groupedSchedule.length > 0 ? (
        groupedSchedule.map((group) => (
          <View key={group.title} style={styles.scheduleGroup}>
            {screenState.homeStyle === 'pillbox' || groupedSchedule.length > 1 ? (
              <Text style={styles.groupTitle}>
                {group.title} · {group.doses.length}
              </Text>
            ) : null}
            <View style={styles.groupStack}>
              {group.doses.map((item) => (
                <DoseCard
                  key={`${item.medicationId}-${item.scheduledTime}`}
                  dose={item.dosage ?? '1 dose'}
                  medication={item.medicationName}
                  onPress={() => router.push('/(meds)/history')}
                  onSkip={
                    ['due', 'upcoming'].includes(item.tone)
                      ? () => handleSkipDose(item)
                      : undefined
                  }
                  onSnooze={
                    item.tone === 'due'
                      ? () => handleSnoozeDose(item)
                      : undefined
                  }
                  onTake={
                    ['due', 'upcoming'].includes(item.tone)
                      ? () => handleTakeDose(item)
                      : undefined
                  }
                  scheduledTime={item.scheduledTime}
                  status={item.tone}
                />
              ))}
            </View>
          </View>
        ))
      ) : (
        <EmptyGlassState
          message="No scheduled reminders are active for today."
          title="Nothing due today"
        />
      )}
    </GlassCard>
  );

  const vitalsSection = (
    <GlassCard
      padding={compactSections.has('vitals') ? 14 : 18}
      style={styles.vitalsCard}
    >
      <SectionHeader title="Vitals quick stats" />
      <View style={styles.vitalsGrid}>
        {screenState.vitals.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => router.push(item.route)}
            style={styles.vitalTileWrap}
          >
            <GlassCard padding={compactSections.has('vitals') ? 12 : 14} style={styles.vitalTile}>
              <VitalStat
                label={item.label}
                size="sm"
                status={item.status}
                unit={item.unit}
                value={item.value}
              />
            </GlassCard>
          </Pressable>
        ))}
      </View>
    </GlassCard>
  );

  const wellnessSection = (
    <Pressable onPress={() => router.push('/(meds)/wellness')}>
      <GlassCard
        padding={compactSections.has('wellness') ? 14 : 18}
        style={styles.wellnessCard}
      >
        <SectionHeader
          action={<Text style={styles.sectionMeta}>View details</Text>}
          title="Wellness score"
        />
        <View style={styles.wellnessRow}>
          <WellnessRing score={wellness.composite} size={compactSections.has('wellness') ? 96 : 120} />
          <View style={styles.wellnessCopy}>
            <Text style={styles.wellnessValue}>{wellness.composite}/100</Text>
            <Text style={styles.wellnessTrend}>
              Trend: {wellness.trend.replace('_', ' ')}
            </Text>
            {!compactSections.has('wellness') ? (
              <Text style={styles.wellnessExplanation}>
                {wellness.components[0]?.explanation ?? 'More tracked data sharpens the score.'}
              </Text>
            ) : null}
            {topInsight ? (
              <View style={styles.topInsightChip}>
                <Text style={styles.topInsightText}>{topInsight.title}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );

  const moodSection = screenState.moodEntries.length === 0 ? (
    <GlassCard
      padding={compactSections.has('mood') ? 14 : 18}
      style={styles.moodPromptCard}
    >
      <SectionHeader title="How are you feeling?" />
      {!compactSections.has('mood') ? (
        <Text style={styles.moodPromptBody}>
          Quick check-ins sharpen the wellness score and make the insights tab more useful.
        </Text>
      ) : null}
      <View style={styles.moodChipRow}>
        {['great', 'good', 'neutral', 'bad', 'terrible'].map((mood) => (
          <MoodChip
            key={mood}
            mood={mood}
            onPress={() => router.push('/(meds)/mood-check-in')}
          />
        ))}
      </View>
    </GlassCard>
  ) : null;

  const refillSection = screenState.refillAlerts.length > 0 ? (
    <GlassCard
      padding={compactSections.has('refills') ? 14 : 18}
      style={styles.refillCard}
    >
      <SectionHeader title="Upcoming refills" />
      <View style={styles.refillStack}>
        {screenState.refillAlerts.map((alert) => (
          <View key={alert.medicationId} style={styles.refillRow}>
            <View style={styles.refillCopy}>
              <Text style={styles.refillName}>{alert.name}</Text>
              {!compactSections.has('refills') ? (
                <Text style={styles.refillMeta}>
                  {alert.pillCount} pills left · {alert.daysRemaining} days remaining
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={() => router.push('/(meds)/refills')}
              style={styles.refillButton}
            >
              <Text style={styles.refillButtonText}>Request refill</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </GlassCard>
  ) : null;

  const sectionMap: Record<string, ReactNode> = {
    mood: moodSection,
    refills: refillSection,
    schedule: scheduleSection,
    vitals: vitalsSection,
    wellness: wellnessSection,
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          colors={[MD_ACCENT_LIGHT]}
          onRefresh={onRefresh}
          refreshing={refreshing}
          tintColor={MD_ACCENT_LIGHT}
        />
      }
      style={styles.screen}
    >
      <SectionStack>
        <ScreenTitleBlock
          subtitle="Today’s meds, vitals, mood, and refill risk in one command view."
          title="Today"
        />

        <View style={styles.metricsRow}>
          <MetricBadge label="7D Adherence" value={`${summary.adherence7d}%`} />
          <MetricBadge label="Streak" value={`${summary.adherenceStreak}d`} />
          <MetricBadge
            label="Taken"
            tone={MD_CHROME_GOLD}
            value={`${summary.todayProgress.taken}/${summary.todayProgress.total || 0}`}
          />
        </View>

        {nextDose ? (
          <GlassCard
            padding={20}
            style={[
              styles.heroCard,
              nextDoseTone === 'due' ? styles.heroCardDue : null,
            ]}
          >
            <Text style={styles.heroEyebrow}>Next Dose</Text>
            <View style={styles.heroHeader}>
              <View style={styles.heroCopy}>
                <Text style={styles.heroTitle}>{nextDose.medicationName}</Text>
                <Text style={styles.heroDose}>{nextDose.dosage ?? 'Dose details pending'}</Text>
              </View>
              <View style={styles.heroCountdownWrap}>
                <Text style={styles.heroCountdown}>
                  {formatRelativeMinutes(nextDose.scheduledTime, now)}
                </Text>
                <Text style={styles.heroTime}>
                  {new Date(nextDose.scheduledTime).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </View>
            <DoseCard
              dose={nextDose.dosage ?? '1 dose'}
              medication={nextDose.medicationName}
              onSkip={() => handleSkipDose(nextDose)}
              onSnooze={() => handleSnoozeDose(nextDose)}
              onTake={() => handleTakeDose(nextDose)}
              scheduledTime={nextDose.scheduledTime}
              status={nextDoseTone}
            />
            <View style={styles.heroFooter}>
              <View style={styles.heroFooterCopy}>
                <Text style={styles.heroFooterLabel}>Today’s schedule</Text>
                <Text style={styles.heroFooterValue}>
                  {summary.todayProgress.taken} of {summary.todayProgress.total || 0} logged
                </Text>
              </View>
              <View style={styles.heroProgressWrap}>
                <ProgressBar value={completionRate} />
              </View>
            </View>
          </GlassCard>
        ) : null}

        {screenState.dashboardSections
          .filter((section) => section.enabled)
          .map((section) => (
            <View key={section.id}>{sectionMap[section.id]}</View>
          ))}
      </SectionStack>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MD_SURFACES.base,
  },
  content: {
    padding: 16,
    paddingBottom: 140,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  heroCard: {
    backgroundColor: withAlpha(MD_SURFACES.low, 0.94),
    gap: 16,
  },
  heroCardDue: {
    shadowColor: MD_ACCENT_LIGHT,
    shadowOpacity: 0.28,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  heroEyebrow: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  heroHeader: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  heroTitle: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.extraBold,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.8,
  },
  heroDose: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  heroCountdownWrap: {
    alignItems: 'flex-end',
    gap: 4,
  },
  heroCountdown: {
    color: MD_ACCENT_LIGHT,
    fontFamily: MD_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
  },
  heroTime: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  heroFooter: {
    gap: 10,
  },
  heroFooterCopy: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroFooterLabel: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
    fontFamily: MD_FONTS.medium,
  },
  heroFooterValue: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT,
    fontFamily: MD_FONTS.semiBold,
  },
  heroProgressWrap: {
    gap: 8,
  },
  scheduleCard: {
    backgroundColor: withAlpha(MD_SURFACES.low, 0.9),
    gap: 14,
  },
  sectionMeta: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  scheduleGroup: {
    gap: 10,
  },
  groupTitle: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_CHROME_GOLD,
  },
  groupStack: {
    gap: 10,
  },
  vitalsCard: {
    backgroundColor: withAlpha(MD_SURFACES.low, 0.9),
    gap: 14,
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  vitalTileWrap: {
    flex: 1,
    minWidth: 96,
  },
  vitalTile: {
    minHeight: 116,
    justifyContent: 'center',
  },
  wellnessCard: {
    backgroundColor: withAlpha(MD_SURFACES.low, 0.9),
    gap: 14,
  },
  wellnessRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18,
  },
  wellnessCopy: {
    flex: 1,
    gap: 6,
  },
  wellnessValue: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.extraBold,
    fontSize: 28,
    lineHeight: 32,
  },
  wellnessTrend: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_ACCENT_LIGHT,
    fontFamily: MD_FONTS.semiBold,
  },
  wellnessExplanation: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  topInsightChip: {
    alignSelf: 'flex-start',
    backgroundColor: withAlpha(MD_CHROME_GOLD, 0.14),
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  topInsightText: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_CHROME_GOLD,
    fontFamily: MD_FONTS.medium,
  },
  moodPromptCard: {
    backgroundColor: withAlpha(MD_SURFACES.low, 0.9),
    gap: 14,
  },
  moodPromptBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  moodChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  refillCard: {
    backgroundColor: withAlpha(MD_SURFACES.low, 0.9),
    gap: 14,
  },
  refillStack: {
    gap: 12,
  },
  refillRow: {
    alignItems: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.04),
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  refillCopy: {
    flex: 1,
    gap: 4,
  },
  refillName: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
    fontFamily: MD_FONTS.bold,
  },
  refillMeta: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_TERTIARY,
  },
  refillButton: {
    backgroundColor: withAlpha(MD_CHROME_GOLD, 0.16),
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  refillButtonText: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_CHROME_GOLD,
  },
});
