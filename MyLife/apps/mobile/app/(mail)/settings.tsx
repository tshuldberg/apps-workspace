import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  getAccounts,
  getSyncStates,
  getContacts,
  getFilters,
  getNotificationPreferences,
  getEncryptionKeys,
  getMailStats,
  getMessages,
  deleteMessage,
} from '@mylife/mail';
import type { MailAccount, SyncState } from '@mylife/mail';
import { Text, colors, spacing, glass } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.mail;

export default function SettingsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [syncStates, setSyncStates] = useState<SyncState[]>([]);
  const [contactCount, setContactCount] = useState(0);
  const [filterCount, setFilterCount] = useState(0);
  const [keyCount, setKeyCount] = useState(0);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [trashCount, setTrashCount] = useState(0);
  const [spamCount, setSpamCount] = useState(0);

  const loadData = useCallback(() => {
    try {
      const accts = getAccounts(db);
      setAccounts(accts);

      const allSync: SyncState[] = [];
      let contacts = 0;
      let filters = 0;
      let keys = 0;
      let anyNotifEnabled = false;
      for (const a of accts) {
        allSync.push(...getSyncStates(db, a.id));
        contacts += getContacts(db, a.id).length;
        filters += getFilters(db, a.id).filter((f) => f.isActive).length;
        keys += getEncryptionKeys(db, a.id).length;
        try {
          const prefs = getNotificationPreferences(db, a.id);
          if (prefs?.enabled) anyNotifEnabled = true;
        } catch { /* ignored */ }
      }
      setSyncStates(allSync);
      setContactCount(contacts);
      setFilterCount(filters);
      setKeyCount(keys);
      setNotifEnabled(anyNotifEnabled);

      const stats = getMailStats(db);
      const trash = stats.byFolder.find((f) => f.folder === 'Trash');
      const spam = stats.byFolder.find((f) => f.folder === 'Spam');
      setTrashCount(trash?.total ?? 0);
      setSpamCount(spam?.total ?? 0);
    } catch { /* ignored */ } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => { loadData(); }, [loadData]);

  const clearFolder = useCallback((folder: string) => {
    Alert.alert(
      `Clear ${folder}`,
      `Delete all messages in ${folder}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: () => {
            try {
              const msgs = getMessages(db, { folder, limit: 500 });
              for (const m of msgs) deleteMessage(db, m.id);
              loadData();
            } catch { /* ignored */ }
          },
        },
      ],
    );
  }, [db, loadData]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={ACCENT} size="large" />
      </View>
    );
  }

  const allSynced = syncStates.every((s) => s.status === 'idle');
  const hasSyncError = syncStates.some((s) => s.status === 'error');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Sync Status */}
      <View style={[styles.syncCard, glass.strong]}>
        <Text variant="subheading" color={colors.text}>
          {hasSyncError ? 'Sync Error' : allSynced ? 'All Synced' : 'Syncing...'}
        </Text>
        {accounts.map((a) => {
          const acctSync = syncStates.filter((s) => s.accountId === a.id);
          const lastSync = acctSync.find((s) => s.lastSyncAt)?.lastSyncAt;
          const hasError = acctSync.some((s) => s.status === 'error');
          return (
            <View key={a.id} style={styles.syncRow}>
              <View style={[styles.accountDot, { backgroundColor: ACCENT }]} />
              <Text variant="body" color={colors.text} style={styles.syncEmail}>{a.email}</Text>
              <Text
                variant="caption"
                color={hasError ? colors.danger : colors.success}
              >
                {hasError ? 'Error' : lastSync ? 'Synced' : 'Pending'}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Accounts */}
      <SettingsRow
        label="Accounts"
        value={`${accounts.length} account${accounts.length !== 1 ? 's' : ''}`}
        onPress={() => router.push('/(mail)/accounts/')}
      />

      {/* Mail Settings */}
      <View style={styles.sectionHeader}>
        <Text variant="label" color={colors.textTertiary}>Mail Settings</Text>
      </View>
      <SettingsRow
        label="Contacts"
        value={`${contactCount}`}
        onPress={() => router.push('/(mail)/contacts/')}
      />
      <SettingsRow
        label="Filters"
        value={`${filterCount} active`}
        onPress={() => router.push('/(mail)/filters/')}
      />
      <SettingsRow
        label="Calendar Events"
        onPress={() => router.push('/(mail)/calendar-events')}
      />

      {/* Notifications */}
      <View style={styles.sectionHeader}>
        <Text variant="label" color={colors.textTertiary}>Notifications</Text>
      </View>
      <SettingsRow
        label="Notification Preferences"
        value={notifEnabled ? 'On' : 'Off'}
        onPress={() => router.push('/(mail)/notifications')}
      />

      {/* Security */}
      <View style={styles.sectionHeader}>
        <Text variant="label" color={colors.textTertiary}>Security</Text>
      </View>
      <SettingsRow
        label="Encryption (PGP)"
        value={keyCount > 0 ? `${keyCount} key${keyCount !== 1 ? 's' : ''}` : 'Not configured'}
        onPress={() => router.push('/(mail)/encryption/')}
      />

      {/* Data */}
      <View style={styles.sectionHeader}>
        <Text variant="label" color={colors.textTertiary}>Data</Text>
      </View>
      <SettingsRow
        label="Clear Trash"
        value={`${trashCount} messages`}
        onPress={() => trashCount > 0 && clearFolder('Trash')}
        destructive
      />
      <SettingsRow
        label="Clear Spam"
        value={`${spamCount} messages`}
        onPress={() => spamCount > 0 && clearFolder('Spam')}
        destructive
      />
    </ScrollView>
  );
}

function SettingsRow({
  label,
  value,
  onPress,
  destructive,
}: {
  label: string;
  value?: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable style={styles.settingsRow} onPress={onPress}>
      <Text variant="body" color={destructive ? colors.danger : colors.text}>{label}</Text>
      <View style={styles.settingsRight}>
        {value && (
          <Text variant="caption" color={colors.textSecondary}>{value}</Text>
        )}
        <Text variant="caption" color={colors.textTertiary}> ›</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl },
  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.background,
  },
  syncCard: { margin: spacing.md, padding: spacing.lg, gap: spacing.sm },
  syncRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
  },
  accountDot: { width: 8, height: 8, borderRadius: 4 },
  syncEmail: { flex: 1 },
  sectionHeader: {
    paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.xs,
  },
  settingsRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    minHeight: 48,
  },
  settingsRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
