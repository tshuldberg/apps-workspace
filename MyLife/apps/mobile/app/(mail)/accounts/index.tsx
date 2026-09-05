import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  getAccounts,
  updateAccount,
  deleteAccount,
  getSyncStates,
  getMailStats,
} from '@mylife/mail';
import type { MailAccount, SyncState } from '@mylife/mail';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';

const ACCENT = colors.modules.mail;

export default function AccountsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [syncStates, setSyncStates] = useState<Record<string, SyncState[]>>({});
  const [accountStats, setAccountStats] = useState<Record<string, { unread: number; total: number; starred: number }>>({});

  const loadData = useCallback(() => {
    try {
      const accts = getAccounts(db);
      setAccounts(accts);
      const ss: Record<string, SyncState[]> = {};
      const stats: Record<string, { unread: number; total: number; starred: number }> = {};
      for (const a of accts) {
        ss[a.id] = getSyncStates(db, a.id);
        try {
          const s = getMailStats(db, a.id);
          stats[a.id] = { unread: s.unreadCount, total: s.totalMessages, starred: s.starredCount };
        } catch {
          stats[a.id] = { unread: 0, total: 0, starred: 0 };
        }
      }
      setSyncStates(ss);
      setAccountStats(stats);
    } catch { /* ignored */ } finally { setLoading(false); }
  }, [db]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleToggleActive = useCallback((accountId: string, isActive: boolean) => {
    try { updateAccount(db, accountId, { isActive }); loadData(); } catch { /* ignored */ }
  }, [db, loadData]);

  const handleDelete = useCallback((account: MailAccount) => {
    Alert.alert(
      'Delete Account',
      `Remove ${account.email}? This deletes all messages for this account.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => { deleteAccount(db, account.id); loadData(); },
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

  if (accounts.length === 0) {
    return (
      <View style={styles.centered}>
        <Text variant="heading">📧</Text>
        <Text variant="subheading" style={styles.emptyTitle}>No accounts</Text>
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: ACCENT }]}
          onPress={() => router.push('/(mail)/accounts/add')}
        >
          <Text variant="caption" color="#fff">Add Account</Text>
        </Pressable>
      </View>
    );
  }

  const totalUnread = Object.values(accountStats).reduce((s, a) => s + a.unread, 0);
  const totalMessages = Object.values(accountStats).reduce((s, a) => s + a.total, 0);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Combined stats */}
        {accounts.length > 1 && (
          <View style={styles.combinedStats}>
            <View style={styles.statItem}>
              <Text variant="heading" color={ACCENT}>{totalUnread}</Text>
              <Text variant="caption" color={colors.textSecondary}>Unread</Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="heading" color={colors.text}>{totalMessages}</Text>
              <Text variant="caption" color={colors.textSecondary}>Total</Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="heading" color={colors.text}>{accounts.length}</Text>
              <Text variant="caption" color={colors.textSecondary}>Accounts</Text>
            </View>
          </View>
        )}

        {accounts.map((a) => {
          const ss = syncStates[a.id] ?? [];
          const hasError = ss.some((s) => s.status === 'error');
          const stats = accountStats[a.id] ?? { unread: 0, total: 0, starred: 0 };

          return (
            <Pressable
              key={a.id}
              style={styles.accountRow}
              onPress={() => router.push({ pathname: '/(mail)/accounts/add', params: { id: a.id } })}
            >
              <View style={[styles.accountDot, { backgroundColor: ACCENT }]} />
              <View style={styles.accountInfo}>
                <Text variant="subheading" color={colors.text}>{a.email}</Text>
                <Text variant="body" color={colors.textSecondary}>{a.displayName}</Text>
                <View style={styles.accountMetaRow}>
                  <Text
                    variant="caption"
                    color={hasError ? colors.danger : colors.success}
                  >
                    {hasError ? 'Sync Error' : 'Connected'}
                  </Text>
                  {stats.unread > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text variant="caption" color="#fff" style={{ fontSize: 10 }}>{stats.unread}</Text>
                    </View>
                  )}
                  <Text variant="caption" color={colors.textTertiary}>
                    {stats.total} msg{stats.total !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
              <Switch
                value={a.isActive}
                onValueChange={(val) => handleToggleActive(a.id, val)}
                trackColor={{ true: ACCENT, false: colors.border }}
              />
              <Text variant="caption" color={colors.textTertiary}> {'\u203A'}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable
        style={[styles.fab, { backgroundColor: ACCENT }]}
        onPress={() => router.push('/(mail)/accounts/add')}
      >
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl },
  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md,
  },
  emptyTitle: { marginTop: spacing.md },
  primaryBtn: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 8,
  },
  accountRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  combinedStats: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  statItem: { alignItems: 'center', gap: 2 },
  accountDot: { width: 8, height: 8, borderRadius: 4 },
  accountInfo: { flex: 1, gap: 2 },
  accountMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  unreadBadge: {
    backgroundColor: ACCENT, borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 1, minWidth: 18, alignItems: 'center',
  },
  fab: {
    position: 'absolute', bottom: spacing.lg, right: spacing.lg,
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  fabIcon: { color: '#fff', fontSize: 28, fontWeight: '300', marginTop: -2 },
});
