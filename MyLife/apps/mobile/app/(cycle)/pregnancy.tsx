import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Text as RNText } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Baby,
  CalendarHeart,
  Clock3,
  EllipsisVertical,
  MapPin,
  Plus,
  Sparkles,
} from 'lucide-react-native';
import {
  GlassCard,
  createAppointment,
  createPregnancyConfig,
  endPregnancy,
  getActivePregnancy,
  getCurrentTrimester,
  getCurrentWeek,
  getDaysUntilDue,
  getPregnancyWeekInfo,
  getUpcomingAppointments,
  isPastDue,
  updateDueDate,
  CYCLE_ACCENT,
  CYCLE_FONTS,
  CYCLE_PHASE_COLORS,
  CYCLE_SURFACES,
  CYCLE_TYPOGRAPHY,
} from '@mylife/cycle';
import { uuid } from '../../lib/uuid';
import { useDatabase } from '../../components/DatabaseProvider';

const PREGNANCY_ACCENT = CYCLE_PHASE_COLORS.ovulation;

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function trimesterLabel(trimester: 1 | 2 | 3 | null): string {
  if (trimester === 1) return 'First Trimester';
  if (trimester === 2) return 'Second Trimester';
  if (trimester === 3) return 'Third Trimester';
  return 'Pregnancy journey';
}

function fruitEmoji(size: string): string {
  const normalized = size.toLowerCase();
  if (normalized.includes('cantaloupe') || normalized.includes('melon')) return '🍈';
  if (normalized.includes('watermelon')) return '🍉';
  if (normalized.includes('banana')) return '🍌';
  if (normalized.includes('apple')) return '🍎';
  if (normalized.includes('avocado')) return '🥑';
  if (normalized.includes('pumpkin')) return '🎃';
  if (normalized.includes('lemon')) return '🍋';
  return '🍑';
}

function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [pressed && !disabled && { opacity: 0.92 }]}
    >
      <LinearGradient
        colors={
          disabled
            ? ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.08)']
            : [PREGNANCY_ACCENT, '#C9894D']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryButton}
      >
        <RNText
          style={[
            styles.primaryButtonText,
            disabled && { color: 'rgba(228, 225, 233, 0.45)' },
          ]}
        >
          {label}
        </RNText>
      </LinearGradient>
    </Pressable>
  );
}

function SheetField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="rgba(214, 195, 181, 0.42)"
      style={styles.sheetInput}
    />
  );
}

export default function PregnancyScreen() {
  const db = useDatabase();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshKey, setRefreshKey] = useState(0);
  const [appointmentModalVisible, setAppointmentModalVisible] = useState(false);
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const [editDueDateVisible, setEditDueDateVisible] = useState(false);
  const [newPregnancyDueDate, setNewPregnancyDueDate] = useState('');
  const [newPregnancyLmp, setNewPregnancyLmp] = useState('');
  const [dueDateDraft, setDueDateDraft] = useState('');
  const [appointmentTitle, setAppointmentTitle] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [appointmentLocation, setAppointmentLocation] = useState('');

  const refresh = useCallback(() => setRefreshKey((tick) => tick + 1), []);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const pregnancy = useMemo(() => {
    try {
      return getActivePregnancy(db);
    } catch {
      return null;
    }
  }, [db, refreshKey]);

  const weekNumber = useMemo(() => {
    if (!pregnancy) return null;
    try {
      return getCurrentWeek(pregnancy.dueDate, today, pregnancy.lastPeriodDate);
    } catch {
      return null;
    }
  }, [pregnancy, today]);

  const trimester = useMemo(() => {
    if (weekNumber == null) return null;
    try {
      return getCurrentTrimester(weekNumber);
    } catch {
      return null;
    }
  }, [weekNumber]);

  const daysUntilDue = useMemo(() => {
    if (!pregnancy) return null;
    try {
      return getDaysUntilDue(pregnancy.dueDate, today);
    } catch {
      return null;
    }
  }, [pregnancy, today]);

  const pastDue = useMemo(() => {
    if (!pregnancy) return false;
    try {
      return isPastDue(pregnancy.dueDate, today);
    } catch {
      return false;
    }
  }, [pregnancy, today]);

  const weekInfo = useMemo(() => {
    if (weekNumber == null) return null;
    try {
      return getPregnancyWeekInfo(weekNumber);
    } catch {
      return null;
    }
  }, [weekNumber]);

  const appointments = useMemo(() => {
    if (!pregnancy) return [];
    try {
      return getUpcomingAppointments(db, pregnancy.id, today, 8);
    } catch {
      return [];
    }
  }, [db, pregnancy, refreshKey, today]);

  const weeksRemaining =
    weekNumber != null ? Math.max(0, 40 - Math.min(weekNumber, 40)) : null;
  const progressPercent =
    weekNumber != null
      ? Math.max(8, Math.min(100, (Math.min(weekNumber, 40) / 40) * 100))
      : 0;
  const milestoneRail = [
    { label: 'Heartbeat', week: 6 },
    { label: '12 week scan', week: 12 },
    { label: 'Anatomy scan', week: 20 },
    { label: 'Viability', week: 24 },
    { label: 'Full term', week: 37 },
    { label: 'Due date', week: 40 },
  ];

  const openMenu = useCallback(() => {
    if (!pregnancy) return;

    Alert.alert('Pregnancy options', 'Manage this pregnancy profile.', [
      {
        text: 'Edit due date',
        onPress: () => {
          setDueDateDraft(pregnancy.dueDate);
          setEditDueDateVisible(true);
        },
      },
      {
        text: 'End pregnancy',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Close pregnancy mode',
            'Choose how you want MyCycle to end this pregnancy record.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delivered',
                onPress: () => {
                  try {
                    endPregnancy(db, pregnancy.id, 'completed');
                    refresh();
                  } catch (error) {
                    Alert.alert(
                      'Unable to close pregnancy',
                      error instanceof Error ? error.message : 'Please try again.',
                    );
                  }
                },
              },
              {
                text: 'Loss',
                style: 'destructive',
                onPress: () => {
                  try {
                    endPregnancy(db, pregnancy.id, 'loss');
                    refresh();
                  } catch (error) {
                    Alert.alert(
                      'Unable to close pregnancy',
                      error instanceof Error ? error.message : 'Please try again.',
                    );
                  }
                },
              },
            ],
          );
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [db, pregnancy, refresh]);

  const handleCreatePregnancy = useCallback(() => {
    if (newPregnancyDueDate.trim().length === 0 && newPregnancyLmp.trim().length === 0) {
      Alert.alert('Missing dates', 'Enter a due date or your last period date.');
      return;
    }

    try {
      if (newPregnancyLmp.trim().length > 0) {
        createPregnancyConfig(db, uuid(), {
          startMethod: 'last_period',
          lastPeriodDate: newPregnancyLmp.trim(),
        });
      } else {
        createPregnancyConfig(db, uuid(), {
          startMethod: 'due_date',
          dueDate: newPregnancyDueDate.trim(),
        });
      }
      setOnboardingVisible(false);
      setNewPregnancyDueDate('');
      setNewPregnancyLmp('');
      refresh();
    } catch (error) {
      Alert.alert(
        'Unable to start pregnancy mode',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }, [db, newPregnancyDueDate, newPregnancyLmp, refresh]);

  const handleSaveDueDate = useCallback(() => {
    if (!pregnancy || dueDateDraft.trim().length === 0) {
      Alert.alert('Missing due date', 'Enter a due date in YYYY-MM-DD format.');
      return;
    }

    try {
      updateDueDate(db, pregnancy.id, dueDateDraft.trim());
      setEditDueDateVisible(false);
      refresh();
    } catch (error) {
      Alert.alert(
        'Unable to update due date',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }, [db, dueDateDraft, pregnancy, refresh]);

  const handleCreateAppointment = useCallback(() => {
    if (!pregnancy || appointmentTitle.trim().length === 0 || appointmentDate.trim().length === 0) {
      Alert.alert('Missing details', 'Enter a visit title and date.');
      return;
    }

    try {
      createAppointment(db, uuid(), {
        pregnancyId: pregnancy.id,
        title: appointmentTitle.trim(),
        date: appointmentDate.trim(),
        time: appointmentTime.trim() || undefined,
        location: appointmentLocation.trim() || undefined,
      });
      setAppointmentModalVisible(false);
      setAppointmentTitle('');
      setAppointmentDate('');
      setAppointmentTime('');
      setAppointmentLocation('');
      refresh();
    } catch (error) {
      Alert.alert(
        'Unable to add appointment',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }, [
    appointmentDate,
    appointmentLocation,
    appointmentTime,
    appointmentTitle,
    db,
    pregnancy,
    refresh,
  ]);

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: 'Pregnancy',
          headerRight: pregnancy
            ? () => (
                <Pressable
                  onPress={openMenu}
                  style={({ pressed }) => [styles.headerButton, pressed && { opacity: 0.7 }]}
                >
                  <EllipsisVertical color="#E4E1E9" size={20} strokeWidth={2} />
                </Pressable>
              )
            : undefined,
        }}
      />

      {!pregnancy ? (
        <View style={styles.emptyScreen}>
          <View style={styles.emptyGlow} />
          <RNText style={styles.heroEyebrow}>Pregnancy Mode</RNText>
          <RNText style={styles.emptyTitle}>Enter Pregnancy Mode</RNText>
          <RNText style={styles.emptyBody}>
            Stay in MyCycle through the full 40-week journey with week tracking, appointments,
            and daily pregnancy logs.
          </RNText>

          <GlassCard variant="high" style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Baby color={PREGNANCY_ACCENT} size={26} strokeWidth={2} />
            </View>
            <RNText style={styles.emptyCardTitle}>Start your pregnancy profile</RNText>
            <RNText style={styles.emptyCardBody}>
              Use a due date or your last period date. You can edit the due date later.
            </RNText>
            <PrimaryButton label="Enter Pregnancy Mode" onPress={() => setOnboardingVisible(true)} />
          </GlassCard>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: Math.max(insets.bottom + 140, 170) },
            ]}
          >
            <View style={styles.hero}>
              <View style={styles.heroGlow} />
              <RNText style={styles.heroEyebrow}>Current Status</RNText>
              <RNText style={styles.weekText}>Week {weekNumber ?? '--'}</RNText>
              <RNText style={styles.trimesterText}>{trimesterLabel(trimester)}</RNText>
              <View style={styles.progressRailWrap}>
                <View style={styles.progressLabels}>
                  <RNText style={styles.progressLabel}>1st</RNText>
                  <RNText style={[styles.progressLabel, styles.progressLabelActive]}>
                    {trimester === 1 ? '1st Trimester' : trimester === 2 ? '2nd Trimester' : '3rd Trimester'}
                  </RNText>
                  <RNText style={styles.progressLabel}>3rd</RNText>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progressPercent}%` as const }]} />
                </View>
              </View>
            </View>

            <View style={styles.statsGrid}>
              <GlassCard style={styles.statCard}>
                <RNText style={styles.sectionEyebrow}>Due Date</RNText>
                <RNText style={styles.statValue}>{formatDate(pregnancy.dueDate)}</RNText>
              </GlassCard>
              <GlassCard variant="high" style={styles.statCard}>
                <RNText style={styles.sectionEyebrow}>Countdown</RNText>
                <RNText style={[styles.statValue, { color: PREGNANCY_ACCENT }]}>
                  {pastDue
                    ? `${Math.abs(daysUntilDue ?? 0)} days past`
                    : `${daysUntilDue ?? '--'} days to go`}
                </RNText>
              </GlassCard>
            </View>

            <GlassCard variant="high" style={styles.sizeCard}>
              <RNText style={styles.sectionEyebrow}>This Week</RNText>
              <View style={styles.sizeCardRow}>
                <View style={styles.sizeCardCopy}>
                  <RNText style={styles.sizeTitle}>
                    Size: {weekInfo?.babySize ?? 'Growing beautifully'}
                  </RNText>
                  <RNText style={styles.sizeBody}>
                    {weekInfo?.developmentHighlight ??
                      'Week-by-week guidance will appear once your pregnancy dates are set.'}
                  </RNText>
                  <View style={styles.sizeChips}>
                    <View style={styles.sizeChip}>
                      <RNText style={styles.sizeChipText}>{weeksRemaining ?? '--'} weeks to go</RNText>
                    </View>
                    <View style={styles.sizeChip}>
                      <RNText style={styles.sizeChipText}>
                        {weekInfo ? `${weekInfo.babySizeCm} cm approx.` : 'Growing'}
                      </RNText>
                    </View>
                  </View>
                </View>
                <View style={styles.fruitArt}>
                  <RNText style={styles.fruitEmoji}>
                    {fruitEmoji(weekInfo?.babySize ?? 'peach')}
                  </RNText>
                </View>
              </View>
            </GlassCard>

            <View style={styles.sectionWrap}>
              <RNText style={styles.sectionEyebrow}>Milestones</RNText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.milestoneRail}
              >
                {[
                  { label: '1st', sub: 'Weeks 1-13', active: trimester === 1, done: (weekNumber ?? 0) > 13 },
                  { label: '2nd', sub: 'Weeks 14-27', active: trimester === 2, done: (weekNumber ?? 0) > 27 },
                  { label: '3rd', sub: 'Weeks 28-40', active: trimester === 3, done: false },
                ].map((item) => (
                  <View
                    key={item.label}
                    style={[
                      styles.trimesterChip,
                      item.active && styles.trimesterChipActive,
                      item.done && styles.trimesterChipDone,
                    ]}
                  >
                    <RNText style={styles.trimesterChipLabel}>{item.label}</RNText>
                    <RNText style={styles.trimesterChipSub}>{item.sub}</RNText>
                  </View>
                ))}

                {milestoneRail.map((item) => {
                  const active = weekNumber != null && weekNumber >= item.week;
                  return (
                    <View
                      key={item.label}
                      style={[styles.milestoneCard, active && styles.milestoneCardActive]}
                    >
                      <RNText style={styles.milestoneWeek}>Week {item.week}</RNText>
                      <RNText style={styles.milestoneLabel}>{item.label}</RNText>
                    </View>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.sectionWrap}>
              <View style={styles.sectionHeaderRow}>
                <RNText style={styles.sectionEyebrow}>Upcoming Visits</RNText>
                <RNText style={styles.sectionHeaderAction}>Next up</RNText>
              </View>

              {appointments.length > 0 ? (
                <View style={styles.appointmentList}>
                  {appointments.map((appointment) => (
                    <GlassCard key={appointment.id} style={styles.appointmentCard}>
                      <View style={styles.appointmentIconWrap}>
                        <CalendarHeart color={PREGNANCY_ACCENT} size={20} strokeWidth={2} />
                      </View>
                      <View style={styles.appointmentCopy}>
                        <RNText style={styles.appointmentTitle}>{appointment.title}</RNText>
                        <View style={styles.appointmentMetaRow}>
                          <Clock3 color="rgba(214, 195, 181, 0.55)" size={14} strokeWidth={2} />
                          <RNText style={styles.appointmentMeta}>
                            {formatDate(appointment.date)}
                            {appointment.time ? ` • ${appointment.time}` : ''}
                          </RNText>
                        </View>
                        {appointment.location ? (
                          <View style={styles.appointmentMetaRow}>
                            <MapPin color="rgba(214, 195, 181, 0.55)" size={14} strokeWidth={2} />
                            <RNText style={styles.appointmentMeta}>{appointment.location}</RNText>
                          </View>
                        ) : null}
                      </View>
                    </GlassCard>
                  ))}
                </View>
              ) : (
                <GlassCard style={styles.emptyAppointmentsCard}>
                  <RNText style={styles.emptyAppointmentsTitle}>No appointments yet</RNText>
                  <RNText style={styles.emptyAppointmentsBody}>
                    Add your next visit so the pregnancy dashboard becomes your weekly check-in.
                  </RNText>
                </GlassCard>
              )}
            </View>

            <GlassCard style={styles.logCard}>
              <View style={styles.logCardHeader}>
                <View style={styles.logCardIcon}>
                  <Sparkles color={CYCLE_ACCENT} size={18} strokeWidth={2.1} />
                </View>
                <View style={styles.logCardCopy}>
                  <RNText style={styles.logCardTitle}>Log Pregnancy Day</RNText>
                  <RNText style={styles.logCardBody}>
                    Capture symptoms, notes, and visit prep without leaving the cycle module.
                  </RNText>
                </View>
              </View>
              <PrimaryButton
                label="Open Pregnancy Log"
                onPress={() => router.push('/(cycle)/pregnancy-log')}
              />
            </GlassCard>
          </ScrollView>

          <Pressable
            onPress={() => setAppointmentModalVisible(true)}
            style={({ pressed }) => [
              styles.fabWrap,
              {
                bottom: Math.max(insets.bottom + 18, 24),
              },
              pressed && { opacity: 0.88 },
            ]}
          >
            <LinearGradient
              colors={[PREGNANCY_ACCENT, '#FFB877']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fab}
            >
              <Plus color="#FFF5FB" size={28} strokeWidth={2.3} />
            </LinearGradient>
          </Pressable>
        </>
      )}

      <Modal
        visible={onboardingVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setOnboardingVisible(false)}
      >
        <View style={styles.sheetBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.sheetKeyboardWrap}
          >
            <View style={styles.sheetCard}>
              <RNText style={styles.sheetEyebrow}>Start Pregnancy Mode</RNText>
              <RNText style={styles.sheetTitle}>Set your pregnancy dates</RNText>
              <RNText style={styles.sheetBody}>
                Enter a due date, or use your last period date and let MyCycle calculate it.
              </RNText>
              <SheetField
                value={newPregnancyDueDate}
                onChangeText={setNewPregnancyDueDate}
                placeholder="Due date (YYYY-MM-DD)"
              />
              <SheetField
                value={newPregnancyLmp}
                onChangeText={setNewPregnancyLmp}
                placeholder="Last period date (optional)"
              />
              <View style={styles.sheetActions}>
                <Pressable
                  onPress={() => setOnboardingVisible(false)}
                  style={({ pressed }) => [
                    styles.sheetSecondaryButton,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <RNText style={styles.sheetSecondaryText}>Cancel</RNText>
                </Pressable>
                <PrimaryButton label="Start" onPress={handleCreatePregnancy} />
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={editDueDateVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditDueDateVisible(false)}
      >
        <View style={styles.sheetBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.sheetKeyboardWrap}
          >
            <View style={styles.sheetCard}>
              <RNText style={styles.sheetEyebrow}>Pregnancy Settings</RNText>
              <RNText style={styles.sheetTitle}>Edit due date</RNText>
              <RNText style={styles.sheetBody}>
                Update the estimated due date and MyCycle will recalculate the current week.
              </RNText>
              <SheetField
                value={dueDateDraft}
                onChangeText={setDueDateDraft}
                placeholder="Due date (YYYY-MM-DD)"
              />
              <View style={styles.sheetActions}>
                <Pressable
                  onPress={() => setEditDueDateVisible(false)}
                  style={({ pressed }) => [
                    styles.sheetSecondaryButton,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <RNText style={styles.sheetSecondaryText}>Cancel</RNText>
                </Pressable>
                <PrimaryButton label="Save due date" onPress={handleSaveDueDate} />
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={appointmentModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAppointmentModalVisible(false)}
      >
        <View style={styles.sheetBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.sheetKeyboardWrap}
          >
            <View style={styles.sheetCard}>
              <RNText style={styles.sheetEyebrow}>Upcoming Visit</RNText>
              <RNText style={styles.sheetTitle}>Add appointment</RNText>
              <RNText style={styles.sheetBody}>
                Capture the next check-up, scan, or lab so it stays visible on the dashboard.
              </RNText>
              <SheetField
                value={appointmentTitle}
                onChangeText={setAppointmentTitle}
                placeholder="Visit title"
              />
              <SheetField
                value={appointmentDate}
                onChangeText={setAppointmentDate}
                placeholder="Date (YYYY-MM-DD)"
              />
              <SheetField
                value={appointmentTime}
                onChangeText={setAppointmentTime}
                placeholder="Time (optional)"
              />
              <SheetField
                value={appointmentLocation}
                onChangeText={setAppointmentLocation}
                placeholder="Location (optional)"
              />
              <View style={styles.sheetActions}>
                <Pressable
                  onPress={() => setAppointmentModalVisible(false)}
                  style={({ pressed }) => [
                    styles.sheetSecondaryButton,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <RNText style={styles.sheetSecondaryText}>Cancel</RNText>
                </Pressable>
                <PrimaryButton label="Add visit" onPress={handleCreateAppointment} />
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: CYCLE_SURFACES.base,
  },
  scroll: {
    flex: 1,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 28,
    gap: 18,
  },
  hero: {
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    position: 'relative',
  },
  heroGlow: {
    position: 'absolute',
    top: -28,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(244, 114, 182, 0.16)',
    opacity: 0.7,
  },
  heroEyebrow: {
    ...CYCLE_TYPOGRAPHY.labelUpper,
    color: PREGNANCY_ACCENT,
  },
  weekText: {
    fontFamily: CYCLE_FONTS.extraBold,
    fontSize: 64,
    lineHeight: 70,
    letterSpacing: -2,
    color: '#F7F2FA',
  },
  trimesterText: {
    ...CYCLE_TYPOGRAPHY.titleMd,
    color: 'rgba(214, 195, 181, 0.9)',
  },
  progressRailWrap: {
    width: '100%',
    gap: 10,
    marginTop: 14,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    ...CYCLE_TYPOGRAPHY.labelTight,
    color: 'rgba(214, 195, 181, 0.5)',
  },
  progressLabelActive: {
    color: PREGNANCY_ACCENT,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 999,
    backgroundColor: CYCLE_SURFACES.highest,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: PREGNANCY_ACCENT,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    gap: 4,
  },
  sectionEyebrow: {
    ...CYCLE_TYPOGRAPHY.labelUpper,
    color: 'rgba(214, 195, 181, 0.58)',
  },
  statValue: {
    ...CYCLE_TYPOGRAPHY.headlineMd,
    color: '#F5F0F8',
  },
  sizeCard: {
    gap: 14,
  },
  sizeCardRow: {
    flexDirection: 'row',
    gap: 16,
  },
  sizeCardCopy: {
    flex: 1,
    gap: 10,
  },
  sizeTitle: {
    ...CYCLE_TYPOGRAPHY.headlineLg,
    color: '#F7F2FA',
  },
  sizeBody: {
    ...CYCLE_TYPOGRAPHY.bodyMd,
    color: 'rgba(214, 195, 181, 0.82)',
  },
  sizeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sizeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: CYCLE_SURFACES.base,
  },
  sizeChipText: {
    ...CYCLE_TYPOGRAPHY.bodySm,
    color: 'rgba(214, 195, 181, 0.9)',
  },
  fruitArt: {
    width: 110,
    minHeight: 150,
    borderRadius: 28,
    backgroundColor: CYCLE_SURFACES.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fruitEmoji: {
    fontSize: 64,
    opacity: 0.88,
  },
  sectionWrap: {
    gap: 12,
  },
  milestoneRail: {
    gap: 10,
    paddingRight: 20,
  },
  trimesterChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: CYCLE_SURFACES.low,
    gap: 2,
    minWidth: 110,
  },
  trimesterChipActive: {
    backgroundColor: 'rgba(244, 114, 182, 0.18)',
  },
  trimesterChipDone: {
    backgroundColor: 'rgba(244, 114, 182, 0.1)',
  },
  trimesterChipLabel: {
    ...CYCLE_TYPOGRAPHY.titleMd,
    color: '#F7F2FA',
  },
  trimesterChipSub: {
    ...CYCLE_TYPOGRAPHY.bodySm,
    color: 'rgba(214, 195, 181, 0.72)',
  },
  milestoneCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: CYCLE_SURFACES.high,
    gap: 4,
    minWidth: 122,
  },
  milestoneCardActive: {
    backgroundColor: 'rgba(244, 114, 182, 0.18)',
  },
  milestoneWeek: {
    ...CYCLE_TYPOGRAPHY.labelUpper,
    color: PREGNANCY_ACCENT,
  },
  milestoneLabel: {
    ...CYCLE_TYPOGRAPHY.titleMd,
    color: '#F7F2FA',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeaderAction: {
    ...CYCLE_TYPOGRAPHY.labelTight,
    color: PREGNANCY_ACCENT,
  },
  appointmentList: {
    gap: 10,
  },
  appointmentCard: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  appointmentIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 18,
    backgroundColor: 'rgba(244, 114, 182, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appointmentCopy: {
    flex: 1,
    gap: 6,
  },
  appointmentTitle: {
    ...CYCLE_TYPOGRAPHY.titleMd,
    color: '#F5F0F8',
  },
  appointmentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  appointmentMeta: {
    ...CYCLE_TYPOGRAPHY.bodySm,
    color: 'rgba(214, 195, 181, 0.76)',
  },
  emptyAppointmentsCard: {
    gap: 6,
  },
  emptyAppointmentsTitle: {
    ...CYCLE_TYPOGRAPHY.titleMd,
    color: '#F5F0F8',
  },
  emptyAppointmentsBody: {
    ...CYCLE_TYPOGRAPHY.bodyMd,
    color: 'rgba(214, 195, 181, 0.76)',
  },
  logCard: {
    gap: 14,
  },
  logCardHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  logCardIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: 'rgba(201, 137, 77, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logCardCopy: {
    flex: 1,
    gap: 4,
  },
  logCardTitle: {
    ...CYCLE_TYPOGRAPHY.headlineMd,
    color: '#F5F0F8',
  },
  logCardBody: {
    ...CYCLE_TYPOGRAPHY.bodyMd,
    color: 'rgba(214, 195, 181, 0.76)',
  },
  fabWrap: {
    position: 'absolute',
    right: 24,
  },
  fab: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 18,
    backgroundColor: CYCLE_SURFACES.base,
  },
  emptyGlow: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(244, 114, 182, 0.14)',
  },
  emptyTitle: {
    fontFamily: CYCLE_FONTS.extraBold,
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -1.2,
    color: '#F7F2FA',
    textAlign: 'center',
  },
  emptyBody: {
    ...CYCLE_TYPOGRAPHY.bodyMd,
    color: 'rgba(214, 195, 181, 0.82)',
    textAlign: 'center',
  },
  emptyCard: {
    width: '100%',
    gap: 12,
    alignItems: 'center',
  },
  emptyIconWrap: {
    width: 62,
    height: 62,
    borderRadius: 24,
    backgroundColor: 'rgba(244, 114, 182, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCardTitle: {
    ...CYCLE_TYPOGRAPHY.headlineMd,
    color: '#F7F2FA',
    textAlign: 'center',
  },
  emptyCardBody: {
    ...CYCLE_TYPOGRAPHY.bodyMd,
    color: 'rgba(214, 195, 181, 0.76)',
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 132,
  },
  primaryButtonText: {
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 13,
    lineHeight: 16,
    color: '#FFF5FB',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.58)',
    justifyContent: 'flex-end',
  },
  sheetKeyboardWrap: {
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: CYCLE_SURFACES.low,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 14,
  },
  sheetEyebrow: {
    ...CYCLE_TYPOGRAPHY.labelUpper,
    color: PREGNANCY_ACCENT,
  },
  sheetTitle: {
    ...CYCLE_TYPOGRAPHY.displayMd,
    color: '#F7F2FA',
  },
  sheetBody: {
    ...CYCLE_TYPOGRAPHY.bodyMd,
    color: 'rgba(214, 195, 181, 0.78)',
  },
  sheetInput: {
    minHeight: 56,
    borderRadius: 20,
    backgroundColor: CYCLE_SURFACES.high,
    paddingHorizontal: 18,
    fontFamily: CYCLE_FONTS.medium,
    fontSize: 16,
    lineHeight: 20,
    color: '#F7F2FA',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 12,
  },
  sheetSecondaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: CYCLE_SURFACES.high,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSecondaryText: {
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 13,
    lineHeight: 16,
    color: '#E4E1E9',
  },
});
