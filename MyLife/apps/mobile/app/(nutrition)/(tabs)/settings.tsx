import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND_DOMAIN } from '@mylife/ui';
import {
  GlassCard,
  MaterialSymbol,
  NU_ACCENT,
  NU_ACCENT_DARK,
  NU_ACCENT_LIGHT,
  NU_FONT_BOLD,
  NU_FONT_MEDIUM,
  NU_FONT_REGULAR,
  NU_FONT_SEMIBOLD,
  NU_SURFACES,
  NU_TEXT,
  NU_TEXT_SECONDARY,
  NU_TEXT_TERTIARY,
  NU_TYPOGRAPHY,
  NUTRITION_MODULE,
  SectionHeader,
  getActiveGoals,
  getAllRestaurants,
  getMealTemplateCount,
  getSetting,
  setSetting,
} from '@mylife/nutrition';
import { useDatabase } from '../../../components/DatabaseProvider';

type WeightUnit = 'lb' | 'kg';
type HeightUnit = 'ft_in' | 'cm';
type VolumeUnit = 'oz' | 'ml';
type EnergyUnit = 'kcal' | 'kJ';
type DefaultMealType = 'auto' | 'breakfast' | 'lunch' | 'dinner' | 'snack';

interface SettingsSnapshot {
  displayName: string;
  joinedDate: string;
  weightUnit: WeightUnit;
  heightUnit: HeightUnit;
  volumeUnit: VolumeUnit;
  energyUnit: EnergyUnit;
  defaultMealType: DefaultMealType;
  showMicronutrients: boolean;
  showSourceBadges: boolean;
  dailyReminderTime: string;
  communityEnabled: boolean;
  activeGoalSummary: string;
  restaurantCount: number;
  templateCount: number;
  syncEnabled: boolean;
}

const INTEGRATIONS = [
  { name: 'MyFast', icon: 'eco', status: 'Insight-ready', route: '/(fast)' as const },
  { name: 'MyWorkouts', icon: 'fitness_center', status: 'Insight-ready', route: '/(workouts)' as const },
  { name: 'MyMood', icon: 'favorite', status: 'Insight-ready', route: '/(mood)' as const },
  { name: 'MyRecipes', icon: 'restaurant_menu', status: 'Ready', route: '/(recipes)' as const },
] as const;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function readFirstNutritionDate(db: ReturnType<typeof useDatabase>) {
  const rows = db.query<{ first_date: string | null }>(
    'SELECT MIN(effective_date) as first_date FROM nu_daily_goals',
  );
  const firstDate = rows[0]?.first_date;
  return firstDate ? firstDate.slice(0, 10) : today();
}

function buildSettingsSnapshot(db: ReturnType<typeof useDatabase>): SettingsSnapshot {
  const activeGoal = getActiveGoals(db, today());
  const restaurantCount = getAllRestaurants(db, 500).length;
  const templateCount = getMealTemplateCount(db);

  return {
    displayName: getSetting(db, 'display_name') ?? 'Nutrition Curator',
    joinedDate: readFirstNutritionDate(db),
    weightUnit: getSetting(db, 'weight_unit') === 'kg' ? 'kg' : 'lb',
    heightUnit: getSetting(db, 'height_unit') === 'cm' ? 'cm' : 'ft_in',
    volumeUnit: getSetting(db, 'waterUnit') === 'oz' ? 'oz' : 'ml',
    energyUnit: getSetting(db, 'energy_unit') === 'kJ' ? 'kJ' : 'kcal',
    defaultMealType: (getSetting(db, 'default_meal_type') as DefaultMealType | undefined) ?? 'auto',
    showMicronutrients: getSetting(db, 'show_micronutrients') !== '0',
    showSourceBadges: getSetting(db, 'show_source_badges') !== '0',
    dailyReminderTime: getSetting(db, 'daily_reminder_time') ?? '7:30 PM',
    communityEnabled: getSetting(db, 'community_enabled') !== '0',
    activeGoalSummary: activeGoal
      ? `${activeGoal.calories} kcal • ${activeGoal.proteinG}P / ${activeGoal.carbsG}C / ${activeGoal.fatG}F`
      : 'No active nutrition goal saved yet',
    restaurantCount,
    templateCount,
    syncEnabled: getSetting(db, 'syncEnabled') === 'true',
  };
}

function formatShortDate(dateString: string) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function SettingsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const snapshot = useMemo(() => buildSettingsSnapshot(db), [db, tick]);
  const [displayName, setDisplayName] = useState(snapshot.displayName);

  useEffect(() => {
    setDisplayName(snapshot.displayName);
  }, [snapshot.displayName]);

  const refresh = () => setTick((value) => value + 1);

  const persist = (key: string, value: string) => {
    try {
      setSetting(db, key, value);
      refresh();
    } catch (error) {
      Alert.alert(
        'Update failed',
        error instanceof Error ? error.message : 'This setting could not be updated.',
      );
    }
  };

  const saveDisplayName = () => {
    const trimmed = displayName.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Choose a profile name before saving.');
      return;
    }

    persist('display_name', trimmed);
  };

  const confirmAction = (title: string, message: string, action: () => void) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: action },
    ]);
  };

  const clearFoodLog = () => {
    confirmAction(
      'Clear food log?',
      'This removes diary entries and logged food items but keeps saved foods, goals, and restaurants.',
      () => {
        try {
          db.transaction(() => {
            db.execute('DELETE FROM nu_food_log_items');
            db.execute('DELETE FROM nu_food_log');
          });
          refresh();
        } catch (error) {
          Alert.alert(
            'Could not clear log',
            error instanceof Error ? error.message : 'Try again after reopening the module.',
          );
        }
      },
    );
  };

  const resetDefaults = () => {
    confirmAction(
      'Reset nutrition preferences?',
      'This keeps your diary data but resets units, reminders, and UI preferences to their defaults.',
      () => {
        try {
          db.transaction(() => {
            setSetting(db, 'weight_unit', 'lb');
            setSetting(db, 'height_unit', 'in');
            setSetting(db, 'waterUnit', 'ml');
            setSetting(db, 'energy_unit', 'kcal');
            setSetting(db, 'default_meal_type', 'auto');
            setSetting(db, 'show_micronutrients', '1');
            setSetting(db, 'show_source_badges', '1');
            setSetting(db, 'daily_reminder_time', '7:30 PM');
            setSetting(db, 'community_enabled', '1');
          });
          refresh();
        } catch (error) {
          Alert.alert(
            'Reset failed',
            error instanceof Error ? error.message : 'Defaults could not be restored.',
          );
        }
      },
    );
  };

  const openPrivacyPolicy = async () => {
    try {
      await Linking.openURL(`https://${BRAND_DOMAIN}/privacy`);
    } catch {
      Alert.alert('Privacy policy unavailable', `Open https://${BRAND_DOMAIN}/privacy in your browser.`);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>CONFIGURATION</Text>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Tune units, reminders, privacy, exports, and cross-module surfaces in one place.</Text>
      </View>

      <GlassCard elevated style={styles.card}>
        <SectionHeader title="Account" accent={NU_TEXT} />
        <View style={styles.accountRow}>
          <View style={styles.accountAvatar}>
            <MaterialSymbol name="account_circle" size={28} color={NU_ACCENT_DARK} />
          </View>
          <View style={styles.accountCopy}>
            <Text style={styles.accountName}>Nutrition Curator</Text>
            <Text style={styles.accountMeta}>Joined {formatShortDate(snapshot.joinedDate)}</Text>
          </View>
        </View>

        <Text style={styles.label}>Profile name</Text>
        <View style={styles.inlineInputRow}>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Display name"
            placeholderTextColor={NU_TEXT_TERTIARY}
            style={styles.inlineInput}
          />
          <InlineButton label="Save" onPress={saveDisplayName} />
        </View>
      </GlassCard>

      <GlassCard style={styles.card}>
        <SectionHeader title="Goals" accent={NU_TEXT} />
        <LinkRow
          icon="monitor_weight"
          title="Current nutrition targets"
          subtitle={snapshot.activeGoalSummary}
          actionLabel="Edit Goals"
          onPress={() => router.push('/(nutrition)/goals' as never)}
        />
      </GlassCard>

      <GlassCard style={styles.card}>
        <SectionHeader title="Units" accent={NU_TEXT} />
        <SegmentedRow
          label="Weight"
          value={snapshot.weightUnit}
          options={[
            { key: 'lb', label: 'LB' },
            { key: 'kg', label: 'KG' },
          ]}
          onChange={(value) => persist('weight_unit', value)}
        />
        <SegmentedRow
          label="Volume"
          value={snapshot.volumeUnit}
          options={[
            { key: 'oz', label: 'OZ' },
            { key: 'ml', label: 'ML' },
          ]}
          onChange={(value) => persist('waterUnit', value)}
        />
        <SegmentedRow
          label="Height"
          value={snapshot.heightUnit}
          options={[
            { key: 'ft_in', label: 'FT + IN' },
            { key: 'cm', label: 'CM' },
          ]}
          onChange={(value) => persist('height_unit', value === 'cm' ? 'cm' : 'in')}
        />
        <SegmentedRow
          label="Energy"
          value={snapshot.energyUnit}
          options={[
            { key: 'kcal', label: 'KCAL' },
            { key: 'kJ', label: 'KJ' },
          ]}
          onChange={(value) => persist('energy_unit', value)}
        />
      </GlassCard>

      <GlassCard style={styles.card}>
        <SectionHeader title="Preferences" accent={NU_TEXT} />
        <SegmentedRow
          label="Default meal"
          value={snapshot.defaultMealType}
          options={[
            { key: 'auto', label: 'AUTO' },
            { key: 'breakfast', label: 'BREAKFAST' },
            { key: 'lunch', label: 'LUNCH' },
            { key: 'dinner', label: 'DINNER' },
            { key: 'snack', label: 'SNACK' },
          ]}
          onChange={(value) => persist('default_meal_type', value)}
          compact
        />
        <ToggleRow
          title="Show micronutrients"
          subtitle="Display vitamins and minerals in food detail and dashboard views."
          value={snapshot.showMicronutrients}
          onToggle={() => persist('show_micronutrients', snapshot.showMicronutrients ? '0' : '1')}
        />
        <ToggleRow
          title="Show source badges"
          subtitle="Keep USDA, OFF, FatSecret, and custom source markers visible."
          value={snapshot.showSourceBadges}
          onToggle={() => persist('show_source_badges', snapshot.showSourceBadges ? '0' : '1')}
        />
        <SettingTextRow
          label="Daily reminder"
          value={snapshot.dailyReminderTime}
          onChange={(value) => persist('daily_reminder_time', value.trim() || '7:30 PM')}
        />
      </GlassCard>

      <GlassCard style={styles.card}>
        <SectionHeader title="Privacy" accent={NU_TEXT} />
        <View style={styles.infoBanner}>
          <MaterialSymbol name="lock" size={18} color={NU_ACCENT_LIGHT} />
          <Text style={styles.infoBannerText}>All nutrition data stays on your device by default.</Text>
        </View>
        <StatusRow
          icon="cloud_off"
          title="Cloud sync"
          subtitle="Core nutrition data is offline-first in this build."
          status={snapshot.syncEnabled ? 'Enabled' : 'Disabled'}
          tone={snapshot.syncEnabled ? 'success' : 'muted'}
        />
        <ToggleRow
          title="Community surfaces"
          subtitle="Keep the nutrition community tab and challenge surfaces available."
          value={snapshot.communityEnabled}
          onToggle={() => persist('community_enabled', snapshot.communityEnabled ? '0' : '1')}
        />
      </GlassCard>

      <GlassCard style={styles.card}>
        <SectionHeader title="Data" accent={NU_TEXT} />
        <LinkRow
          icon="download"
          title="Export data"
          subtitle="Build CSV, JSON, or printable exports."
          onPress={() => router.push('/(nutrition)/export' as never)}
        />
        <LinkRow
          icon="edit_note"
          title="Food journal"
          subtitle="Review daily notes, tags, and linked meal reflections."
          onPress={() => router.push('/(nutrition)/notes' as never)}
        />
        <LinkRow
          icon="restaurant"
          title="Restaurants"
          subtitle={`${snapshot.restaurantCount} saved restaurant entries`}
          onPress={() => router.push('/(nutrition)/restaurant' as never)}
        />
        <LinkRow
          icon="restaurant_menu"
          title="Meal templates"
          subtitle={`${snapshot.templateCount} templates in the nutrition database`}
          onPress={() => Alert.alert('Template manager', 'Template management is staged through the logging flow in the current build.')}
        />
        <DangerRow
          title="Clear food log"
          subtitle="Remove diary entries while keeping saved foods and settings."
          onPress={clearFoodLog}
        />
        <DangerRow
          title="Reset to defaults"
          subtitle="Restore nutrition preferences and units without deleting history."
          onPress={resetDefaults}
        />
      </GlassCard>

      <GlassCard style={styles.card}>
        <SectionHeader title="Integrations" accent={NU_TEXT} />
        <View style={styles.integrationList}>
          {INTEGRATIONS.map((integration) => (
            <LinkRow
              key={integration.name}
              icon={integration.icon}
              title={integration.name}
              subtitle={integration.status}
              onPress={() => router.push(integration.route as never)}
              status={integration.status}
            />
          ))}
        </View>
      </GlassCard>

      <GlassCard style={styles.card}>
        <SectionHeader title="About" accent={NU_TEXT} />
        <StatusRow
          icon="info"
          title="Version"
          subtitle="Current nutrition module release"
          status={NUTRITION_MODULE.version}
          tone="success"
        />
        <StatusRow
          icon="science"
          title="Data sources"
          subtitle="USDA, Open Food Facts, and FatSecret credits"
          status="Verified"
          tone="success"
        />
        <LinkRow
          icon="public"
          title="Privacy policy"
          subtitle={`Open ${BRAND_DOMAIN}/privacy`}
          onPress={openPrivacyPolicy}
        />
      </GlassCard>
    </ScrollView>
  );
}

function InlineButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <LinearGradient colors={[NU_ACCENT_LIGHT, NU_ACCENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.inlineButton}>
        <Text style={styles.inlineButtonLabel}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function LinkRow({
  icon,
  title,
  subtitle,
  onPress,
  actionLabel,
  status,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  actionLabel?: string;
  status?: string;
}) {
  return (
    <Pressable onPress={onPress} style={styles.linkRow}>
      <View style={styles.linkIcon}>
        <MaterialSymbol name={icon} size={18} color={NU_ACCENT_LIGHT} />
      </View>
      <View style={styles.linkCopy}>
        <Text style={styles.linkTitle}>{title}</Text>
        <Text style={styles.linkSubtitle}>{subtitle}</Text>
      </View>
      {status ? <StatusPill label={status} tone="success" /> : null}
      {actionLabel ? <Text style={styles.actionLabel}>{actionLabel}</Text> : null}
      {!status && !actionLabel ? <MaterialSymbol name="keyboard_arrow_right" size={18} color={NU_TEXT_TERTIARY} /> : null}
    </Pressable>
  );
}

function SegmentedRow({
  label,
  value,
  options,
  onChange,
  compact = false,
}: {
  label: string;
  value: string;
  options: Array<{ key: string; label: string }>;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <View style={styles.segmentedRow}>
      <Text style={styles.segmentedLabel}>{label}</Text>
      <View style={[styles.segmentedOptions, compact ? styles.segmentedOptionsCompact : null]}>
        {options.map((option) => {
          const active = value === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => onChange(option.key)}
              style={[styles.segmentedOption, active ? styles.segmentedOptionActive : null]}
            >
              <Text style={[styles.segmentedOptionLabel, active ? styles.segmentedOptionLabelActive : null]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ToggleRow({
  title,
  subtitle,
  value,
  onToggle,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable onPress={onToggle} style={styles.toggleRow}>
      <View style={styles.toggleCopy}>
        <Text style={styles.linkTitle}>{title}</Text>
        <Text style={styles.linkSubtitle}>{subtitle}</Text>
      </View>
      <View style={[styles.toggleTrack, value ? styles.toggleTrackActive : null]}>
        <View style={[styles.toggleThumb, value ? styles.toggleThumbActive : null]} />
      </View>
    </Pressable>
  );
}

function SettingTextRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <View style={styles.textSettingRow}>
      <Text style={styles.segmentedLabel}>{label}</Text>
      <View style={styles.inlineInputRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onEndEditing={() => onChange(draft)}
          style={styles.inlineInput}
          placeholder="7:30 PM"
          placeholderTextColor={NU_TEXT_TERTIARY}
        />
        <InlineButton label="Set" onPress={() => onChange(draft)} />
      </View>
    </View>
  );
}

function StatusRow({
  icon,
  title,
  subtitle,
  status,
  tone,
}: {
  icon: string;
  title: string;
  subtitle: string;
  status: string;
  tone: 'success' | 'muted';
}) {
  return (
    <View style={styles.linkRow}>
      <View style={styles.linkIcon}>
        <MaterialSymbol name={icon} size={18} color={NU_ACCENT_LIGHT} />
      </View>
      <View style={styles.linkCopy}>
        <Text style={styles.linkTitle}>{title}</Text>
        <Text style={styles.linkSubtitle}>{subtitle}</Text>
      </View>
      <StatusPill label={status} tone={tone} />
    </View>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: 'success' | 'muted';
}) {
  return (
    <View style={[styles.statusPill, tone === 'success' ? styles.statusPillSuccess : styles.statusPillMuted]}>
      <Text style={[styles.statusPillLabel, tone === 'success' ? styles.statusPillLabelSuccess : null]}>{label}</Text>
    </View>
  );
}

function DangerRow({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.dangerRow}>
      <View style={styles.linkCopy}>
        <Text style={styles.dangerTitle}>{title}</Text>
        <Text style={styles.linkSubtitle}>{subtitle}</Text>
      </View>
      <MaterialSymbol name="delete" size={18} color="#FFB4AB" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: NU_SURFACES.lowest,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 18,
  },
  hero: {
    gap: 6,
    paddingTop: 8,
  },
  eyebrow: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_ACCENT_LIGHT,
  },
  title: {
    ...NU_TYPOGRAPHY.displayLg,
    fontSize: 40,
    lineHeight: 44,
    color: NU_TEXT,
  },
  subtitle: {
    ...NU_TYPOGRAPHY.bodyMd,
    color: NU_TEXT_SECONDARY,
  },
  card: {
    gap: 16,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  accountAvatar: {
    width: 52,
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 184, 119, 0.2)',
  },
  accountCopy: {
    gap: 4,
  },
  accountName: {
    fontFamily: NU_FONT_BOLD,
    fontSize: 18,
    color: NU_TEXT,
  },
  accountMeta: {
    fontFamily: NU_FONT_REGULAR,
    fontSize: 13,
    color: NU_TEXT_SECONDARY,
  },
  label: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_TERTIARY,
  },
  inlineInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inlineInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: NU_SURFACES.high,
    paddingHorizontal: 14,
    color: NU_TEXT,
    fontFamily: NU_FONT_SEMIBOLD,
    fontSize: 15,
  },
  inlineButton: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineButtonLabel: {
    fontFamily: NU_FONT_BOLD,
    fontSize: 12,
    color: NU_ACCENT_DARK,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  segmentedRow: {
    gap: 10,
  },
  segmentedLabel: {
    fontFamily: NU_FONT_SEMIBOLD,
    fontSize: 14,
    color: NU_TEXT,
  },
  segmentedOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segmentedOptionsCompact: {
    gap: 6,
  },
  segmentedOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: NU_SURFACES.high,
  },
  segmentedOptionActive: {
    backgroundColor: 'rgba(201, 137, 77, 0.22)',
  },
  segmentedOptionLabel: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_TERTIARY,
  },
  segmentedOptionLabelActive: {
    color: NU_ACCENT_LIGHT,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleCopy: {
    flex: 1,
    gap: 4,
  },
  toggleTrack: {
    width: 54,
    height: 30,
    borderRadius: 999,
    backgroundColor: NU_SURFACES.high,
    padding: 3,
    justifyContent: 'center',
  },
  toggleTrackActive: {
    backgroundColor: 'rgba(201, 137, 77, 0.4)',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: NU_TEXT_SECONDARY,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
    backgroundColor: NU_ACCENT_LIGHT,
  },
  textSettingRow: {
    gap: 10,
  },
  infoBanner: {
    borderRadius: 16,
    backgroundColor: 'rgba(255, 184, 119, 0.12)',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoBannerText: {
    flex: 1,
    fontFamily: NU_FONT_REGULAR,
    fontSize: 13,
    lineHeight: 20,
    color: NU_TEXT_SECONDARY,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  linkIcon: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NU_SURFACES.high,
  },
  linkCopy: {
    flex: 1,
    gap: 4,
  },
  linkTitle: {
    fontFamily: NU_FONT_SEMIBOLD,
    fontSize: 14,
    color: NU_TEXT,
  },
  linkSubtitle: {
    fontFamily: NU_FONT_REGULAR,
    fontSize: 12,
    lineHeight: 18,
    color: NU_TEXT_SECONDARY,
  },
  actionLabel: {
    fontFamily: NU_FONT_MEDIUM,
    fontSize: 12,
    color: NU_ACCENT_LIGHT,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  statusPillSuccess: {
    backgroundColor: 'rgba(48, 209, 88, 0.14)',
  },
  statusPillMuted: {
    backgroundColor: NU_SURFACES.high,
  },
  statusPillLabel: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_TERTIARY,
  },
  statusPillLabelSuccess: {
    color: '#30D158',
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dangerTitle: {
    fontFamily: NU_FONT_SEMIBOLD,
    fontSize: 14,
    color: '#FFB4AB',
  },
  integrationList: {
    gap: 14,
  },
});
