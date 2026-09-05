import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  getAccounts,
  getContacts,
  toggleContactVip,
  deleteContact,
  generateInitials,
  getAvatarColor,
} from '@mylife/mail';
import type { MailContact } from '@mylife/mail';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';

const ACCENT = colors.modules.mail;

type Filter = 'all' | 'vip' | 'recent' | 'auto' | 'inactive';

export default function ContactsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<MailContact[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const accounts = useMemo(() => getAccounts(db), [db]);

  const loadData = useCallback(() => {
    try {
      const all: MailContact[] = [];
      for (const a of accounts) {
        all.push(...getContacts(db, a.id));
      }
      setContacts(all);
    } catch { /* ignored */ } finally { setLoading(false); }
  }, [db, accounts]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    let list = contacts;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) =>
        c.email.toLowerCase().includes(q) ||
        (c.displayName?.toLowerCase().includes(q) ?? false)
      );
    }

    switch (filter) {
      case 'vip': list = list.filter((c) => c.isVip); break;
      case 'recent': list = [...list].sort((a, b) => b.frequency - a.frequency).slice(0, 20); break;
      case 'auto': list = list.filter((c) => c.source === 'auto_created'); break;
      case 'inactive': {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        list = list.filter((c) =>
          c.lastContactedAt && new Date(c.lastContactedAt) < thirtyDaysAgo,
        );
        break;
      }
    }
    return list;
  }, [contacts, filter, searchQuery]);

  const sections = useMemo(() => {
    const groups: Record<string, MailContact[]> = {};
    for (const c of filtered) {
      const letter = (c.displayName?.[0] ?? c.email[0]).toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(c);
    }
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, data]) => ({ title, data }));
  }, [filtered]);

  const handleToggleVip = useCallback((id: string) => {
    try { toggleContactVip(db, id); loadData(); } catch { /* ignored */ }
  }, [db, loadData]);

  const handleDelete = useCallback((id: string) => {
    try { deleteContact(db, id); loadData(); } catch { /* ignored */ }
  }, [db, loadData]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={ACCENT} size="large" />
      </View>
    );
  }

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'vip', label: 'VIP Only' },
    { key: 'recent', label: 'Recent' },
    { key: 'auto', label: 'Auto-created' },
    { key: 'inactive', label: "Haven't heard from" },
  ];

  return (
    <View style={styles.screen}>
      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts..."
          placeholderTextColor={colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {filters.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.chip, filter === f.key && styles.chipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text variant="caption" color={filter === f.key ? ACCENT : colors.textSecondary}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {contacts.length === 0 ? (
        <View style={styles.centered}>
          <Text variant="heading">👤</Text>
          <Text variant="subheading" style={styles.emptyTitle}>Your address book is ready</Text>
          <Text variant="body" color={colors.textSecondary} style={styles.emptyText}>
            Contacts appear automatically as you send email, or add them manually.
          </Text>
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: ACCENT }]}
            onPress={() => router.push({ pathname: '/(mail)/contacts/[id]', params: { id: 'new' } })}
          >
            <Text variant="caption" color="#fff">Add Contact</Text>
          </Pressable>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <Text variant="label" color={colors.textTertiary}>{title}</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const displayName = item.displayName ?? item.email;
            const initials = generateInitials(displayName);
            const avatarColor = getAvatarColor(item.email);

            return (
              <Pressable
                style={styles.contactRow}
                onPress={() => router.push(`/(mail)/contacts/${item.id}`)}
              >
                <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
                  <Text variant="caption" color="#fff">{initials}</Text>
                  {item.isVip && (
                    <View style={styles.vipBadge}>
                      <Text style={{ fontSize: 8 }}>⭐</Text>
                    </View>
                  )}
                </View>
                <View style={styles.contactInfo}>
                  <Text variant="subheading" color={colors.text} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <Text variant="body" color={colors.textSecondary} numberOfLines={1}>
                    {item.email}
                  </Text>
                  {item.company && (
                    <Text variant="caption" color={colors.textTertiary} numberOfLines={1}>
                      {item.company}
                    </Text>
                  )}
                </View>
                <View style={styles.contactMeta}>
                  <Text variant="caption" color={colors.textTertiary}>
                    {item.frequency} msg{item.frequency !== 1 ? 's' : ''}
                  </Text>
                  <View style={styles.frequencyDots}>
                    {[1, 2, 3].map((level) => (
                      <View
                        key={level}
                        style={[
                          styles.freqDot,
                          item.frequency >= level * 5
                            ? { backgroundColor: ACCENT }
                            : { backgroundColor: colors.border },
                        ]}
                      />
                    ))}
                  </View>
                  {item.lastContactedAt && (
                    <Text variant="caption" color={colors.textTertiary}>
                      {new Date(item.lastContactedAt).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: spacing.lg, backgroundColor: colors.background,
  },
  emptyTitle: { marginTop: spacing.md, marginBottom: spacing.xs },
  emptyText: { textAlign: 'center', marginBottom: spacing.lg },
  primaryBtn: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  searchRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  searchInput: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, padding: spacing.sm, color: colors.text,
    fontFamily: 'Inter', fontSize: 16,
  },
  filterRow: {
    flexDirection: 'row', paddingHorizontal: spacing.md,
    gap: spacing.sm, marginBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
  },
  chipActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(59,130,246,0.3)',
  },
  sectionHeader: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    backgroundColor: colors.background,
  },
  contactRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  vipBadge: {
    position: 'absolute', top: -2, right: -2,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: colors.background,
    justifyContent: 'center', alignItems: 'center',
  },
  contactInfo: { flex: 1, marginLeft: spacing.sm, gap: 2 },
  contactMeta: { alignItems: 'flex-end', gap: spacing.xs },
  frequencyDots: { flexDirection: 'row', gap: 3 },
  freqDot: { width: 6, height: 6, borderRadius: 3 },
});
