import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, ChevronRight, Download, Lock, Sparkles, Trash2 } from 'lucide-react-native';
import {
  getSetting,
  setSetting,
  getMoodEntryCount,
  getBreathingSessions,
  getLockConfig,
  getPet,
  EVOLUTION_NAMES,
  GlassCard,
  SectionHeader,
  MOOD_ACCENT,
  MOOD_SURFACES,
  MOOD_TYPOGRAPHY,
} from '@mylife/mood';
import { colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

export default function MoodSettingsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);

  const entryCount = useMemo(() => getMoodEntryCount(db), [db, tick]);
  const breathingSessions = useMemo(() => getBreathingSessions(db, 1000), [db, tick]);
  const lockConfig = useMemo(() => getLockConfig(db), [db, tick]);
  const pet = useMemo(() => getPet(db), [db, tick]);

  const appLockEnabled = lockConfig?.isEnabled ?? false;
  const hideFromSwitcher = getSetting(db, 'hide_from_switcher') === 'true';

  const toggleHideFromSwitcher = useCallback(
    (value: boolean) => {
      setSetting(db, 'hide_from_switcher', value ? 'true' : 'false');
      setTick((t) => t + 1);
    },
    [db],
  );

  const handleExportData = useCallback(() => {
    Alert.alert(
      'Export Data',
      `Your mood data includes ${entryCount} entries and ${breathingSessions.length} breathing sessions. Export functionality coming soon.`,
      [{ text: 'OK' }],
    );
  }, [entryCount, breathingSessions.length]);

  const handleClearData = useCallback(() => {
    Alert.alert(
      'Clear All Data',
      'Bulk data clearing is not available yet. To remove entries individually, edit them from the History tab.',
      [{ text: 'OK' }],
    );
  }, []);

  const petLevel = pet ? (pet.experience ?? 0) : 0;
  const petEvolution = pet ? (EVOLUTION_NAMES[pet.evolutionStage] ?? 'Companion') : 'Companion';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Fine-tune your library and digital sanctuary.</Text>
      </View>

      {/* Companion */}
      <SectionHeader label="COMPANION" title="" />
      <View style={styles.section}>
        <GlassCard level={2} onPress={() => router.push('/(mood)/pet')}>
          <View style={styles.companionRow}>
            <View style={styles.companionAvatar}>
              <Text style={styles.companionEmoji}>{'\uD83E\uDD89'}</Text>
            </View>
            <View style={styles.companionInfo}>
              <Text style={styles.companionName}>{pet?.name ?? 'Luna'}</Text>
              <Text style={styles.companionLevel}>
                Level {Math.floor(petLevel / 100) + 1} {'\u2022'} {petEvolution}
              </Text>
            </View>
            <Pressable style={styles.interactPill} onPress={() => router.push('/(mood)/pet')}>
              <Text style={styles.interactText}>INTERACT</Text>
            </Pressable>
          </View>
        </GlassCard>
      </View>

      {/* Notifications */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Bell size={18} color={MOOD_ACCENT} strokeWidth={2} />
          <Text style={styles.sectionTitle}>Notifications</Text>
        </View>
        <GlassCard level={2}>
          <View style={styles.notifRow}>
            <Text style={styles.notifLabel}>Morning Check-in</Text>
            <Text style={styles.notifTime}>9:00 AM</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.notifRow}>
            <Text style={styles.notifLabel}>Evening Review</Text>
            <Text style={styles.notifTime}>9:00 PM</Text>
          </View>
        </GlassCard>
      </View>

      {/* Privacy */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Lock size={18} color={MOOD_ACCENT} strokeWidth={2} />
          <Text style={styles.sectionTitle}>Privacy</Text>
        </View>
        <GlassCard level={2}>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>App Lock</Text>
            <Switch
              value={appLockEnabled}
              onValueChange={() => router.push('/(mood)/lock-settings')}
              trackColor={{ false: MOOD_SURFACES.highest, true: MOOD_ACCENT }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Hide from Switcher</Text>
            <Switch
              value={hideFromSwitcher}
              onValueChange={toggleHideFromSwitcher}
              trackColor={{ false: MOOD_SURFACES.highest, true: MOOD_ACCENT }}
              thumbColor="#FFFFFF"
            />
          </View>
        </GlassCard>
      </View>

      {/* Manage Content */}
      <SectionHeader label="MANAGE CONTENT" title="" />
      <View style={styles.section}>
        <GlassCard level={2}>
          <Pressable
            style={styles.menuRow}
            onPress={() => {
              // Activities management - navigate to activity settings
              Alert.alert('Activities', 'Activity management coming soon.');
            }}
          >
            <Sparkles size={18} color={colors.textSecondary} strokeWidth={1.5} />
            <Text style={styles.menuLabel}>Activities management</Text>
            <ChevronRight size={16} color={colors.textSecondary} strokeWidth={1.5} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.menuRow} onPress={handleExportData}>
            <Download size={18} color={colors.textSecondary} strokeWidth={1.5} />
            <Text style={styles.menuLabel}>Export Data (CSV)</Text>
            <ChevronRight size={16} color={colors.textSecondary} strokeWidth={1.5} />
          </Pressable>
        </GlassCard>
      </View>

      {/* Danger Zone */}
      <View style={styles.dangerSection}>
        <Pressable style={styles.dangerButton} onPress={handleClearData}>
          <Trash2 size={18} color="#FFFFFF" strokeWidth={2} />
          <Text style={styles.dangerButtonText}>Clear All Data</Text>
        </Pressable>
        <Text style={styles.dangerWarning}>
          PERMANENT ACTION {'\u2022'} CANNOT BE UNDONE
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MOOD_SURFACES.base },
  content: { paddingBottom: 100 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    ...MOOD_TYPOGRAPHY.displayLg,
    color: colors.text,
  },
  subtitle: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    color: MOOD_ACCENT,
  },
  // Companion
  companionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  companionAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: MOOD_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(82, 68, 58, 0.3)',
  },
  companionEmoji: {
    fontSize: 32,
  },
  companionInfo: {
    flex: 1,
    gap: 2,
  },
  companionName: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  companionLevel: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
  },
  interactPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: MOOD_SURFACES.highest,
    borderWidth: 1,
    borderColor: 'rgba(82, 68, 58, 0.2)',
  },
  interactText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    color: colors.text,
  },
  // Notifications
  notifRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  notifLabel: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.text,
  },
  notifTime: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: MOOD_ACCENT,
    fontFamily: MOOD_TYPOGRAPHY.headlineMd.fontFamily,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  // Privacy
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  toggleLabel: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.text,
  },
  // Manage Content
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  menuLabel: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.text,
    flex: 1,
  },
  // Danger
  dangerSection: {
    paddingHorizontal: 20,
    marginTop: 8,
    alignItems: 'center',
    gap: 10,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#93000A',
  },
  dangerButtonText: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: '#FFB4AB',
  },
  dangerWarning: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    color: '#FFB4AB',
    opacity: 0.7,
  },
});
