import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import {
  GlassCard,
  HABITS_MODULE,
  MaterialSymbol,
  XPBar,
  countHabits,
  createArea,
  deleteArea,
  ensurePetState,
  ensurePlayerProfile,
  getAllActiveEnrollments,
  getAllActiveHealthKitLinks,
  getAllActiveLocationReminders,
  getAllSobrietyProfiles,
  getAreas,
  getPetState,
  getPlayerProfile,
  getSetting,
  getXPProgress,
  importAllCSV,
  reorderAreas,
  setGamificationEnabled,
  setSetting,
  updateArea,
  type Area,
  HB_ACCENT,
  HB_ACCENT_LIGHT,
  HB_AREAS,
  HB_SURFACES,
  HB_TEXT,
  HB_TEXT_SECONDARY,
  HB_TYPOGRAPHY,
  withAlpha,
} from '@mylife/habits';
import { AreaManagerSheet } from '../../../components/habits/AreaManagerSheet';
import {
  ExpandablePanel,
  FeatureTile,
  FilterChip,
  resolveAreaColor,
  resolveAreaIcon,
} from '../../../components/habits/phase1-shared';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';

type SectionKey = 'reminders' | 'areas' | 'display' | 'integrations' | 'gamification' | 'data' | 'about';

const FEATURE_TILES = [
  { icon: 'military_tech', label: 'Badges', route: '/(habits)/badge-gallery', color: HB_ACCENT_LIGHT },
  { icon: 'sports_esports', label: 'RPG Progress', route: '/(habits)/rpg', color: HB_ACCENT },
  { icon: 'pets', label: 'Pet', route: '/(habits)/pet-detail', color: HB_AREAS.social },
  { icon: 'health_and_safety', label: 'Sobriety', route: '/(habits)/sobriety-clock', color: HB_AREAS.body },
  { icon: 'timer', label: 'Focus Timer', route: '/(habits)/focus-timer', color: HB_AREAS.learning },
  { icon: 'schedule', label: 'Time Reports', route: '/(habits)/time-reports', color: HB_AREAS.money },
  { icon: 'link', label: 'Habit Stacking', route: '/(habits)/stacking', color: HB_ACCENT_LIGHT },
  { icon: 'groups', label: 'Programs', route: '/(habits)/programs', color: HB_AREAS.social },
  { icon: 'favorite', label: 'Cycle', route: '/(habits)/cycle', color: HB_AREAS.body },
  { icon: 'health_and_safety', label: 'HealthKit', route: '/(habits)/healthkit', color: HB_AREAS.health },
  { icon: 'location_on', label: 'Locations', route: '/(habits)/locations', color: HB_AREAS.learning },
  { icon: 'mic', label: 'Siri', route: '/(habits)/siri', color: HB_AREAS.mind },
] as const;

const REMINDER_TIMES = ['06:30', '08:00', '12:00', '18:00', '21:00'];
const REMINDER_SOUNDS = ['Soft', 'Bell', 'Echo'];
const DND_WINDOWS = ['None', '22:00-07:00', '23:00-06:00'];

function SettingRow({
  label,
  value,
  description,
  action,
}: {
  label: string;
  value?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingCopy}>
        <Text style={styles.settingLabel}>{label}</Text>
        {description ? <Text style={styles.settingDescription}>{description}</Text> : null}
      </View>
      {action ?? (value ? <Text style={styles.settingValue}>{value}</Text> : null)}
    </View>
  );
}

function SettingToggle({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <SettingRow
      action={
        <Switch
          onValueChange={onValueChange}
          trackColor={{ false: HB_SURFACES.highest, true: withAlpha(HB_ACCENT, 0.55) }}
          value={value}
        />
      }
      description={description}
      label={label}
    />
  );
}

export default function HabitsSettingsScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [areaEditorVisible, setAreaEditorVisible] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<SectionKey, boolean>>({
    reminders: true,
    areas: true,
    display: true,
    integrations: false,
    gamification: false,
    data: false,
    about: false,
  });

  const screenState = useMemo(() => {
    try {
      const playerProfile = getPlayerProfile(db);
      const xp = getXPProgress(playerProfile?.totalXP ?? 0);
      const petState = getPetState(db);
      const areas = getAreas(db);
      const activeEnrollments = getAllActiveEnrollments(db);
      const habitsCount = countHabits(db);
      const healthKitLinks = getAllActiveHealthKitLinks(db);
      const locationReminders = getAllActiveLocationReminders(db);
      const sobrietyProfiles = getAllSobrietyProfiles(db);

      return {
        error: null as string | null,
        playerProfile,
        xp,
        petState,
        areas,
        activeQuests: activeEnrollments.length,
        habitsCount,
        healthKitLinksCount: healthKitLinks.length,
        locationReminderCount: locationReminders.length,
        sobrietyCount: sobrietyProfiles.length,
        reminderTime: getSetting(db, 'default_reminder_time') ?? '08:00',
        reminderSound: getSetting(db, 'notification_sound') ?? 'Soft',
        doNotDisturb: getSetting(db, 'do_not_disturb_window') ?? 'None',
        timeFormat: getSetting(db, 'time_format') ?? '12h',
        weekStartsOn: getSetting(db, 'week_starts_on') ?? 'monday',
        showStreakFreezes: getSetting(db, 'show_streak_freezes') !== 'false',
        healthKitEnabled: getSetting(db, 'healthkit_enabled') !== 'false',
        siriEnabled: getSetting(db, 'siri_enabled') === 'true',
        locationEnabled: getSetting(db, 'location_enabled') === 'true',
        petEnabled: getSetting(db, 'pet_companion_enabled') !== 'false',
        xpNotifications: getSetting(db, 'xp_notifications') !== 'false',
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Could not load settings.',
        playerProfile: null,
        xp: getXPProgress(0),
        petState: null,
        areas: [] as Area[],
        activeQuests: 0,
        habitsCount: 0,
        healthKitLinksCount: 0,
        locationReminderCount: 0,
        sobrietyCount: 0,
        reminderTime: '08:00',
        reminderSound: 'Soft',
        doNotDisturb: 'None',
        timeFormat: '12h',
        weekStartsOn: 'monday',
        showStreakFreezes: true,
        healthKitEnabled: true,
        siriEnabled: false,
        locationEnabled: false,
        petEnabled: true,
        xpNotifications: true,
      };
    }
  }, [db, refreshKey]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((value) => value + 1);
    setTimeout(() => setRefreshing(false), 160);
  }, []);

  const toggleSection = useCallback((section: SectionKey) => {
    setExpandedSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }, []);

  const persist = useCallback((key: string, value: string) => {
    setSetting(db, key, value);
    setRefreshKey((current) => current + 1);
  }, [db]);

  const handleExport = useCallback(() => {
    router.push('/(habits)/export');
  }, [router]);

  const handleImport = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'text/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const csv = await FileSystem.readAsStringAsync(result.assets[0].uri);
      if (!csv.trim()) {
        Alert.alert('Empty file', 'The selected file has no habit data.');
        return;
      }
      const imported = importAllCSV(db, csv);
      const summary = `${imported.habits.imported} habits and ${imported.completions.imported} completions imported.`;
      Alert.alert('Import complete', summary);
      setRefreshKey((value) => value + 1);
    } catch {
      Alert.alert('Import failed', 'Could not import the selected file.');
    }
  }, [db]);

  const clearHistory = useCallback(() => {
    Alert.alert(
      'Clear completion history?',
      'This removes completions, measurements, timed sessions, and focus session history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            db.execute('DELETE FROM hb_completions');
            db.execute('DELETE FROM hb_measurements');
            db.execute('DELETE FROM hb_timed_sessions');
            db.execute('DELETE FROM hb_focus_sessions');
            db.execute('DELETE FROM hb_xp_transactions');
            setRefreshKey((value) => value + 1);
          },
        },
      ],
    );
  }, [db]);

  const deleteAllData = useCallback(() => {
    Alert.alert(
      'Delete all MyHabits data?',
      'This wipes every habits table stored on-device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: () => {
            const tables = db.query<{ name: string }>(
              "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'hb_%' ORDER BY name",
            );
            tables
              .filter((table) => table.name !== 'sqlite_sequence')
              .forEach((table) => {
                db.execute(`DELETE FROM ${table.name}`);
              });
            setRefreshKey((value) => value + 1);
          },
        },
      ],
    );
  }, [db]);

  if (screenState.error) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <GlassCard level={2} contentStyle={styles.errorCard}>
            <Text style={styles.errorTitle}>Settings unavailable</Text>
            <Text style={styles.errorBody}>{screenState.error}</Text>
            <FilterChip label="Refresh" onPress={onRefresh} selected />
          </GlassCard>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={HB_ACCENT_LIGHT} />}
      >
        <GlassCard level={1} contentStyle={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Module hub</Text>
          <Text style={styles.heroTitle}>Settings</Text>
          <Text style={styles.heroSubtitle}>
            Configure reminders, integrations, companion systems, and data safety from a single glass console.
          </Text>
        </GlassCard>

        <Pressable onPress={() => router.push('/(habits)/rpg')}>
          <GlassCard level={3} contentStyle={styles.profileCard}>
            <View style={styles.profileTopRow}>
              <View style={styles.profileCopy}>
                <Text style={styles.profileEyebrow}>Player profile</Text>
                <Text style={styles.profileTitle}>Level {screenState.xp.level}</Text>
                <Text style={styles.profileMeta}>
                  {screenState.playerProfile?.totalXP ?? 0} total XP • {screenState.activeQuests} active quest{screenState.activeQuests === 1 ? '' : 's'}
                </Text>
              </View>
              <View style={styles.profileIcon}>
                <MaterialSymbol color={HB_ACCENT_LIGHT} name="sports_esports" size={24} />
              </View>
            </View>
            <XPBar
              current={screenState.xp.currentXP}
              level={screenState.xp.level}
              max={screenState.xp.neededXP}
            />
          </GlassCard>
        </Pressable>

        <View style={styles.featureGrid}>
          {FEATURE_TILES.map((tile) => (
            <FeatureTile
              key={tile.label}
              color={tile.color}
              icon={tile.icon}
              label={tile.label}
              onPress={() => router.push(tile.route)}
            />
          ))}
        </View>

        <ExpandablePanel
          caption={`${screenState.reminderTime} default • ${screenState.reminderSound}`}
          onToggle={() => toggleSection('reminders')}
          open={expandedSections.reminders}
          title="Reminders"
        >
          <SettingRow description="Default reminder time for new habits" label="Reminder time" />
          <View style={styles.optionRail}>
            {REMINDER_TIMES.map((time) => (
              <FilterChip
                key={time}
                label={time}
                onPress={() => persist('default_reminder_time', time)}
                selected={screenState.reminderTime === time}
              />
            ))}
          </View>
          <SettingRow description="Sound theme for reminders" label="Notification sound" />
          <View style={styles.optionRail}>
            {REMINDER_SOUNDS.map((sound) => (
              <FilterChip
                key={sound}
                label={sound}
                onPress={() => persist('notification_sound', sound)}
                selected={screenState.reminderSound === sound}
              />
            ))}
          </View>
          <SettingRow description="Silence routine nudges during deep night blocks" label="Do not disturb" />
          <View style={styles.optionRail}>
            {DND_WINDOWS.map((windowValue) => (
              <FilterChip
                key={windowValue}
                label={windowValue}
                onPress={() => persist('do_not_disturb_window', windowValue)}
                selected={screenState.doNotDisturb === windowValue}
              />
            ))}
          </View>
        </ExpandablePanel>

        <ExpandablePanel
          caption={`${screenState.areas.length} area${screenState.areas.length === 1 ? '' : 's'} configured`}
          onToggle={() => toggleSection('areas')}
          open={expandedSections.areas}
          title="Areas"
        >
          <View style={styles.areaPreviewRow}>
            {screenState.areas.map((area) => (
              <View key={area.id} style={styles.areaPreview}>
                <View style={[styles.areaPreviewDot, { backgroundColor: resolveAreaColor(area.name, area.color) }]} />
                <Text style={styles.areaPreviewLabel}>{area.name}</Text>
              </View>
            ))}
            {screenState.areas.length === 0 ? (
              <Text style={styles.supportingText}>No areas configured yet. Add a few so the Habits tab can group by life domain.</Text>
            ) : null}
          </View>
          <FilterChip label="Manage areas" onPress={() => setAreaEditorVisible(true)} selected />
        </ExpandablePanel>

        <ExpandablePanel
          caption={`${screenState.timeFormat} • week starts ${screenState.weekStartsOn}`}
          onToggle={() => toggleSection('display')}
          open={expandedSections.display}
          title="Display"
        >
          <SettingRow description="Clock style used in timers and reminders" label="Time format" />
          <View style={styles.optionRail}>
            {['12h', '24h'].map((format) => (
              <FilterChip
                key={format}
                label={format}
                onPress={() => persist('time_format', format)}
                selected={screenState.timeFormat === format}
              />
            ))}
          </View>
          <SettingRow description="Calendar grouping for streaks and stats" label="Week starts on" />
          <View style={styles.optionRail}>
            {['monday', 'sunday'].map((day) => (
              <FilterChip
                key={day}
                label={day}
                onPress={() => persist('week_starts_on', day)}
                selected={screenState.weekStartsOn === day}
              />
            ))}
          </View>
          <SettingToggle
            description="Show freeze reserves near streak heroes"
            label="Show streak freezes"
            onValueChange={(value) => persist('show_streak_freezes', String(value))}
            value={screenState.showStreakFreezes}
          />
        </ExpandablePanel>

        <ExpandablePanel
          caption={`${screenState.healthKitLinksCount} HealthKit links • ${screenState.locationReminderCount} locations`}
          onToggle={() => toggleSection('integrations')}
          open={expandedSections.integrations}
          title="Integrations"
        >
          <SettingToggle
            description={`${screenState.healthKitLinksCount} metric link${screenState.healthKitLinksCount === 1 ? '' : 's'} active`}
            label="HealthKit"
            onValueChange={(value) => persist('healthkit_enabled', String(value))}
            value={screenState.healthKitEnabled}
          />
          <SettingToggle
            description="Expose habit actions to Shortcuts once the Siri surface is configured"
            label="Siri shortcuts"
            onValueChange={(value) => persist('siri_enabled', String(value))}
            value={screenState.siriEnabled}
          />
          <SettingToggle
            description={`${screenState.locationReminderCount} reminder zone${screenState.locationReminderCount === 1 ? '' : 's'} ready`}
            label="Location reminders"
            onValueChange={(value) => persist('location_enabled', String(value))}
            value={screenState.locationEnabled}
          />
        </ExpandablePanel>

        <ExpandablePanel
          caption={`${screenState.petEnabled ? 'Pet on' : 'Pet off'} • ${screenState.sobrietyCount} sobriety profile${screenState.sobrietyCount === 1 ? '' : 's'}`}
          onToggle={() => toggleSection('gamification')}
          open={expandedSections.gamification}
          title="Gamification"
        >
          <SettingToggle
            description="Enable RPG progress and level-based rewards"
            label="RPG mode"
            onValueChange={(value) => {
              ensurePlayerProfile(db);
              setGamificationEnabled(db, value);
              setRefreshKey((current) => current + 1);
            }}
            value={screenState.playerProfile?.gamificationEnabled ?? false}
          />
          <SettingToggle
            description={screenState.petState?.name ? `${screenState.petState.name} is currently active` : 'Spawn the habit companion surface'}
            label="Pet companion"
            onValueChange={(value) => {
              ensurePetState(db);
              persist('pet_companion_enabled', String(value));
            }}
            value={screenState.petEnabled}
          />
          <SettingToggle
            description="Celebrate XP gains and streak bonuses inline"
            label="XP notifications"
            onValueChange={(value) => persist('xp_notifications', String(value))}
            value={screenState.xpNotifications}
          />
        </ExpandablePanel>

        <ExpandablePanel
          caption={`${screenState.habitsCount} habits stored locally`}
          onToggle={() => toggleSection('data')}
          open={expandedSections.data}
          title="Data"
        >
          <SettingRow
            action={<FilterChip label="Open Export" onPress={handleExport} selected />}
            description="Share a flat-file snapshot of habits and completions"
            label="Export"
          />
          <SettingRow
            action={<FilterChip label="Import CSV" onPress={() => void handleImport()} />}
            description="Restore data from a previous export"
            label="Import"
          />
          <SettingRow
            action={<FilterChip label="Clear history" onPress={clearHistory} />}
            description="Remove logs while keeping habit definitions"
            label="History"
          />
          <SettingRow
            action={<FilterChip color={HB_AREAS.body} label="Delete all" onPress={deleteAllData} />}
            description="Wipe every MyHabits table on this device"
            label="Danger zone"
          />
        </ExpandablePanel>

        <ExpandablePanel
          caption={`v${HABITS_MODULE.version}`}
          onToggle={() => toggleSection('about')}
          open={expandedSections.about}
          title="About"
        >
          <SettingRow description="Current module build" label="Version" value={HABITS_MODULE.version} />
          <SettingRow
            action={<FilterChip label="Privacy" onPress={() => router.push('/(hub)/privacy')} />}
            description="Read the suite privacy commitment"
            label="Privacy policy"
          />
          <SettingRow
            action={<FilterChip label="Credits" onPress={() => void Linking.openURL('https://openai.com')} />}
            description="Design system, module research, and implementation"
            label="Credits"
          />
        </ExpandablePanel>
      </ScrollView>

      <AreaManagerSheet
        areas={screenState.areas}
        onAddArea={(name, color) => {
          createArea(db, uuid(), { name, color, icon: resolveAreaIcon(name) });
          setRefreshKey((value) => value + 1);
        }}
        onClose={() => setAreaEditorVisible(false)}
        onDeleteArea={(areaId) => {
          deleteArea(db, areaId);
          setRefreshKey((value) => value + 1);
        }}
        onMoveArea={(areaId, direction) => {
          const orderedIds = screenState.areas.map((area) => area.id);
          const currentIndex = orderedIds.indexOf(areaId);
          const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
          if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedIds.length) return;
          const reordered = [...orderedIds];
          const [item] = reordered.splice(currentIndex, 1);
          reordered.splice(nextIndex, 0, item);
          reorderAreas(db, reordered);
          setRefreshKey((value) => value + 1);
        }}
        onRenameArea={(areaId, name, color) => {
          updateArea(db, areaId, { name, color, icon: resolveAreaIcon(name) });
          setRefreshKey((value) => value + 1);
        }}
        visible={areaEditorVisible}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HB_SURFACES.lowest,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 136,
    gap: 16,
  },
  heroCard: {
    gap: 10,
  },
  heroEyebrow: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_ACCENT_LIGHT,
    fontSize: 10,
    lineHeight: 12,
  },
  heroTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
    fontSize: 34,
    lineHeight: 38,
  },
  heroSubtitle: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  profileCard: {
    gap: 14,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  profileCopy: {
    flex: 1,
    gap: 4,
  },
  profileEyebrow: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_ACCENT_LIGHT,
    fontSize: 10,
    lineHeight: 12,
  },
  profileTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
    fontSize: 24,
    lineHeight: 28,
  },
  profileMeta: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 17,
  },
  profileIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(HB_ACCENT, 0.16),
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  optionRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  settingRow: {
    borderRadius: 18,
    backgroundColor: HB_SURFACES.low,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingCopy: {
    flex: 1,
    gap: 4,
  },
  settingLabel: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
    fontSize: 16,
    lineHeight: 20,
  },
  settingDescription: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 17,
  },
  settingValue: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_ACCENT_LIGHT,
  },
  areaPreviewRow: {
    gap: 8,
  },
  areaPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  areaPreviewDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  areaPreviewLabel: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT,
    fontSize: 13,
    lineHeight: 18,
  },
  supportingText: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  errorCard: {
    gap: 10,
  },
  errorTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
    fontSize: 24,
    lineHeight: 28,
  },
  errorBody: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
});
