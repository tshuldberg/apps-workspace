import { useState, useCallback, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
  TextInput,
  Pressable,
  Share,
} from 'react-native';
import { Text } from '@mylife/ui';
import { Shield, Download, Trash2, Lock } from 'lucide-react-native';
import { useDatabase } from '../../components/DatabaseProvider';
import { getSecurityPreference, upsertSecurityPreference } from '@mylife/sync';
import {
  setSetting,
  getSettings,
  getDataStats,
  exportAllData,
  exportCSV,
  deleteAllData,
  type DataStats,
  type FriendsSettingKey,
} from '@mylife/friends';

const ACCENT = '#EC4899';
const BG = '#131318';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const SURFACE = '#1B1B20';
const SURFACE_ELEVATED = '#2A292F';
const BORDER = 'rgba(255,255,255,0.06)';
const DANGER = '#FFB4AB';
const DANGER_BG = '#93000A';
const SUCCESS = '#30D158';

const NUDGE_THRESHOLDS = [14, 30, 60, 90];
const MESSAGE_TTLS = [
  { label: '24h', seconds: 24 * 60 * 60 },
  { label: '7d', seconds: 7 * 24 * 60 * 60 },
  { label: '30d', seconds: 30 * 24 * 60 * 60 },
] as const;
const DEFAULT_MESSAGE_TTL_SECONDS = 7 * 24 * 60 * 60;

export default function FriendsSettingsScreen() {
  const db = useDatabase();
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [directEncryptionRequired, setDirectEncryptionRequired] = useState(false);
  const [disappearingMessagesEnabled, setDisappearingMessagesEnabled] = useState(false);
  const [disappearAfterSeconds, setDisappearAfterSeconds] = useState<number>(
    DEFAULT_MESSAGE_TTL_SECONDS,
  );
  const [nudgeEnabled, setNudgeEnabled] = useState(true);
  const [driftEnabled, setDriftEnabled] = useState(true);
  const [defaultNudgeDays, setDefaultNudgeDays] = useState(30);
  const [effortBalanceVisible, setEffortBalanceVisible] = useState(false);
  const [stats, setStats] = useState<DataStats | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showDeleteInput, setShowDeleteInput] = useState(false);

  // Load settings on mount
  useEffect(() => {
    const all = getSettings(db);
    setBiometricEnabled(all.biometric_lock_enabled === 'true');
    setNudgeEnabled(all.nudge_enabled !== 'false');
    setDriftEnabled(all.drift_detection_enabled !== 'false');
    setDefaultNudgeDays(Number(all.default_nudge_days) || 30);
    setEffortBalanceVisible(all.effort_balance_visible === 'true');
    setStats(getDataStats(db));

    const directPref = getSecurityPreference(db, 'direct', 'default');
    if (directPref) {
      setDirectEncryptionRequired(directPref.encryptionMode === 'required');
      setDisappearingMessagesEnabled(directPref.disappearingMessagesEnabled);
      if (directPref.disappearAfterSeconds) {
        setDisappearAfterSeconds(directPref.disappearAfterSeconds);
      }
    }
  }, [db]);

  const updateSetting = useCallback(
    (key: FriendsSettingKey, value: string) => {
      setSetting(db, key, value);
    },
    [db],
  );

  const toggleBiometric = useCallback(
    (value: boolean) => {
      setBiometricEnabled(value);
      updateSetting('biometric_lock_enabled', String(value));
    },
    [updateSetting],
  );

  const updateDirectSecurity = useCallback(
    (next: {
      encryptionRequired?: boolean;
      disappearingEnabled?: boolean;
      disappearSeconds?: number;
    }) => {
      const encryptionRequired = next.encryptionRequired ?? directEncryptionRequired;
      const disappearingEnabled = next.disappearingEnabled ?? disappearingMessagesEnabled;
      const disappearSeconds = next.disappearSeconds ?? disappearAfterSeconds;
      upsertSecurityPreference(db, {
        subjectType: 'direct',
        subjectId: 'default',
        encryptionMode: encryptionRequired ? 'required' : 'opportunistic',
        disappearingMessagesEnabled: disappearingEnabled,
        disappearAfterSeconds: disappearingEnabled ? disappearSeconds : null,
        updatedAt: new Date().toISOString(),
      });
    },
    [db, directEncryptionRequired, disappearingMessagesEnabled, disappearAfterSeconds],
  );

  const toggleDirectEncryption = useCallback(
    (value: boolean) => {
      setDirectEncryptionRequired(value);
      updateDirectSecurity({ encryptionRequired: value });
    },
    [updateDirectSecurity],
  );

  const toggleDisappearingMessages = useCallback(
    (value: boolean) => {
      setDisappearingMessagesEnabled(value);
      updateDirectSecurity({ disappearingEnabled: value });
    },
    [updateDirectSecurity],
  );

  const selectDisappearAfter = useCallback(
    (seconds: number) => {
      setDisappearAfterSeconds(seconds);
      updateDirectSecurity({ disappearSeconds: seconds });
    },
    [updateDirectSecurity],
  );

  const toggleNudge = useCallback(
    (value: boolean) => {
      setNudgeEnabled(value);
      updateSetting('nudge_enabled', String(value));
    },
    [updateSetting],
  );

  const toggleDrift = useCallback(
    (value: boolean) => {
      setDriftEnabled(value);
      updateSetting('drift_detection_enabled', String(value));
    },
    [updateSetting],
  );

  const toggleEffortBalance = useCallback(
    (value: boolean) => {
      setEffortBalanceVisible(value);
      updateSetting('effort_balance_visible', String(value));
    },
    [updateSetting],
  );

  const selectNudgeDays = useCallback(
    (days: number) => {
      setDefaultNudgeDays(days);
      updateSetting('default_nudge_days', String(days));
    },
    [updateSetting],
  );

  const handleExportJSON = useCallback(() => {
    Alert.alert(
      'Export All Data',
      stats
        ? `This will export ${stats.people} people, ${stats.hangouts} hangouts, ${stats.memories} memories, and all other data as JSON.`
        : 'Export all your friends data as JSON.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export',
          onPress: async () => {
            const data = exportAllData(db);
            const json = JSON.stringify(data, null, 2);
            await Share.share({
              message: json,
              title: 'MyFriends Backup',
            });
          },
        },
      ],
    );
  }, [db, stats]);

  const handleExportCSV = useCallback(() => {
    const tables = [
      { label: 'People', table: 'fn_people' },
      { label: 'Circles', table: 'fn_circles' },
      { label: 'Hangouts', table: 'fn_hangouts' },
      { label: 'Gifts', table: 'fn_gifts' },
      { label: 'Gift Ideas', table: 'fn_gift_ideas' },
      { label: 'Memories', table: 'fn_memories' },
      { label: 'Life Events', table: 'fn_life_events' },
    ];

    Alert.alert(
      'Export CSV',
      'Choose a table to export:',
      [
        ...tables.map((t) => ({
          text: t.label,
          onPress: async () => {
            const csv = exportCSV(db, t.table);
            if (!csv) {
              Alert.alert('Empty', `No data in ${t.label}.`);
              return;
            }
            await Share.share({
              message: csv,
              title: `MyFriends - ${t.label}.csv`,
            });
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }, [db]);

  const handleDeleteAll = useCallback(() => {
    if (deleteConfirmText !== 'DELETE') {
      Alert.alert('Confirmation Required', 'Type DELETE to confirm.');
      return;
    }
    Alert.alert(
      'Delete All Data',
      'This will permanently erase all your MyFriends data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: () => {
            deleteAllData(db);
            setStats(getDataStats(db));
            setDeleteConfirmText('');
            setShowDeleteInput(false);
            Alert.alert('Done', 'All MyFriends data has been deleted.');
          },
        },
      ],
    );
  }, [db, deleteConfirmText]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Privacy Badge */}
      <View style={styles.privacyBadge}>
        <Lock size={16} color={SUCCESS} strokeWidth={2} />
        <Text style={styles.privacyBadgeText}>
          Device-only. Zero cloud. Zero tracking.
        </Text>
      </View>

      {/* Privacy & Security */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Shield size={20} color={ACCENT} strokeWidth={1.5} />
          <Text style={styles.sectionTitle}>Privacy & Security</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Biometric Lock</Text>
              <Text style={styles.settingDescription}>
                Require Face ID or Fingerprint to open MyFriends
              </Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={toggleBiometric}
              trackColor={{ false: SURFACE_ELEVATED, true: ACCENT }}
              thumbColor={TEXT_PRIMARY}
            />
          </View>
          <Text style={styles.privacyNote}>
            This is the most private module. Your data never leaves this device.
          </Text>
        </View>

        <View style={[styles.card, styles.securityCard]}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Require Contact Encryption</Text>
              <Text style={styles.settingDescription}>
                Both sides confirm before direct contact sync.
              </Text>
            </View>
            <Switch
              value={directEncryptionRequired}
              onValueChange={toggleDirectEncryption}
              trackColor={{ false: SURFACE_ELEVATED, true: ACCENT }}
              thumbColor={TEXT_PRIMARY}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Disappearing Messages</Text>
              <Text style={styles.settingDescription}>
                Applies when the other side confirms.
              </Text>
            </View>
            <Switch
              value={disappearingMessagesEnabled}
              onValueChange={toggleDisappearingMessages}
              trackColor={{ false: SURFACE_ELEVATED, true: ACCENT }}
              thumbColor={TEXT_PRIMARY}
            />
          </View>

          {disappearingMessagesEnabled ? (
            <View style={styles.daysRow}>
              {MESSAGE_TTLS.map((option) => (
                <Pressable
                  key={option.seconds}
                  style={[
                    styles.dayChip,
                    disappearAfterSeconds === option.seconds && styles.dayChipActive,
                  ]}
                  onPress={() => selectDisappearAfter(option.seconds)}
                >
                  <Text
                    style={[
                      styles.dayChipText,
                      disappearAfterSeconds === option.seconds && styles.dayChipTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      {/* Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>

        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Nudge Reminders</Text>
              <Text style={styles.settingDescription}>
                Gentle reminders to reach out to friends
              </Text>
            </View>
            <Switch
              value={nudgeEnabled}
              onValueChange={toggleNudge}
              trackColor={{ false: SURFACE_ELEVATED, true: ACCENT }}
              thumbColor={TEXT_PRIMARY}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Drift Detection</Text>
              <Text style={styles.settingDescription}>
                Alert when you are losing touch with someone
              </Text>
            </View>
            <Switch
              value={driftEnabled}
              onValueChange={toggleDrift}
              trackColor={{ false: SURFACE_ELEVATED, true: ACCENT }}
              thumbColor={TEXT_PRIMARY}
            />
          </View>

          <View style={styles.divider} />

          <Text style={styles.settingLabel}>Default Nudge Threshold</Text>
          <Text style={styles.settingDescription}>
            Days before a nudge reminder fires
          </Text>
          <View style={styles.daysRow}>
            {NUDGE_THRESHOLDS.map((days) => (
              <Pressable
                key={days}
                style={[
                  styles.dayChip,
                  defaultNudgeDays === days && styles.dayChipActive,
                ]}
                onPress={() => selectNudgeDays(days)}
              >
                <Text
                  style={[
                    styles.dayChipText,
                    defaultNudgeDays === days && styles.dayChipTextActive,
                  ]}
                >
                  {days}d
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* Insights */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Insights</Text>

        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Effort Balance</Text>
              <Text style={styles.settingDescription}>
                Show who initiates vs who responds in relationships
              </Text>
            </View>
            <Switch
              value={effortBalanceVisible}
              onValueChange={toggleEffortBalance}
              trackColor={{ false: SURFACE_ELEVATED, true: ACCENT }}
              thumbColor={TEXT_PRIMARY}
            />
          </View>
        </View>
      </View>

      {/* Data */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data</Text>

        <View style={styles.card}>
          {stats && (
            <View style={styles.statsGrid}>
              <StatItem label="People" count={stats.people} />
              <StatItem label="Circles" count={stats.circles} />
              <StatItem label="Hangouts" count={stats.hangouts} />
              <StatItem label="Gifts" count={stats.gifts} />
              <StatItem label="Ideas" count={stats.giftIdeas} />
              <StatItem label="Memories" count={stats.memories} />
              <StatItem label="Events" count={stats.lifeEvents} />
              <StatItem label="Nudges" count={stats.nudges} />
              <StatItem label="Photos" count={stats.photos} />
            </View>
          )}

          <View style={styles.divider} />

          <Pressable style={styles.exportButton} onPress={handleExportJSON}>
            <Download size={18} color={TEXT_PRIMARY} strokeWidth={1.5} />
            <Text style={styles.exportButtonText}>Export as JSON</Text>
          </Pressable>

          <Pressable style={styles.exportButton} onPress={handleExportCSV}>
            <Download size={18} color={TEXT_PRIMARY} strokeWidth={1.5} />
            <Text style={styles.exportButtonText}>Export as CSV</Text>
          </Pressable>
        </View>
      </View>

      {/* Danger Zone */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: DANGER }]}>
          Danger Zone
        </Text>

        <View style={[styles.card, styles.dangerCard]}>
          <View style={styles.dangerHeader}>
            <Trash2 size={18} color={DANGER} strokeWidth={1.5} />
            <Text style={styles.dangerTitle}>Delete All MyFriends Data</Text>
          </View>
          <Text style={styles.dangerDescription}>
            Permanently removes all people, hangouts, memories, gifts, and
            settings. This cannot be undone.
          </Text>

          {showDeleteInput ? (
            <View style={styles.deleteConfirmRow}>
              <TextInput
                style={styles.deleteInput}
                value={deleteConfirmText}
                onChangeText={setDeleteConfirmText}
                placeholder="Type DELETE to confirm"
                placeholderTextColor={TEXT_SECONDARY}
                autoCapitalize="characters"
              />
              <Pressable
                style={[
                  styles.deleteButton,
                  deleteConfirmText !== 'DELETE' && styles.deleteButtonDisabled,
                ]}
                onPress={handleDeleteAll}
                disabled={deleteConfirmText !== 'DELETE'}
              >
                <Text style={styles.deleteButtonText}>Confirm</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={styles.dangerTrigger}
              onPress={() => setShowDeleteInput(true)}
            >
              <Text style={styles.dangerTriggerText}>
                Delete all data...
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.footer} />
    </ScrollView>
  );
}

function StatItem({ label, count }: { label: string; count: number }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statCount}>{count}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(48, 209, 88, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(48, 209, 88, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 24,
  },
  privacyBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: SUCCESS,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 12,
  },
  card: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
  },
  securityCard: {
    marginTop: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    lineHeight: 18,
  },
  privacyNote: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    fontStyle: 'italic',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 14,
  },
  daysRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  dayChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: SURFACE_ELEVATED,
    borderWidth: 1,
    borderColor: BORDER,
  },
  dayChipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  dayChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  dayChipTextActive: {
    color: '#FFFFFF',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statItem: {
    alignItems: 'center',
    minWidth: 60,
  },
  statCount: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  statLabel: {
    fontSize: 11,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: SURFACE_ELEVATED,
    marginTop: 10,
  },
  exportButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  dangerCard: {
    borderColor: 'rgba(255, 180, 171, 0.2)',
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dangerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: DANGER,
  },
  dangerDescription: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    lineHeight: 18,
    marginBottom: 16,
  },
  deleteConfirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deleteInput: {
    flex: 1,
    backgroundColor: BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: TEXT_PRIMARY,
  },
  deleteButton: {
    backgroundColor: DANGER_BG,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  deleteButtonDisabled: {
    opacity: 0.4,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: DANGER,
  },
  dangerTrigger: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(147, 0, 10, 0.2)',
    alignSelf: 'flex-start',
  },
  dangerTriggerText: {
    fontSize: 14,
    fontWeight: '600',
    color: DANGER,
  },
  footer: {
    height: 40,
  },
});
