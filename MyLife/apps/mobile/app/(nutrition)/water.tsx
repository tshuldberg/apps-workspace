import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import {
  GlassCard,
  MaterialSymbol,
  NU_ACCENT_LIGHT,
  NU_SURFACES,
  NU_TEXT,
  NU_TEXT_SECONDARY,
  NU_TEXT_TERTIARY,
  NU_TYPOGRAPHY,
  NU_WATER,
  createWaterLogEntry,
  deleteWaterLogEntry,
  getSetting,
  getWaterGoalMl,
  getWaterLogByDate,
  getWeeklyWaterTotals,
  setSetting,
  updateWaterLogEntry,
  type WaterEntry,
} from '@mylife/nutrition';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import { formatClockLabel, formatLiters, todayKey } from './phase2-data';

const QUICK_AMOUNTS = [250, 500, 750, 1000];
const REMINDER_INTERVALS = ['30m', '1h', '2h'] as const;

export default function WaterScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [refreshToken, setRefreshToken] = useState(0);
  const [goalDraft, setGoalDraft] = useState(() => getWaterGoalMl(db));
  const [customVisible, setCustomVisible] = useState(false);
  const [customAmount, setCustomAmount] = useState(500);
  const [editingEntry, setEditingEntry] = useState<WaterEntry | null>(null);
  const [remindersEnabled, setRemindersEnabled] = useState(
    () => getSetting(db, 'water_reminders') === '1',
  );
  const [reminderInterval, setReminderInterval] = useState<
    (typeof REMINDER_INTERVALS)[number]
  >(
    () =>
      (getSetting(db, 'water_reminder_interval') as
        | (typeof REMINDER_INTERVALS)[number]
        | undefined) ?? '1h',
  );
  const [chartToast, setChartToast] = useState<string | null>(null);
  const fillAnim = useRef(new Animated.Value(0)).current;

  const today = todayKey();
  const goalMl = useMemo(() => getWaterGoalMl(db), [db, refreshToken]);
  const waterLog = useMemo(() => {
    try {
      return getWaterLogByDate(db, today);
    } catch {
      return [] as WaterEntry[];
    }
  }, [db, today, refreshToken]);
  const weekly = useMemo(() => {
    try {
      return getWeeklyWaterTotals(db, today);
    } catch {
      return { days: [], goalMl };
    }
  }, [db, today, goalMl, refreshToken]);

  const consumedMl = useMemo(
    () => waterLog.reduce((sum, entry) => sum + entry.amountMl, 0),
    [waterLog],
  );
  const progress = goalMl > 0 ? Math.min(consumedMl / goalMl, 1) : 0;

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: progress,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [fillAnim, progress]);

  useEffect(() => {
    if (!chartToast) {
      return;
    }

    const timeout = setTimeout(() => setChartToast(null), 1600);
    return () => clearTimeout(timeout);
  }, [chartToast]);

  function refresh() {
    setRefreshToken((current) => current + 1);
  }

  function logWater(amountMl: number) {
    try {
      createWaterLogEntry(db, uuid(), {
        date: today,
        amountMl,
        source: 'quick_add',
      });
      refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not add water.';
      Alert.alert('Hydration failed', message);
    }
  }

  function saveCustomAmount() {
    try {
      if (editingEntry) {
        updateWaterLogEntry(db, editingEntry.id, {
          amountMl: customAmount,
          source: 'manual',
        });
      } else {
        createWaterLogEntry(db, uuid(), {
          date: today,
          amountMl: customAmount,
          source: 'manual',
        });
      }
      setCustomVisible(false);
      setEditingEntry(null);
      refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not save water entry.';
      Alert.alert('Save failed', message);
    }
  }

  function saveGoal() {
    try {
      const value = String(goalDraft);
      setSetting(db, 'waterGoalMl', value);
      setSetting(db, 'water_goal_ml', value);
      refresh();
      Alert.alert('Saved', 'Daily hydration goal updated.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not save water goal.';
      Alert.alert('Save failed', message);
    }
  }

  function saveReminders(nextEnabled: boolean, nextInterval = reminderInterval) {
    try {
      setSetting(db, 'water_reminders', nextEnabled ? '1' : '0');
      setSetting(db, 'water_reminder_interval', nextInterval);
      setRemindersEnabled(nextEnabled);
      setReminderInterval(nextInterval);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not save reminders.';
      Alert.alert('Reminder failed', message);
    }
  }

  const fillHeight = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const maxWeeklyMl = Math.max(goalMl, ...weekly.days.map((day) => day.totalMl), 1);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topGlow} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable style={styles.headerButton} onPress={() => router.back()}>
            <MaterialSymbol name="arrow_back" size={18} color={NU_TEXT} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.headerEyebrow}>Water intake</Text>
            <Text style={styles.headerTitle}>Hydration</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <GlassCard elevated style={styles.heroCard}>
          <View style={styles.heroGlassRow}>
            <View style={styles.glassShell}>
              <Animated.View style={[styles.glassFill, { height: fillHeight }]} />
              <View style={styles.glassInnerHighlight} />
              <View style={styles.glassRim} />
            </View>
            <View style={styles.heroCopy}>
              <View style={styles.heroLabelChip}>
                <MaterialSymbol name="water_drop" size={15} color={NU_WATER} />
                <Text style={styles.heroLabelText}>Today</Text>
              </View>
              <Text style={styles.heroValue}>
                {formatLiters(consumedMl)} / {formatLiters(goalMl)}
              </Text>
              <Text style={styles.heroSubtitle}>
                {Math.round(progress * 100)}% of your hydration goal
              </Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Add</Text>
            <Text style={styles.sectionHint}>Tap to log instantly</Text>
          </View>
          <View style={styles.quickGrid}>
            {QUICK_AMOUNTS.map((amount) => (
              <Pressable
                key={amount}
                style={styles.quickChip}
                onPress={() => logWater(amount)}
              >
                <MaterialSymbol name="water_drop" size={16} color={NU_WATER} />
                <Text style={styles.quickChipLabel}>
                  {amount >= 1000 ? `${amount / 1000}L` : `${amount}ml`}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={styles.quickChip}
              onPress={() => {
                setEditingEntry(null);
                setCustomAmount(500);
                setCustomVisible(true);
              }}
            >
              <MaterialSymbol name="edit" size={16} color={NU_ACCENT_LIGHT} />
              <Text style={styles.quickChipLabel}>Custom</Text>
            </Pressable>
          </View>
        </GlassCard>

        <GlassCard style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today&apos;s Log</Text>
            <Text style={styles.sectionHint}>{waterLog.length} entries</Text>
          </View>
          {waterLog.length === 0 ? (
            <Text style={styles.emptyBody}>
              No water logged yet. Use the quick-add chips to start your streak.
            </Text>
          ) : (
            <View style={styles.logList}>
              {waterLog.map((entry) => (
                <View key={entry.id} style={styles.logRow}>
                  <View style={styles.logIcon}>
                    <MaterialSymbol
                      name="water_drop"
                      size={16}
                      color={NU_WATER}
                    />
                  </View>
                  <View style={styles.logCopy}>
                    <Text style={styles.logAmount}>
                      {entry.amountMl >= 1000
                        ? `${(entry.amountMl / 1000).toFixed(1)}L`
                        : `${entry.amountMl}ml`}
                    </Text>
                    <Text style={styles.logTime}>{formatClockLabel(entry.createdAt)}</Text>
                  </View>
                  <View style={styles.logActions}>
                    <Pressable
                      style={styles.logActionButton}
                      onPress={() => {
                        setEditingEntry(entry);
                        setCustomAmount(entry.amountMl);
                        setCustomVisible(true);
                      }}
                    >
                      <MaterialSymbol name="edit" size={15} color={NU_TEXT_SECONDARY} />
                    </Pressable>
                    <Pressable
                      style={styles.logActionButton}
                      onPress={() => {
                        Alert.alert('Delete entry', 'Remove this water log?', [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: () => {
                              try {
                                deleteWaterLogEntry(db, entry.id);
                                refresh();
                              } catch (error) {
                                const message =
                                  error instanceof Error
                                    ? error.message
                                    : 'Could not delete that entry.';
                                Alert.alert('Delete failed', message);
                              }
                            },
                          },
                        ]);
                      }}
                    >
                      <MaterialSymbol name="delete" size={15} color="#FFB4AB" />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}
        </GlassCard>

        <GlassCard style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>7-Day Trend</Text>
            <Text style={styles.sectionHint}>Goal line included</Text>
          </View>
          <View style={styles.chartArea}>
            {weekly.days.map((day) => {
              const chartInnerHeight = 122;
              const barHeight = Math.max(
                (day.totalMl / maxWeeklyMl) * chartInnerHeight,
                8,
              );
              const goalLineBottom = (goalMl / maxWeeklyMl) * chartInnerHeight + 6;
              const dayLabel = new Date(`${day.date}T00:00:00`).toLocaleDateString(
                'en-US',
                { weekday: 'short' },
              );
              const isToday = day.date === today;

              return (
                <Pressable
                  key={day.date}
                  style={styles.chartColumn}
                  onPress={() =>
                    setChartToast(
                      `${dayLabel}: ${day.totalMl}ml logged across ${day.entryCount} entries`,
                    )
                  }
                >
                  <View style={styles.chartTrack}>
                    <View
                      style={[
                        styles.goalLine,
                        {
                          bottom: goalLineBottom,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.chartBar,
                        {
                          height: barHeight,
                          opacity: isToday ? 1 : 0.72,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.chartLabel,
                      isToday ? styles.chartLabelActive : null,
                    ]}
                  >
                    {dayLabel}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {chartToast ? (
            <Text style={styles.chartToast}>{chartToast}</Text>
          ) : null}
        </GlassCard>

        <GlassCard style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Daily Goal</Text>
            <Text style={styles.sectionHint}>250ml steps</Text>
          </View>
          <View style={styles.goalRow}>
            <StepperButton
              label="-"
              onPress={() => setGoalDraft((value) => Math.max(500, value - 250))}
            />
            <View style={styles.goalValueCard}>
              <Text style={styles.goalValue}>{formatLiters(goalDraft)}</Text>
              <Text style={styles.goalValueHint}>{goalDraft}ml target</Text>
            </View>
            <StepperButton
              label="+"
              onPress={() => setGoalDraft((value) => Math.min(6000, value + 250))}
            />
          </View>
          <LinearGradient
            colors={[NU_ACCENT_LIGHT, NU_WATER]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.saveButtonWrap}
          >
            <Pressable style={styles.saveButton} onPress={saveGoal}>
              <Text style={styles.saveButtonText}>Save goal</Text>
            </Pressable>
          </LinearGradient>
        </GlassCard>

        <GlassCard style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Reminders</Text>
            <Switch
              value={remindersEnabled}
              onValueChange={(value) => saveReminders(value)}
              trackColor={{ false: '#3A3A40', true: 'rgba(56,189,248,0.45)' }}
              thumbColor={remindersEnabled ? NU_WATER : '#E4E1E9'}
            />
          </View>
          <Text style={styles.emptyBody}>
            Remind me to drink throughout the day.
          </Text>
          <View style={styles.intervalRow}>
            {REMINDER_INTERVALS.map((interval) => {
              const selected = reminderInterval === interval;
              return (
                <Pressable
                  key={interval}
                  style={[
                    styles.intervalChip,
                    selected ? styles.intervalChipActive : null,
                  ]}
                  onPress={() => saveReminders(remindersEnabled, interval)}
                >
                  <Text
                    style={[
                      styles.intervalChipLabel,
                      selected ? styles.intervalChipLabelActive : null,
                    ]}
                  >
                    {interval}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </GlassCard>
      </ScrollView>

      <Modal
        visible={customVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCustomVisible(false)}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setCustomVisible(false)}
        >
          <Pressable
            style={styles.sheet}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              {editingEntry ? 'Edit amount' : 'Custom amount'}
            </Text>
            <Text style={styles.sheetBody}>
              Fine-tune a hydration entry in 50ml increments.
            </Text>
            <View style={styles.customStepperRow}>
              <StepperButton
                label="-"
                onPress={() => setCustomAmount((value) => Math.max(50, value - 50))}
              />
              <View style={styles.customAmountCard}>
                <Text style={styles.customAmountValue}>{customAmount}ml</Text>
                <Text style={styles.customAmountHint}>
                  {(customAmount / 1000).toFixed(2)} liters
                </Text>
              </View>
              <StepperButton
                label="+"
                onPress={() => setCustomAmount((value) => Math.min(3000, value + 50))}
              />
            </View>
            <LinearGradient
              colors={[NU_ACCENT_LIGHT, NU_WATER]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.saveButtonWrap}
            >
              <Pressable style={styles.saveButton} onPress={saveCustomAmount}>
                <Text style={styles.saveButtonText}>
                  {editingEntry ? 'Update entry' : 'Save entry'}
                </Text>
              </Pressable>
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function StepperButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.stepperButton} onPress={onPress}>
      <Text style={styles.stepperLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: NU_SURFACES.lowest,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
    gap: 16,
  },
  topGlow: {
    position: 'absolute',
    top: -120,
    right: -90,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: 'rgba(56,189,248,0.18)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NU_SURFACES.low,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  headerEyebrow: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_SECONDARY,
  },
  headerTitle: {
    color: NU_TEXT,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.02 * 30,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  headerSpacer: {
    width: 40,
  },
  heroCard: {
    overflow: 'hidden',
  },
  heroGlassRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  glassShell: {
    width: 120,
    height: 168,
    borderRadius: 32,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  glassFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(56,189,248,0.7)',
  },
  glassInnerHighlight: {
    position: 'absolute',
    top: 12,
    bottom: 12,
    left: 16,
    width: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  glassRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  heroCopy: {
    flex: 1,
    gap: 8,
  },
  heroLabelChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(56,189,248,0.12)',
  },
  heroLabelText: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_WATER,
  },
  heroValue: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_TEXT,
    fontSize: 30,
    lineHeight: 34,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  heroSubtitle: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
  },
  sectionCard: {
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_TEXT,
  },
  sectionHint: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_TERTIARY,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickChip: {
    minWidth: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: NU_SURFACES.low,
  },
  quickChipLabel: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  emptyBody: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
  },
  logList: {
    gap: 10,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: NU_SURFACES.low,
  },
  logIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56,189,248,0.12)',
  },
  logCopy: {
    flex: 1,
    gap: 2,
  },
  logAmount: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_TEXT,
  },
  logTime: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
  },
  logActions: {
    flexDirection: 'row',
    gap: 8,
  },
  logActionButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
    minHeight: 170,
  },
  chartColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  chartTrack: {
    width: '100%',
    height: 138,
    justifyContent: 'flex-end',
    alignItems: 'center',
    position: 'relative',
    borderRadius: 18,
    paddingHorizontal: 8,
    paddingBottom: 6,
    backgroundColor: NU_SURFACES.low,
  },
  goalLine: {
    position: 'absolute',
    left: 6,
    right: 6,
    height: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,184,119,0.85)',
  },
  chartBar: {
    width: '100%',
    borderRadius: 14,
    backgroundColor: NU_WATER,
  },
  chartLabel: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_TERTIARY,
  },
  chartLabelActive: {
    color: NU_TEXT,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  chartToast: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_WATER,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  goalValueCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    paddingVertical: 12,
    backgroundColor: NU_SURFACES.low,
  },
  goalValue: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_TEXT,
  },
  goalValueHint: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
  },
  saveButtonWrap: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  saveButton: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    ...NU_TYPOGRAPHY.titleMd,
    color: '#062330',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  intervalRow: {
    flexDirection: 'row',
    gap: 10,
  },
  intervalChip: {
    flex: 1,
    minHeight: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NU_SURFACES.low,
  },
  intervalChipActive: {
    backgroundColor: 'rgba(56,189,248,0.18)',
  },
  intervalChipLabel: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  intervalChipLabelActive: {
    color: NU_WATER,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    backgroundColor: NU_SURFACES.base,
    gap: 14,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 52,
    height: 5,
    borderRadius: 999,
    backgroundColor: NU_TEXT_TERTIARY,
    opacity: 0.5,
  },
  sheetTitle: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_TEXT,
    textAlign: 'center',
  },
  sheetBody: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
    textAlign: 'center',
  },
  customStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  customAmountCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    paddingVertical: 12,
    backgroundColor: NU_SURFACES.low,
  },
  customAmountValue: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_TEXT,
  },
  customAmountHint: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NU_SURFACES.low,
  },
  stepperLabel: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_TEXT,
  },
});
