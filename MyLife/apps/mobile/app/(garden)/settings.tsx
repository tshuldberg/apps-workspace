import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import {
  GARDEN_ACCENT,
  GARDEN_ACCENT_DIM,
  GARDEN_DANGER,
  GARDEN_GOLD,
  GARDEN_SURFACES,
  GARDEN_TYPOGRAPHY,
  GlassCard,
  SectionHeader,
  getPlantCount,
  getZones,
  getFrostConfig,
  getSetting,
  setSetting,
} from '@mylife/garden';
import { colors } from '@mylife/ui';
import {
  Activity,
  ArrowLeftRight,
  BookOpen,
  Camera,
  CalendarDays,
  ChevronRight,
  Cloud,
  Download,
  Heart,
  LayoutGrid,
  Microscope,
  Pencil,
  Repeat,
  Snowflake,
  Sun,
  Trash2,
  Wheat,
  type LucideIcon,
} from 'lucide-react-native';
import { useDatabase } from '../../components/DatabaseProvider';

type SettingsKey =
  | 'units'
  | 'temperature'
  | 'watering_reminders'
  | 'skip_rain_days'
  | 'icloud_backup';

type LinkedTool = {
  label: string;
  icon: LucideIcon;
  route: Href;
};

const LINKED_TOOLS: LinkedTool[] = [
  { label: 'Journal', icon: BookOpen, route: '/(garden)/journal' },
  { label: 'Photos Gallery', icon: Camera, route: '/(garden)/photos' },
  { label: 'Plant Diagnosis', icon: Microscope, route: '/(garden)/diagnose' },
  { label: 'Frost Dates', icon: Snowflake, route: '/(garden)/frost' },
  { label: 'Planting Calendar', icon: CalendarDays, route: '/(garden)/seasonal' },
  { label: 'Seasonal Calendar', icon: Repeat, route: '/(garden)/seasonal' },
  { label: 'Seed Library', icon: Wheat, route: '/(garden)/seeds' },
  { label: 'Wishlist', icon: Heart, route: '/(garden)/wishlist' },
  { label: 'Companion Planting', icon: ArrowLeftRight, route: '/(garden)/companions' },
  { label: 'Layout Planner', icon: LayoutGrid, route: '/(garden)/layouts' },
  { label: 'Propagation Tracker', icon: Activity, route: '/(garden)/propagations' },
  { label: 'Light Levels', icon: Sun, route: '/(garden)/light-meter' },
  { label: 'Garden Weather', icon: Cloud, route: '/(garden)/frost' },
];

const APP_VERSION = '2.4.0';

export default function SettingsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);

  const plantCount = useMemo(() => getPlantCount(db), [db, tick]);
  const zones = useMemo(() => getZones(db), [db, tick]);
  const frostConfig = useMemo(() => getFrostConfig(db), [db, tick]);

  const displayName = useMemo(
    () => getSetting(db, 'display_name') ?? 'Garden Curator',
    [db, tick],
  );
  const location = useMemo(
    () => getSetting(db, 'default_location') ?? 'Asheville, NC',
    [db, tick],
  );
  const usdaZone = frostConfig?.usdaZone ?? '7a';

  const unitsImperial = useMemo(
    () => (getSetting(db, 'units') ?? 'imperial') === 'imperial',
    [db, tick],
  );
  const tempFahrenheit = useMemo(
    () => (getSetting(db, 'temperature') ?? 'F') === 'F',
    [db, tick],
  );
  const wateringReminders = useMemo(
    () => (getSetting(db, 'watering_reminders') ?? '1') === '1',
    [db, tick],
  );
  const skipRainDays = useMemo(
    () => (getSetting(db, 'skip_rain_days') ?? '0') === '1',
    [db, tick],
  );
  const icloudBackup = useMemo(
    () => (getSetting(db, 'icloud_backup') ?? '0') === '1',
    [db, tick],
  );

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const persist = useCallback(
    (key: SettingsKey, value: string) => {
      setSetting(db, key, value);
      refresh();
    },
    [db, refresh],
  );

  const handleEditProfile = () => {
    Alert.alert(
      'Edit Profile',
      'Profile editing is coming soon. Update your display name and location from this screen in a future release.',
    );
  };

  const handleNotificationSchedule = () => {
    Alert.alert('Notification Schedule', 'Notification scheduling coming soon.');
  };

  const handleExport = () => {
    router.push('/(garden)/export');
  };

  const handleDeleteAll = () => {
    Alert.alert(
      'Delete All Garden Data',
      'This will permanently remove every plant, journal entry, harvest record, zone, and seed from your garden. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: () => {
            // TODO: wire to a bulk-delete engine method once it ships in @mylife/garden.
            Alert.alert(
              'Coming Soon',
              'Bulk delete is wired to a future release once the recovery flow ships.',
            );
          },
        },
      ],
    );
  };

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Unable to open link', url);
    });
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>MYGARDEN</Text>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>MyGarden preferences</Text>
      </View>

      {/* Profile / Location card */}
      <GlassCard level={2} style={styles.profileCard}>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {displayName.slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profileMeta}>
              {location} · Zone {usdaZone}
            </Text>
            <Text style={styles.profileSub}>
              {plantCount} {plantCount === 1 ? 'plant' : 'plants'} ·{' '}
              {zones.length} {zones.length === 1 ? 'bed' : 'beds'}
            </Text>
          </View>
          <Pressable
            onPress={handleEditProfile}
            hitSlop={12}
            style={styles.editButton}
          >
            <Pencil size={16} color={GARDEN_ACCENT} strokeWidth={2} />
          </Pressable>
        </View>
      </GlassCard>

      {/* Preferences */}
      <SectionHeader label="Settings" title="Preferences" />
      <GlassCard level={1} style={styles.listCard}>
        <SegmentRow
          title="Units"
          left="Imperial"
          right="Metric"
          isLeft={unitsImperial}
          onPress={(left) => persist('units', left ? 'imperial' : 'metric')}
        />
        <Divider />
        <SegmentRow
          title="Temperature"
          left="°F"
          right="°C"
          isLeft={tempFahrenheit}
          onPress={(left) => persist('temperature', left ? 'F' : 'C')}
        />
        <Divider />
        <Pressable
          style={styles.row}
          onPress={() => router.push('/(garden)/frost')}
        >
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Frost Zone</Text>
            <Text style={styles.rowSub}>USDA hardiness zone</Text>
          </View>
          <View style={styles.rowRight}>
            <Text style={styles.rowValue}>Zone {usdaZone}</Text>
            <ChevronRight size={18} color={colors.textSecondary} />
          </View>
        </Pressable>
        <Divider />
        <ToggleRow
          title="Watering Reminders"
          subtitle="Notify when plants need water"
          value={wateringReminders}
          onChange={(v) => persist('watering_reminders', v ? '1' : '0')}
        />
        <Divider />
        <ToggleRow
          title="Skip Rain Days"
          subtitle="Requires weather data"
          value={skipRainDays}
          onChange={(v) => persist('skip_rain_days', v ? '1' : '0')}
        />
        <Divider />
        <Pressable style={styles.row} onPress={handleNotificationSchedule}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Notification Schedule</Text>
            <Text style={styles.rowSub}>Quiet hours and digest</Text>
          </View>
          <ChevronRight size={18} color={colors.textSecondary} />
        </Pressable>
      </GlassCard>

      {/* Linked tools */}
      <SectionHeader label="Workspace" title="Garden Tools" />
      <GlassCard level={1} style={styles.listCard}>
        {LINKED_TOOLS.map((tool, idx) => {
          const Icon = tool.icon;
          return (
            <View key={tool.label}>
              <Pressable
                style={styles.row}
                onPress={() => router.push(tool.route)}
              >
                <View style={styles.toolIconBox}>
                  <Icon size={18} color={GARDEN_ACCENT} strokeWidth={1.8} />
                </View>
                <Text style={[styles.rowLabel, styles.toolLabel]}>
                  {tool.label}
                </Text>
                <ChevronRight size={18} color={colors.textSecondary} />
              </Pressable>
              {idx < LINKED_TOOLS.length - 1 && <Divider />}
            </View>
          );
        })}
      </GlassCard>

      {/* Data & Backup */}
      <SectionHeader label="Archive" title="Data" />
      <GlassCard level={1} style={styles.listCard}>
        <Pressable style={styles.row} onPress={handleExport}>
          <View style={styles.toolIconBox}>
            <Download size={18} color={GARDEN_ACCENT} strokeWidth={1.8} />
          </View>
          <Text style={[styles.rowLabel, styles.toolLabel]}>Export Data</Text>
          <ChevronRight size={18} color={colors.textSecondary} />
        </Pressable>
        <Divider />
        <ToggleRow
          title="Backup to iCloud"
          subtitle="Encrypted nightly snapshot"
          value={icloudBackup}
          onChange={(v) => persist('icloud_backup', v ? '1' : '0')}
        />
        <Divider />
        <Pressable style={styles.row} onPress={handleDeleteAll}>
          <View style={[styles.toolIconBox, styles.dangerIconBox]}>
            <Trash2 size={18} color={GARDEN_DANGER} strokeWidth={1.8} />
          </View>
          <Text style={[styles.rowLabel, styles.toolLabel, styles.dangerText]}>
            Delete All Garden Data
          </Text>
        </Pressable>
      </GlassCard>

      {/* About */}
      <SectionHeader label="System" title="About" />
      <GlassCard level={1} style={styles.listCard}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Version</Text>
          <Text style={styles.rowValue}>{APP_VERSION}</Text>
        </View>
        <Divider />
        <Pressable
          style={styles.row}
          onPress={() => openLink('https://mylife.app/privacy')}
        >
          <Text style={styles.rowLabel}>Privacy Policy</Text>
          <ChevronRight size={18} color={colors.textSecondary} />
        </Pressable>
        <Divider />
        <Pressable
          style={styles.row}
          onPress={() => openLink('https://mylife.app/terms')}
        >
          <Text style={styles.rowLabel}>Terms of Service</Text>
          <ChevronRight size={18} color={colors.textSecondary} />
        </Pressable>
      </GlassCard>

      <Text style={styles.footerText}>MyGarden Curator v{APP_VERSION}</Text>
    </ScrollView>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{title}</Text>
        {subtitle != null && <Text style={styles.rowSub}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: GARDEN_SURFACES.highest, true: GARDEN_ACCENT_DIM }}
        thumbColor={value ? GARDEN_ACCENT : '#cfcfcf'}
        ios_backgroundColor={GARDEN_SURFACES.highest}
      />
    </View>
  );
}

function SegmentRow({
  title,
  left,
  right,
  isLeft,
  onPress,
}: {
  title: string;
  left: string;
  right: string;
  isLeft: boolean;
  onPress: (left: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{title}</Text>
      </View>
      <View style={styles.segment}>
        <Pressable
          onPress={() => onPress(true)}
          style={[styles.segmentButton, isLeft && styles.segmentActive]}
        >
          <Text
            style={[
              styles.segmentText,
              isLeft && styles.segmentTextActive,
            ]}
          >
            {left}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onPress(false)}
          style={[styles.segmentButton, !isLeft && styles.segmentActive]}
        >
          <Text
            style={[
              styles.segmentText,
              !isLeft && styles.segmentTextActive,
            ]}
          >
            {right}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GARDEN_SURFACES.base,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 100,
    paddingBottom: 140,
    gap: 12,
  },
  header: {
    paddingHorizontal: 4,
    paddingBottom: 12,
    gap: 4,
  },
  headerLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    color: GARDEN_ACCENT,
  },
  headerTitle: {
    ...GARDEN_TYPOGRAPHY.displayLg,
    color: colors.text,
  },
  headerSubtitle: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  profileCard: {
    padding: 20,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: GARDEN_SURFACES.highest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    color: GARDEN_ACCENT,
  },
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  profileMeta: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  profileSub: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 1,
    color: GARDEN_GOLD,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: GARDEN_SURFACES.highest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCard: {
    padding: 0,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
  },
  rowSub: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowValue: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    marginLeft: 16,
  },
  toolIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: GARDEN_SURFACES.highest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerIconBox: {
    backgroundColor: 'rgba(255, 180, 171, 0.08)',
  },
  toolLabel: {
    flex: 1,
  },
  dangerText: {
    color: GARDEN_DANGER,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: GARDEN_SURFACES.highest,
    borderRadius: 999,
    padding: 3,
  },
  segmentButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  segmentActive: {
    backgroundColor: GARDEN_ACCENT,
  },
  segmentText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: GARDEN_SURFACES.depth,
  },
  footerText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 16,
    opacity: 0.5,
  },
});
