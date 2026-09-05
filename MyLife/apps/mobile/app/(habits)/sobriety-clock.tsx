import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  GlassCard,
  HB_ACCENT,
  HB_ACCENT_GLOW,
  HB_ACCENT_LIGHT,
  HB_FONTS,
  HB_SURFACES,
  HB_TEXT,
  HB_TEXT_SECONDARY,
  HB_TEXT_TERTIARY,
  MaterialSymbol,
  SOBRIETY_DAY_MILESTONES,
  StatTile,
  SectionHeader,
  analyzeTriggerFrequency,
  calculateLifetimeStats,
  calculateSobrietyDuration,
  createPledge,
  getAllSobrietyProfiles,
  getAllTriggersForHabit,
  getCravingsForHabit,
  getHabitById,
  getMilestonesForHabit,
  getPledgeForDate,
  getPledgeStreak,
  getRecentPledgeDates,
  getSlipDates,
  getSobrietyProfile,
  getTriggersForCraving,
  recordCompletion,
  updateSobrietyProfile,
  withAlpha,
  type Craving,
  type SobrietyDuration,
  type SobrietyLifetimeStats,
} from '@mylife/habits';
import { EmptyState, Text } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import {
  formatCurrencyFromCents,
  formatFriendlyDate,
  formatRelativeTimestamp,
  inferSobrietyTrack,
  isIsoDate,
  parseCravingContext,
} from '../../components/habits/phase5';

const DAY_MILESTONES = SOBRIETY_DAY_MILESTONES.filter((day) => day <= 365).slice(0, 9);
const HOTLINE_URL = 'https://988lifeline.org/';
const HELPLINE_URL = 'https://www.samhsa.gov/find-help/national-helpline';

interface RecentCravingEntry {
  craving: Craving;
  triggerNames: string[];
  location?: string;
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultPledge(substanceName?: string | null): string {
  if (substanceName?.trim()) {
    return `Today I choose distance from ${substanceName.toLowerCase()} and closer alignment with the life I want.`;
  }

  return 'Today I choose clarity, steadiness, and one more honest day.';
}

function formatCompactTime(duration: SobrietyDuration) {
  return [
    { label: 'Hours', value: String(duration.hours).padStart(2, '0') },
    { label: 'Min', value: String(duration.minutes).padStart(2, '0') },
    { label: 'Sec', value: String(duration.seconds).padStart(2, '0') },
  ];
}

function formatStreakLabel(days: number): string {
  if (days === 1) {
    return '1 day sober';
  }

  return `${days} days sober`;
}

function openExternal(url: string, label: string) {
  void Linking.openURL(url).catch(() => {
    Alert.alert('Unable to open resource', `Try opening ${label} manually.`);
  });
}

export default function SobrietyClockScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ habitId?: string }>();
  const [refreshToken, setRefreshToken] = useState(0);
  const [duration, setDuration] = useState<SobrietyDuration | null>(null);
  const [stats, setStats] = useState<SobrietyLifetimeStats | null>(null);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [pledgeSheetOpen, setPledgeSheetOpen] = useState(false);
  const [quitDateDraft, setQuitDateDraft] = useState('');
  const [dailyCostDraft, setDailyCostDraft] = useState('');
  const [pledgeDraft, setPledgeDraft] = useState('');

  const refresh = useCallback(() => setRefreshToken((value) => value + 1), []);

  const allProfiles = useMemo(
    () => getAllSobrietyProfiles(db),
    [db, refreshToken],
  );

  const activeHabitId = params.habitId ?? allProfiles[0]?.habitId ?? null;

  const profile = useMemo(
    () => (activeHabitId ? getSobrietyProfile(db, activeHabitId) : null),
    [activeHabitId, db, refreshToken],
  );

  const habit = useMemo(
    () => (profile ? getHabitById(db, profile.habitId) : null),
    [db, profile, refreshToken],
  );

  const slipDates = useMemo(
    () => (profile ? getSlipDates(db, profile.habitId) : []),
    [db, profile, refreshToken],
  );

  const today = todayString();

  const pledgeToday = useMemo(
    () => (profile ? getPledgeForDate(db, profile.id, today) : null),
    [db, profile, refreshToken, today],
  );

  const recentPledgeDates = useMemo(
    () => (profile ? getRecentPledgeDates(db, profile.id) : []),
    [db, profile, refreshToken],
  );

  const recentCravings = useMemo<RecentCravingEntry[]>(
    () => (profile
      ? getCravingsForHabit(db, profile.habitId, { limit: 4 }).map((craving) => {
        const triggers = getTriggersForCraving(db, craving.id).map((item) => item.triggerName);
        const context = parseCravingContext(craving.notes);
        return {
          craving,
          triggerNames: triggers,
          location: context.location,
        };
      })
      : []),
    [db, profile, refreshToken],
  );

  const triggerHighlights = useMemo(
    () => (profile
      ? analyzeTriggerFrequency(getAllTriggersForHabit(db, profile.habitId)).slice(0, 3)
      : []),
    [db, profile, refreshToken],
  );

  const milestoneDays = useMemo(() => {
    if (!profile) {
      return DAY_MILESTONES;
    }

    const stored = getMilestonesForHabit(db, profile.habitId)
      .filter((item) => item.milestoneType === 'sobriety_days')
      .map((item) => item.threshold)
      .filter((threshold) => threshold <= 365)
      .sort((a, b) => a - b);

    return stored.length > 0 ? stored : DAY_MILESTONES;
  }, [db, profile, refreshToken]);

  useEffect(() => {
    if (!profile) {
      setDuration(null);
      setStats(null);
      return;
    }

    const updateClock = () => {
      const now = Date.now();
      setDuration(calculateSobrietyDuration(profile.quitDate, now, [...slipDates]));
      setStats(calculateLifetimeStats(profile.quitDate, profile.dailyCost, slipDates, now));
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [profile, slipDates]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    setQuitDateDraft(profile.quitDate.slice(0, 10));
    setDailyCostDraft((profile.dailyCost / 100).toFixed(profile.dailyCost % 100 === 0 ? 0 : 2));
    setPledgeDraft(profile.motivation?.trim() || defaultPledge(habit?.name));
  }, [habit?.name, profile]);

  const recoveryTrack = useMemo(
    () => inferSobrietyTrack(habit?.name),
    [habit?.name],
  );

  const displayedPledge = profile?.motivation?.trim() || defaultPledge(habit?.name);
  const pledgeStreak = profile ? getPledgeStreak(recentPledgeDates, today) : 0;
  const currentDays = duration?.totalDays ?? 0;
  const nextMilestone = milestoneDays.find((threshold) => threshold > currentDays) ?? null;
  const hoursElapsed = duration ? duration.totalDays * 24 + duration.hours : 0;
  const timeReclaimedHours = stats
    ? Math.round((stats.currentStreak * recoveryTrack.dailyMinutesRecovered) / 60)
    : 0;
  const caloriesAvoided = stats
    ? stats.currentStreak * recoveryTrack.dailyCaloriesAvoided
    : 0;

  const handleTakePledge = useCallback(() => {
    if (!profile) {
      return;
    }

    if (pledgeToday) {
      Alert.alert('Already pledged', 'Your daily pledge is already recorded for today.');
      return;
    }

    createPledge(db, uuid(), profile.id, today);
    refresh();
  }, [db, pledgeToday, profile, refresh, today]);

  const handleSlip = useCallback(() => {
    if (!profile) {
      return;
    }

    Alert.alert(
      'Log a slip',
      'This resets the live sobriety clock for today. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log slip',
          style: 'destructive',
          onPress: () => {
            recordCompletion(db, uuid(), profile.habitId, new Date().toISOString(), -1);
            refresh();
          },
        },
      ],
    );
  }, [db, profile, refresh]);

  const handleSaveProfile = useCallback(() => {
    if (!profile) {
      return;
    }

    if (!isIsoDate(quitDateDraft.trim())) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD for the sobriety start date.');
      return;
    }

    const numericDailyCost = Number.parseFloat(dailyCostDraft);
    if (!Number.isFinite(numericDailyCost) || numericDailyCost < 0) {
      Alert.alert('Invalid daily spend', 'Enter a valid dollar amount.');
      return;
    }

    updateSobrietyProfile(db, profile.id, {
      quitDate: quitDateDraft.trim(),
      dailyCost: Math.round(numericDailyCost * 100),
    });
    setProfileSheetOpen(false);
    refresh();
  }, [dailyCostDraft, db, profile, quitDateDraft, refresh]);

  const handleSavePledge = useCallback(() => {
    if (!profile) {
      return;
    }

    updateSobrietyProfile(db, profile.id, {
      motivation: pledgeDraft.trim(),
    });
    setPledgeSheetOpen(false);
    refresh();
  }, [db, pledgeDraft, profile, refresh]);

  const handleSharePledge = useCallback(async () => {
    const message = `${displayedPledge}\n\n${formatStreakLabel(currentDays)} in MyHabits.`;
    await Share.share({ message });
  }, [currentDays, displayedPledge]);

  if (!profile || !duration || !stats) {
    return (
      <View style={styles.emptyState}>
        <EmptyState
          icon={'\u23F0'}
          title="No sobriety tracker yet"
          message="Create a negative habit with sobriety enabled to unlock the dashboard."
        />
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.headingBlock}>
            <Text style={styles.overline}>Sobriety</Text>
            <Text style={styles.screenTitle}>{habit?.name ?? 'Recovery'}</Text>
            <Text style={styles.screenSubtitle}>
              Since {formatFriendlyDate(profile.quitDate)}
            </Text>
          </View>
          <Pressable
            style={styles.headerAction}
            onPress={() => setProfileSheetOpen(true)}
          >
            <MaterialSymbol name="edit" size={16} color={HB_TEXT} />
            <Text style={styles.headerActionText}>Edit</Text>
          </Pressable>
        </View>

        <GlassCard level={4} style={styles.heroCard} contentStyle={styles.heroContent}>
          <LinearGradient
            colors={[withAlpha(HB_ACCENT_LIGHT, 0.22), withAlpha(HB_ACCENT, 0.08)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.heroBadge}>
            <MaterialSymbol name="local_fire_department" size={18} color={HB_ACCENT_LIGHT} filled />
            <Text style={styles.heroBadgeText}>Continuous sobriety</Text>
          </View>

          <View style={styles.heroCenter}>
            <Text style={styles.heroDays}>{duration.totalDays}</Text>
            <Text style={styles.heroDaysLabel}>
              {duration.totalDays === 1 ? 'day sober' : 'days sober'}
            </Text>
            <View style={styles.heroTimeRow}>
              {formatCompactTime(duration).map((item) => (
                <View key={item.label} style={styles.heroTimeItem}>
                  <Text style={styles.heroTimeValue}>{item.value}</Text>
                  <Text style={styles.heroTimeLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.heroFooter}>
            <View>
              <Text style={styles.heroFooterLabel}>Current streak</Text>
              <Text style={styles.heroFooterValue}>{formatStreakLabel(stats.currentStreak)}</Text>
            </View>
            <View style={styles.heroFooterDivider} />
            <View>
              <Text style={styles.heroFooterLabel}>Longest streak</Text>
              <Text style={styles.heroFooterValue}>{stats.longestStreak} days</Text>
            </View>
          </View>
        </GlassCard>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsRow}
        >
          <StatTile
            label="Saved"
            value={formatCurrencyFromCents(stats.moneySavedCurrent, profile.currency)}
            delta="current streak"
            icon="attach_money"
            color="#30D158"
          />
          <StatTile
            label="Time back"
            value={`${timeReclaimedHours}h`}
            delta={`${recoveryTrack.dailyMinutesRecovered} min/day reclaimed`}
            icon="schedule"
            color={HB_ACCENT_LIGHT}
          />
          <StatTile
            label="Calories"
            value={`${caloriesAvoided.toLocaleString()}`}
            delta="avoided this streak"
            icon="bolt"
            color="#FFB877"
          />
          <StatTile
            label="Pledges"
            value={pledgeStreak}
            delta={pledgeToday ? 'today locked in' : 'ready for today'}
            icon="check_circle"
            color="#8BCFF0"
          />
        </ScrollView>

        <GlassCard level={3} contentStyle={styles.sectionCard}>
          <SectionHeader title="Milestone timeline" />
          {nextMilestone ? (
            <View style={styles.sectionSummary}>
              <Text style={styles.sectionSummaryValue}>{nextMilestone - currentDays} days left</Text>
              <Text style={styles.sectionSummaryText}>until the {nextMilestone}-day marker</Text>
            </View>
          ) : (
            <View style={styles.sectionSummary}>
              <Text style={styles.sectionSummaryValue}>All core milestones cleared</Text>
              <Text style={styles.sectionSummaryText}>Keep stacking quiet days.</Text>
            </View>
          )}

          <View style={styles.timelineList}>
            {milestoneDays.map((threshold) => {
              const achieved = currentDays >= threshold;
              const isNext = nextMilestone === threshold;
              return (
                <View key={threshold} style={styles.timelineRow}>
                  <View
                    style={[
                      styles.timelineDot,
                      achieved ? styles.timelineDotDone : undefined,
                      isNext ? styles.timelineDotNext : undefined,
                    ]}
                  >
                    {achieved ? (
                      <MaterialSymbol name="check" size={12} color={HB_SURFACES.lowest} filled />
                    ) : null}
                  </View>
                  <View style={styles.timelineCopy}>
                    <Text style={styles.timelineTitle}>{threshold} days</Text>
                    <Text style={styles.timelineText}>
                      {achieved
                        ? 'Reached'
                        : isNext
                          ? `${Math.max(0, threshold - currentDays)} days to go`
                          : 'Upcoming'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </GlassCard>

        <GlassCard level={3} contentStyle={styles.sectionCard}>
          <SectionHeader
            title="Savings calculator"
            action={{ label: 'Configure', onPress: () => setProfileSheetOpen(true) }}
          />
          <Text style={styles.bodyCopy}>
            Based on a daily spend of {formatCurrencyFromCents(profile.dailyCost, profile.currency)} and the current recovery track.
          </Text>
          <View style={styles.metricGrid}>
            <View style={styles.metricTile}>
              <Text style={styles.metricValue}>{formatCurrencyFromCents(stats.moneySavedLifetime, profile.currency)}</Text>
              <Text style={styles.metricLabel}>Lifetime saved</Text>
            </View>
            <View style={styles.metricTile}>
              <Text style={styles.metricValue}>{Math.round((stats.totalCleanDays * recoveryTrack.dailyMinutesRecovered) / 60)}h</Text>
              <Text style={styles.metricLabel}>Lifetime time reclaimed</Text>
            </View>
            <View style={styles.metricTile}>
              <Text style={styles.metricValue}>{(stats.totalCleanDays * recoveryTrack.dailyCaloriesAvoided).toLocaleString()}</Text>
              <Text style={styles.metricLabel}>Lifetime calories avoided</Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard level={3} contentStyle={styles.sectionCard}>
          <SectionHeader title="Health benefits timeline" />
          <View style={styles.timelineList}>
            {recoveryTrack.benefits.map((benefit) => {
              const achieved = hoursElapsed >= benefit.thresholdHours;
              return (
                <View key={benefit.label} style={styles.benefitRow}>
                  <View style={[styles.benefitPill, achieved ? styles.benefitPillActive : undefined]}>
                    <Text style={styles.benefitPillText}>
                      {benefit.thresholdHours < 24
                        ? `${benefit.thresholdHours}h`
                        : `${Math.round(benefit.thresholdHours / 24)}d`}
                    </Text>
                  </View>
                  <Text style={[styles.benefitText, achieved ? styles.benefitTextActive : undefined]}>
                    {benefit.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </GlassCard>

        <GlassCard level={3} contentStyle={styles.sectionCard}>
          <SectionHeader
            title="Cravings + triggers"
            action={{
              label: 'Insights',
              onPress: () => router.push(`/(habits)/craving-insights?habitId=${profile.habitId}`),
            }}
          />
          <View style={styles.actionRow}>
            <Pressable
              style={styles.primaryButton}
              onPress={() => router.push(`/(habits)/log-craving?habitId=${profile.habitId}`)}
            >
              <MaterialSymbol name="add" size={18} color={HB_SURFACES.lowest} filled />
              <Text style={styles.primaryButtonText}>Log craving</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => router.push(`/(habits)/craving-insights?habitId=${profile.habitId}`)}
            >
              <Text style={styles.secondaryButtonText}>Open insights</Text>
            </Pressable>
          </View>

          {triggerHighlights.length > 0 ? (
            <View style={styles.chipWrap}>
              {triggerHighlights.map((trigger) => (
                <View key={trigger.triggerName} style={styles.triggerChip}>
                  <Text style={styles.triggerChipText}>
                    {trigger.triggerName} · {trigger.count}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyCopy}>No trigger history yet. Start logging moments to see patterns.</Text>
          )}

          <View style={styles.recentList}>
            {recentCravings.length > 0 ? recentCravings.map((entry) => (
              <View key={entry.craving.id} style={styles.recentRow}>
                <View style={styles.recentIntensity}>
                  <Text style={styles.recentIntensityValue}>{entry.craving.intensity}</Text>
                </View>
                <View style={styles.recentCopy}>
                  <Text style={styles.recentTitle}>
                    {entry.triggerNames.slice(0, 2).join(' + ') || 'Craving logged'}
                  </Text>
                  <Text style={styles.recentMeta}>
                    {formatRelativeTimestamp(entry.craving.loggedAt)}
                    {entry.location ? ` · ${entry.location}` : ''}
                    {entry.craving.copingStrategy ? ` · ${entry.craving.copingStrategy}` : ''}
                  </Text>
                </View>
              </View>
            )) : (
              <Text style={styles.emptyCopy}>No recent cravings logged.</Text>
            )}
          </View>
        </GlassCard>

        <GlassCard level={3} contentStyle={styles.sectionCard}>
          <SectionHeader
            title="Daily pledge"
            action={{ label: 'Update', onPress: () => setPledgeSheetOpen(true) }}
          />
          <Text style={styles.pledgeText}>{displayedPledge}</Text>
          <View style={styles.pledgeFooter}>
            <View>
              <Text style={styles.heroFooterLabel}>Pledge streak</Text>
              <Text style={styles.heroFooterValue}>{pledgeStreak} days</Text>
            </View>
            <View style={styles.buttonStack}>
              <Pressable style={styles.primaryButtonSmall} onPress={handleTakePledge}>
                <Text style={styles.primaryButtonSmallText}>
                  {pledgeToday ? 'Pledged today' : 'Commit today'}
                </Text>
              </Pressable>
              <Pressable style={styles.linkButton} onPress={() => { void handleSharePledge(); }}>
                <MaterialSymbol name="share" size={16} color={HB_ACCENT_LIGHT} />
                <Text style={styles.linkButtonText}>Share pledge</Text>
              </Pressable>
            </View>
          </View>
        </GlassCard>

        <GlassCard level={3} contentStyle={styles.sectionCard}>
          <SectionHeader title="Support resources" />
          <Text style={styles.bodyCopy}>
            If you feel at risk right now, reach for support before white-knuckling it alone.
          </Text>
          <View style={styles.supportStack}>
            <SupportRow
              title="988 Lifeline"
              subtitle="Call or chat for immediate emotional support"
              onPress={() => openExternal(HOTLINE_URL, '988 Lifeline')}
            />
            <SupportRow
              title="SAMHSA National Helpline"
              subtitle="Treatment and referral support"
              onPress={() => openExternal(HELPLINE_URL, 'SAMHSA National Helpline')}
            />
            <SupportRow
              title={recoveryTrack.meetingLabel}
              subtitle="Find local or virtual community support"
              onPress={() => openExternal(recoveryTrack.meetingUrl, recoveryTrack.meetingLabel)}
            />
          </View>
          <Pressable style={styles.dangerButton} onPress={handleSlip}>
            <Text style={styles.dangerButtonText}>Log a slip</Text>
          </Pressable>
        </GlassCard>
      </ScrollView>

      <SheetModal
        visible={profileSheetOpen}
        title="Edit sobriety profile"
        subtitle="Update the start date and your estimated daily spend."
        onClose={() => setProfileSheetOpen(false)}
      >
        <Field label="Habit">
          <Pressable
            style={styles.readOnlyField}
            onPress={() => {
              setProfileSheetOpen(false);
              router.push(`/(habits)/${profile.habitId}`);
            }}
          >
            <Text style={styles.inputValue}>{habit?.name ?? 'Recovery habit'}</Text>
            <Text style={styles.readOnlyHint}>Open habit details</Text>
          </Pressable>
        </Field>
        <Field label="Start date">
          <TextInput
            value={quitDateDraft}
            onChangeText={setQuitDateDraft}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={HB_TEXT_TERTIARY}
            style={styles.input}
          />
        </Field>
        <Field label="Daily spend (USD)">
          <TextInput
            value={dailyCostDraft}
            onChangeText={setDailyCostDraft}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={HB_TEXT_TERTIARY}
            style={styles.input}
          />
        </Field>
        <Pressable style={styles.primaryButtonBlock} onPress={handleSaveProfile}>
          <Text style={styles.primaryButtonText}>Save changes</Text>
        </Pressable>
      </SheetModal>

      <SheetModal
        visible={pledgeSheetOpen}
        title="Update pledge"
        subtitle="Set the line you want to see every time you open this screen."
        onClose={() => setPledgeSheetOpen(false)}
      >
        <Field label="Pledge">
          <TextInput
            value={pledgeDraft}
            onChangeText={setPledgeDraft}
            multiline
            placeholder="Write the promise you want to keep today."
            placeholderTextColor={HB_TEXT_TERTIARY}
            style={[styles.input, styles.textArea]}
            textAlignVertical="top"
          />
        </Field>
        <Pressable style={styles.primaryButtonBlock} onPress={handleSavePledge}>
          <Text style={styles.primaryButtonText}>Save pledge</Text>
        </Pressable>
      </SheetModal>
    </>
  );
}

function SupportRow({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.supportRow} onPress={onPress}>
      <View style={styles.supportCopy}>
        <Text style={styles.supportTitle}>{title}</Text>
        <Text style={styles.supportSubtitle}>{subtitle}</Text>
      </View>
      <MaterialSymbol name="chevron_right" size={18} color={HB_TEXT_TERTIARY} />
    </Pressable>
  );
}

function SheetModal({
  visible,
  title,
  subtitle,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalSubtitle}>{subtitle}</Text>
          <View style={styles.modalBody}>{children}</View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: HB_SURFACES.base,
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
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: HB_ACCENT_LIGHT,
  },
  screenTitle: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.8,
    color: HB_TEXT,
  },
  screenSubtitle: {
    fontFamily: HB_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: HB_TEXT_SECONDARY,
  },
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: withAlpha(HB_ACCENT, 0.18),
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerActionText: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
    color: HB_TEXT,
  },
  heroCard: {
    shadowColor: HB_ACCENT_GLOW,
    shadowOpacity: 0.3,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  heroContent: {
    position: 'relative',
    gap: 20,
    paddingVertical: 24,
  },
  heroBadge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: withAlpha(HB_ACCENT, 0.16),
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroBadgeText: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
    color: HB_ACCENT_LIGHT,
  },
  heroCenter: {
    alignItems: 'center',
    gap: 8,
  },
  heroDays: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 72,
    lineHeight: 78,
    letterSpacing: -2.4,
    color: HB_TEXT,
    fontVariant: ['tabular-nums'],
  },
  heroDaysLabel: {
    fontFamily: HB_FONTS.medium,
    fontSize: 18,
    lineHeight: 22,
    color: HB_TEXT_SECONDARY,
  },
  heroTimeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  heroTimeItem: {
    alignItems: 'center',
    minWidth: 72,
    borderRadius: 16,
    backgroundColor: withAlpha(HB_TEXT, 0.05),
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  heroTimeValue: {
    fontFamily: HB_FONTS.bold,
    fontSize: 24,
    lineHeight: 28,
    color: HB_TEXT,
    fontVariant: ['tabular-nums'],
  },
  heroTimeLabel: {
    fontFamily: HB_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: HB_TEXT_TERTIARY,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  heroFooterDivider: {
    height: 34,
    width: 1,
    backgroundColor: withAlpha(HB_TEXT, 0.08),
  },
  heroFooterLabel: {
    fontFamily: HB_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: HB_TEXT_TERTIARY,
  },
  heroFooterValue: {
    fontFamily: HB_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
    color: HB_TEXT,
  },
  statsRow: {
    gap: 12,
    paddingRight: 4,
  },
  sectionCard: {
    gap: 16,
  },
  sectionSummary: {
    gap: 2,
  },
  sectionSummaryValue: {
    fontFamily: HB_FONTS.bold,
    fontSize: 24,
    lineHeight: 28,
    color: HB_TEXT,
  },
  sectionSummaryText: {
    fontFamily: HB_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: HB_TEXT_SECONDARY,
  },
  timelineList: {
    gap: 14,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: withAlpha(HB_TEXT, 0.08),
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotDone: {
    backgroundColor: HB_ACCENT_LIGHT,
  },
  timelineDotNext: {
    backgroundColor: withAlpha('#30D158', 0.18),
  },
  timelineCopy: {
    flex: 1,
    gap: 2,
  },
  timelineTitle: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 15,
    lineHeight: 19,
    color: HB_TEXT,
  },
  timelineText: {
    fontFamily: HB_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
    color: HB_TEXT_SECONDARY,
  },
  bodyCopy: {
    fontFamily: HB_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: HB_TEXT_SECONDARY,
  },
  metricGrid: {
    gap: 12,
  },
  metricTile: {
    borderRadius: 18,
    backgroundColor: withAlpha(HB_TEXT, 0.04),
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
  },
  metricValue: {
    fontFamily: HB_FONTS.bold,
    fontSize: 22,
    lineHeight: 26,
    color: HB_TEXT,
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    fontFamily: HB_FONTS.regular,
    fontSize: 12,
    lineHeight: 16,
    color: HB_TEXT_TERTIARY,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitPill: {
    minWidth: 52,
    borderRadius: 999,
    backgroundColor: withAlpha(HB_TEXT, 0.08),
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  benefitPillActive: {
    backgroundColor: withAlpha('#30D158', 0.24),
  },
  benefitPillText: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
    color: HB_TEXT,
  },
  benefitText: {
    flex: 1,
    fontFamily: HB_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: HB_TEXT_SECONDARY,
  },
  benefitTextActive: {
    color: HB_TEXT,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    backgroundColor: HB_ACCENT_LIGHT,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryButtonText: {
    fontFamily: HB_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
    color: HB_SURFACES.lowest,
  },
  secondaryButton: {
    borderRadius: 16,
    backgroundColor: withAlpha(HB_TEXT, 0.05),
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: HB_TEXT,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  triggerChip: {
    borderRadius: 999,
    backgroundColor: withAlpha(HB_ACCENT, 0.14),
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  triggerChipText: {
    fontFamily: HB_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: HB_ACCENT_LIGHT,
    textTransform: 'capitalize',
  },
  recentList: {
    gap: 12,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recentIntensity: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: withAlpha(HB_ACCENT, 0.2),
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentIntensityValue: {
    fontFamily: HB_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
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
  },
  recentMeta: {
    fontFamily: HB_FONTS.regular,
    fontSize: 12,
    lineHeight: 16,
    color: HB_TEXT_TERTIARY,
  },
  emptyCopy: {
    fontFamily: HB_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
    color: HB_TEXT_SECONDARY,
  },
  pledgeText: {
    fontFamily: HB_FONTS.medium,
    fontSize: 16,
    lineHeight: 24,
    color: HB_TEXT,
  },
  pledgeFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 16,
  },
  buttonStack: {
    alignItems: 'flex-end',
    gap: 8,
  },
  primaryButtonSmall: {
    borderRadius: 14,
    backgroundColor: withAlpha('#30D158', 0.2),
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryButtonSmallText: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 16,
    color: '#B9FFD3',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  linkButtonText: {
    fontFamily: HB_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: HB_ACCENT_LIGHT,
  },
  supportStack: {
    gap: 10,
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    backgroundColor: withAlpha(HB_TEXT, 0.04),
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  supportCopy: {
    flex: 1,
    gap: 2,
  },
  supportTitle: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: HB_TEXT,
  },
  supportSubtitle: {
    fontFamily: HB_FONTS.regular,
    fontSize: 12,
    lineHeight: 16,
    color: HB_TEXT_SECONDARY,
  },
  dangerButton: {
    alignSelf: 'flex-start',
    borderRadius: 14,
    backgroundColor: withAlpha('#FF453A', 0.16),
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dangerButtonText: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 16,
    color: '#FFB4AB',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.64)',
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: HB_SURFACES.high,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 32,
    gap: 10,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: withAlpha(HB_TEXT, 0.16),
    marginBottom: 4,
  },
  modalTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 22,
    lineHeight: 26,
    color: HB_TEXT,
  },
  modalSubtitle: {
    fontFamily: HB_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: HB_TEXT_SECONDARY,
  },
  modalBody: {
    gap: 14,
    marginTop: 8,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: HB_TEXT_TERTIARY,
  },
  input: {
    borderRadius: 18,
    backgroundColor: HB_SURFACES.low,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: HB_TEXT,
    fontFamily: HB_FONTS.medium,
    fontSize: 15,
    lineHeight: 20,
  },
  textArea: {
    minHeight: 120,
  },
  readOnlyField: {
    borderRadius: 18,
    backgroundColor: HB_SURFACES.low,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  inputValue: {
    fontFamily: HB_FONTS.medium,
    fontSize: 15,
    lineHeight: 20,
    color: HB_TEXT,
  },
  readOnlyHint: {
    fontFamily: HB_FONTS.regular,
    fontSize: 12,
    lineHeight: 16,
    color: HB_ACCENT_LIGHT,
  },
  primaryButtonBlock: {
    borderRadius: 18,
    backgroundColor: HB_ACCENT_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
});
