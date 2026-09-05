import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  HealthInputOptions,
  HealthKitPermissions,
  HealthPermission,
  HealthValue,
} from 'react-native-health';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  createHealthKitLink,
  deactivateHealthKitLink,
  deleteHealthKitLink,
  endSession,
  getAllActiveHealthKitLinks,
  getAutoTrackProgress,
  getCompletionsForDate,
  getHabitById,
  getHabits,
  getMeasurementsForDate,
  getSessionsForDate,
  getSetting,
  HEALTHKIT_DATA_SOURCES,
  recordCompletion,
  recordMeasurement,
  setSetting,
  startSession,
  updateHealthKitLinkSyncTime,
  type ComparisonOperator,
  type HealthKitDataSource,
  type HealthKitLink,
  GlassCard,
  HB_ACCENT,
  HB_ACCENT_LIGHT,
  HB_FONTS,
  HB_SURFACES,
  HB_TEXT,
  HB_TEXT_SECONDARY,
  HB_TEXT_TERTIARY,
  HB_TYPOGRAPHY,
  MaterialSymbol,
  SectionHeader,
  StatTile,
  withAlpha,
} from '@mylife/habits';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

type PermissionCategoryKey =
  | 'steps'
  | 'sleep'
  | 'workouts'
  | 'heartRate'
  | 'mindfulMinutes'
  | 'standHours';

type HealthKitPermissionState = Record<PermissionCategoryKey, boolean>;
type SyncFrequency = 'manual' | 'hourly' | 'daily';

type HealthKitSyncSettings = {
  frequency: SyncFrequency;
  autoComplete: boolean;
  twoWaySync: boolean;
};

type SyncHistoryEntry = {
  id: string;
  habitName: string;
  metricLabel: string;
  syncedAt: string;
  value: number | null;
  unit: string;
  status: 'completed' | 'updated' | 'skipped' | 'error';
  detail: string;
};

const CONNECTED_KEY = 'habits_healthkit_connected';
const PERMISSIONS_KEY = 'habits_healthkit_permissions';
const SETTINGS_KEY = 'habits_healthkit_sync_settings';
const HISTORY_KEY = 'habits_healthkit_sync_history';

const DEFAULT_PERMISSION_STATE: HealthKitPermissionState = {
  steps: true,
  sleep: true,
  workouts: true,
  heartRate: true,
  mindfulMinutes: false,
  standHours: false,
};

const DEFAULT_SYNC_SETTINGS: HealthKitSyncSettings = {
  frequency: 'manual',
  autoComplete: true,
  twoWaySync: false,
};

const PERMISSION_CATEGORIES: Array<{
  key: PermissionCategoryKey;
  label: string;
  detail: string;
  permissionNames: string[];
}> = [
  {
    key: 'steps',
    label: 'Steps',
    detail: 'Read daily step count and walking progress.',
    permissionNames: ['StepCount'],
  },
  {
    key: 'sleep',
    label: 'Sleep',
    detail: 'Import nightly sleep duration for recovery habits.',
    permissionNames: ['SleepAnalysis'],
  },
  {
    key: 'workouts',
    label: 'Workouts',
    detail: 'Read exercise minutes and active energy.',
    permissionNames: ['Workout', 'ActiveEnergyBurned'],
  },
  {
    key: 'heartRate',
    label: 'Heart Rate',
    detail: 'Read resting heart rate for recovery habits.',
    permissionNames: ['RestingHeartRate', 'HeartRate'],
  },
  {
    key: 'mindfulMinutes',
    label: 'Mindful Minutes',
    detail: 'Read mindfulness sessions for meditation habits.',
    permissionNames: ['MindfulSession'],
  },
  {
    key: 'standHours',
    label: 'Stand Hours',
    detail: 'Read Apple stand hour totals for movement habits.',
    permissionNames: ['AppleStandHour'],
  },
];

const SYNC_FREQUENCIES: SyncFrequency[] = ['manual', 'hourly', 'daily'];
const COMPARISON_OPTIONS: ComparisonOperator[] = ['gte', 'lte', 'eq'];

function readJsonSetting<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function callbackToPromise<T>(
  invoke: (callback: (error: unknown, result: T) => void) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    invoke((error, result) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(result);
    });
  });
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatComparison(comparison: ComparisonOperator) {
  switch (comparison) {
    case 'gte':
      return 'At least';
    case 'lte':
      return 'At most';
    case 'eq':
      return 'Exactly';
    case 'gt':
      return 'Greater than';
    case 'lt':
      return 'Less than';
  }
}

function formatValue(value: number | null, unit: string) {
  if (value == null) return 'Unavailable';
  return `${Math.round(value * 10) / 10} ${unit}`;
}

function getLastSyncTime(links: HealthKitLink[]) {
  return links.reduce<string | null>((latest, link) => {
    if (!link.lastSyncedAt) return latest;
    if (!latest) return link.lastSyncedAt;
    return link.lastSyncedAt > latest ? link.lastSyncedAt : latest;
  }, null);
}

function getStartOfDayIso() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

async function readMetricValue(
  dataSource: HealthKitDataSource,
  appleHealthKit: Record<string, CallableFunction>,
) {
  const options: HealthInputOptions = {
    startDate: getStartOfDayIso(),
    endDate: new Date().toISOString(),
    ascending: true,
    limit: 500,
  };

  const readValues = async (method: string) => {
    if (typeof appleHealthKit[method] !== 'function') {
      return null;
    }
    return callbackToPromise<HealthValue[]>((cb) => {
      appleHealthKit[method](options, cb);
    });
  };

  switch (dataSource.id) {
    case 'steps': {
      const samples = await readValues('getDailyStepCountSamples');
      if (!samples) return null;
      return samples.reduce((sum, sample) => sum + Number(sample.value ?? 0), 0);
    }
    case 'active_energy': {
      const samples = await readValues('getActiveEnergyBurned');
      if (!samples) return null;
      return samples.reduce((sum, sample) => sum + Number(sample.value ?? 0), 0);
    }
    case 'sleep': {
      const samples = await readValues('getSleepSamples');
      if (!samples) return null;
      const totalHours = samples.reduce((sum, sample) => {
        const start = sample.startDate ? new Date(sample.startDate).getTime() : 0;
        const end = sample.endDate ? new Date(sample.endDate).getTime() : 0;
        if (!start || !end) return sum;
        return sum + (end - start) / (1000 * 60 * 60);
      }, 0);
      return Math.round(totalHours * 10) / 10;
    }
    case 'resting_hr': {
      const samples = await readValues('getRestingHeartRate');
      if (!samples || samples.length === 0) return null;
      const latestValue = Number(samples[samples.length - 1]?.value ?? Number.NaN);
      return Number.isFinite(latestValue) ? latestValue : null;
    }
    case 'exercise_minutes': {
      if (typeof appleHealthKit.getWorkoutSamples === 'function') {
        const samples = await callbackToPromise<HealthValue[]>((cb) => {
          appleHealthKit.getWorkoutSamples(options, cb);
        });
        const totalMinutes = samples.reduce((sum, sample) => {
          const start = sample.startDate ? new Date(sample.startDate).getTime() : 0;
          const end = sample.endDate ? new Date(sample.endDate).getTime() : 0;
          if (!start || !end) return sum;
          return sum + (end - start) / (1000 * 60);
        }, 0);
        return Math.round(totalMinutes);
      }
      return null;
    }
    case 'mindful_minutes': {
      if (typeof appleHealthKit.getMindfulSessionSamples === 'function') {
        const samples = await callbackToPromise<HealthValue[]>((cb) => {
          appleHealthKit.getMindfulSessionSamples(options, cb);
        });
        const totalMinutes = samples.reduce((sum, sample) => {
          const start = sample.startDate ? new Date(sample.startDate).getTime() : 0;
          const end = sample.endDate ? new Date(sample.endDate).getTime() : 0;
          if (!start || !end) return sum;
          return sum + (end - start) / (1000 * 60);
        }, 0);
        return Math.round(totalMinutes);
      }
      return null;
    }
    case 'stand_hours': {
      if (typeof appleHealthKit.getAppleStandHourSamples === 'function') {
        const samples = await callbackToPromise<HealthValue[]>((cb) => {
          appleHealthKit.getAppleStandHourSamples(options, cb);
        });
        return samples.length;
      }
      if (typeof appleHealthKit.getAppleStandTime === 'function') {
        const samples = await callbackToPromise<HealthValue[]>((cb) => {
          appleHealthKit.getAppleStandTime(options, cb);
        });
        return samples.reduce((sum, sample) => sum + Number(sample.value ?? 0), 0);
      }
      return null;
    }
    case 'distance': {
      if (typeof appleHealthKit.getDistanceWalkingRunning === 'function') {
        const result = await callbackToPromise<HealthValue>((cb) => {
          appleHealthKit.getDistanceWalkingRunning(options, cb);
        });
        const value = Number(result.value ?? Number.NaN);
        return Number.isFinite(value) ? value : null;
      }
      return null;
    }
    case 'water': {
      if (typeof appleHealthKit.getWaterSamples === 'function') {
        const samples = await callbackToPromise<HealthValue[]>((cb) => {
          appleHealthKit.getWaterSamples(options, cb);
        });
        return samples.reduce((sum, sample) => sum + Number(sample.value ?? 0), 0);
      }
      return null;
    }
    default:
      return null;
  }
}

export default function HealthKitScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const [status, setStatus] = useState<{
    checking: boolean;
    available: boolean;
    reason: string;
  }>({
    checking: true,
    available: false,
    reason: 'Checking Apple Health availability...',
  });
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [thresholdText, setThresholdText] = useState('');
  const [comparison, setComparison] = useState<ComparisonOperator>('gte');

  const isIOS = Platform.OS === 'ios';

  const refresh = useCallback(() => {
    setTick((value) => value + 1);
  }, []);

  const habits = useMemo(
    () => getHabits(db, { isArchived: false }),
    [db, tick],
  );
  const activeLinks = useMemo(
    () => getAllActiveHealthKitLinks(db),
    [db, tick],
  );
  const permissionState = useMemo(
    () => readJsonSetting<HealthKitPermissionState>(
      getSetting(db, PERMISSIONS_KEY),
      DEFAULT_PERMISSION_STATE,
    ),
    [db, tick],
  );
  const syncSettings = useMemo(
    () => readJsonSetting<HealthKitSyncSettings>(
      getSetting(db, SETTINGS_KEY),
      DEFAULT_SYNC_SETTINGS,
    ),
    [db, tick],
  );
  const syncHistory = useMemo(
    () => readJsonSetting<SyncHistoryEntry[]>(
      getSetting(db, HISTORY_KEY),
      [],
    ),
    [db, tick],
  );
  const connected = useMemo(
    () => getSetting(db, CONNECTED_KEY) === 'true',
    [db, tick],
  );

  const habitsById = useMemo(
    () => new Map(habits.map((habit) => [habit.id, habit])),
    [habits],
  );

  useEffect(() => {
    let cancelled = false;

    async function checkAvailability() {
      if (!isIOS) {
        setStatus({
          checking: false,
          available: false,
          reason: 'HealthKit is only available on iPhone.',
        });
        return;
      }

      try {
        const appleHealthModule = await import('react-native-health');
        const appleHealthKit = appleHealthModule.default;
        const available = await callbackToPromise<boolean>((cb) =>
          appleHealthKit.isAvailable(cb),
        );

        if (!cancelled) {
          setStatus({
            checking: false,
            available,
            reason: available
              ? 'Apple Health is ready for habit mappings.'
              : 'Apple Health is unavailable on this device.',
          });
        }
      } catch (error) {
        if (!cancelled) {
          setStatus({
            checking: false,
            available: false,
            reason:
              `Apple Health native access is unavailable in this build. ${String(error)}`,
          });
        }
      }
    }

    void checkAvailability();

    return () => {
      cancelled = true;
    };
  }, [isIOS, tick]);

  const savePermissionState = useCallback(
    (nextState: HealthKitPermissionState) => {
      setSetting(db, PERMISSIONS_KEY, JSON.stringify(nextState));
      refresh();
    },
    [db, refresh],
  );

  const saveSyncSettings = useCallback(
    (nextSettings: HealthKitSyncSettings) => {
      setSetting(db, SETTINGS_KEY, JSON.stringify(nextSettings));
      refresh();
    },
    [db, refresh],
  );

  const connectHealthKit = useCallback(async () => {
    if (!isIOS) {
      Alert.alert('iPhone Only', 'HealthKit mappings only work on iPhone.');
      return;
    }

    setConnecting(true);

    try {
      const appleHealthModule = await import('react-native-health');
      const appleHealthKit = appleHealthModule.default;
      const available = await callbackToPromise<boolean>((cb) =>
        appleHealthKit.isAvailable(cb),
      );

      if (!available) {
        Alert.alert('Unavailable', 'Apple Health is not available on this device.');
        return;
      }

      const readPermissions: HealthPermission[] = [];

      for (const category of PERMISSION_CATEGORIES) {
        if (!permissionState[category.key]) continue;
        for (const permissionName of category.permissionNames) {
          const resolvedPermission = (
            appleHealthModule.HealthPermission as Record<string, HealthPermission | undefined>
          )[permissionName];
          if (resolvedPermission) {
            readPermissions.push(resolvedPermission);
          }
        }
      }

      const permissions: HealthKitPermissions = {
        permissions: {
          read: readPermissions,
          write: syncSettings.twoWaySync
            ? [appleHealthModule.HealthPermission.Workout]
            : [],
        },
      };

      await callbackToPromise<HealthValue>((cb) =>
        appleHealthKit.initHealthKit(permissions, cb),
      );

      setSetting(db, CONNECTED_KEY, 'true');
      Alert.alert(
        'Connected',
        'Apple Health permissions were granted for MyHabits.',
      );
      refresh();
    } catch (error) {
      Alert.alert(
        'Connection Failed',
        `MyHabits could not connect to Apple Health. ${String(error)}`,
      );
    } finally {
      setConnecting(false);
    }
  }, [db, isIOS, permissionState, refresh, syncSettings.twoWaySync]);

  const openNewMapping = useCallback(() => {
    setEditingLinkId(null);
    setSelectedHabitId(habits[0]?.id ?? null);
    setSelectedSourceId(HEALTHKIT_DATA_SOURCES[0]?.id ?? null);
    setThresholdText(String(HEALTHKIT_DATA_SOURCES[0]?.defaultThreshold ?? 1));
    setComparison(HEALTHKIT_DATA_SOURCES[0]?.defaultComparison ?? 'gte');
    setEditorVisible(true);
  }, [habits]);

  const openEditMapping = useCallback(
    (link: HealthKitLink) => {
      setEditingLinkId(link.id);
      setSelectedHabitId(link.habitId);
      setSelectedSourceId(link.metric);
      setThresholdText(String(link.threshold));
      setComparison(link.comparison);
      setEditorVisible(true);
    },
    [],
  );

  const closeEditor = useCallback(() => {
    setEditorVisible(false);
    setEditingLinkId(null);
  }, []);

  const handleSaveMapping = useCallback(() => {
    if (!selectedHabitId || !selectedSourceId) {
      Alert.alert('Missing Info', 'Choose a habit and a HealthKit metric first.');
      return;
    }

    const dataSource = HEALTHKIT_DATA_SOURCES.find((item) => item.id === selectedSourceId);
    const threshold = Number.parseFloat(thresholdText);

    if (!dataSource || !Number.isFinite(threshold) || threshold <= 0) {
      Alert.alert('Invalid Threshold', 'Enter a valid threshold for this metric.');
      return;
    }

    if (editingLinkId) {
      deleteHealthKitLink(db, editingLinkId);
    }

    createHealthKitLink(db, uuid(), {
      habitId: selectedHabitId,
      dataSource: dataSource.healthKitIdentifier,
      metric: dataSource.id,
      threshold,
      comparison,
    });

    closeEditor();
    refresh();
  }, [
    closeEditor,
    comparison,
    db,
    editingLinkId,
    refresh,
    selectedHabitId,
    selectedSourceId,
    thresholdText,
  ]);

  const handleDeleteMapping = useCallback(
    (link: HealthKitLink) => {
      Alert.alert('Remove Mapping', 'Delete this habit to HealthKit mapping?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteHealthKitLink(db, link.id);
            refresh();
          },
        },
      ]);
    },
    [db, refresh],
  );

  const handleDisableMapping = useCallback(
    (link: HealthKitLink) => {
      Alert.alert('Disable Mapping', 'Pause auto-completion for this mapping?', [
        { text: 'Keep Active', style: 'cancel' },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: () => {
            deactivateHealthKitLink(db, link.id);
            refresh();
          },
        },
      ]);
    },
    [db, refresh],
  );

  const handleSyncNow = useCallback(async () => {
    if (!isIOS) {
      Alert.alert('iPhone Only', 'HealthKit sync only works on iPhone.');
      return;
    }

    setSyncing(true);

    try {
      const appleHealthModule = await import('react-native-health');
      const appleHealthKit = appleHealthModule.default as unknown as Record<string, CallableFunction>;
      const permissions: HealthKitPermissions = {
        permissions: {
          read: [],
          write: [],
        },
      };

      await callbackToPromise<HealthValue>((cb) =>
        (appleHealthKit as unknown as {
          initHealthKit: (
            input: HealthKitPermissions,
            callback: (error: unknown, value: HealthValue) => void,
          ) => void;
        }).initHealthKit(permissions, cb),
      );

      const today = new Date().toISOString().slice(0, 10);
      const completions = getCompletionsForDate(db, today);
      const measurements = getMeasurementsForDate(db, today);
      const sessions = getSessionsForDate(db, today);
      const nextHistory: SyncHistoryEntry[] = [];
      let completedCount = 0;

      for (const link of activeLinks) {
        const habit = habitsById.get(link.habitId) ?? null;
        const dataSource = HEALTHKIT_DATA_SOURCES.find((item) => item.id === link.metric);

        if (!habit || !dataSource) {
          nextHistory.push({
            id: uuid(),
            habitName: habit?.name ?? 'Missing habit',
            metricLabel: dataSource?.label ?? link.metric,
            syncedAt: new Date().toISOString(),
            value: null,
            unit: dataSource?.unit ?? '',
            status: 'error',
            detail: 'Mapping is incomplete.',
          });
          continue;
        }

        const value = await readMetricValue(dataSource, appleHealthKit);
        updateHealthKitLinkSyncTime(db, link.id);

        if (value == null) {
          nextHistory.push({
            id: uuid(),
            habitName: habit.name,
            metricLabel: dataSource.label,
            syncedAt: new Date().toISOString(),
            value: null,
            unit: dataSource.unit,
            status: 'skipped',
            detail: 'This metric is not readable in the current build.',
          });
          continue;
        }

        const progress = getAutoTrackProgress(value, link.threshold, link.comparison);
        const alreadyCompleted = habit.habitType === 'measurable'
          ? measurements.some((measurement) => measurement.habitId === habit.id)
          : habit.habitType === 'timed'
            ? sessions.some((session) => session.habitId === habit.id && session.completed)
            : completions.some((completion) => completion.habitId === habit.id);

        let statusLabel: SyncHistoryEntry['status'] = 'updated';
        let detail = `${formatComparison(link.comparison)} ${link.threshold} ${dataSource.unit}`;

        if (syncSettings.autoComplete && progress.isComplete && !alreadyCompleted) {
          const now = new Date().toISOString();

          if (habit.habitType === 'measurable') {
            recordMeasurement(db, uuid(), habit.id, now, value, link.threshold);
          } else if (habit.habitType === 'timed') {
            const sessionId = uuid();
            startSession(db, sessionId, habit.id, habit.targetCount);
            endSession(db, sessionId, habit.targetCount);
            recordCompletion(db, uuid(), habit.id, now, habit.targetCount);
          } else {
            recordCompletion(db, uuid(), habit.id, now, value);
          }

          completedCount += 1;
          statusLabel = 'completed';
          detail = `Auto-completed after hitting ${value} ${dataSource.unit}.`;
        } else if (progress.isComplete) {
          detail = `Threshold met at ${value} ${dataSource.unit}.`;
        } else {
          detail = `Current progress ${progress.percentage}% (${value} ${dataSource.unit}).`;
        }

        nextHistory.push({
          id: uuid(),
          habitName: habit.name,
          metricLabel: dataSource.label,
          syncedAt: new Date().toISOString(),
          value,
          unit: dataSource.unit,
          status: statusLabel,
          detail,
        });
      }

      setSetting(
        db,
        HISTORY_KEY,
        JSON.stringify([...nextHistory, ...syncHistory].slice(0, 10)),
      );
      setSetting(db, CONNECTED_KEY, 'true');
      refresh();

      Alert.alert(
        'Sync Complete',
        completedCount > 0
          ? `${completedCount} habit${completedCount === 1 ? '' : 's'} auto-completed from Apple Health.`
          : 'HealthKit links refreshed. No new habits were auto-completed.',
      );
    } catch (error) {
      Alert.alert(
        'Sync Failed',
        `MyHabits could not finish the Apple Health sync. ${String(error)}`,
      );
    } finally {
      setSyncing(false);
    }
  }, [activeLinks, db, habitsById, isIOS, refresh, syncHistory, syncSettings.autoComplete]);

  const selectedSource = useMemo(
    () => HEALTHKIT_DATA_SOURCES.find((item) => item.id === selectedSourceId) ?? null,
    [selectedSourceId],
  );

  const lastSync = getLastSyncTime(activeLinks);

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.heroHeader}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>Apple Health</Text>
            <Text style={styles.title}>HealthKit</Text>
            <Text style={styles.subtitle}>
              Link real-world health signals to habits so MyHabits can keep streaks moving for you.
            </Text>
          </View>
          <View style={styles.heroGlyph}>
            <MaterialSymbol
              name="health_and_safety"
              size={34}
              color={HB_ACCENT_LIGHT}
              filled
            />
          </View>
        </View>

        <GlassCard level={4} style={styles.heroCard} contentStyle={styles.heroCardContent}>
          <View style={styles.connectionTopRow}>
            <View>
              <Text style={styles.connectionLabel}>Connection Status</Text>
              <Text style={styles.connectionValue}>
                {status.checking
                  ? 'Checking...'
                  : !isIOS
                    ? 'iPhone Only'
                    : status.available && connected
                      ? 'Connected'
                      : status.available
                        ? 'Ready to Connect'
                        : 'Unavailable'}
              </Text>
              <Text style={styles.connectionCaption}>
                {status.reason}
              </Text>
            </View>
            {(connecting || status.checking) ? (
              <ActivityIndicator color={HB_ACCENT_LIGHT} />
            ) : (
              <Pressable
                style={styles.primaryButton}
                onPress={connected ? handleSyncNow : connectHealthKit}
              >
                <Text style={styles.primaryButtonText}>
                  {connected ? 'Sync Now' : 'Connect'}
                </Text>
              </Pressable>
            )}
          </View>

          <View style={styles.statGrid}>
            <StatTile
              label="Mapped"
              value={activeLinks.length}
              delta="Active habit automations"
              icon="link"
              color={HB_ACCENT_LIGHT}
            />
            <StatTile
              label="Last Sync"
              value={lastSync ? formatTimestamp(lastSync).split(',')[0] : 'Never'}
              delta={lastSync ? formatTimestamp(lastSync) : 'No completed sync yet'}
              icon="schedule"
              color="#8BCFF0"
            />
            <StatTile
              label="Permissions"
              value={Object.values(permissionState).filter(Boolean).length}
              delta="Metric groups enabled"
              icon="favorite"
              color="#30D158"
            />
          </View>
        </GlassCard>

        <GlassCard level={2} contentStyle={styles.sectionCard}>
          <SectionHeader title="Permissions" />
          <View style={styles.permissionList}>
            {PERMISSION_CATEGORIES.map((category) => (
              <View key={category.key} style={styles.toggleRow}>
                <View style={styles.toggleCopy}>
                  <Text style={styles.toggleTitle}>{category.label}</Text>
                  <Text style={styles.toggleDetail}>{category.detail}</Text>
                </View>
                <Switch
                  trackColor={{
                    false: withAlpha(HB_TEXT_TERTIARY, 0.28),
                    true: withAlpha(HB_ACCENT, 0.6),
                  }}
                  thumbColor={permissionState[category.key] ? HB_ACCENT_LIGHT : HB_TEXT}
                  value={permissionState[category.key]}
                  onValueChange={(enabled) => {
                    savePermissionState({
                      ...permissionState,
                      [category.key]: enabled,
                    });
                  }}
                />
              </View>
            ))}
          </View>
        </GlassCard>

        <GlassCard level={2} contentStyle={styles.sectionCard}>
          <SectionHeader
            title="Habit Mapping"
            action={{ label: 'Add Mapping', onPress: openNewMapping }}
          />
          {activeLinks.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialSymbol
                name="link"
                size={22}
                color={HB_ACCENT_LIGHT}
                filled
              />
              <Text style={styles.emptyTitle}>No health automations yet</Text>
              <Text style={styles.emptyBody}>
                Create a mapping like Walk 10k Steps to let MyHabits auto-complete it when Apple Health says you got there.
              </Text>
            </View>
          ) : (
            <View style={styles.mappingList}>
              {activeLinks.map((link) => {
                const habit = habitsById.get(link.habitId) ?? getHabitById(db, link.habitId);
                const source = HEALTHKIT_DATA_SOURCES.find((item) => item.id === link.metric);
                if (!habit || !source) return null;

                return (
                  <GlassCard
                    key={link.id}
                    level={1}
                    style={styles.mappingCard}
                    contentStyle={styles.mappingCardContent}
                  >
                    <View style={styles.mappingHeader}>
                      <View style={styles.mappingMeta}>
                        <Text style={styles.mappingHabit}>
                          {habit.icon ? `${habit.icon} ` : ''}
                          {habit.name}
                        </Text>
                        <Text style={styles.mappingRule}>
                          {source.label} • {formatComparison(link.comparison)} {link.threshold} {source.unit}
                        </Text>
                      </View>
                      <View style={styles.mappingStatusPill}>
                        <Text style={styles.mappingStatusText}>Live</Text>
                      </View>
                    </View>

                    <Text style={styles.mappingDetail}>
                      When MyHabits sees this metric hit the threshold, it can mark the habit complete automatically.
                    </Text>

                    <View style={styles.mappingActions}>
                      <Pressable
                        style={styles.ghostButton}
                        onPress={() => openEditMapping(link)}
                      >
                        <Text style={styles.ghostButtonText}>Edit</Text>
                      </Pressable>
                      <Pressable
                        style={styles.ghostButton}
                        onPress={() => handleDisableMapping(link)}
                      >
                        <Text style={styles.ghostButtonText}>Disable</Text>
                      </Pressable>
                      <Pressable
                        style={styles.dangerButton}
                        onPress={() => handleDeleteMapping(link)}
                      >
                        <Text style={styles.dangerButtonText}>Delete</Text>
                      </Pressable>
                    </View>
                  </GlassCard>
                );
              })}
            </View>
          )}
        </GlassCard>

        <GlassCard level={2} contentStyle={styles.sectionCard}>
          <SectionHeader title="Sync History" />
          {syncHistory.length === 0 ? (
            <Text style={styles.helperText}>
              Sync once to see recent auto-completions and unavailable metrics here.
            </Text>
          ) : (
            <View style={styles.historyList}>
              {syncHistory.map((entry) => (
                <View key={entry.id} style={styles.historyRow}>
                  <View
                    style={[
                      styles.historyDot,
                      entry.status === 'completed'
                        ? styles.historyDotComplete
                        : entry.status === 'error'
                          ? styles.historyDotError
                          : styles.historyDotIdle,
                    ]}
                  />
                  <View style={styles.historyCopy}>
                    <Text style={styles.historyTitle}>
                      {entry.habitName} • {entry.metricLabel}
                    </Text>
                    <Text style={styles.historyDetail}>
                      {entry.detail}
                    </Text>
                  </View>
                  <Text style={styles.historyValue}>
                    {formatValue(entry.value, entry.unit)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </GlassCard>

        <GlassCard level={2} contentStyle={styles.sectionCard}>
          <SectionHeader title="Sync Settings" />
          <View style={styles.frequencyRow}>
            {SYNC_FREQUENCIES.map((frequency) => {
              const selected = syncSettings.frequency === frequency;
              return (
                <Pressable
                  key={frequency}
                  style={[
                    styles.frequencyChip,
                    selected ? styles.frequencyChipSelected : null,
                  ]}
                  onPress={() => {
                    saveSyncSettings({
                      ...syncSettings,
                      frequency,
                    });
                  }}
                >
                  <Text
                    style={[
                      styles.frequencyChipText,
                      selected ? styles.frequencyChipTextSelected : null,
                    ]}
                  >
                    {frequency}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleTitle}>Auto-complete habits</Text>
              <Text style={styles.toggleDetail}>
                Mark mapped habits complete as soon as the HealthKit threshold is met.
              </Text>
            </View>
            <Switch
              trackColor={{
                false: withAlpha(HB_TEXT_TERTIARY, 0.28),
                true: withAlpha(HB_ACCENT, 0.6),
              }}
              thumbColor={syncSettings.autoComplete ? HB_ACCENT_LIGHT : HB_TEXT}
              value={syncSettings.autoComplete}
              onValueChange={(autoComplete) => {
                saveSyncSettings({
                  ...syncSettings,
                  autoComplete,
                });
              }}
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleTitle}>Two-way sync</Text>
              <Text style={styles.toggleDetail}>
                Keep this off unless you are testing a custom dev client with write access.
              </Text>
            </View>
            <Switch
              trackColor={{
                false: withAlpha(HB_TEXT_TERTIARY, 0.28),
                true: withAlpha(HB_ACCENT, 0.6),
              }}
              thumbColor={syncSettings.twoWaySync ? HB_ACCENT_LIGHT : HB_TEXT}
              value={syncSettings.twoWaySync}
              onValueChange={(twoWaySync) => {
                saveSyncSettings({
                  ...syncSettings,
                  twoWaySync,
                });
              }}
            />
          </View>
        </GlassCard>
      </ScrollView>

      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        visible={editorVisible}
        onRequestClose={closeEditor}
      >
        <View style={styles.editorScreen}>
          <View style={styles.editorHeader}>
            <Pressable onPress={closeEditor}>
              <Text style={styles.editorDismiss}>Cancel</Text>
            </Pressable>
            <Text style={styles.editorTitle}>
              {editingLinkId ? 'Edit Mapping' : 'New Mapping'}
            </Text>
            <Pressable onPress={handleSaveMapping}>
              <Text style={styles.editorSave}>Save</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.editorContent}>
            <GlassCard level={2} contentStyle={styles.sectionCard}>
              <SectionHeader title="Choose a Habit" />
              <View style={styles.editorOptionList}>
                {habits.map((habit) => {
                  const selected = selectedHabitId === habit.id;
                  return (
                    <Pressable
                      key={habit.id}
                      style={[
                        styles.editorOption,
                        selected ? styles.editorOptionSelected : null,
                      ]}
                      onPress={() => setSelectedHabitId(habit.id)}
                    >
                      <Text style={styles.editorOptionLabel}>
                        {habit.icon ? `${habit.icon} ` : ''}
                        {habit.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </GlassCard>

            <GlassCard level={2} contentStyle={styles.sectionCard}>
              <SectionHeader title="Choose a Metric" />
              <View style={styles.editorOptionList}>
                {HEALTHKIT_DATA_SOURCES.map((source) => {
                  const selected = selectedSourceId === source.id;
                  return (
                    <Pressable
                      key={source.id}
                      style={[
                        styles.editorMetricOption,
                        selected ? styles.editorOptionSelected : null,
                      ]}
                      onPress={() => {
                        setSelectedSourceId(source.id);
                        setThresholdText(String(source.defaultThreshold));
                        setComparison(source.defaultComparison);
                      }}
                    >
                      <Text style={styles.editorOptionLabel}>{source.label}</Text>
                      <Text style={styles.editorOptionHint}>
                        Default {source.defaultThreshold} {source.unit}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </GlassCard>

            <GlassCard level={2} contentStyle={styles.sectionCard}>
              <SectionHeader title="Threshold + Rule" />
              <Text style={styles.fieldLabel}>Threshold</Text>
              <TextInput
                keyboardType="decimal-pad"
                placeholder={selectedSource ? String(selectedSource.defaultThreshold) : '10'}
                placeholderTextColor={HB_TEXT_TERTIARY}
                style={styles.input}
                value={thresholdText}
                onChangeText={setThresholdText}
              />
              <Text style={styles.fieldHint}>
                {selectedSource ? `Unit: ${selectedSource.unit}` : 'Pick a metric first.'}
              </Text>

              <View style={styles.frequencyRow}>
                {COMPARISON_OPTIONS.map((option) => {
                  const selected = option === comparison;
                  return (
                    <Pressable
                      key={option}
                      style={[
                        styles.frequencyChip,
                        selected ? styles.frequencyChipSelected : null,
                      ]}
                      onPress={() => setComparison(option)}
                    >
                      <Text
                        style={[
                          styles.frequencyChipText,
                          selected ? styles.frequencyChipTextSelected : null,
                        ]}
                      >
                        {formatComparison(option)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </GlassCard>
          </ScrollView>
        </View>
      </Modal>

      {(syncing || connecting) ? (
        <View style={styles.overlayLoader}>
          <GlassCard level={4} contentStyle={styles.overlayCard}>
            <ActivityIndicator color={HB_ACCENT_LIGHT} />
            <Text style={styles.overlayText}>
              {syncing ? 'Syncing Apple Health...' : 'Connecting Apple Health...'}
            </Text>
          </GlassCard>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HB_SURFACES.lowest,
  },
  content: {
    padding: 20,
    paddingBottom: 48,
    gap: 18,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  eyebrow: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_ACCENT_LIGHT,
  },
  title: {
    ...HB_TYPOGRAPHY.displayLg,
    color: HB_TEXT,
  },
  subtitle: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  heroGlyph: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(HB_ACCENT, 0.18),
  },
  heroCard: {
    backgroundColor: withAlpha(HB_ACCENT, 0.08),
  },
  heroCardContent: {
    gap: 18,
  },
  connectionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  connectionLabel: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_ACCENT_LIGHT,
  },
  connectionValue: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 28,
    lineHeight: 32,
    color: HB_TEXT,
    marginTop: 6,
  },
  connectionCaption: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    marginTop: 6,
    maxWidth: 260,
  },
  primaryButton: {
    borderRadius: 999,
    backgroundColor: HB_ACCENT,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primaryButtonText: {
    fontFamily: HB_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
    color: HB_TEXT,
  },
  statGrid: {
    gap: 12,
  },
  sectionCard: {
    gap: 16,
  },
  permissionList: {
    gap: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  toggleCopy: {
    flex: 1,
    gap: 4,
  },
  toggleTitle: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 15,
    lineHeight: 20,
    color: HB_TEXT,
  },
  toggleDetail: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  emptyState: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 20,
  },
  emptyTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: HB_TEXT,
  },
  emptyBody: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    textAlign: 'center',
  },
  mappingList: {
    gap: 12,
  },
  mappingCard: {
    backgroundColor: withAlpha(HB_ACCENT, 0.05),
  },
  mappingCardContent: {
    gap: 12,
  },
  mappingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mappingMeta: {
    flex: 1,
    gap: 4,
  },
  mappingHabit: {
    fontFamily: HB_FONTS.bold,
    fontSize: 17,
    lineHeight: 22,
    color: HB_TEXT,
  },
  mappingRule: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_ACCENT_LIGHT,
  },
  mappingStatusPill: {
    borderRadius: 999,
    backgroundColor: withAlpha('#30D158', 0.18),
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mappingStatusText: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: '#30D158',
  },
  mappingDetail: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  mappingActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  ghostButton: {
    borderRadius: 999,
    backgroundColor: HB_SURFACES.high,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ghostButtonText: {
    fontFamily: HB_FONTS.medium,
    fontSize: 13,
    lineHeight: 16,
    color: HB_TEXT,
  },
  dangerButton: {
    borderRadius: 999,
    backgroundColor: withAlpha('#FF453A', 0.18),
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dangerButtonText: {
    fontFamily: HB_FONTS.medium,
    fontSize: 13,
    lineHeight: 16,
    color: '#FFB4AB',
  },
  helperText: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  historyList: {
    gap: 14,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  historyDotComplete: {
    backgroundColor: '#30D158',
  },
  historyDotError: {
    backgroundColor: '#FF453A',
  },
  historyDotIdle: {
    backgroundColor: HB_ACCENT_LIGHT,
  },
  historyCopy: {
    flex: 1,
    gap: 2,
  },
  historyTitle: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: HB_TEXT,
  },
  historyDetail: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    fontSize: 13,
    lineHeight: 18,
  },
  historyValue: {
    fontFamily: HB_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: HB_TEXT_TERTIARY,
    textAlign: 'right',
    maxWidth: 88,
  },
  frequencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  frequencyChip: {
    borderRadius: 999,
    backgroundColor: HB_SURFACES.high,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  frequencyChipSelected: {
    backgroundColor: withAlpha(HB_ACCENT, 0.26),
  },
  frequencyChipText: {
    fontFamily: HB_FONTS.medium,
    fontSize: 13,
    lineHeight: 16,
    color: HB_TEXT_SECONDARY,
    textTransform: 'capitalize',
  },
  frequencyChipTextSelected: {
    color: HB_TEXT,
  },
  editorScreen: {
    flex: 1,
    backgroundColor: HB_SURFACES.lowest,
  },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
  },
  editorDismiss: {
    fontFamily: HB_FONTS.medium,
    fontSize: 15,
    lineHeight: 20,
    color: HB_TEXT_SECONDARY,
  },
  editorTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: HB_TEXT,
  },
  editorSave: {
    fontFamily: HB_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
    color: HB_ACCENT_LIGHT,
  },
  editorContent: {
    paddingHorizontal: 20,
    paddingBottom: 36,
    gap: 16,
  },
  editorOptionList: {
    gap: 10,
  },
  editorOption: {
    borderRadius: 16,
    backgroundColor: HB_SURFACES.high,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  editorMetricOption: {
    borderRadius: 16,
    backgroundColor: HB_SURFACES.high,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
  },
  editorOptionSelected: {
    backgroundColor: withAlpha(HB_ACCENT, 0.24),
  },
  editorOptionLabel: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 15,
    lineHeight: 20,
    color: HB_TEXT,
  },
  editorOptionHint: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  fieldLabel: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_TEXT_TERTIARY,
  },
  fieldHint: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    marginTop: -4,
  },
  input: {
    borderRadius: 16,
    backgroundColor: HB_SURFACES.high,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: HB_FONTS.medium,
    fontSize: 15,
    lineHeight: 20,
    color: HB_TEXT,
  },
  overlayLoader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha('#050507', 0.56),
  },
  overlayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  overlayText: {
    fontFamily: HB_FONTS.medium,
    fontSize: 14,
    lineHeight: 18,
    color: HB_TEXT,
  },
});
