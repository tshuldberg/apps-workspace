import { useCallback, useMemo, useState, type ReactNode } from 'react';
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
import {
  GlassCard,
  MaterialSymbol,
  getBirthProfiles,
  withAlpha,
  ST_ACCENT,
  ST_ACCENT_LIGHT,
  ST_FONTS,
  ST_SURFACES,
  ST_TEXT,
  ST_TEXT_SECONDARY,
  ST_TEXT_TERTIARY,
} from '@mylife/stars';
import { useDatabase } from '../../../components/DatabaseProvider';

const FEATURE_ITEMS = [
  { label: 'Birth Chart', route: '/(stars)/birth-chart', icon: 'psychology' },
  { label: 'Compatibility', route: '/(stars)/compatibility', icon: 'favorite' },
  { label: 'Moon Calendar', route: '/(stars)/moon-calendar', icon: 'dark_mode' },
  { label: 'Retrogrades', route: '/(stars)/retrograde-dashboard', icon: 'warning' },
  { label: 'Zodiac Events', route: '/(stars)/zodiac-events', icon: 'auto_awesome' },
  { label: 'Transit Calendar', route: '/(stars)/transit-calendar', icon: 'calendar_today' },
  { label: 'Solar Return', route: '/(stars)/solar-return', icon: 'sunny' },
  { label: 'Progressions', route: '/(stars)/progressions', icon: 'flare' },
  { label: 'Tarot', route: '/(stars)/tarot-card', icon: 'style' },
  { label: 'Readings History', route: '/(stars)/readings-history', icon: 'history' },
  { label: 'Friends', route: '/(stars)/friends', icon: 'people' },
] as const;

type ExpandKey = 'profiles' | 'preferences' | 'notifications' | 'appearance' | 'data';

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function StarsSettingsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [expanded, setExpanded] = useState<Record<ExpandKey, boolean>>({
    profiles: true,
    preferences: true,
    notifications: true,
    appearance: false,
    data: false,
  });
  const [houseSystem, setHouseSystem] = useState<'Placidus' | 'Whole Sign' | 'Koch'>('Placidus');
  const [zodiacType, setZodiacType] = useState<'Tropical' | 'Sidereal'>('Tropical');
  const [orbTolerance, setOrbTolerance] = useState<'Tight' | 'Moderate' | 'Wide'>('Moderate');
  const [dailyReminder, setDailyReminder] = useState(true);
  const [moonAlerts, setMoonAlerts] = useState(true);
  const [retrogradeAlerts, setRetrogradeAlerts] = useState(false);
  const [majorTransitAlerts, setMajorTransitAlerts] = useState(false);
  const [westernSymbols, setWesternSymbols] = useState(true);
  const [showDegreePrecision, setShowDegreePrecision] = useState(true);
  const refresh = useCallback(() => setRefreshSeed((value) => value + 1), []);

  const profiles = useMemo(() => getBirthProfiles(db), [db, refreshSeed]);
  const primaryProfile = profiles[0] ?? null;

  const toggleSection = useCallback((key: ExpandKey) => {
    setExpanded((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }, []);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={refresh}
          tintColor={ST_ACCENT_LIGHT}
        />
      }
    >
      <GlassCard variant="high" style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{primaryProfile?.name?.slice(0, 1) ?? '✦'}</Text>
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.profileName}>{primaryProfile?.name ?? 'Your chart is waiting'}</Text>
            <Text style={styles.profileMeta}>
              {primaryProfile?.birthDate ?? 'Save birth date, time, and place to unlock full chart mapping.'}
            </Text>
          </View>
        </View>

        <View style={styles.bigThreeRow}>
          <BigThreePill label="Sun" value={primaryProfile?.sunSign ? titleCase(primaryProfile.sunSign) : 'Unknown'} />
          <BigThreePill label="Moon" value={primaryProfile?.moonSign ? titleCase(primaryProfile.moonSign) : 'Unknown'} />
          <BigThreePill label="Rising" value={primaryProfile?.risingSign ? titleCase(primaryProfile.risingSign) : 'Add time'} />
        </View>

        <Pressable
          style={styles.primaryButton}
          onPress={() =>
            primaryProfile
              ? router.push(`/(stars)/profile/${primaryProfile.id}` as never)
              : router.push('/(stars)/add-profile' as never)
          }
        >
          <Text style={styles.primaryButtonText}>
            {primaryProfile ? 'Edit Profile' : 'Add Birth Profile'}
          </Text>
        </Pressable>
      </GlassCard>

      <View style={styles.grid}>
        {FEATURE_ITEMS.map((item) => (
          <Pressable
            key={item.label}
            style={styles.gridTile}
            onPress={() => router.push(item.route as never)}
          >
            <MaterialSymbol name={item.icon} size={22} color={ST_ACCENT_LIGHT} />
            <Text style={styles.gridLabel}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <CollapsibleSection
        title="Birth Profiles"
        expanded={expanded.profiles}
        onToggle={() => toggleSection('profiles')}
      >
        {profiles.length > 0 ? (
          profiles.map((profile) => (
            <Pressable
              key={profile.id}
              style={styles.row}
              onPress={() => router.push(`/(stars)/profile/${profile.id}` as never)}
            >
              <View>
                <Text style={styles.rowLabel}>{profile.name}</Text>
                <Text style={styles.rowValue}>
                  {profile.birthDate} · {profile.sunSign ? titleCase(profile.sunSign) : 'Unknown'}
                </Text>
              </View>
              <MaterialSymbol name="chevron_right" size={18} color={ST_TEXT_TERTIARY} />
            </Pressable>
          ))
        ) : (
          <Text style={styles.sectionBody}>No birth profiles yet.</Text>
        )}
        <Pressable
          style={styles.secondaryButton}
          onPress={() => router.push('/(stars)/add-profile' as never)}
        >
          <Text style={styles.secondaryButtonText}>Add Profile</Text>
        </Pressable>
      </CollapsibleSection>

      <CollapsibleSection
        title="Preferences"
        expanded={expanded.preferences}
        onToggle={() => toggleSection('preferences')}
      >
        <PreferenceGroup
          label="House System"
          options={['Placidus', 'Whole Sign', 'Koch']}
          selected={houseSystem}
          onSelect={(value) => setHouseSystem(value as typeof houseSystem)}
        />
        <PreferenceGroup
          label="Zodiac Type"
          options={['Tropical', 'Sidereal']}
          selected={zodiacType}
          onSelect={(value) => setZodiacType(value as typeof zodiacType)}
        />
        <PreferenceGroup
          label="Aspect Orbs"
          options={['Tight', 'Moderate', 'Wide']}
          selected={orbTolerance}
          onSelect={(value) => setOrbTolerance(value as typeof orbTolerance)}
        />
        <InfoRow label="Time Zone" value="Auto-detect" />
        <InfoRow label="Location" value={primaryProfile?.birthPlace ?? 'Use profile'} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Notifications"
        expanded={expanded.notifications}
        onToggle={() => toggleSection('notifications')}
      >
        <SwitchRow label="Daily reading reminder" value={dailyReminder} onValueChange={setDailyReminder} />
        <SwitchRow label="New + full moon alerts" value={moonAlerts} onValueChange={setMoonAlerts} />
        <SwitchRow label="Retrograde start alerts" value={retrogradeAlerts} onValueChange={setRetrogradeAlerts} />
        <SwitchRow label="Major transit alerts" value={majorTransitAlerts} onValueChange={setMajorTransitAlerts} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Appearance"
        expanded={expanded.appearance}
        onToggle={() => toggleSection('appearance')}
      >
        <SwitchRow label="Use western symbols" value={westernSymbols} onValueChange={setWesternSymbols} />
        <SwitchRow label="Show degree precision" value={showDegreePrecision} onValueChange={setShowDegreePrecision} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Data"
        expanded={expanded.data}
        onToggle={() => toggleSection('data')}
      >
        <Pressable
          style={styles.row}
          onPress={() => Alert.alert('Export journal', 'Journal export will be wired in a later phase.')}
        >
          <Text style={styles.rowLabel}>Export journal</Text>
          <MaterialSymbol name="share" size={18} color={ST_TEXT_TERTIARY} />
        </Pressable>
        <Pressable
          style={styles.row}
          onPress={() => Alert.alert('Clear cache', 'Reading cache clearing will be added with persistence controls.')}
        >
          <Text style={styles.rowLabel}>Clear readings cache</Text>
          <MaterialSymbol name="delete" size={18} color={ST_TEXT_TERTIARY} />
        </Pressable>
        <Pressable
          style={styles.row}
          onPress={() => Alert.alert('Delete data', 'Destructive data deletion is intentionally gated until a dedicated flow is built.')}
        >
          <Text style={[styles.rowLabel, styles.dangerText]}>Delete account data</Text>
          <MaterialSymbol name="warning" size={18} color="#FFB4AB" />
        </Pressable>
      </CollapsibleSection>
    </ScrollView>
  );
}

function BigThreePill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.bigThreePill}>
      <Text style={styles.bigThreeLabel}>{label}</Text>
      <Text style={styles.bigThreeValue}>{value}</Text>
    </View>
  );
}

function CollapsibleSection({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <GlassCard style={styles.sectionCard}>
      <Pressable style={styles.sectionHeader} onPress={onToggle}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <MaterialSymbol
          name={expanded ? 'expand_less' : 'expand_more'}
          size={20}
          color={ST_ACCENT_LIGHT}
        />
      </Pressable>
      {expanded ? children : null}
    </GlassCard>
  );
}

function PreferenceGroup({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.preferenceGroup}>
      <Text style={styles.preferenceLabel}>{label}</Text>
      <View style={styles.preferenceOptions}>
        {options.map((option) => {
          const active = option === selected;
          return (
            <Pressable
              key={option}
              style={[styles.preferenceChip, active ? styles.preferenceChipActive : null]}
              onPress={() => onSelect(option)}
            >
              <Text style={[styles.preferenceChipText, active ? styles.preferenceChipTextActive : null]}>
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SwitchRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        trackColor={{ false: withAlpha('#FFFFFF', 0.12), true: withAlpha(ST_ACCENT, 0.5) }}
        thumbColor={value ? ST_ACCENT_LIGHT : '#B8B8C2'}
        value={value}
        onValueChange={onValueChange}
      />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ST_SURFACES.base,
  },
  content: {
    padding: 16,
    paddingBottom: 140,
    gap: 16,
  },
  profileCard: {
    gap: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(ST_ACCENT, 0.16),
  },
  avatarText: {
    fontFamily: ST_FONTS.extraBold,
    fontSize: 22,
    color: ST_ACCENT_LIGHT,
  },
  profileCopy: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    fontFamily: ST_FONTS.extraBold,
    fontSize: 26,
    lineHeight: 32,
    color: ST_TEXT,
  },
  profileMeta: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: ST_TEXT_SECONDARY,
  },
  bigThreeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  bigThreePill: {
    flex: 1,
    borderRadius: 18,
    padding: 12,
    gap: 4,
    backgroundColor: withAlpha('#FFFFFF', 0.05),
  },
  bigThreeLabel: {
    fontFamily: ST_FONTS.medium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: ST_TEXT_TERTIARY,
  },
  bigThreeValue: {
    fontFamily: ST_FONTS.bold,
    fontSize: 15,
    color: ST_TEXT,
  },
  primaryButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: ST_ACCENT_LIGHT,
  },
  primaryButtonText: {
    fontFamily: ST_FONTS.bold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#22113E',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridTile: {
    width: '31%',
    minWidth: 100,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 12,
    backgroundColor: withAlpha('#FFFFFF', 0.05),
  },
  gridLabel: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 17,
    color: ST_TEXT,
  },
  sectionCard: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 20,
    color: ST_TEXT,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: withAlpha('#FFFFFF', 0.04),
  },
  rowLabel: {
    fontFamily: ST_FONTS.medium,
    fontSize: 14,
    color: ST_TEXT,
  },
  rowValue: {
    fontFamily: ST_FONTS.regular,
    fontSize: 13,
    color: ST_TEXT_SECONDARY,
  },
  sectionBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: ST_TEXT_SECONDARY,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: withAlpha(ST_ACCENT, 0.12),
  },
  secondaryButtonText: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 12,
    color: ST_ACCENT_LIGHT,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  preferenceGroup: {
    gap: 8,
  },
  preferenceLabel: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: ST_TEXT_TERTIARY,
  },
  preferenceOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  preferenceChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: withAlpha('#FFFFFF', 0.05),
  },
  preferenceChipActive: {
    backgroundColor: ST_ACCENT_LIGHT,
  },
  preferenceChipText: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 12,
    color: ST_TEXT_SECONDARY,
  },
  preferenceChipTextActive: {
    color: '#22113E',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: withAlpha('#FFFFFF', 0.04),
  },
  dangerText: {
    color: '#FFB4AB',
  },
});
