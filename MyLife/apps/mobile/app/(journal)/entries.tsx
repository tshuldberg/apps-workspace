import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { listJournalEntries, listJournalNotebooks, listJournalTags, listOnThisDayEntries } from '@mylife/journal';
import { Card, Text, borderRadius, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const JOURNAL_ACCENT = colors.modules.journal;

export default function JournalEntriesScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [selectedJournalId, setSelectedJournalId] = useState<string | null>(null);
  const notebooks = useMemo(() => listJournalNotebooks(db), [db]);
  const selectedJournal = useMemo(
    () => notebooks.find((journal) => journal.id === selectedJournalId) ?? notebooks[0] ?? null,
    [notebooks, selectedJournalId],
  );
  const tags = useMemo(() => listJournalTags(db, selectedJournal?.id), [db, selectedJournal]);
  const entries = useMemo(
    () => listJournalEntries(db, {
      journalId: selectedJournal?.id,
      tag: activeTag ?? undefined,
      limit: 50,
    }),
    [db, selectedJournal, activeTag],
  );
  const onThisDay = useMemo(
    () => listOnThisDayEntries(db, new Date().toISOString().slice(0, 10), selectedJournal?.id, 6),
    [db, selectedJournal],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text variant="subheading">Browse Entries</Text>
        <View style={styles.chipRow}>
          {notebooks.map((journal) => {
            const selected = selectedJournal?.id === journal.id;
            return (
              <Pressable
                key={journal.id}
                onPress={() => setSelectedJournalId(journal.id)}
                style={[styles.chip, selected ? styles.chipActive : null]}
              >
                <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                  {journal.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text variant="caption" color={colors.textSecondary}>
          Filter by notebook and tag to find past entries.
        </Text>
        <View style={styles.chipRow}>
          <Pressable
            onPress={() => setActiveTag(null)}
            style={[styles.chip, !activeTag ? styles.chipActive : null]}
          >
            <Text variant="caption" color={!activeTag ? colors.background : colors.textSecondary}>
              All
            </Text>
          </Pressable>
          {tags.map((tag) => {
            const selected = tag.name === activeTag;
            return (
              <Pressable
                key={tag.id}
                onPress={() => setActiveTag(selected ? null : tag.name)}
                style={[styles.chip, selected ? styles.chipActive : null]}
              >
                <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                  {tag.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text variant="subheading">On This Day</Text>
        <View style={styles.list}>
          {onThisDay.length === 0 ? (
            <Text variant="caption" color={colors.textSecondary}>
              No matching entries from past years yet.
            </Text>
          ) : (
            onThisDay.map((entry) => (
              <Pressable key={entry.id} onPress={() => router.push(`/(journal)/entry-detail?id=${entry.id}` as never)}>
                <Card style={styles.innerCard}>
                  <Text variant="body">{entry.title ?? 'Untitled entry'}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {entry.entryDate} · {entry.yearsAgo} year{entry.yearsAgo === 1 ? '' : 's'} ago
                  </Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {entry.body.slice(0, 200)}
                  </Text>
                </Card>
              </Pressable>
            ))
          )}
        </View>
      </Card>

      <Card>
        <Text variant="subheading">
          {activeTag ? `Entries tagged "${activeTag}"` : 'Recent entries'}
        </Text>
        <View style={styles.list}>
          {entries.length === 0 ? (
            <Text variant="caption" color={colors.textSecondary}>
              No entries match this filter yet.
            </Text>
          ) : (
            entries.map((entry) => (
              <Pressable key={entry.id} onPress={() => router.push(`/(journal)/entry-detail?id=${entry.id}` as never)}>
                <Card style={styles.innerCard}>
                  <Text variant="body">{entry.title ?? 'Untitled entry'}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {entry.entryDate}
                    {entry.mood ? ` · ${entry.mood}` : ''}
                    {entry.tags.length > 0 ? ` · ${entry.tags.join(', ')}` : ''}
                  </Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {entry.body.slice(0, 200)}
                  </Text>
                </Card>
              </Pressable>
            ))
          )}
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceElevated,
  },
  chipActive: {
    backgroundColor: JOURNAL_ACCENT,
    borderColor: JOURNAL_ACCENT,
  },
  list: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  innerCard: {
    gap: spacing.xs,
  },
});
