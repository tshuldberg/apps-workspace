import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  getAccounts,
  getFilters,
  getMessages,
  toggleFilter,
  deleteFilter,
  countMatches,
} from '@mylife/mail';
import type { MailFilter } from '@mylife/mail';
import { Text, colors, spacing, glass } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';

const ACCENT = colors.modules.mail;

export default function FiltersScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<MailFilter[]>([]);

  const accounts = useMemo(() => getAccounts(db), [db]);

  const loadData = useCallback(() => {
    try {
      const all: MailFilter[] = [];
      for (const a of accounts) {
        all.push(...getFilters(db, a.id));
      }
      all.sort((a, b) => a.priority - b.priority);
      setFilters(all);
    } catch { /* ignored */ } finally { setLoading(false); }
  }, [db, accounts]);

  useEffect(() => { loadData(); }, [loadData]);

  // Compute match counts per filter against inbox messages
  const matchCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    try {
      const messages = getMessages(db, { folder: 'Inbox', limit: 500 });
      for (const f of filters) {
        counts[f.id] = countMatches(messages, f);
      }
    } catch { /* ignored */ }
    return counts;
  }, [db, filters]);

  const handleToggle = useCallback((id: string) => {
    try { toggleFilter(db, id); loadData(); } catch { /* ignored */ }
  }, [db, loadData]);

  const handleDelete = useCallback((id: string) => {
    try { deleteFilter(db, id); loadData(); } catch { /* ignored */ }
  }, [db, loadData]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={ACCENT} size="large" />
      </View>
    );
  }

  if (filters.length === 0) {
    return (
      <View style={styles.centered}>
        <View style={[styles.emptyCard, glass.card]}>
          <Text variant="heading">📬</Text>
          <Text variant="subheading" color={colors.text}>Tame your inbox</Text>
          <Text variant="body" color={colors.textSecondary} style={styles.emptyText}>
            Create rules to sort newsletters, flag VIP senders, and auto-archive noise.
          </Text>
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: ACCENT }]}
            onPress={() => router.push('/(mail)/filters/edit')}
          >
            <Text variant="caption" color="#fff">Create First Filter</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const activeCount = filters.filter((f) => f.isActive).length;

  return (
    <View style={styles.screen}>
      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <Text variant="caption" color={colors.textSecondary}>
          {filters.length} rule{filters.length !== 1 ? 's' : ''} ({activeCount} active)
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {filters.map((f) => {
          const matches = matchCounts[f.id] ?? 0;
          return (
            <Pressable
              key={f.id}
              style={[styles.filterRow, !f.isActive && styles.filterDisabled]}
              onPress={() => router.push({ pathname: '/(mail)/filters/edit', params: { id: f.id } })}
            >
              <Text variant="caption" color={colors.textTertiary} style={styles.priority}>
                {f.priority}
              </Text>
              <View style={styles.filterInfo}>
                <Text variant="subheading" color={f.isActive ? colors.text : colors.textSecondary}>
                  {f.name}
                </Text>
                <Text variant="body" color={colors.textSecondary}>
                  When {f.field} contains &apos;{f.pattern}&apos; {'\u2192'} {f.action}{f.actionValue ? ` (${f.actionValue})` : ''}
                </Text>
                {matches > 0 && (
                  <Text variant="caption" color={ACCENT}>
                    {matches} matching message{matches !== 1 ? 's' : ''} in inbox
                  </Text>
                )}
              </View>
              <Switch
                value={f.isActive}
                onValueChange={() => handleToggle(f.id)}
                trackColor={{ true: ACCENT, false: colors.border }}
              />
              <Text variant="caption" color={colors.textTertiary}> {'\u203A'}</Text>
            </Pressable>
          );
        })}

        {/* Recently triggered section */}
        <View style={styles.recentSection}>
          <Text variant="label" color={colors.textTertiary} style={styles.sectionLabel}>
            Recently Active Rules
          </Text>
          {filters
            .filter((f) => f.isActive && (matchCounts[f.id] ?? 0) > 0)
            .slice(0, 5)
            .map((f) => (
              <View key={`recent-${f.id}`} style={styles.recentRow}>
                <View style={[styles.recentDot, { backgroundColor: ACCENT }]} />
                <Text variant="body" color={colors.textSecondary} style={styles.recentName}>
                  {f.name}
                </Text>
                <Text variant="caption" color={colors.textTertiary}>
                  {matchCounts[f.id]} match{(matchCounts[f.id] ?? 0) !== 1 ? 'es' : ''}
                </Text>
              </View>
            ))}
          {filters.filter((f) => f.isActive && (matchCounts[f.id] ?? 0) > 0).length === 0 && (
            <Text variant="caption" color={colors.textTertiary} style={{ paddingVertical: spacing.sm }}>
              No rules have matched recently.
            </Text>
          )}
        </View>
      </ScrollView>

      <Pressable
        style={[styles.fab, { backgroundColor: ACCENT }]}
        onPress={() => router.push('/(mail)/filters/edit')}
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
    backgroundColor: colors.background, padding: spacing.lg,
  },
  emptyCard: { padding: spacing.lg, gap: spacing.md, alignItems: 'center' },
  emptyText: { textAlign: 'center' },
  primaryBtn: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 8,
  },
  summaryBar: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  filterRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  filterDisabled: { opacity: 0.5 },
  priority: { width: 24, textAlign: 'center' },
  filterInfo: { flex: 1, gap: 2 },
  recentSection: { paddingHorizontal: spacing.md, paddingTop: spacing.lg },
  sectionLabel: { marginBottom: spacing.sm },
  recentRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  recentDot: { width: 6, height: 6, borderRadius: 3 },
  recentName: { flex: 1 },
  fab: {
    position: 'absolute', bottom: spacing.lg, right: spacing.lg,
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  fabIcon: { color: '#fff', fontSize: 28, fontWeight: '300', marginTop: -2 },
});
