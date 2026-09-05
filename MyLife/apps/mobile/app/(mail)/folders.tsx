import { useCallback, useEffect, useState } from 'react';
import { uuid } from '../../lib/uuid';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  getAccounts,
  getFolders,
  getMailStats,
  getSyncStates,
  createFolder,
  SYSTEM_FOLDERS,
} from '@mylife/mail';
import type { MailAccount, MailFolder, MailStats, SyncState } from '@mylife/mail';
import { Text, colors, spacing, glass } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.mail;

const FOLDER_ICONS: Record<string, string> = {
  inbox: '📥', send: '📤', 'file-text': '📝',
  star: '⭐', trash: '🗑️', 'alert-triangle': '⚠️', folder: '📂',
};

export default function FoldersScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [folders, setFolders] = useState<Record<string, MailFolder[]>>({});
  const [stats, setStats] = useState<Record<string, MailStats>>({});
  const [syncStates, setSyncStates] = useState<Record<string, SyncState[]>>({});
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [createAccountId, setCreateAccountId] = useState<string | null>(null);

  const loadData = useCallback(() => {
    try {
      const accts = getAccounts(db);
      setAccounts(accts);
      const fMap: Record<string, MailFolder[]> = {};
      const sMap: Record<string, MailStats> = {};
      const ssMap: Record<string, SyncState[]> = {};
      for (const a of accts) {
        fMap[a.id] = getFolders(db, a.id);
        sMap[a.id] = getMailStats(db, a.id);
        ssMap[a.id] = getSyncStates(db, a.id);
      }
      if (accts.length === 0) {
        sMap['all'] = getMailStats(db);
      }
      setFolders(fMap);
      setStats(sMap);
      setSyncStates(ssMap);
    } catch { /* ignored */ } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreateFolder = useCallback(() => {
    if (!newFolderName.trim() || !createAccountId) return;
    const id = `folder_${uuid()}`;
    try {
      createFolder(db, id, { accountId: createAccountId, name: newFolderName.trim() });
      setShowCreateDialog(false);
      setNewFolderName('');
      loadData();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create folder');
    }
  }, [db, newFolderName, createAccountId, loadData]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={ACCENT} size="large" />
      </View>
    );
  }

  const renderFolderRow = (name: string, icon: string, count: number, unread: number, accountId?: string) => (
    <Pressable
      key={`${accountId ?? 'all'}-${name}`}
      style={styles.folderRow}
      onPress={() => router.push({ pathname: '/(mail)/', params: { folder: name, accountId } })}
    >
      <Text style={styles.folderIcon}>{FOLDER_ICONS[icon] ?? '📂'}</Text>
      <Text variant="body" color={colors.text} style={styles.folderName}>{name}</Text>
      <View style={styles.folderCounts}>
        {unread > 0 && (
          <View style={[styles.badge, { backgroundColor: ACCENT }]}>
            <Text variant="caption" color="#fff" style={styles.badgeText}>{unread}</Text>
          </View>
        )}
        <Text variant="caption" color={colors.textSecondary}>{count}</Text>
      </View>
    </Pressable>
  );

  const renderAccountSection = (account: MailAccount) => {
    const accountStats = stats[account.id];
    const accountFolders = folders[account.id] ?? [];
    const customFolders = accountFolders.filter((f) => !f.isSystem);
    const syncList = syncStates[account.id] ?? [];
    const hasError = syncList.some((s) => s.status === 'error');

    return (
      <View key={account.id} style={styles.section}>
        {accounts.length > 1 && (
          <View style={styles.accountHeader}>
            <View style={[styles.accountDot, { backgroundColor: ACCENT }]} />
            <Text variant="subheading" color={colors.text} style={styles.accountEmail}>
              {account.email}
            </Text>
            {hasError && <Text variant="caption" color={colors.danger}>Sync Error</Text>}
          </View>
        )}

        {/* System folders */}
        {SYSTEM_FOLDERS.map((sf) => {
          const folderStats = accountStats?.byFolder.find((f) => f.folder === sf.name);
          return renderFolderRow(
            sf.name, sf.icon,
            folderStats?.total ?? 0,
            folderStats?.unread ?? 0,
            account.id,
          );
        })}

        {/* Custom folders */}
        {customFolders.length > 0 && (
          <View style={styles.customSection}>
            <Text variant="label" color={colors.textTertiary} style={styles.customLabel}>Custom</Text>
            {customFolders.map((f) => {
              const folderStats = accountStats?.byFolder.find((fs) => fs.folder === f.name);
              return renderFolderRow(
                f.name, f.icon ?? 'folder',
                folderStats?.total ?? 0,
                folderStats?.unread ?? 0,
                account.id,
              );
            })}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {accounts.length === 0 ? (
          <View style={styles.centered}>
            <Text variant="heading">📁</Text>
            <Text variant="subheading" style={styles.emptyTitle}>No accounts</Text>
            <Text variant="body" color={colors.textSecondary}>Add an email account to see folders</Text>
          </View>
        ) : (
          accounts.map(renderAccountSection)
        )}
      </ScrollView>

      {/* Create folder dialog */}
      {showCreateDialog && (
        <View style={styles.dialogOverlay}>
          <View style={[styles.dialog, glass.strong]}>
            <Text variant="subheading">Create Folder</Text>
            <TextInput
              style={styles.input}
              placeholder="Folder name"
              placeholderTextColor={colors.textTertiary}
              value={newFolderName}
              onChangeText={setNewFolderName}
              autoFocus
            />
            <View style={styles.dialogButtons}>
              <Pressable onPress={() => setShowCreateDialog(false)}>
                <Text variant="caption" color={colors.textSecondary}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.createBtn, { backgroundColor: ACCENT }]}
                onPress={handleCreateFolder}
              >
                <Text variant="caption" color="#fff">Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Add folder FAB */}
      {accounts.length > 0 && (
        <Pressable
          style={[styles.fab, { backgroundColor: ACCENT }]}
          onPress={() => {
            setCreateAccountId(accounts[0].id);
            setShowCreateDialog(true);
          }}
        >
          <Text style={styles.fabIcon}>+</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl },
  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: spacing.lg, minHeight: 300,
  },
  emptyTitle: { marginTop: spacing.md, marginBottom: spacing.xs },
  section: { marginBottom: spacing.md },
  accountHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  accountDot: { width: 8, height: 8, borderRadius: 4 },
  accountEmail: { flex: 1 },
  folderRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    minHeight: 48,
  },
  folderIcon: { fontSize: 20, width: 32 },
  folderName: { flex: 1 },
  folderCounts: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  customSection: { marginTop: spacing.xs },
  customLabel: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  dialogOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
    padding: spacing.lg,
  },
  dialog: { width: '100%', maxWidth: 340, padding: spacing.lg, gap: spacing.md },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, padding: spacing.sm, color: colors.text,
    fontFamily: 'Inter', fontSize: 16,
  },
  dialogButtons: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md, alignItems: 'center',
  },
  createBtn: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 8 },
  fab: {
    position: 'absolute', bottom: spacing.lg, right: spacing.lg,
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  fabIcon: { color: '#fff', fontSize: 28, fontWeight: '300', marginTop: -2 },
});
