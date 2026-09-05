import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import {
  getSetting,
  setSetting,
  getNotificationPreferences,
  setNotificationPreference,
  listGoals,
  listGoalProgress,
  createGoal,
  upsertGoal,
  refreshGoalProgress,
  setWaterTarget,
  exportFastsCSV,
  exportWeightCSV,
  getBeverageTypes,
  createBeverageType,
  updateBeverageType,
  deleteBeverageType,
  getContainerPresets,
  createContainerPreset,
  updateContainerPreset,
  deleteContainerPreset,
  volumeToGlasses,
  calculatePersonalizedTarget,
  generateReminderSlots,
} from '@mylife/fast';
import type {
  NotificationPreferences,
  Goal,
  GoalProgress,
  BeverageType,
  ContainerPreset,
  WaterReminderConfig,
  ReminderSlot,
} from '@mylife/fast';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { getHealthSyncStatus, probeHealthSyncStatus, syncHealthData } from '../../lib/health-sync';
import { uuid } from '../../lib/uuid';

const ACCENT = colors.modules.fast;

interface WeeklyGoalState {
  goal: Goal | null;
  target: number;
  history: GoalProgress[];
}

function settingBool(value: string | null, fallback = false): boolean {
  if (value == null) return fallback;
  return value === '1' || value.toLowerCase() === 'true';
}

function loadWeeklyGoal(db: ReturnType<typeof useDatabase>): WeeklyGoalState {
  const goals = listGoals(db, true);
  const weekly = goals.find((goal) => goal.type === 'fasts_per_week' && goal.isActive) ?? null;
  if (!weekly) return { goal: null, target: 5, history: [] };
  return {
    goal: weekly,
    target: Math.max(1, Math.round(weekly.targetValue)),
    history: listGoalProgress(db, weekly.id, 8),
  };
}

// ── Main Component ──

export default function FastSettingsScreen() {
  const db = useDatabase();

  // Existing settings state
  const [defaultProtocol, setDefaultProtocol] = useState(
    getSetting(db, 'defaultProtocol') ?? '16:8',
  );
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(
    getNotificationPreferences(db),
  );
  const [waterTargetVal, setWaterTargetState] = useState(() => {
    const value = Number(getSetting(db, 'waterDailyTarget') ?? '8');
    return Number.isFinite(value) ? Math.max(1, Math.round(value)) : 8;
  });
  const [weeklyGoal, setWeeklyGoal] = useState<WeeklyGoalState>(() => loadWeeklyGoal(db));
  const [healthSyncEnabled, setHealthSyncEnabled] = useState(
    settingBool(getSetting(db, 'healthSyncEnabled'), false),
  );
  const [healthReadWeight, setHealthReadWeight] = useState(
    settingBool(getSetting(db, 'healthReadWeight'), false),
  );
  const [healthWriteFasts, setHealthWriteFasts] = useState(
    settingBool(getSetting(db, 'healthWriteFasts'), false),
  );
  const [healthStatus, setHealthStatus] = useState(() => getHealthSyncStatus());

  // FAST-06: Beverage types
  const [beverageTypes, setBeverageTypes] = useState<BeverageType[]>([]);
  const [newBevName, setNewBevName] = useState('');
  const [newBevIcon, setNewBevIcon] = useState('🥤');
  const [newBevOz, setNewBevOz] = useState('12');
  const [newBevCoeff, setNewBevCoeff] = useState('1.0');
  const [newBevCaffeine, setNewBevCaffeine] = useState('');

  // FAST-07: Container presets
  const [containers, setContainers] = useState<ContainerPreset[]>([]);
  const [newContName, setNewContName] = useState('');
  const [newContIcon, setNewContIcon] = useState('🥛');
  const [newContOz, setNewContOz] = useState('16');

  // FAST-08: Water reminders
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderInterval, setReminderInterval] = useState(60);
  const [wakeStart, setWakeStart] = useState('07:00');
  const [wakeEnd, setWakeEnd] = useState('22:00');
  const [pauseDryFast, setPauseDryFast] = useState(false);
  const [personalizedGoal, setPersonalizedGoal] = useState(false);
  const [weightForTarget, setWeightForTarget] = useState('');
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>('lbs');
  const [reminderSlots, setReminderSlots] = useState<ReminderSlot[]>([]);

  const loadAll = useCallback(() => {
    setBeverageTypes(getBeverageTypes(db));
    setContainers(getContainerPresets(db));

    // Load reminder config
    setReminderEnabled(settingBool(getSetting(db, 'waterRemindersEnabled')));
    const interval = Number(getSetting(db, 'waterReminderInterval') ?? '60');
    setReminderInterval(Number.isFinite(interval) ? interval : 60);
    setWakeStart(getSetting(db, 'waterWakeStart') ?? '07:00');
    setWakeEnd(getSetting(db, 'waterWakeEnd') ?? '22:00');
    setPauseDryFast(settingBool(getSetting(db, 'waterPauseDuringDryFast')));
    setPersonalizedGoal(settingBool(getSetting(db, 'waterPersonalizedGoal')));
  }, [db]);

  useEffect(() => {
    loadAll();
    let mounted = true;
    probeHealthSyncStatus()
      .then((status) => {
        if (!mounted) return;
        setHealthStatus(status);
      })
      .catch(() => {
        // Ignore probe failures; health sync status stays unknown.
      });
    return () => { mounted = false; };
  }, [loadAll]);

  // Update reminder preview
  useEffect(() => {
    if (reminderEnabled) {
      setReminderSlots(generateReminderSlots(reminderInterval, wakeStart, wakeEnd));
    } else {
      setReminderSlots([]);
    }
  }, [reminderEnabled, reminderInterval, wakeStart, wakeEnd, pauseDryFast, personalizedGoal]);

  const save = () => {
    setSetting(db, 'defaultProtocol', defaultProtocol.trim() || '16:8');
    setSetting(db, 'healthSyncEnabled', healthSyncEnabled ? '1' : '0');
    setSetting(db, 'healthReadWeight', healthReadWeight ? '1' : '0');
    setSetting(db, 'healthWriteFasts', healthWriteFasts ? '1' : '0');

    // Save reminder config
    setSetting(db, 'waterRemindersEnabled', reminderEnabled ? 'true' : 'false');
    setSetting(db, 'waterReminderInterval', String(reminderInterval));
    setSetting(db, 'waterWakeStart', wakeStart);
    setSetting(db, 'waterWakeEnd', wakeEnd);
    setSetting(db, 'waterPauseDuringDryFast', pauseDryFast ? 'true' : 'false');
    setSetting(db, 'waterPersonalizedGoal', personalizedGoal ? 'true' : 'false');

    if (weeklyGoal.goal) {
      upsertGoal(db, { ...weeklyGoal.goal, targetValue: weeklyGoal.target });
    } else {
      createGoal(db, { type: 'fasts_per_week', targetValue: weeklyGoal.target, label: 'Weekly fasting goal', unit: 'fasts' });
    }
    refreshGoalProgress(db);
    setWeeklyGoal(loadWeeklyGoal(db));
    Alert.alert('Saved', 'Settings saved successfully.');
  };

  const adjustWaterTarget = (delta: number) => {
    const next = Math.max(1, waterTargetVal + delta);
    const updated = setWaterTarget(db, next);
    setWaterTargetState(updated.target);
  };

  const updateNotification = (key: keyof NotificationPreferences, value: boolean) => {
    setNotificationPrefs((prev) => ({ ...prev, [key]: value }));
    setNotificationPreference(db, key, value);
  };

  const handleSyncHealth = useCallback(async () => {
    if (!healthSyncEnabled) {
      Alert.alert('Health Sync', 'Enable health sync first.');
      return;
    }
    const result = await syncHealthData(db, { readWeight: healthReadWeight, writeFasts: healthWriteFasts });
    Alert.alert('Health Sync', result.message);
  }, [db, healthReadWeight, healthSyncEnabled, healthWriteFasts]);

  const handleExport = useCallback(() => {
    const combined = `=== Fasts ===\n${exportFastsCSV(db)}\n=== Weight ===\n${exportWeightCSV(db)}`;
    void Share.share({ message: combined, title: 'MyFast Export' });
  }, [db]);

  const handleEraseData = useCallback(() => {
    Alert.alert('Erase All Data', 'Permanently delete all fasts, water logs, goals, and settings?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Erase Everything',
        style: 'destructive',
        onPress: () => {
          db.transaction(() => {
            db.execute('DELETE FROM ft_beverage_log');
            db.execute('DELETE FROM ft_container_presets');
            db.execute('DELETE FROM ft_beverage_types');
            db.execute('DELETE FROM ft_goal_progress');
            db.execute('DELETE FROM ft_goals');
            db.execute('DELETE FROM ft_active_fast');
            db.execute('DELETE FROM ft_fasts');
            db.execute('DELETE FROM ft_weight_entries');
            db.execute('DELETE FROM ft_water_intake');
            db.execute('DELETE FROM ft_notifications_config');
            db.execute('DELETE FROM ft_streak_cache');
            db.execute('DELETE FROM ft_settings');
          });
          Alert.alert('Done', 'All MyFast data has been erased.');
        },
      },
    ]);
  }, [db]);

  // FAST-06: Beverage type handlers
  const handleAddBeverageType = () => {
    if (!newBevName.trim()) return;
    createBeverageType(db, {
      name: newBevName.trim(),
      icon: newBevIcon || '🥤',
      defaultOz: Number(newBevOz) || 12,
      coefficient: Number(newBevCoeff) || 1.0,
      caffeineMg: newBevCaffeine ? Number(newBevCaffeine) : null,
    });
    setNewBevName('');
    setNewBevOz('12');
    setNewBevCoeff('1.0');
    setNewBevCaffeine('');
    loadAll();
  };

  const handleDeleteBeverageType = (id: string) => {
    Alert.alert('Delete', 'Remove this beverage type?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteBeverageType(db, id); loadAll(); } },
    ]);
  };

  // FAST-07: Container handlers
  const handleAddContainer = () => {
    if (!newContName.trim()) return;
    createContainerPreset(db, {
      name: newContName.trim(),
      icon: newContIcon || '🥛',
      volumeOz: Number(newContOz) || 16,
    });
    setNewContName('');
    setNewContOz('16');
    loadAll();
  };

  const handleDeleteContainer = (id: string) => {
    Alert.alert('Delete', 'Remove this container?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteContainerPreset(db, id); loadAll(); } },
    ]);
  };

  // FAST-08: personalized target calc
  const personalizedTarget = personalizedGoal && weightForTarget
    ? calculatePersonalizedTarget(Number(weightForTarget), weightUnit)
    : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Timer Defaults */}
      <Card>
        <Text variant="subheading">Timer Defaults</Text>
        <View style={styles.formRow}>
          <Text variant="caption" color={colors.textSecondary}>Default protocol</Text>
          <TextInput
            style={styles.input}
            value={defaultProtocol}
            onChangeText={setDefaultProtocol}
            placeholder="16:8"
            placeholderTextColor={colors.textTertiary}
          />
        </View>
      </Card>

      {/* Notifications */}
      <Card>
        <Text variant="subheading">Notifications</Text>
        <ToggleRow label="Fast started" value={notificationPrefs.fastStart} onChange={(v) => updateNotification('fastStart', v)} />
        <ToggleRow label="25% progress" value={notificationPrefs.progress25} onChange={(v) => updateNotification('progress25', v)} />
        <ToggleRow label="50% progress" value={notificationPrefs.progress50} onChange={(v) => updateNotification('progress50', v)} />
        <ToggleRow label="75% progress" value={notificationPrefs.progress75} onChange={(v) => updateNotification('progress75', v)} />
        <ToggleRow label="Fast complete" value={notificationPrefs.fastComplete} onChange={(v) => updateNotification('fastComplete', v)} />
      </Card>

      {/* Hydration */}
      <Card>
        <Text variant="subheading">Hydration</Text>
        <View style={styles.rowBetween}>
          <Text variant="body">Daily target</Text>
          <View style={styles.adjustControls}>
            <Pressable style={styles.adjustButton} onPress={() => adjustWaterTarget(-1)}>
              <Text variant="label">-</Text>
            </Pressable>
            <Text style={styles.targetValue}>{waterTargetVal}</Text>
            <Pressable style={styles.adjustButton} onPress={() => adjustWaterTarget(1)}>
              <Text variant="label">+</Text>
            </Pressable>
          </View>
        </View>
      </Card>

      {/* Goals */}
      <Card>
        <Text variant="subheading">Goals</Text>
        <View style={styles.rowBetween}>
          <Text variant="body">Fasts per week</Text>
          <View style={styles.adjustControls}>
            <Pressable style={styles.adjustButton} onPress={() => setWeeklyGoal((prev) => ({ ...prev, target: Math.max(1, prev.target - 1) }))}>
              <Text variant="label">-</Text>
            </Pressable>
            <Text style={styles.targetValue}>{weeklyGoal.target}</Text>
            <Pressable style={styles.adjustButton} onPress={() => setWeeklyGoal((prev) => ({ ...prev, target: Math.min(14, prev.target + 1) }))}>
              <Text variant="label">+</Text>
            </Pressable>
          </View>
        </View>
        {weeklyGoal.history.slice(0, 3).map((entry) => (
          <View key={entry.id} style={styles.rowBetweenMini}>
            <Text variant="caption" color={colors.textSecondary}>{entry.periodStart} - {entry.periodEnd}</Text>
            <Text variant="caption" color={entry.completed ? colors.success : colors.text}>{entry.currentValue}/{entry.targetValue}</Text>
          </View>
        ))}
      </Card>

      {/* FAST-06: Beverage Types */}
      <Card>
        <Text variant="subheading">Beverage Types</Text>
        {beverageTypes.map((bt) => (
          <View key={bt.id} style={styles.itemRow}>
            <Text style={styles.itemIcon}>{bt.icon}</Text>
            <View style={styles.flex1}>
              <Text variant="body">{bt.name}</Text>
              <Text variant="caption" color={colors.textSecondary}>
                {bt.defaultOz}oz · coeff {bt.coefficient}{bt.caffeineMg != null ? ` · ${bt.caffeineMg}mg caffeine` : ''}
              </Text>
            </View>
            {!bt.isBuiltin ? (
              <Pressable onPress={() => handleDeleteBeverageType(bt.id)}>
                <Text variant="caption" color={colors.danger}>Delete</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
        <Text variant="label" color={colors.textSecondary} style={{ marginTop: spacing.md }}>
          Add Custom Beverage
        </Text>
        <View style={styles.formRow}>
          <TextInput style={[styles.input, { flex: 1 }]} value={newBevName} onChangeText={setNewBevName} placeholder="Name" placeholderTextColor={colors.textTertiary} />
          <TextInput style={[styles.input, { width: 50 }]} value={newBevIcon} onChangeText={setNewBevIcon} placeholder="Icon" placeholderTextColor={colors.textTertiary} />
        </View>
        <View style={styles.formRow}>
          <TextInput style={[styles.input, { flex: 1 }]} value={newBevOz} onChangeText={setNewBevOz} placeholder="Oz" keyboardType="decimal-pad" placeholderTextColor={colors.textTertiary} />
          <TextInput style={[styles.input, { flex: 1 }]} value={newBevCoeff} onChangeText={setNewBevCoeff} placeholder="Coefficient" keyboardType="decimal-pad" placeholderTextColor={colors.textTertiary} />
          <TextInput style={[styles.input, { flex: 1 }]} value={newBevCaffeine} onChangeText={setNewBevCaffeine} placeholder="Caffeine mg" keyboardType="decimal-pad" placeholderTextColor={colors.textTertiary} />
        </View>
        <Pressable style={[styles.primaryButton, { marginTop: spacing.sm }]} onPress={handleAddBeverageType}>
          <Text variant="label" color={colors.background}>Add Beverage Type</Text>
        </Pressable>
      </Card>

      {/* FAST-07: Container Presets */}
      <Card>
        <Text variant="subheading">Container Presets</Text>
        {containers.map((c) => (
          <View key={c.id} style={styles.itemRow}>
            <Text style={styles.itemIcon}>{c.icon}</Text>
            <View style={styles.flex1}>
              <Text variant="body">{c.name}</Text>
              <Text variant="caption" color={colors.textSecondary}>
                {c.volumeOz}oz ({volumeToGlasses(c.volumeOz).toFixed(1)} glasses)
              </Text>
            </View>
            {!c.isBuiltin ? (
              <Pressable onPress={() => handleDeleteContainer(c.id)}>
                <Text variant="caption" color={colors.danger}>Delete</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
        <Text variant="label" color={colors.textSecondary} style={{ marginTop: spacing.md }}>
          Add Custom Container
        </Text>
        <View style={styles.formRow}>
          <TextInput style={[styles.input, { flex: 1 }]} value={newContName} onChangeText={setNewContName} placeholder="Name" placeholderTextColor={colors.textTertiary} />
          <TextInput style={[styles.input, { width: 50 }]} value={newContIcon} onChangeText={setNewContIcon} placeholder="Icon" placeholderTextColor={colors.textTertiary} />
          <TextInput style={[styles.input, { flex: 1 }]} value={newContOz} onChangeText={setNewContOz} placeholder="Volume oz" keyboardType="decimal-pad" placeholderTextColor={colors.textTertiary} />
        </View>
        {newContOz ? (
          <Text variant="caption" color={colors.textSecondary} style={{ marginTop: spacing.xs }}>
            = {volumeToGlasses(Number(newContOz) || 0).toFixed(1)} glasses
          </Text>
        ) : null}
        <Pressable style={[styles.primaryButton, { marginTop: spacing.sm }]} onPress={handleAddContainer}>
          <Text variant="label" color={colors.background}>Add Container</Text>
        </Pressable>
      </Card>

      {/* FAST-08: Smart Water Reminders */}
      <Card>
        <Text variant="subheading">Smart Water Reminders</Text>
        <ToggleRow label="Enable reminders" value={reminderEnabled} onChange={setReminderEnabled} />
        {reminderEnabled ? (
          <>
            <View style={styles.rowBetween}>
              <Text variant="body">Interval</Text>
              <View style={styles.adjustControls}>
                {[30, 45, 60, 90, 120].map((mins) => (
                  <Pressable
                    key={mins}
                    style={[styles.chipSmall, reminderInterval === mins && styles.chipSmallActive]}
                    onPress={() => setReminderInterval(mins)}
                  >
                    <Text variant="caption" color={reminderInterval === mins ? colors.background : colors.text}>
                      {mins}m
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.formRow}>
              <View style={{ flex: 1 }}>
                <Text variant="caption" color={colors.textSecondary}>Wake start</Text>
                <TextInput style={styles.input} value={wakeStart} onChangeText={setWakeStart} placeholder="07:00" placeholderTextColor={colors.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="caption" color={colors.textSecondary}>Wake end</Text>
                <TextInput style={styles.input} value={wakeEnd} onChangeText={setWakeEnd} placeholder="22:00" placeholderTextColor={colors.textTertiary} />
              </View>
            </View>
            <ToggleRow label="Pause during dry fast" value={pauseDryFast} onChange={setPauseDryFast} />
            <ToggleRow label="Personalized target" value={personalizedGoal} onChange={setPersonalizedGoal} />
            {personalizedGoal ? (
              <View style={styles.formRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={weightForTarget}
                  onChangeText={setWeightForTarget}
                  placeholder="Your weight"
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.textTertiary}
                />
                <Pressable
                  style={[styles.chipSmall, weightUnit === 'lbs' && styles.chipSmallActive]}
                  onPress={() => setWeightUnit('lbs')}
                >
                  <Text variant="caption" color={weightUnit === 'lbs' ? colors.background : colors.text}>lbs</Text>
                </Pressable>
                <Pressable
                  style={[styles.chipSmall, weightUnit === 'kg' && styles.chipSmallActive]}
                  onPress={() => setWeightUnit('kg')}
                >
                  <Text variant="caption" color={weightUnit === 'kg' ? colors.background : colors.text}>kg</Text>
                </Pressable>
              </View>
            ) : null}
            {personalizedTarget != null ? (
              <Text variant="body" color={ACCENT} style={{ marginTop: spacing.xs }}>
                Recommended: {personalizedTarget.toFixed(0)} oz/day
              </Text>
            ) : null}
            {reminderSlots.length > 0 ? (
              <View style={{ marginTop: spacing.sm }}>
                <Text variant="caption" color={colors.textSecondary}>Reminder schedule</Text>
                <View style={styles.slotsRow}>
                  {reminderSlots.map((slot, i) => (
                    <View key={i} style={styles.slotChip}>
                      <Text variant="caption" color={colors.text}>
                        {String(slot.hour).padStart(2, '0')}:{String(slot.minute).padStart(2, '0')}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        ) : null}
      </Card>

      {/* Health Integration */}
      <Card>
        <Text variant="subheading">Health Integration</Text>
        <ToggleRow label="Enable health sync" value={healthSyncEnabled} onChange={setHealthSyncEnabled} />
        <ToggleRow label="Read weight entries" value={healthReadWeight} onChange={setHealthReadWeight} />
        <ToggleRow label="Write fasting windows" value={healthWriteFasts} onChange={setHealthWriteFasts} />
        <Text variant="caption" color={colors.textSecondary} style={{ marginTop: spacing.sm }}>
          {healthStatus.reason}
        </Text>
        <Pressable style={[styles.primaryButton, { marginTop: spacing.sm }]} onPress={() => void handleSyncHealth()}>
          <Text variant="label" color={colors.background}>Sync Health Now</Text>
        </Pressable>
      </Card>

      <Pressable style={styles.primaryButton} onPress={save}>
        <Text variant="label" color={colors.background}>Save Settings</Text>
      </Pressable>

      {/* Data */}
      <Card>
        <Text variant="subheading">Data</Text>
        <Pressable style={[styles.primaryButton, { marginTop: spacing.sm }]} onPress={handleExport}>
          <Text variant="label" color={colors.background}>Export as CSV</Text>
        </Pressable>
        <Pressable style={[styles.dangerButton, { marginTop: spacing.sm }]} onPress={handleEraseData}>
          <Text variant="label" color={colors.background}>Erase All Data</Text>
        </Pressable>
      </Card>

      <Card>
        <Text variant="subheading">About</Text>
        <Text variant="caption" color={colors.textSecondary} style={{ marginTop: spacing.xs }}>MyFast v0.1.0</Text>
        <Text variant="caption" color={colors.textTertiary} style={{ marginTop: spacing.xs }}>
          All data stored locally on your device. No accounts, no servers, no tracking.
        </Text>
      </Card>
    </ScrollView>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.switchRow}>
      <Text variant="body">{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: colors.surfaceElevated, true: ACCENT }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  formRow: { marginTop: spacing.sm, flexDirection: 'row', gap: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
  },
  switchRow: { marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowBetween: { marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowBetweenMini: { marginTop: spacing.xs, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  adjustControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  adjustButton: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  targetValue: { color: ACCENT, fontWeight: '700', minWidth: 30, textAlign: 'center' },
  primaryButton: { borderRadius: 8, backgroundColor: ACCENT, paddingVertical: spacing.sm, alignItems: 'center' },
  dangerButton: { borderRadius: 8, backgroundColor: colors.danger, paddingVertical: spacing.sm, alignItems: 'center' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  itemIcon: { fontSize: 24 },
  flex1: { flex: 1 },
  chipSmall: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 999,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
  },
  chipSmallActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  slotsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  slotChip: {
    backgroundColor: colors.surfaceElevated, borderRadius: 6,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
  },
});
