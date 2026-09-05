import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { searchNotes } from '@mylife/notes';
import { Card, Text, borderRadius, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.notes;

export default function NotesSearchScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const results = useMemo(() => (query.trim() ? searchNotes(db, query.trim(), 30) : []), [db, query]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text variant="subheading">Search Notes</Text>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search titles and full note text"
          placeholderTextColor={colors.textTertiary}
        />
        <Text variant="caption" color={colors.textSecondary}>
          Use quotes for an exact phrase. {results.length > 0 ? `${results.length} matches` : 'FTS search is instant on-device.'}
        </Text>
      </Card>

      <Card>
        {!query.trim() ? (
          <Text variant="body" color={colors.textSecondary}>
            Search across your markdown knowledge base, clipped pages, and daily notes.
          </Text>
        ) : results.length === 0 ? (
          <Text variant="body" color={colors.textSecondary}>
            No notes matched "{query.trim()}".
          </Text>
        ) : (
          <View style={styles.list}>
            {results.map((note) => (
              <Pressable
                key={note.id}
                style={styles.resultCard}
                onPress={() => router.push({ pathname: '/(notes)/note-editor', params: { id: note.id } })}
              >
                <Text variant="body">{note.title || 'Untitled'}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {note.snippet.replace(/<[^>]+>/g, '')}
                </Text>
                <Text variant="caption" color={ACCENT}>Open note</Text>
              </Pressable>
            ))}
          </View>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
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
  list: { gap: spacing.sm },
  resultCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    gap: spacing.xs,
  },
});
