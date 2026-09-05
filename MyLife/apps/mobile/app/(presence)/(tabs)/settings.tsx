import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  MaterialSymbol,
  PR_ACCENT,
  PR_ACCENT_LIGHT,
  PR_SURFACES,
  PR_TEXT,
  PR_TEXT_SECONDARY,
  PR_TEXT_TERTIARY,
  PR_TYPOGRAPHY,
  PRESENCE_MODULE,
  calculateImprovement,
  createGoal,
  exportAppUsageCSV,
  exportDailyUsageCSV,
  exportSessionsCSV,
  formatScreenTime,
  getAllActiveIntentions,
  getAppUsageRange,
  getDailyUsageRange,
  getFocusSessions,
  getSetting,
  setSetting,
} from '@mylife/presence';
import { ErrorState } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';

type CategoryKey =
  | 'social'
  | 'entertainment'
  | 'productivity'
  | 'communication'
  | 'utilities'
  | 'gaming'
  | 'other';

type TimeDisplayMode = 'clock' | 'decimal';

interface SettingsViewState {
  dailyGoal: number;
  goalDraft: number;
  suggestedGoal: number;
  suggestionCopy: string;
  activeIntentionsCount: number;
  dailyReportEnabled: boolean;
  dailyReportTime: string;
  goalWarningsEnabled: boolean;
  streakRiskEnabled: boolean;
  focusRemindersEnabled: boolean;
  morningBriefingEnabled: boolean;
  morningBriefingTime: string;
  bedtimeEnabled: boolean;
  bedtimeTime: string;
  timeDisplayMode: TimeDisplayMode;
  categorySummaries: Array<{
    key: CategoryKey;
    label: string;
    icon: Parameters<typeof MaterialSymbol>[0]['name'];
    count: number;
    apps: string[];
  }>;
}

const CATEGORY_META: Array<{
  key: CategoryKey;
  label: string;
  icon: Parameters<typeof MaterialSymbol>[0]['name'];
}> = [
  { key: 'social', label: 'Social', icon: 'share' },
  { key: 'entertainment', label: 'Entertainment', icon: 'movie' },
  { key: 'productivity', label: 'Productivity', icon: 'task_alt' },
  { key: 'communication', label: 'Communication', icon: 'chat' },
  { key: 'utilities', label: 'Utilities', icon: 'explore' },
  { key: 'gaming', label: 'Games', icon: 'bolt' },
  { key: 'other', label: 'Other', icon: 'diamond' },
];

const DAILY_REPORT_TIMES = ['19:30', '20:00', '20:30', '21:00'];
const MORNING_TIMES = ['06:30', '07:00', '07:30', '08:00'];
const BEDTIME_TIMES = ['21:30', '22:00', '22:30', '23:00'];

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysAgoKey(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return toDateKey(date);
}

function normalizeCategory(category: string): CategoryKey {
  const key = category.toLowerCase();

  if (key === 'work') return 'productivity';
  if (key === 'media' || key === 'audio') return 'entertainment';
  if (key === 'games') return 'gaming';
  if (key === 'utilities') return 'utilities';
  if (key === 'social' || key === 'entertainment' || key === 'productivity' || key === 'communication' || key === 'gaming') {
    return key;
  }

  return 'other';
}

function formatTimeLabel(value: string): string {
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function buildSettingsState(db: ReturnType<typeof useDatabase>): SettingsViewState {
  const today = toDateKey(new Date());
  const allAppUsage = getAppUsageRange(db, '2020-01-01', '2099-12-31', 6000);
  const weeklyRecords = getDailyUsageRange(db, daysAgoKey(6), today, 7);
  const previousWeeklyRecords = getDailyUsageRange(db, daysAgoKey(13), daysAgoKey(7), 7);
  const currentAverage = weeklyRecords.length > 0
    ? Math.round(weeklyRecords.reduce((sum, record) => sum + record.total_minutes, 0) / weeklyRecords.length)
    : Number(getSetting(db, 'daily_goal_minutes') ?? '180');
  const previousAverage = previousWeeklyRecords.length > 0
    ? Math.round(previousWeeklyRecords.reduce((sum, record) => sum + record.total_minutes, 0) / previousWeeklyRecords.length)
    : currentAverage;
  const improvement = calculateImprovement(currentAverage, previousAverage);
  const suggestedGoal = Math.max(60, Math.round((currentAverage * (improvement > 0 ? 0.9 : 0.95)) / 15) * 15);

  const appNamesByCategory = new Map<CategoryKey, Set<string>>();

  for (const record of allAppUsage) {
    const category = normalizeCategory(record.category);
    const current = appNamesByCategory.get(category) ?? new Set<string>();
    current.add(record.app_name);
    appNamesByCategory.set(category, current);
  }

  return {
    dailyGoal: Number(getSetting(db, 'daily_goal_minutes') ?? '180'),
    goalDraft: Number(getSetting(db, 'daily_goal_minutes') ?? '180'),
    suggestedGoal,
    suggestionCopy:
      improvement > 0
        ? `Your last 7 days ran ${improvement}% hotter than the previous week. A ${formatScreenTime(suggestedGoal)} cap will start nudging things down.`
        : `You are already trending ${Math.abs(improvement)}% lower than the week before. ${formatScreenTime(suggestedGoal)} should keep the pressure gentle.`,
    activeIntentionsCount: getAllActiveIntentions(db, 100).length,
    dailyReportEnabled: getSetting(db, 'daily_report_reminder_enabled') !== '0',
    dailyReportTime: getSetting(db, 'daily_report_reminder_time') ?? '20:30',
    goalWarningsEnabled: getSetting(db, 'progressive_alerts_enabled') !== '0',
    streakRiskEnabled: getSetting(db, 'streak_reminders_enabled') !== '0',
    focusRemindersEnabled: getSetting(db, 'focus_session_reminders_enabled') !== '0',
    morningBriefingEnabled: getSetting(db, 'morning_briefing_enabled') !== '0',
    morningBriefingTime: getSetting(db, 'morning_briefing_time') ?? '07:30',
    bedtimeEnabled: getSetting(db, 'bedtime_wind_down_enabled') !== '0',
    bedtimeTime: getSetting(db, 'bedtime_time') ?? '22:00',
    timeDisplayMode: (getSetting(db, 'time_display_mode') ?? 'clock') as TimeDisplayMode,
    categorySummaries: CATEGORY_META.map((entry) => {
      const apps = [...(appNamesByCategory.get(entry.key) ?? new Set<string>())].sort();
      return {
        ...entry,
        count: apps.length,
        apps,
      };
    }),
  };
}

export default function PresenceSettingsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [viewState, setViewState] = useState<SettingsViewState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    try {
      setViewState(buildSettingsState(db));
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load settings.');
    }
  }, [db]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    load();
    setRefreshing(false);
  }, [load]);

  const updateViewState = useCallback((updater: (current: SettingsViewState) => SettingsViewState) => {
    setViewState((current) => (current ? updater(current) : current));
  }, []);

  const persistSettingValue = useCallback(
    (key: string, value: string, updater: (current: SettingsViewState) => SettingsViewState) => {
      try {
        setSetting(db, key, value);
        updateViewState(updater);
      } catch (nextError) {
        Alert.alert('Could not save setting', nextError instanceof Error ? nextError.message : 'Please try again.');
      }
    },
    [db, updateViewState],
  );

  const saveGoal = useCallback(() => {
    if (viewState == null) {
      return;
    }

    try {
      createGoal(db, {
        daily_minutes: viewState.goalDraft,
        effective_date: toDateKey(new Date()),
      });
      setSetting(db, 'daily_goal_minutes', String(viewState.goalDraft));
      updateViewState((current) => ({
        ...current,
        dailyGoal: current.goalDraft,
      }));
      Alert.alert('Goal saved', `Daily screen-time goal set to ${formatScreenTime(viewState.goalDraft)}.`);
    } catch (nextError) {
      Alert.alert('Could not save goal', nextError instanceof Error ? nextError.message : 'Please try again.');
    }
  }, [db, updateViewState, viewState]);

  const exportData = useCallback(async () => {
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        throw new Error('Sharing is not available on this device.');
      }

      const dailyCsv = exportDailyUsageCSV(getDailyUsageRange(db, '2020-01-01', '2099-12-31', 5000));
      const appCsv = exportAppUsageCSV(getAppUsageRange(db, '2020-01-01', '2099-12-31', 10_000));
      const sessionsCsv = exportSessionsCSV(getFocusSessions(db, 5000));
      const targetDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;

      if (!targetDir) {
        throw new Error('File export storage is unavailable.');
      }

      const uri = `${targetDir}mypresence-export-${Date.now()}.txt`;
      const bundle = [
        '# MyPresence Daily Usage',
        dailyCsv,
        '',
        '# MyPresence App Usage',
        appCsv,
        '',
        '# MyPresence Focus Sessions',
        sessionsCsv,
      ].join('\n');

      await FileSystem.writeAsStringAsync(uri, bundle, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await Sharing.shareAsync(uri, {
        mimeType: 'text/plain',
        dialogTitle: 'Export MyPresence Data',
      });
    } catch (nextError) {
      Alert.alert('Export failed', nextError instanceof Error ? nextError.message : 'Please try again.');
    }
  }, [db]);

  const clearAllData = useCallback(() => {
    Alert.alert(
      'Clear all history?',
      'This deletes presence tracking history, sessions, XP, and intentions. Settings stay in place.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Data',
          style: 'destructive',
          onPress: () => {
            try {
              db.transaction(() => {
                db.execute('DELETE FROM pr_session_whitelist');
                db.execute('DELETE FROM pr_sessions');
                db.execute('DELETE FROM pr_app_intentions');
                db.execute('DELETE FROM pr_app_opens');
                db.execute('DELETE FROM pr_xp_log');
                db.execute('DELETE FROM pr_app_usage');
                db.execute('DELETE FROM pr_daily_usage');
                db.execute('DELETE FROM pr_goals');
              });
              load();
            } catch (nextError) {
              Alert.alert('Could not clear data', nextError instanceof Error ? nextError.message : 'Please try again.');
            }
          },
        },
      ],
    );
  }, [db, load]);

  if (error) {
    return (
      <View style={styles.screen}>
        <View style={styles.errorWrap}>
          <ErrorState message={error} onRetry={load} />
        </View>
      </View>
    );
  }

  if (viewState == null) {
    return <View style={styles.screen} />;
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={PR_ACCENT_LIGHT}
            colors={[PR_ACCENT_LIGHT]}
          />
        )}
      >
        <View style={styles.heroBlock}>
          <Text style={styles.heroEyebrow}>Settings</Text>
          <Text style={styles.heroTitle}>Settings</Text>
          <Text style={styles.heroCopy}>
            Tune the goal, notification rhythm, data export, and display behavior behind your attention dashboard.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Daily Goal</Text>
          <View style={styles.groupCard}>
            <View style={styles.goalRow}>
              <View>
                <Text style={styles.rowTitle}>Daily Usage Limit</Text>
                <Text style={styles.rowCopy}>Maximum screen time per day</Text>
              </View>
              <MaterialSymbol name="timer" size={20} color={PR_ACCENT_LIGHT} />
            </View>

            <View style={styles.goalStepper}>
              <Pressable
                onPress={() => updateViewState((current) => ({
                  ...current,
                  goalDraft: Math.max(30, current.goalDraft - 15),
                }))}
                style={styles.stepButton}
              >
                <MaterialSymbol name="remove" size={18} color={PR_TEXT} />
              </Pressable>
              <Text style={styles.goalValue}>{formatScreenTime(viewState.goalDraft)}</Text>
              <Pressable
                onPress={() => updateViewState((current) => ({
                  ...current,
                  goalDraft: current.goalDraft + 15,
                }))}
                style={styles.stepButton}
              >
                <MaterialSymbol name="add" size={18} color={PR_TEXT} />
              </Pressable>
            </View>

            <Pressable onPress={saveGoal}>
              <LinearGradient
                colors={[PR_ACCENT_LIGHT, PR_ACCENT]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.saveGoalButton}
              >
                <Text style={styles.saveGoalText}>Save Goal</Text>
              </LinearGradient>
            </Pressable>

            <View style={styles.suggestionCard}>
              <Text style={styles.suggestionLabel}>Smart Suggestion</Text>
              <Text style={styles.suggestionValue}>{formatScreenTime(viewState.suggestedGoal)}</Text>
              <Text style={styles.suggestionCopy}>{viewState.suggestionCopy}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>App Categories</Text>
            <Pressable onPress={() => Alert.alert('Coming Soon', 'Custom categories land in a later phase.')}>
              <Text style={styles.linkText}>Add custom category</Text>
            </Pressable>
          </View>

          <View style={styles.groupCard}>
            {viewState.categorySummaries.map((category) => (
              <Pressable
                key={category.key}
                onPress={() =>
                  Alert.alert(
                    category.label,
                    category.apps.length > 0 ? category.apps.join('\n') : 'No assigned apps yet.',
                  )
                }
                style={styles.row}
              >
                <View style={styles.rowLeft}>
                  <View style={styles.rowIconWrap}>
                    <MaterialSymbol name={category.icon} size={18} color={PR_ACCENT_LIGHT} />
                  </View>
                  <View>
                    <Text style={styles.rowTitle}>{category.label}</Text>
                    <Text style={styles.rowCopy}>{`${category.count} apps assigned`}</Text>
                  </View>
                </View>
                <MaterialSymbol name="chevron_right" size={18} color={PR_TEXT_TERTIARY} />
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Notifications</Text>
          <View style={styles.groupCard}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.rowTitle}>Daily Report Reminder</Text>
                <Text style={styles.rowCopy}>Summary of your tracked day</Text>
              </View>
              <Switch
                value={viewState.dailyReportEnabled}
                onValueChange={(value) =>
                  persistSettingValue(
                    'daily_report_reminder_enabled',
                    value ? '1' : '0',
                    (current) => ({ ...current, dailyReportEnabled: value }),
                  )}
                trackColor={{ false: PR_SURFACES.highest, true: 'rgba(34,211,238,0.38)' }}
                thumbColor={viewState.dailyReportEnabled ? PR_ACCENT_LIGHT : '#F5F5F7'}
              />
            </View>
            {viewState.dailyReportEnabled ? (
              <View style={styles.timeChipRow}>
                {DAILY_REPORT_TIMES.map((value) => (
                  <Pressable
                    key={value}
                    onPress={() =>
                      persistSettingValue(
                        'daily_report_reminder_time',
                        value,
                        (current) => ({ ...current, dailyReportTime: value }),
                      )}
                    style={[
                      styles.timeChip,
                      viewState.dailyReportTime === value && styles.timeChipActive,
                    ]}
                  >
                    <Text style={[styles.timeChipText, viewState.dailyReportTime === value && styles.timeChipTextActive]}>
                      {formatTimeLabel(value)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.rowTitle}>Goal Warnings</Text>
                <Text style={styles.rowCopy}>Alert when you are approaching your limit</Text>
              </View>
              <Switch
                value={viewState.goalWarningsEnabled}
                onValueChange={(value) =>
                  persistSettingValue(
                    'progressive_alerts_enabled',
                    value ? '1' : '0',
                    (current) => ({ ...current, goalWarningsEnabled: value }),
                  )}
                trackColor={{ false: PR_SURFACES.highest, true: 'rgba(34,211,238,0.38)' }}
                thumbColor={viewState.goalWarningsEnabled ? PR_ACCENT_LIGHT : '#F5F5F7'}
              />
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.rowTitle}>Streak at Risk</Text>
                <Text style={styles.rowCopy}>Nudge yourself before the streak breaks</Text>
              </View>
              <Switch
                value={viewState.streakRiskEnabled}
                onValueChange={(value) =>
                  persistSettingValue(
                    'streak_reminders_enabled',
                    value ? '1' : '0',
                    (current) => ({ ...current, streakRiskEnabled: value }),
                  )}
                trackColor={{ false: PR_SURFACES.highest, true: 'rgba(34,211,238,0.38)' }}
                thumbColor={viewState.streakRiskEnabled ? PR_ACCENT_LIGHT : '#F5F5F7'}
              />
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.rowTitle}>Focus Session Reminders</Text>
                <Text style={styles.rowCopy}>Keep planned sessions from slipping</Text>
              </View>
              <Switch
                value={viewState.focusRemindersEnabled}
                onValueChange={(value) =>
                  persistSettingValue(
                    'focus_session_reminders_enabled',
                    value ? '1' : '0',
                    (current) => ({ ...current, focusRemindersEnabled: value }),
                  )}
                trackColor={{ false: PR_SURFACES.highest, true: 'rgba(34,211,238,0.38)' }}
                thumbColor={viewState.focusRemindersEnabled ? PR_ACCENT_LIGHT : '#F5F5F7'}
              />
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.rowTitle}>Morning Briefing</Text>
                <Text style={styles.rowCopy}>Start the day with a calm reset</Text>
              </View>
              <Switch
                value={viewState.morningBriefingEnabled}
                onValueChange={(value) =>
                  persistSettingValue(
                    'morning_briefing_enabled',
                    value ? '1' : '0',
                    (current) => ({ ...current, morningBriefingEnabled: value }),
                  )}
                trackColor={{ false: PR_SURFACES.highest, true: 'rgba(34,211,238,0.38)' }}
                thumbColor={viewState.morningBriefingEnabled ? PR_ACCENT_LIGHT : '#F5F5F7'}
              />
            </View>
            {viewState.morningBriefingEnabled ? (
              <View style={styles.timeChipRow}>
                {MORNING_TIMES.map((value) => (
                  <Pressable
                    key={value}
                    onPress={() =>
                      persistSettingValue(
                        'morning_briefing_time',
                        value,
                        (current) => ({ ...current, morningBriefingTime: value }),
                      )}
                    style={[
                      styles.timeChip,
                      viewState.morningBriefingTime === value && styles.timeChipActive,
                    ]}
                  >
                    <Text style={[styles.timeChipText, viewState.morningBriefingTime === value && styles.timeChipTextActive]}>
                      {formatTimeLabel(value)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.rowTitle}>Bedtime Wind-down</Text>
                <Text style={styles.rowCopy}>A late-evening reminder to stop scrolling</Text>
              </View>
              <Switch
                value={viewState.bedtimeEnabled}
                onValueChange={(value) =>
                  persistSettingValue(
                    'bedtime_wind_down_enabled',
                    value ? '1' : '0',
                    (current) => ({ ...current, bedtimeEnabled: value }),
                  )}
                trackColor={{ false: PR_SURFACES.highest, true: 'rgba(34,211,238,0.38)' }}
                thumbColor={viewState.bedtimeEnabled ? PR_ACCENT_LIGHT : '#F5F5F7'}
              />
            </View>
            {viewState.bedtimeEnabled ? (
              <View style={styles.timeChipRow}>
                {BEDTIME_TIMES.map((value) => (
                  <Pressable
                    key={value}
                    onPress={() =>
                      persistSettingValue(
                        'bedtime_time',
                        value,
                        (current) => ({ ...current, bedtimeTime: value }),
                      )}
                    style={[
                      styles.timeChip,
                      viewState.bedtimeTime === value && styles.timeChipActive,
                    ]}
                  >
                    <Text style={[styles.timeChipText, viewState.bedtimeTime === value && styles.timeChipTextActive]}>
                      {formatTimeLabel(value)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <Text style={styles.disclaimer}>
              Notification scheduling requires permissions and will be wired in a future release.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>App Intentions</Text>
          <View style={styles.groupCard}>
            <Pressable style={styles.row} onPress={() => router.push('/(presence)/intentions' as never)}>
              <View style={styles.rowLeft}>
                <View style={styles.rowIconWrap}>
                  <MaterialSymbol name="psychology" size={18} color={PR_ACCENT_LIGHT} />
                </View>
                <View>
                  <Text style={styles.rowTitle}>Active Intentions</Text>
                  <Text style={styles.rowCopy}>{`${viewState.activeIntentionsCount} active rules`}</Text>
                </View>
              </View>
              <MaterialSymbol name="chevron_right" size={18} color={PR_TEXT_TERTIARY} />
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Phase 4 Features</Text>
          <View style={styles.groupCard}>
            <Pressable style={styles.row} onPress={() => router.push('/(presence)/scheduled' as never)}>
              <View style={styles.rowLeft}>
                <View style={styles.rowIconWrap}>
                  <MaterialSymbol name="repeat" size={18} color={PR_ACCENT_LIGHT} />
                </View>
                <View>
                  <Text style={styles.rowTitle}>Scheduled Sessions</Text>
                  <Text style={styles.rowCopy}>Recurring focus blocks and upcoming run windows</Text>
                </View>
              </View>
              <MaterialSymbol name="chevron_right" size={18} color={PR_TEXT_TERTIARY} />
            </Pressable>

            <Pressable style={styles.row} onPress={() => router.push('/(presence)/accountability' as never)}>
              <View style={styles.rowLeft}>
                <View style={styles.rowIconWrap}>
                  <MaterialSymbol name="groups" size={18} color={PR_ACCENT_LIGHT} />
                </View>
                <View>
                  <Text style={styles.rowTitle}>Accountability Partners</Text>
                  <Text style={styles.rowCopy}>Share codes and notify-over-goal preferences</Text>
                </View>
              </View>
              <MaterialSymbol name="chevron_right" size={18} color={PR_TEXT_TERTIARY} />
            </Pressable>

            <Pressable style={styles.row} onPress={() => router.push('/(presence)/rewards' as never)}>
              <View style={styles.rowLeft}>
                <View style={styles.rowIconWrap}>
                  <MaterialSymbol name="card_giftcard" size={18} color={PR_ACCENT_LIGHT} />
                </View>
                <View>
                  <Text style={styles.rowTitle}>Rewards</Text>
                  <Text style={styles.rowCopy}>Milestones that auto-earn as momentum builds</Text>
                </View>
              </View>
              <MaterialSymbol name="chevron_right" size={18} color={PR_TEXT_TERTIARY} />
            </Pressable>

            <Pressable style={styles.row} onPress={() => router.push('/(presence)/commitment' as never)}>
              <View style={styles.rowLeft}>
                <View style={styles.rowIconWrap}>
                  <MaterialSymbol name="handshake" size={18} color={PR_ACCENT_LIGHT} />
                </View>
                <View>
                  <Text style={styles.rowTitle}>Commitment Contract</Text>
                  <Text style={styles.rowCopy}>A note to your future self for hard days</Text>
                </View>
              </View>
              <MaterialSymbol name="chevron_right" size={18} color={PR_TEXT_TERTIARY} />
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Display</Text>
          <View style={styles.groupCard}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={styles.rowIconWrap}>
                  <MaterialSymbol name="schedule" size={18} color={PR_ACCENT_LIGHT} />
                </View>
                <View>
                  <Text style={styles.rowTitle}>Time Format</Text>
                  <Text style={styles.rowCopy}>Preview formatting for minutes and reports</Text>
                </View>
              </View>
            </View>
            <View style={styles.timeChipRow}>
              {(['clock', 'decimal'] as TimeDisplayMode[]).map((value) => (
                <Pressable
                  key={value}
                  onPress={() =>
                    persistSettingValue(
                      'time_display_mode',
                      value,
                      (current) => ({ ...current, timeDisplayMode: value }),
                    )}
                  style={[
                    styles.timeChip,
                    viewState.timeDisplayMode === value && styles.timeChipActive,
                  ]}
                >
                  <Text style={[styles.timeChipText, viewState.timeDisplayMode === value && styles.timeChipTextActive]}>
                    {value === 'clock' ? 'Hours + Minutes' : 'Decimal Hours'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.readonlyRow}>
              <Text style={styles.rowTitle}>Theme</Text>
              <Text style={styles.readonlyValue}>Follows hub</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Data</Text>
          <View style={styles.groupCard}>
            <Pressable style={styles.row} onPress={() => void exportData()}>
              <View style={styles.rowLeft}>
                <View style={styles.rowIconWrap}>
                  <MaterialSymbol name="download" size={18} color={PR_ACCENT_LIGHT} />
                </View>
                <View>
                  <Text style={styles.rowTitle}>Export Usage Data</Text>
                  <Text style={styles.rowCopy}>Daily usage, app usage, and session CSV bundle</Text>
                </View>
              </View>
              <MaterialSymbol name="open_in_new" size={18} color={PR_TEXT_TERTIARY} />
            </Pressable>

            <Pressable style={[styles.row, styles.dangerRow]} onPress={clearAllData}>
              <View style={styles.rowLeft}>
                <View style={[styles.rowIconWrap, styles.dangerIconWrap]}>
                  <MaterialSymbol name="delete_forever" size={18} color="#FFB4AB" />
                </View>
                <View>
                  <Text style={styles.dangerTitle}>Clear All History</Text>
                  <Text style={styles.rowCopy}>Delete presence tracking, sessions, XP, and intentions</Text>
                </View>
              </View>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>About</Text>
          <View style={styles.groupCard}>
            <View style={styles.readonlyRow}>
              <Text style={styles.rowTitle}>Version</Text>
              <Text style={styles.readonlyValue}>{PRESENCE_MODULE.version}</Text>
            </View>

            <Pressable
              style={styles.row}
              onPress={() => Alert.alert('XP System', 'Goal days, focus sessions, intentions, and streak bonuses all feed your level progression.')}
            >
              <View style={styles.rowLeft}>
                <View style={styles.rowIconWrap}>
                  <MaterialSymbol name="bolt" size={18} color={PR_ACCENT_LIGHT} />
                </View>
                <View>
                  <Text style={styles.rowTitle}>XP System</Text>
                  <Text style={styles.rowCopy}>How levels and titles are calculated</Text>
                </View>
              </View>
              <MaterialSymbol name="chevron_right" size={18} color={PR_TEXT_TERTIARY} />
            </Pressable>

            <Pressable style={styles.row} onPress={() => router.push('/(presence)/badges' as never)}>
              <View style={styles.rowLeft}>
                <View style={styles.rowIconWrap}>
                  <MaterialSymbol name="diamond" size={18} color={PR_ACCENT_LIGHT} />
                </View>
                <View>
                  <Text style={styles.rowTitle}>Badge Criteria</Text>
                  <Text style={styles.rowCopy}>See the current badge ladder and progress</Text>
                </View>
              </View>
              <MaterialSymbol name="chevron_right" size={18} color={PR_TEXT_TERTIARY} />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PR_SURFACES.lowest,
  },
  content: {
    paddingBottom: 160,
    gap: 20,
  },
  stickyShell: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    backgroundColor: 'rgba(14, 14, 19, 0.92)',
  },
  topBar: {
    minHeight: 64,
    borderRadius: 24,
    backgroundColor: 'rgba(19, 19, 24, 0.76)',
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: PR_ACCENT,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    ...PR_TYPOGRAPHY.titleMd,
    color: '#03151A',
  },
  topBarEyebrow: {
    ...PR_TYPOGRAPHY.labelTight,
    color: PR_TEXT_TERTIARY,
  },
  topBarTitle: {
    ...PR_TYPOGRAPHY.headlineMd,
    color: PR_ACCENT_LIGHT,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  heroBlock: {
    paddingHorizontal: 20,
    gap: 6,
  },
  heroEyebrow: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_ACCENT_LIGHT,
  },
  heroTitle: {
    ...PR_TYPOGRAPHY.displayLg,
    color: PR_TEXT,
    lineHeight: 52,
  },
  heroCopy: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
  },
  section: {
    paddingHorizontal: 20,
    gap: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionLabel: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_TEXT_TERTIARY,
  },
  linkText: {
    ...PR_TYPOGRAPHY.labelTight,
    color: PR_ACCENT_LIGHT,
  },
  groupCard: {
    backgroundColor: PR_SURFACES.low,
    borderRadius: 24,
    padding: 18,
    gap: 14,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rowIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34,211,238,0.12)',
  },
  rowTitle: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  rowCopy: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_SECONDARY,
    marginTop: 2,
  },
  goalStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 999,
    backgroundColor: PR_SURFACES.high,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  stepButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PR_SURFACES.base,
  },
  goalValue: {
    ...PR_TYPOGRAPHY.headlineMd,
    color: PR_ACCENT_LIGHT,
  },
  saveGoalButton: {
    minHeight: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveGoalText: {
    ...PR_TYPOGRAPHY.titleMd,
    color: '#04161D',
  },
  suggestionCard: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 16,
    gap: 6,
  },
  suggestionLabel: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_TEXT_TERTIARY,
  },
  suggestionValue: {
    ...PR_TYPOGRAPHY.headlineMd,
    color: PR_TEXT,
  },
  suggestionCopy: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_SECONDARY,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleCopy: {
    flex: 1,
  },
  timeChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  timeChip: {
    borderRadius: 999,
    backgroundColor: PR_SURFACES.high,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  timeChipActive: {
    backgroundColor: PR_ACCENT_LIGHT,
  },
  timeChipText: {
    ...PR_TYPOGRAPHY.labelTight,
    color: PR_TEXT_SECONDARY,
  },
  timeChipTextActive: {
    color: '#03151A',
  },
  disclaimer: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_TERTIARY,
  },
  readonlyRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  readonlyValue: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_ACCENT_LIGHT,
  },
  dangerRow: {
    paddingTop: 8,
  },
  dangerIconWrap: {
    backgroundColor: 'rgba(255,180,171,0.12)',
  },
  dangerTitle: {
    ...PR_TYPOGRAPHY.titleMd,
    color: '#FFB4AB',
  },
  errorWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
});
