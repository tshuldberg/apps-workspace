import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { listJournalNotebooks, searchJournalEntries } from '@mylife/journal';
import { Card, Text, borderRadius, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const JOURNAL_ACCENT = colors.modules.journal;

export default function JournalSearchScreen() {
  const db = useDatabase();
  const [query, setQuery] = useState('');
  const [selectedJournalId, setSelectedJournalId] = useState<string | null>(null);
  const notebooks = useMemo(() => listJournalNotebooks(db), [db]);
  const selectedJournal = useMemo(
    () => notebooks.find((journal) => journal.id === selectedJournalId) ?? notebooks[0] ?? null,
    [notebooks, selectedJournalId],
  );
  const results = useMemo(
    () => (query.trim() ? searchJournalEntries(db, query.trim(), 25, selectedJournal?.id) : []),
    [db, query, selectedJournal],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text variant="subheading">Search Journal</Text>
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
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search titles, body text, or tags"
          placeholderTextColor={colors.textTertiary}
        />
        <Text variant="caption" color={colors.textSecondary}>
          Search across titles, entries, and tags within the selected notebook.
        </Text>
      </Card>

      <Card>
        <Text variant="subheading">Results</Text>
        <View style={styles.list}>
          {!query.trim() ? (
            <Text variant="caption" color={colors.textSecondary}>
              Start typing to search your journal.
            </Text>
          ) : results.length === 0 ? (
            <Text variant="caption" color={colors.textSecondary}>
              No entries matched "{query.trim()}".
            </Text>
          ) : (
            results.map((entry) => (
              <Card key={entry.id} style={styles.innerCard}>
                <Text variant="body">{entry.title ?? 'Untitled entry'}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {entry.entryDate}
                  {entry.matchedTagNames.length > 0 ? ` · matched tags: ${entry.matchedTagNames.join(', ')}` : ''}
                </Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {entry.body.slice(0, 200)}
                </Text>
              </Card>
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
  input: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
  },
  list: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  innerCard: {
    gap: spacing.xs,
  },
});
