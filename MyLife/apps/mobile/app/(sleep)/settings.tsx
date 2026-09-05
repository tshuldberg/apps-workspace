import { useCallback, useMemo, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import * as Notifications from 'expo-notifications';
import * as Sharing from 'expo-sharing';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  SleepEntryRecord,
  SleepRestrictionWindow,
} from '@mylife/sleep';
import {
  calculateReminderFireDate,
  exportToCBTIFormat,
  formatDurationLabel,
  formatReminderSummary,
  getActiveGoals,
  getEfficiencyTrend,
  getSleepRestrictionWindow,
  listEntries,
  listFactors,
} from '@mylife/sleep';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { SLEEP_ACCENT, readSleepTargetHours } from './_ui';

const REMINDER_OPTIONS = [15, 30, 45, 60];
const REMINDER_ENABLED_KEY = 'sleep.reminder.enabled';
const REMINDER_MINUTES_KEY = 'sleep.reminder.minutesBefore';
const REMINDER_TARGET_KEY = 'sleep.reminder.targetBedtime';
const REMINDER_NOTIFICATION_ID_KEY = 'sleep.reminder.notificationId';
const RESTRICTION_ENABLED_KEY = 'sleep.restriction.enabled';
const SLEEP_CHANNEL_ID = 'mysleep-bedtime-reminders';
const CLOCK_TIME_RE = /T(\d{2}:\d{2})/;
const CURRENT_YEAR = new Date().getFullYear();

let notificationHandlerConfigured = false;

function configureSleepNotificationHandler() {
  if (notificationHandlerConfigured) {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  notificationHandlerConfigured = true;
}

async function ensureSleepNotificationChannelAsync() {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(SLEEP_CHANNEL_ID, {
    name: 'MySleep bedtime reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 120, 200],
    lightColor: '#A78BFA',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: 'default',
  });
}

function readSetting(
  db: ReturnType<typeof useDatabase>,
  key: string,
  fallback: string,
): string {
  return db.query<{ value: string }>(
    `SELECT value FROM sl_settings WHERE key = ? LIMIT 1`,
    [key],
  )[0]?.value ?? fallback;
}

function writeSetting(
  db: ReturnType<typeof useDatabase>,
  key: string,
  value: string,
): void {
  db.execute(
    `INSERT INTO sl_settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

function resolveReminderTargetBedtime(db: ReturnType<typeof useDatabase>) {
  const saved = readSetting(db, REMINDER_TARGET_KEY, '');
  if (saved) {
    return saved;
  }

  return (
    getActiveGoals(db).find((goal) => goal.type === 'bedtime')?.target_value ??
    '22:30'
  );
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clockTimeFromDateTime(value: string): string | undefined {
  return CLOCK_TIME_RE.exec(value)?.[1];
}

function getRestrictionPreview(
  entries: readonly SleepEntryRecord[],
): SleepRestrictionWindow | null {
  const trend = getEfficiencyTrend(entries);
  const efficiencyValues = trend
    .map((point) => point.sleepEfficiency)
    .filter((value): value is number => typeof value === 'number');
  const timeInBedValues = trend
    .map((point) => point.timeInBedMinutes)
    .filter((value): value is number => typeof value === 'number');
  const totalSleepValues = trend
    .map((point) => point.totalSleepTimeMinutes)
    .filter((value): value is number => typeof value === 'number');
  const currentEfficiency = average(efficiencyValues);

  if (currentEfficiency === null) {
    return null;
  }

  return getSleepRestrictionWindow(currentEfficiency, 85, {
    averageSleepMinutes: average(totalSleepValues) ?? undefined,
    currentTimeInBedMinutes: average(timeInBedValues) ?? undefined,
    preferredWakeTime: clockTimeFromDateTime(entries[0]?.wake_time ?? '') ?? '07:00',
  });
}

async function cancelExistingReminder(db: ReturnType<typeof useDatabase>) {
  const existingId = readSetting(db, REMINDER_NOTIFICATION_ID_KEY, '');
  if (!existingId) {
    return;
  }

  await Notifications.cancelScheduledNotificationAsync(existingId);
  writeSetting(db, REMINDER_NOTIFICATION_ID_KEY, '');
}

async function scheduleReminder(
  db: ReturnType<typeof useDatabase>,
  targetBedtime: string,
  minutesBefore: number,
) {
  configureSleepNotificationHandler();
  await ensureSleepNotificationChannelAsync();
  await cancelExistingReminder(db);

  const permission = await Notifications.getPermissionsAsync();
  const finalPermission =
    permission.granted || permission.status === 'granted'
      ? permission
      : await Notifications.requestPermissionsAsync();

  if (!finalPermission.granted && finalPermission.status !== 'granted') {
    throw new Error('Notifications are not enabled for MySleep.');
  }

  const fireDate = calculateReminderFireDate(
    targetBedtime,
    minutesBefore,
    new Date(),
  );
  const seconds = Math.max(
    1,
    Math.ceil((fireDate.getTime() - Date.now()) / 1000),
  );
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time to wind down',
      body: `Target bedtime in ${minutesBefore} minutes.`,
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      repeats: false,
    },
  });
  writeSetting(db, REMINDER_NOTIFICATION_ID_KEY, id);
}

export default function SleepSettingsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [targetHours, setTargetHours] = useState('8');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [restrictionEnabled, setRestrictionEnabled] = useState(false);
  const [minutesBefore, setMinutesBefore] = useState(30);
  const [targetBedtime, setTargetBedtime] = useState('22:30');
  const [restrictionPreview, setRestrictionPreview] =
    useState<SleepRestrictionWindow | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);

  const loadSettings = useCallback(() => {
    const recentEntries = listEntries(db, { limit: 30 });

    setTargetHours(String(readSleepTargetHours(db)));
    setReminderEnabled(readSetting(db, REMINDER_ENABLED_KEY, 'false') === 'true');
    setRestrictionEnabled(
      readSetting(db, RESTRICTION_ENABLED_KEY, 'false') === 'true',
    );
    setMinutesBefore(Number(readSetting(db, REMINDER_MINUTES_KEY, '30')) || 30);
    setTargetBedtime(resolveReminderTargetBedtime(db));
    setRestrictionPreview(getRestrictionPreview(recentEntries));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings]),
  );

  const summary = useMemo(
    () =>
      formatReminderSummary(reminderEnabled, targetBedtime, minutesBefore),
    [minutesBefore, reminderEnabled, targetBedtime],
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    try {
      loadSettings();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadSettings]);

  const handleSave = useCallback(async () => {
    const parsedTargetHours = Number(targetHours);
    if (!Number.isFinite(parsedTargetHours) || parsedTargetHours <= 0) {
      Alert.alert('Check target hours', 'Use a positive number such as 8.');
      return;
    }

    try {
      writeSetting(db, 'sleep.targetHours', String(parsedTargetHours));
      writeSetting(db, REMINDER_ENABLED_KEY, reminderEnabled ? 'true' : 'false');
      writeSetting(db, REMINDER_MINUTES_KEY, String(minutesBefore));
      writeSetting(db, REMINDER_TARGET_KEY, targetBedtime);
      writeSetting(
        db,
        RESTRICTION_ENABLED_KEY,
        restrictionEnabled ? 'true' : 'false',
      );

      if (reminderEnabled) {
        await scheduleReminder(db, targetBedtime, minutesBefore);
      } else {
        await cancelExistingReminder(db);
      }

      setStatusText(reminderEnabled ? 'Reminder scheduled.' : 'Reminder off.');
    } catch (err) {
      setStatusText(null);
      Alert.alert(
        'Reminder not scheduled',
        err instanceof Error ? err.message : 'Check notification permissions.',
      );
    }
  }, [
    db,
    minutesBefore,
    reminderEnabled,
    restrictionEnabled,
    targetBedtime,
    targetHours,
  ]);

  const handleExportCBTI = useCallback(async () => {
    try {
      const entries = listEntries(db, { limit: 500 });
      if (entries.length === 0) {
        Alert.alert(
          'Nothing to export',
          'Log at least one night before exporting a CBT-I diary.',
        );
        return;
      }

      const exportFile = exportToCBTIFormat(entries, listFactors(db, { limit: 500 }));
      const available = await Sharing.isAvailableAsync();
      const cacheDirectory = FileSystem.cacheDirectory;
      if (!available || !cacheDirectory) {
        throw new Error('Sharing is not available on this device.');
      }

      const fileUri = `${cacheDirectory}${exportFile.filename}`;
      await FileSystem.writeAsStringAsync(fileUri, exportFile.content);
      await Sharing.shareAsync(fileUri, {
        dialogTitle: 'Export CBT-I diary',
        mimeType: exportFile.mimeType,
        UTI: 'public.comma-separated-values-text',
      });
      setStatusText(`Exported ${exportFile.rowCount} CBT-I diary rows.`);
    } catch (err) {
      setStatusText(null);
      Alert.alert(
        'Export unavailable',
        err instanceof Error ? err.message : 'Could not export CBT-I diary.',
      );
    }
  }, [db]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={(
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={SLEEP_ACCENT}
        />
      )}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Settings</Text>
        <Text style={styles.heroTitle}>Tune MySleep targets and wind-down reminders.</Text>
        <Text style={styles.heroCopy}>
          Reminder settings stay inside MySleep and use the platform notification permission directly.
        </Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.cardEyebrow}>Sleep target</Text>
        <Text style={styles.panelTitle}>Target hours</Text>
        <TextInput
          value={targetHours}
          onChangeText={setTargetHours}
          keyboardType="numeric"
          placeholder="8"
          placeholderTextColor="rgba(240,240,245,0.35)"
          style={styles.input}
        />
      </View>

      <View style={styles.panel}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={styles.cardEyebrow}>Bedtime reminder</Text>
            <Text style={styles.panelTitle}>Wind-down nudge</Text>
            <Text style={styles.bodyText}>{summary}</Text>
          </View>
          <Switch
            value={reminderEnabled}
            onValueChange={setReminderEnabled}
            thumbColor={reminderEnabled ? '#F5F3FF' : '#8A8A98'}
            trackColor={{ false: 'rgba(255,255,255,0.14)', true: SLEEP_ACCENT }}
          />
        </View>

        <Text style={styles.inputLabel}>Target bedtime</Text>
        <TextInput
          value={targetBedtime}
          onChangeText={setTargetBedtime}
          autoCapitalize="none"
          placeholder="22:30"
          placeholderTextColor="rgba(240,240,245,0.35)"
          style={styles.input}
        />

        <Text style={styles.inputLabel}>Remind before bedtime</Text>
        <View style={styles.optionRow}>
          {REMINDER_OPTIONS.map((option) => {
            const selected = option === minutesBefore;
            return (
              <Pressable
                key={option}
                onPress={() => setMinutesBefore(option)}
                style={[
                  styles.optionButton,
                  selected && styles.optionButtonSelected,
                ]}
              >
                <Text
                  style={[
                    styles.optionButtonText,
                    selected && styles.optionButtonTextSelected,
                  ]}
                >
                  {option} min
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.cardEyebrow}>Bridge boundary</Text>
        <Text style={styles.panelTitle}>Local by default</Text>
        <Text style={styles.bodyText}>
          Mood, Habits, and Health bridges remain explicit opt-ins. Bedtime reminders do not share sleep data outside MySleep.
        </Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.cardEyebrow}>CBT-I diary</Text>
        <Text style={styles.panelTitle}>Therapist export</Text>
        <Text style={styles.bodyText}>
          Export date, time in bed, total sleep time, efficiency, awakenings, quality, supplements, and notes as a CBT-I CSV.
        </Text>
        <Pressable
          onPress={() => void handleExportCBTI()}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>Export for Therapist</Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        <Text style={styles.cardEyebrow}>Sleep science</Text>
        <Text style={styles.panelTitle}>Rhythm tools</Text>
        <Text style={styles.bodyText}>
          Review chronotype, jet lag adjustment, and shift-work sleep windows from the local MySleep dataset.
        </Text>
        <View style={styles.scienceButtonRow}>
          <Pressable
            onPress={() => router.push('/(sleep)/science/chronotype' as never)}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Chronotype</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(sleep)/science/jet-lag' as never)}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Jet Lag</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(sleep)/science/shift-work' as never)}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Shift Work</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              router.push(`/(sleep)/review/${CURRENT_YEAR}` as never)
            }
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Year Review</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.panel}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={styles.cardEyebrow}>Advanced CBT-I</Text>
            <Text style={styles.panelTitle}>Sleep restriction tracking</Text>
          </View>
          <Switch
            value={restrictionEnabled}
            onValueChange={setRestrictionEnabled}
            thumbColor={restrictionEnabled ? '#F5F3FF' : '#8A8A98'}
            trackColor={{ false: 'rgba(255,255,255,0.14)', true: SLEEP_ACCENT }}
          />
        </View>
        <Text style={styles.bodyText}>
          Use restriction tracking only with therapist guidance. MySleep never recommends less than 5.5 hours in bed.
        </Text>
        {restrictionPreview ? (
          <View style={styles.restrictionPreview}>
            <Text style={styles.restrictionValue}>
              {restrictionPreview.recommendedBedtime} - {restrictionPreview.recommendedWakeTime}
            </Text>
            <Text style={styles.restrictionMeta}>
              {formatDurationLabel(restrictionPreview.recommendedTimeInBedMinutes)} in bed, {restrictionPreview.currentEfficiency.toFixed(1)}% efficiency
            </Text>
            <Text style={styles.bodyText}>{restrictionPreview.rationale}</Text>
          </View>
        ) : (
          <Text style={styles.bodyText}>
            Log bedtime and wake time to preview a restriction window.
          </Text>
        )}
      </View>

      <Pressable onPress={() => void handleSave()} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>Save Settings</Text>
      </Pressable>

      {statusText && <Text style={styles.statusText}>{statusText}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: surfaceTiers.lowest,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
    gap: 16,
  },
  hero: {
    gap: 12,
    padding: 20,
    borderRadius: 24,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    color: SLEEP_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  heroCopy: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  panel: {
    gap: 12,
    padding: 18,
    borderRadius: 22,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardEyebrow: {
    color: SLEEP_ACCENT,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  panelTitle: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
  },
  bodyText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleCopy: {
    flex: 1,
    gap: 6,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scienceButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionButtonSelected: {
    backgroundColor: 'rgba(167,139,250,0.18)',
    borderColor: 'rgba(167,139,250,0.46)',
  },
  optionButtonText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  optionButtonTextSelected: {
    color: '#F5F3FF',
  },
  secondaryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(167,139,250,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.46)',
  },
  secondaryButtonText: {
    color: '#F5F3FF',
    fontSize: 14,
    fontWeight: '900',
  },
  restrictionPreview: {
    gap: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  restrictionValue: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '800',
  },
  restrictionMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  primaryButton: {
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: SLEEP_ACCENT,
  },
  primaryButtonText: {
    color: '#101018',
    fontSize: 15,
    fontWeight: '900',
  },
  statusText: {
    color: '#BBF7D0',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
  },
});
