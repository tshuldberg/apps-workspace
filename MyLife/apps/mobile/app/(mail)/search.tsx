import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  getAccounts,
  getMessages,
  searchMessages,
  generateInitials,
  getAvatarColor,
  resolveContact,
  getContacts,
} from '@mylife/mail';
import type { MailMessage } from '@mylife/mail';
import { Text, colors, spacing, glass } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.mail;

type QuickFilter = 'unread' | 'starred' | 'attachments' | 'encrypted';

export default function SearchScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<QuickFilter>>(new Set());
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const accounts = useMemo(() => getAccounts(db), [db]);
  const contacts = useMemo(() => {
    const all: import('@mylife/mail').MailContact[] = [];
    for (const a of accounts) all.push(...getContacts(db, a.id));
    return all;
  }, [db, accounts]);

  const results = useMemo(() => {
    if (!query.trim() && activeFilters.size === 0) return [];
    try {
      let messages = getMessages(db, { limit: 200 });

      // Apply quick filters
      if (activeFilters.has('unread')) {
        messages = messages.filter((m: MailMessage) => !m.isRead);
      }
      if (activeFilters.has('starred')) {
        messages = messages.filter((m: MailMessage) => m.isStarred);
      }

      // Apply text search
      if (query.trim()) {
        return searchMessages(messages, query.trim());
      }
      return messages;
    } catch {
      return [];
    }
  }, [db, query, activeFilters]);

  const toggleFilter = useCallback((filter: QuickFilter) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(filter)) next.delete(filter);
      else next.add(filter);
      return next;
    });
  }, []);

  const executeSearch = useCallback((term: string) => {
    setQuery(term);
    setRecentSearches((prev) => {
      const next = [term, ...prev.filter((s) => s !== term)];
      return next.slice(0, 10);
    });
  }, []);

  const removeRecent = useCallback((term: string) => {
    setRecentSearches((prev) => prev.filter((s) => s !== term));
  }, []);

  const quickFilters: { key: QuickFilter; label: string }[] = [
    { key: 'unread', label: 'Unread' },
    { key: 'starred', label: 'Starred' },
    { key: 'attachments', label: 'Attachments' },
    { key: 'encrypted', label: 'Encrypted' },
  ];

  return (
    <View style={styles.screen}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search mail..."
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => query.trim() && executeSearch(query.trim())}
          returnKeyType="search"
          autoFocus
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} style={styles.clearBtn}>
            <Text variant="caption" color={colors.textSecondary}>Clear</Text>
          </Pressable>
        )}
      </View>

      {/* Quick filters */}
      <View style={styles.filterRow}>
        {quickFilters.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.chip, activeFilters.has(f.key) && styles.chipActive]}
            onPress={() => toggleFilter(f.key)}
          >
            <Text
              variant="caption"
              color={activeFilters.has(f.key) ? ACCENT : colors.textSecondary}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Before search: recent searches */}
      {!query.trim() && activeFilters.size === 0 && recentSearches.length > 0 && (
        <View style={styles.recentSection}>
          <Text variant="label" color={colors.textTertiary} style={styles.recentLabel}>
            Recent Searches
          </Text>
          {recentSearches.map((term) => (
            <View key={term} style={styles.recentRow}>
              <Pressable style={styles.recentTerm} onPress={() => executeSearch(term)}>
                <Text variant="body" color={colors.textSecondary}>{term}</Text>
              </Pressable>
              <Pressable onPress={() => removeRecent(term)}>
                <Text variant="caption" color={colors.textTertiary}>x</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Results */}
      {(query.trim() || activeFilters.size > 0) && (
        <>
          <Text variant="caption" color={colors.textSecondary} style={styles.resultCount}>
            {results.length} result{results.length !== 1 ? 's' : ''}
          </Text>
          {results.length === 0 ? (
            <View style={styles.emptyResults}>
              <Text variant="subheading" color={colors.textSecondary}>
                No messages match '{query}'
              </Text>
              <Text variant="body" color={colors.textTertiary}>
                Try searching for sender name, subject, or message content
              </Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const contact = resolveContact(item.from, contacts);
                const displayName = contact?.displayName ?? item.from.split('@')[0];
                const initials = generateInitials(displayName);
                const avatarColor = getAvatarColor(item.from);

                return (
                  <Pressable
                    style={styles.resultRow}
                    onPress={() => router.push(`/(mail)/message/${item.id}`)}
                  >
                    <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
                      <Text variant="caption" color="#fff">{initials}</Text>
                    </View>
                    <View style={styles.resultContent}>
                      <Text variant="subheading" numberOfLines={1} color={colors.text}>
                        {displayName}
                      </Text>
                      <Text variant="body" numberOfLines={1} color={colors.text}>
                        {item.subject}
                      </Text>
                      <Text variant="body" numberOfLines={1} color={colors.textSecondary}>
                        {item.body.slice(0, 80)}
                      </Text>
                    </View>
                    <View style={styles.resultMeta}>
                      <Text variant="caption" color={colors.textSecondary}>
                        {new Date(item.receivedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </Text>
                      <View style={styles.folderBadge}>
                        <Text variant="caption" color={colors.textTertiary} style={{ fontSize: 10 }}>
                          {item.folder}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              }}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    padding: spacing.sm, color: colors.text,
    fontFamily: 'Inter', fontSize: 16,
  },
  clearBtn: { padding: spacing.xs },
  filterRow: {
    flexDirection: 'row', paddingHorizontal: spacing.md,
    gap: spacing.sm, marginBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    backgroundColor: glass.card.backgroundColor,
    borderWidth: glass.card.borderWidth,
    borderColor: glass.card.borderColor,
    borderRadius: 999,
  },
  chipActive: {
    backgroundColor: glass.strong.backgroundColor,
    borderColor: 'rgba(59,130,246,0.3)',
  },
  recentSection: { paddingHorizontal: spacing.md },
  recentLabel: { marginBottom: spacing.xs },
  recentRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  recentTerm: { flex: 1 },
  resultCount: { paddingHorizontal: spacing.md, marginBottom: spacing.xs },
  emptyResults: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: spacing.lg, gap: spacing.sm,
  },
  resultRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 999,
    justifyContent: 'center', alignItems: 'center',
  },
  resultContent: { flex: 1, marginLeft: spacing.sm, gap: 2 },
  resultMeta: { alignItems: 'flex-end', gap: spacing.xs },
  folderBadge: {
    paddingHorizontal: 6, paddingVertical: 2,
    backgroundColor: glass.card.backgroundColor,
    borderWidth: glass.card.borderWidth,
    borderColor: glass.card.borderColor,
    borderRadius: 4,
  },
});
