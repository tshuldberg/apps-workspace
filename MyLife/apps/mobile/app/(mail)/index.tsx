import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getAccounts,
  getThreads,
  getMessagesByThread,
  getMailStats,
  getContacts,
  markAsRead,
  toggleStar,
  moveToFolder,
  generateInitials,
  getAvatarColor,
  resolveContact,
} from '@mylife/mail';
import type { MailAccount, MailThread, MailContact } from '@mylife/mail';
import { Text, colors, spacing, glass } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.mail;

export default function InboxScreen() {
  const { accountId: accountParam } = useLocalSearchParams<{ accountId?: string }>();
  const db = useDatabase();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threads, setThreads] = useState<MailThread[]>([]);
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [contacts, setContacts] = useState<MailContact[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(accountParam ?? null);
  const [menuOpen, setMenuOpen] = useState(false);

  const loadData = useCallback(() => {
    try {
      const accts = getAccounts(db);
      setAccounts(accts);
      if (accts.length === 0) {
        setLoading(false);
        return;
      }
      let t: MailThread[] = [];
      if (selectedAccount) {
        t = getThreads(db, selectedAccount, 50, 0);
      } else {
        for (const a of accts) {
          t.push(...getThreads(db, a.id, 50, 0));
        }
        t.sort((a, b) => new Date(b.latestMessageAt).getTime() - new Date(a.latestMessageAt).getTime());
        t = t.slice(0, 50);
      }
      setThreads(t);
      const c = getContacts(db, selectedAccount ?? accts[0].id);
      setContacts(c);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load inbox');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, selectedAccount]);

  useEffect(() => { loadData(); }, [loadData]);

  const stats = useMemo(() => {
    try { return getMailStats(db, selectedAccount ?? undefined); }
    catch { return null; }
  }, [db, selectedAccount]);

  const sections = useMemo(() => {
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now.getTime() - 86400000).toDateString();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);

    const groups: Record<string, MailThread[]> = {
      Today: [],
      Yesterday: [],
      'This Week': [],
      Earlier: [],
    };
    for (const t of threads) {
      const d = new Date(t.latestMessageAt);
      const ds = d.toDateString();
      if (ds === today) groups.Today.push(t);
      else if (ds === yesterday) groups.Yesterday.push(t);
      else if (d > weekAgo) groups['This Week'].push(t);
      else groups.Earlier.push(t);
    }
    return Object.entries(groups)
      .filter(([, data]) => data.length > 0)
      .map(([title, data]) => ({ title, data }));
  }, [threads]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleSwipeRead = useCallback((threadId: string) => {
    try {
      const msgs = getMessagesByThread(db, threadId);
      for (const m of msgs) if (!m.isRead) markAsRead(db, m.id);
      loadData();
    } catch { /* ignored */ }
  }, [db, loadData]);

  const handleSwipeStar = useCallback((threadId: string) => {
    try {
      const msgs = getMessagesByThread(db, threadId);
      if (msgs.length > 0) toggleStar(db, msgs[msgs.length - 1].id);
      loadData();
    } catch { /* ignored */ }
  }, [db, loadData]);

  const handleSwipeTrash = useCallback((threadId: string) => {
    try {
      const msgs = getMessagesByThread(db, threadId);
      for (const m of msgs) moveToFolder(db, m.id, 'Trash');
      loadData();
    } catch { /* ignored */ }
  }, [db, loadData]);

  // No accounts: redirect to onboarding
  if (!loading && accounts.length === 0) {
    return (
      <View style={styles.centered}>
        <Text variant="heading">📬</Text>
        <Text variant="subheading" style={styles.emptyTitle}>Welcome to MyMail</Text>
        <Text variant="body" color={colors.textSecondary} style={styles.emptyText}>
          Your email stays on your device. No cloud. No tracking.
        </Text>
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: ACCENT }]}
          onPress={() => router.push('/(mail)/onboarding')}
        >
          <Text variant="caption" color="#fff">Get Started</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={ACCENT} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Account filter bar */}
      {accounts.length > 1 && (
        <View style={styles.filterBar}>
          <Pressable
            style={[styles.filterChip, !selectedAccount && styles.filterChipActive]}
            onPress={() => setSelectedAccount(null)}
          >
            <Text variant="caption" color={!selectedAccount ? ACCENT : colors.textSecondary}>
              All{stats ? ` (${stats.unreadCount})` : ''}
            </Text>
          </Pressable>
          {accounts.map((a) => (
            <Pressable
              key={a.id}
              style={[styles.filterChip, selectedAccount === a.id && styles.filterChipActive]}
              onPress={() => setSelectedAccount(a.id)}
            >
              <View style={[styles.accountDot, { backgroundColor: ACCENT }]} />
              <Text variant="caption" color={selectedAccount === a.id ? ACCENT : colors.textSecondary} numberOfLines={1}>
                {a.email.split('@')[0]}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Hamburger menu button */}
      <View style={styles.menuRow}>
        <Pressable style={styles.menuButton} onPress={() => setMenuOpen(true)}>
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
        </Pressable>
      </View>

      <Modal visible={menuOpen} transparent animationType="slide" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.menuSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.menuHandle} />
            <ScrollView bounces={false}>
              {[
                { label: 'Templates', route: '/(mail)/templates' },
                { label: 'Schedule Send', route: '/(mail)/schedule-send' },
                { label: 'Contacts', route: '/(mail)/contacts' },
                { label: 'Accounts', route: '/(mail)/accounts' },
                { label: 'Filters', route: '/(mail)/filters' },
                { label: 'Calendar Events', route: '/(mail)/calendar-events' },
                { label: 'Notifications', route: '/(mail)/notifications' },
                { label: 'Encryption', route: '/(mail)/encryption' },
              ].map((item) => (
                <Pressable
                  key={item.label}
                  style={styles.menuItem}
                  onPress={() => {
                    setMenuOpen(false);
                    router.push(item.route as never);
                  }}
                >
                  <Text variant="body" color={colors.text}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {error && (
        <View style={styles.errorBanner}>
          <Text variant="caption" color={colors.danger}>{error}</Text>
          <Pressable onPress={loadData}>
            <Text variant="caption" color={ACCENT}>Retry</Text>
          </Pressable>
        </View>
      )}

      {threads.length === 0 && !error ? (
        <View style={styles.centered}>
          <Text variant="heading">📭</Text>
          <Text variant="subheading" style={styles.emptyTitle}>Your inbox is clear</Text>
          <Text variant="body" color={colors.textSecondary}>New messages will appear here</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />
          }
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <Text variant="label" color={colors.textTertiary}>{title}</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const sender = item.participantEmails[0] ?? 'Unknown';
            const contact = resolveContact(sender, contacts);
            const displayName = contact?.displayName ?? sender.split('@')[0];
            const initials = generateInitials(displayName);
            const avatarColor = getAvatarColor(sender);
            const isUnread = item.unreadCount > 0;

            return (
              <Pressable
                style={styles.threadRow}
                onPress={() => router.push(`/(mail)/thread/${item.id}`)}
              >
                {/* Avatar */}
                <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
                  <Text variant="caption" color="#fff">{initials}</Text>
                  {isUnread && <View style={[styles.unreadDot, { backgroundColor: ACCENT }]} />}
                  {accounts.length > 1 && (
                    <View style={[styles.accountDotSmall, { backgroundColor: ACCENT }]} />
                  )}
                </View>

                {/* Content */}
                <View style={styles.threadContent}>
                  <Text
                    variant="subheading"
                    color={isUnread ? colors.text : colors.textSecondary}
                    numberOfLines={1}
                  >
                    {displayName}
                  </Text>
                  <Text variant="body" color={colors.text} numberOfLines={1}>
                    {item.subject}
                  </Text>
                  <Text variant="body" color={colors.textSecondary} numberOfLines={1}>
                    {item.messageCount} message{item.messageCount !== 1 ? 's' : ''}
                  </Text>
                </View>

                {/* Right side */}
                <View style={styles.threadMeta}>
                  <Text variant="caption" color={colors.textSecondary}>
                    {formatTime(item.latestMessageAt)}
                  </Text>
                  {isUnread && <View style={[styles.unreadIndicator, { backgroundColor: ACCENT }]} />}
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {/* Compose FAB */}
      <Pressable
        style={[styles.fab, { backgroundColor: ACCENT }]}
        onPress={() => router.push('/(mail)/compose-message')}
      >
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </View>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1, backgroundColor: colors.background,
    justifyContent: 'center', alignItems: 'center', padding: spacing.lg,
  },
  emptyTitle: { marginTop: spacing.md, marginBottom: spacing.xs },
  emptyText: { textAlign: 'center', marginBottom: spacing.lg },
  primaryBtn: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: 8, marginTop: spacing.sm,
  },
  filterBar: {
    flexDirection: 'row', paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, gap: spacing.sm,
  },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    backgroundColor: glass.card.backgroundColor,
    borderWidth: glass.card.borderWidth,
    borderColor: glass.card.borderColor,
    borderRadius: 999,
  },
  filterChipActive: {
    backgroundColor: glass.strong.backgroundColor,
    borderColor: 'rgba(59,130,246,0.3)',
  },
  accountDot: { width: 8, height: 8, borderRadius: 4 },
  errorBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: 'rgba(255,69,58,0.1)',
  },
  sectionHeader: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    backgroundColor: colors.background,
  },
  threadRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    minHeight: 76, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 999,
    justifyContent: 'center', alignItems: 'center',
  },
  unreadDot: {
    position: 'absolute', bottom: 0, left: 0,
    width: 10, height: 10, borderRadius: 5,
    borderWidth: 2, borderColor: colors.background,
  },
  accountDotSmall: {
    position: 'absolute', bottom: 0, right: 0,
    width: 8, height: 8, borderRadius: 4,
    borderWidth: 1.5, borderColor: colors.background,
  },
  threadContent: { flex: 1, marginLeft: spacing.sm, gap: 2 },
  threadMeta: { alignItems: 'flex-end', gap: spacing.xs },
  unreadIndicator: { width: 8, height: 8, borderRadius: 4 },
  fab: {
    position: 'absolute', bottom: spacing.lg, right: spacing.lg,
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  fabIcon: { color: '#fff', fontSize: 28, fontWeight: '300', marginTop: -2 },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  menuLine: {
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.text,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: spacing.xl,
    maxHeight: '70%',
  },
  menuHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  menuItem: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
