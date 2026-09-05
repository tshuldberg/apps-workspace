import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  Text as RNText,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import type { DatabaseAdapter } from '@mylife/db';
import {
  Chip,
  GlassPanel,
  MaterialSymbol,
  SectionLabel,
  WK_ACCENT,
  WK_ACCENT_LIGHT,
  WK_CATEGORY_COLORS,
  WK_FONTS,
  WK_SURFACES,
  getSetWeightsForSession,
  getWorkoutSessions,
  seedWorkoutExerciseLibrary,
} from '@mylife/workouts';
import { ErrorState } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  clearWorkoutRecentViews,
  getWorkoutPhaseOneSettings,
  saveWorkoutPhaseOneSettings,
  WORKOUT_PHASE_ONE_DEFAULTS,
  type WorkoutEquipmentOption,
  type WorkoutPhaseOneSettings,
  type WorkoutPreferenceFocus,
} from '../../../lib/workouts/settings';
import {
  WorkoutPrimaryButton,
  WorkoutSecondaryButton,
  WorkoutTabScrollView,
  formatVolume,
} from './_screen-kit';

interface ProfileStats {
  totalWorkouts: number;
  totalVolume: number;
  daysActive: number;
}

interface SettingsSectionProps {
  label: string;
  children: ReactNode;
}

interface SettingsItemProps {
  title: string;
  description?: string;
  children?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
}

const FOCUS_OPTIONS: Array<{ value: WorkoutPreferenceFocus; label: string; accent: string }> = [
  { value: 'strength', label: 'Strength', accent: WK_ACCENT_LIGHT },
  { value: 'hypertrophy', label: 'Hypertrophy', accent: WK_ACCENT },
  { value: 'cardio', label: 'Cardio', accent: WK_CATEGORY_COLORS.cardio },
  { value: 'mobility', label: 'Mobility', accent: WK_CATEGORY_COLORS.cardio },
  { value: 'recovery', label: 'Recovery', accent: WK_CATEGORY_COLORS.recovery },
];

const EQUIPMENT_OPTIONS: Array<{ value: WorkoutEquipmentOption; label: string }> = [
  { value: 'barbell', label: 'Barbell' },
  { value: 'dumbbells', label: 'Dumbbells' },
  { value: 'kettlebells', label: 'Kettlebells' },
  { value: 'machines', label: 'Machines' },
  { value: 'bands', label: 'Bands' },
  { value: 'bodyweight', label: 'Bodyweight' },
];

const REST_PRESETS = [30, 45, 60, 90, 120, 180] as const;
const BARBELL_PRESETS = [35, 45, 55, 65] as const;

function buildLifetimeVolume(
  db: DatabaseAdapter,
  sessions: ReturnType<typeof getWorkoutSessions>,
): number {
  return sessions.reduce((sum, session) => {
    const setWeights = getSetWeightsForSession(db, session.id);
    if (setWeights.length > 0) {
      return (
        sum +
        setWeights.reduce((sessionSum, set) => {
          return sessionSum + set.weight * set.reps;
        }, 0)
      );
    }

    return (
      sum +
      session.exercisesCompleted.reduce((sessionSum, exercise) => {
        if (exercise.skipped) return sessionSum;
        return sessionSum + (exercise.repsCompleted ?? 0) * 10;
      }, 0)
    );
  }, 0);
}

function buildProfileStats(db: DatabaseAdapter): ProfileStats {
  const sessions = getWorkoutSessions(db, { onlyCompleted: true, limit: 320 });

  return {
    totalWorkouts: sessions.length,
    totalVolume: Math.round(buildLifetimeVolume(db, sessions)),
    daysActive: new Set(
      sessions
        .filter((session) => session.completedAt)
        .map((session) => (session.completedAt as string).slice(0, 10)),
    ).size,
  };
}

function clearWorkoutModuleData(db: DatabaseAdapter): void {
  const rows = db.query<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'wk_%'",
  );

  db.execute('PRAGMA foreign_keys = OFF');
  try {
    db.transaction(() => {
      for (const row of rows) {
        if (!/^wk_[a-z0-9_]+$/i.test(row.name)) continue;
        db.execute(`DELETE FROM ${row.name}`);
      }
    });
  } finally {
    db.execute('PRAGMA foreign_keys = ON');
  }
}

function SettingsSection({ label, children }: SettingsSectionProps) {
  return (
    <View style={styles.section}>
      <SectionLabel>{label}</SectionLabel>
      <GlassPanel padding={18} style={styles.sectionPanel}>
        {children}
      </GlassPanel>
    </View>
  );
}

function SettingsItem({
  title,
  description,
  children,
  onPress,
  destructive = false,
}: SettingsItemProps) {
  const content = (
    <View style={styles.settingItem}>
      <View style={styles.settingCopy}>
        <RNText style={[styles.settingTitle, destructive && styles.destructiveText]}>
          {title}
        </RNText>
        {description ? <RNText style={styles.settingDescription}>{description}</RNText> : null}
      </View>
      {children ? <View style={styles.settingControl}>{children}</View> : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} style={styles.pressableItem}>
      {content}
    </Pressable>
  );
}

function Stepper({
  value,
  options,
  formatter,
  onChange,
}: {
  value: number;
  options: readonly number[];
  formatter: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const index = Math.max(0, options.indexOf(value));

  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={() => onChange(options[Math.max(index - 1, 0)] ?? value)}
        style={styles.stepperButton}
      >
        <RNText style={styles.stepperButtonText}>-</RNText>
      </Pressable>
      <RNText style={styles.stepperValue}>{formatter(value)}</RNText>
      <Pressable
        onPress={() => onChange(options[Math.min(index + 1, options.length - 1)] ?? value)}
        style={styles.stepperButton}
      >
        <RNText style={styles.stepperButtonText}>+</RNText>
      </Pressable>
    </View>
  );
}

export default function WorkoutsSettingsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const navigation = useNavigation();
  const [settings, setSettings] = useState<WorkoutPhaseOneSettings>(WORKOUT_PHASE_ONE_DEFAULTS);
  const [profileStats, setProfileStats] = useState<ProfileStats>({
    totalWorkouts: 0,
    totalVolume: 0,
    daysActive: 0,
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => setIsEditingProfile((value) => !value)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={isEditingProfile ? 'Save profile' : 'Edit profile'}
          style={styles.headerIconButton}
        >
          <MaterialSymbol
            name={isEditingProfile ? 'check_circle' : 'edit'}
            size={20}
            color="rgba(228, 225, 233, 0.74)"
          />
        </Pressable>
      ),
    });
  }, [navigation, isEditingProfile]);

  const load = useCallback(() => {
    try {
      seedWorkoutExerciseLibrary(db);
      setSettings(getWorkoutPhaseOneSettings(db));
      setProfileStats(buildProfileStats(db));
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load workout settings.',
      );
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const persistSettings = useCallback(
    (next: WorkoutPhaseOneSettings) => {
      setSettings(next);
      saveWorkoutPhaseOneSettings(db, next);
    },
    [db],
  );

  const updateSetting = useCallback(
    <K extends keyof WorkoutPhaseOneSettings>(
      key: K,
      value: WorkoutPhaseOneSettings[K],
    ) => {
      persistSettings({
        ...settings,
        [key]: value,
      });
    },
    [persistSettings, settings],
  );

  const toggleEquipment = useCallback(
    (value: WorkoutEquipmentOption) => {
      const next = settings.availableEquipment.includes(value)
        ? settings.availableEquipment.filter((item) => item !== value)
        : [...settings.availableEquipment, value];

      persistSettings({
        ...settings,
        availableEquipment: next,
      });
    },
    [persistSettings, settings],
  );

  const handleExport = useCallback(() => {
    Alert.alert(
      'Export Data',
      `Phase 1 placeholder. Current profile snapshot:\n\nWorkouts: ${profileStats.totalWorkouts}\nVolume: ${formatVolume(profileStats.totalVolume)} lbs\nDays active: ${profileStats.daysActive}`,
    );
  }, [profileStats.daysActive, profileStats.totalVolume, profileStats.totalWorkouts]);

  const handleReseed = useCallback(() => {
    try {
      const seeded = seedWorkoutExerciseLibrary(db);
      Alert.alert(
        'Exercise Library',
        seeded > 0
          ? `Seeded ${seeded} exercises into MyWorkouts.`
          : 'Exercise library is already seeded.',
      );
      load();
    } catch (seedError) {
      Alert.alert(
        'Unable to Reseed',
        seedError instanceof Error ? seedError.message : 'Failed to reseed the exercise library.',
      );
    }
  }, [db, load]);

  const handleClearAllData = useCallback(() => {
    Alert.alert(
      'Clear All Workout Data',
      'This removes workouts, sessions, plans, photos, measurements, overload rules, and Phase 1 preferences for MyWorkouts.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Data',
          style: 'destructive',
          onPress: () => {
            try {
              clearWorkoutModuleData(db);
              saveWorkoutPhaseOneSettings(db, WORKOUT_PHASE_ONE_DEFAULTS);
              clearWorkoutRecentViews(db);
              setSettings(WORKOUT_PHASE_ONE_DEFAULTS);
              setProfileStats({ totalWorkouts: 0, totalVolume: 0, daysActive: 0 });
              Alert.alert('Workout Data Cleared', 'MyWorkouts has been reset for a fresh start.');
            } catch (clearError) {
              Alert.alert(
                'Unable to Clear Data',
                clearError instanceof Error ? clearError.message : 'Failed to clear workout data.',
              );
            }
          },
        },
      ],
    );
  }, [db]);

  const versionLabel = Constants.expoConfig?.version ?? '0.1.0';
  const avatarInitial = settings.displayName.trim().charAt(0).toUpperCase() || 'W';

  return (
    <WorkoutTabScrollView onRefresh={load}>
      <View style={styles.body}>
        <GlassPanel padding={22} style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.avatar}>
              <RNText style={styles.avatarText}>{avatarInitial}</RNText>
            </View>
            <View style={styles.heroCopy}>
              <RNText style={styles.heroName}>{settings.displayName}</RNText>
              <View style={styles.tierPill}>
                <RNText style={styles.tierText}>{settings.tierLabel}</RNText>
              </View>
            </View>
          </View>

          <View style={styles.profileStatsRow}>
            <View style={styles.profileStat}>
              <RNText style={styles.profileStatValue}>{profileStats.totalWorkouts}</RNText>
              <RNText style={styles.profileStatLabel}>Total workouts</RNText>
            </View>
            <View style={styles.profileStat}>
              <RNText style={styles.profileStatValue}>{formatVolume(profileStats.totalVolume)}</RNText>
              <RNText style={styles.profileStatLabel}>Total volume</RNText>
            </View>
            <View style={styles.profileStat}>
              <RNText style={styles.profileStatValue}>{profileStats.daysActive}</RNText>
              <RNText style={styles.profileStatLabel}>Days active</RNText>
            </View>
          </View>
        </GlassPanel>

        {error ? (
          <GlassPanel padding={24} style={styles.sectionPanel}>
            <ErrorState message={error} onRetry={load} />
          </GlassPanel>
        ) : null}

        <SettingsSection label="Account">
          {isEditingProfile ? (
            <View style={styles.inputGroup}>
              <View style={styles.inputWrap}>
                <RNText style={styles.inputLabel}>Display Name</RNText>
                <TextInput
                  value={settings.displayName}
                  onChangeText={(value) => updateSetting('displayName', value)}
                  placeholder="Display name"
                  placeholderTextColor="rgba(214, 195, 181, 0.44)"
                  style={styles.input}
                />
              </View>
              <View style={styles.inputWrap}>
                <RNText style={styles.inputLabel}>Tier Label</RNText>
                <TextInput
                  value={settings.tierLabel}
                  onChangeText={(value) => updateSetting('tierLabel', value)}
                  placeholder="Tier label"
                  placeholderTextColor="rgba(214, 195, 181, 0.44)"
                  style={styles.input}
                />
              </View>
            </View>
          ) : (
            <>
              <SettingsItem
                title="Display Name"
                description="How your MyWorkouts profile appears across the mobile shell."
              >
                <RNText style={styles.inlineValue}>{settings.displayName}</RNText>
              </SettingsItem>
              <SettingsItem
                title="Tier"
                description="Your current profile label inside the training shell."
              >
                <RNText style={styles.inlineValue}>{settings.tierLabel}</RNText>
              </SettingsItem>
            </>
          )}
        </SettingsSection>

        <SettingsSection label="Training Preferences">
          <SettingsItem
            title="Default Focus"
            description="Tune recommendations and builder defaults toward your primary goal."
          >
            <View style={styles.chipWrap}>
              {FOCUS_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={settings.defaultFocus === option.value}
                  accent={option.accent}
                  onPress={() => updateSetting('defaultFocus', option.value)}
                />
              ))}
            </View>
          </SettingsItem>

          <SettingsItem
            title="Default Rest Time"
            description="Used by workout creation and session playback timers."
          >
            <Stepper
              value={settings.defaultRestSeconds}
              options={REST_PRESETS}
              formatter={(value) => (value >= 60 ? `${value / 60}m` : `${value}s`)}
              onChange={(value) => updateSetting('defaultRestSeconds', value)}
            />
          </SettingsItem>

          <SettingsItem
            title="Auto-Start Rest Timer"
            description="Immediately trigger the rest countdown after a set is logged."
          >
            <Switch
              value={settings.autoStartRestTimer}
              onValueChange={(value) => updateSetting('autoStartRestTimer', value)}
              trackColor={{ false: WK_SURFACES.high, true: WK_ACCENT }}
            />
          </SettingsItem>

          <SettingsItem
            title="Voice Commands"
            description="Keep hands free during sessions. Advanced voice flow is still evolving."
          >
            <Switch
              value={settings.voiceCommandsEnabled}
              onValueChange={(value) => {
                updateSetting('voiceCommandsEnabled', value);
                if (value) {
                  Alert.alert(
                    'Voice Commands Enabled',
                    'Voice controls will be surfaced inside active workout flows as the next phases land.',
                  );
                }
              }}
              trackColor={{ false: WK_SURFACES.high, true: WK_ACCENT }}
            />
          </SettingsItem>
        </SettingsSection>

        <SettingsSection label="Equipment">
          <SettingsItem
            title="Plate Inventory"
            description="Open the plate loader to tune bar and plate availability."
            onPress={() => router.push('/(workouts)/plate-loader' as never)}
          >
            <MaterialSymbol name="chevron_right" size={18} color="rgba(214, 195, 181, 0.54)" />
          </SettingsItem>

          <SettingsItem
            title="Default Barbell Weight"
            description="Used as the starting bar for warmups and plate calculations."
          >
            <View style={styles.chipWrap}>
              {BARBELL_PRESETS.map((value) => (
                <Chip
                  key={value}
                  label={`${value} lbs`}
                  selected={settings.defaultBarbellWeight === value}
                  onPress={() => updateSetting('defaultBarbellWeight', value)}
                />
              ))}
            </View>
          </SettingsItem>

          <SettingsItem
            title="Available Equipment"
            description="Filter suggestions and builder options by what is actually in your gym."
          >
            <View style={styles.chipWrap}>
              {EQUIPMENT_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={settings.availableEquipment.includes(option.value)}
                  accent={WK_CATEGORY_COLORS.recovery}
                  onPress={() => toggleEquipment(option.value)}
                />
              ))}
            </View>
          </SettingsItem>
        </SettingsSection>

        <SettingsSection label="Units">
          <SettingsItem title="Weight Unit" description="For lifts, plates, and load calculations.">
            <View style={styles.chipWrap}>
              {(['lbs', 'kg'] as const).map((value) => (
                <Chip
                  key={value}
                  label={value.toUpperCase()}
                  selected={settings.weightUnit === value}
                  onPress={() => updateSetting('weightUnit', value)}
                />
              ))}
            </View>
          </SettingsItem>

          <SettingsItem title="Distance Unit" description="For running, GPS tracking, and cardio summaries.">
            <View style={styles.chipWrap}>
              {(['mi', 'km'] as const).map((value) => (
                <Chip
                  key={value}
                  label={value.toUpperCase()}
                  selected={settings.distanceUnit === value}
                  onPress={() => updateSetting('distanceUnit', value)}
                />
              ))}
            </View>
          </SettingsItem>

          <SettingsItem title="Body Weight Unit" description="Used for weigh-ins and physique progress tracking.">
            <View style={styles.chipWrap}>
              {(['lbs', 'kg'] as const).map((value) => (
                <Chip
                  key={value}
                  label={value.toUpperCase()}
                  selected={settings.bodyWeightUnit === value}
                  onPress={() => updateSetting('bodyWeightUnit', value)}
                />
              ))}
            </View>
          </SettingsItem>
        </SettingsSection>

        <SettingsSection label="Notifications">
          <SettingsItem title="Workout Reminders" description="Nudges before your planned session window.">
            <Switch
              value={settings.workoutReminders}
              onValueChange={(value) => updateSetting('workoutReminders', value)}
              trackColor={{ false: WK_SURFACES.high, true: WK_ACCENT }}
            />
          </SettingsItem>
          <SettingsItem title="Rest Timer Alerts" description="Haptics and banners when rest periods end.">
            <Switch
              value={settings.restTimerAlerts}
              onValueChange={(value) => updateSetting('restTimerAlerts', value)}
              trackColor={{ false: WK_SURFACES.high, true: WK_ACCENT }}
            />
          </SettingsItem>
          <SettingsItem title="PR Notifications" description="Celebrate new personal records as they happen.">
            <Switch
              value={settings.prNotifications}
              onValueChange={(value) => updateSetting('prNotifications', value)}
              trackColor={{ false: WK_SURFACES.high, true: WK_ACCENT }}
            />
          </SettingsItem>
        </SettingsSection>

        <SettingsSection label="Integrations">
          <SettingsItem
            title="Apple Watch"
            description="Pair the watch bridge, sync session controls, and review the current status."
            onPress={() => router.push('/(workouts)/watch' as never)}
          >
            <View style={styles.statusPill}>
              <RNText style={styles.statusPillText}>Available</RNText>
            </View>
          </SettingsItem>

          <SettingsItem title="GPS Tracking" description="Record outdoor routes and pace while cardio sessions run.">
            <Switch
              value={settings.gpsTrackingEnabled}
              onValueChange={(value) => updateSetting('gpsTrackingEnabled', value)}
              trackColor={{ false: WK_SURFACES.high, true: WK_ACCENT }}
            />
          </SettingsItem>

          <SettingsItem title="Form Recordings" description="Keep video references for lift review and technique notes.">
            <Switch
              value={settings.formRecordingsEnabled}
              onValueChange={(value) => updateSetting('formRecordingsEnabled', value)}
              trackColor={{ false: WK_SURFACES.high, true: WK_ACCENT }}
            />
          </SettingsItem>
        </SettingsSection>

        <SettingsSection label="Data">
          <View style={styles.actionStack}>
            <WorkoutPrimaryButton label="Export Data" icon="download" onPress={handleExport} />
            <WorkoutSecondaryButton label="Reseed Exercise Library" icon="restart_alt" onPress={handleReseed} />
            <Pressable onPress={handleClearAllData} style={styles.dangerButton}>
              <MaterialSymbol name="delete" size={16} color="#FFB4AB" />
              <RNText style={styles.dangerButtonText}>Clear All Data</RNText>
            </Pressable>
          </View>
        </SettingsSection>

        <SettingsSection label="About">
          <SettingsItem title="Version" description="Current MyWorkouts mobile shell release.">
            <RNText style={styles.inlineValue}>{`MyWorkouts v${versionLabel}`}</RNText>
          </SettingsItem>
          <SettingsItem
            title="Privacy Policy"
            description="Open the shared MyLife privacy guidance."
            onPress={() =>
              Alert.alert(
                'Privacy Policy',
                'Open the MyLife web legal pages at /legal/privacy when you need the full privacy policy.',
              )
            }
          >
            <MaterialSymbol name="privacy_tip" size={18} color="rgba(214, 195, 181, 0.54)" />
          </SettingsItem>
          <SettingsItem
            title="Support"
            description="Need help with workouts data, syncing, or the UI shell?"
            onPress={() =>
              Alert.alert(
                'Support',
                'Support routing is still a placeholder in Phase 1. Use the shared MyLife support channels from the web shell for now.',
              )
            }
          >
            <MaterialSymbol name="support" size={18} color="rgba(214, 195, 181, 0.54)" />
          </SettingsItem>
        </SettingsSection>
      </View>
    </WorkoutTabScrollView>
  );
}

const styles = StyleSheet.create({
  headerIconButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 152,
    gap: 18,
  },
  heroCard: {
    backgroundColor: WK_SURFACES.low,
    gap: 18,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201, 137, 77, 0.18)',
  },
  avatarText: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 34,
    lineHeight: 38,
    color: WK_ACCENT_LIGHT,
  },
  heroCopy: {
    flex: 1,
    gap: 10,
  },
  heroName: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 28,
    lineHeight: 32,
    color: '#F3EFFA',
    letterSpacing: -0.7,
  },
  tierPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: 'rgba(201, 137, 77, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tierText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: WK_ACCENT_LIGHT,
  },
  profileStatsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  profileStat: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: WK_SURFACES.high,
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 4,
  },
  profileStatValue: {
    fontFamily: WK_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: '#F1ECF8',
  },
  profileStatLabel: {
    fontFamily: WK_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    color: 'rgba(214, 195, 181, 0.62)',
  },
  section: {
    gap: 8,
  },
  sectionPanel: {
    backgroundColor: WK_SURFACES.low,
    gap: 14,
  },
  settingItem: {
    gap: 12,
    backgroundColor: WK_SURFACES.high,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  pressableItem: {
    borderRadius: 16,
  },
  settingCopy: {
    gap: 4,
  },
  settingTitle: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: '#F1ECF8',
  },
  settingDescription: {
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(214, 195, 181, 0.62)',
  },
  destructiveText: {
    color: '#FFB4AB',
  },
  settingControl: {
    gap: 10,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  inputGroup: {
    gap: 12,
  },
  inputWrap: {
    gap: 6,
  },
  inputLabel: {
    fontFamily: WK_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(214, 195, 181, 0.58)',
  },
  input: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 14,
    backgroundColor: WK_SURFACES.high,
    color: '#F1ECF8',
    fontFamily: WK_FONTS.medium,
    fontSize: 14,
  },
  inlineValue: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 16,
    color: WK_ACCENT_LIGHT,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 12,
    borderRadius: 999,
    backgroundColor: WK_SURFACES.lowest,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WK_SURFACES.high,
  },
  stepperButtonText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 16,
    lineHeight: 18,
    color: WK_ACCENT_LIGHT,
  },
  stepperValue: {
    minWidth: 52,
    textAlign: 'center',
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 16,
    color: '#F1ECF8',
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: 'rgba(48, 209, 88, 0.16)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 14,
    color: WK_CATEGORY_COLORS.recovery,
  },
  actionStack: {
    gap: 12,
  },
  dangerButton: {
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 69, 58, 0.10)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dangerButtonText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 16,
    color: '#FFB4AB',
  },
});
