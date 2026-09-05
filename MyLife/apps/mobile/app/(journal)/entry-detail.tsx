import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getJournalEntryById } from '@mylife/journal';
import { Card, Text, borderRadius, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const JOURNAL_ACCENT = colors.modules.journal;

export default function JournalEntryDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const entryId = typeof params.id === 'string' ? params.id : '';
  const entry = useMemo(() => (entryId ? getJournalEntryById(db, entryId) : null), [db, entryId]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {!entry ? (
        <Card>
          <Text variant="subheading">Entry not found</Text>
          <Text variant="caption" color={colors.textSecondary}>
            This journal entry may have been deleted or moved.
          </Text>
        </Card>
      ) : (
        <>
          <Card>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text variant="subheading">{entry.title ?? 'Untitled entry'}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {entry.entryDate}
                  {entry.mood ? ` · ${entry.mood}` : ''}
                  {entry.wordCount ? ` · ${entry.wordCount} words` : ''}
                </Text>
              </View>
              <Pressable
                style={styles.editButton}
                onPress={() => router.push({ pathname: '/(journal)/new-entry', params: { id: entry.id } })}
              >
                <Text variant="caption" color={JOURNAL_ACCENT}>Edit</Text>
              </Pressable>
            </View>

            {entry.tags.length > 0 ? (
              <View style={styles.chipRow}>
                {entry.tags.map((tag) => (
                  <View key={tag} style={styles.chip}>
                    <Text variant="caption" color={colors.textSecondary}>#{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>

          <Card>
            <Text variant="body" style={styles.bodyCopy}>{entry.body}</Text>
          </Card>
        </>
      )}
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
    paddingBottom: spacing.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  editButton: {
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: `${JOURNAL_ACCENT}55`,
    backgroundColor: `${JOURNAL_ACCENT}18`,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  chip: {
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  bodyCopy: {
    lineHeight: 24,
  },
});
