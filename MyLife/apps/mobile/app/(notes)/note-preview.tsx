import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getNoteById } from '@mylife/notes';
import { Card, Text, borderRadius, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.notes;

export default function NotePreviewScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const noteId = typeof params.id === 'string' ? params.id : '';
  const note = useMemo(() => (noteId ? getNoteById(db, noteId) : null), [db, noteId]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {!note ? (
        <Card>
          <Text variant="subheading">Note not found</Text>
          <Text variant="caption" color={colors.textSecondary}>
            This note may have been deleted.
          </Text>
        </Card>
      ) : (
        <>
          <Card>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text variant="subheading">{note.title || 'Untitled'}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {note.wordCount} words
                  {note.isPinned ? ' · pinned' : ''}
                </Text>
              </View>
              <Pressable
                style={styles.editButton}
                onPress={() => router.push({ pathname: '/(notes)/note-editor', params: { id: note.id } })}
              >
                <Text variant="caption" color={ACCENT}>Edit</Text>
              </Pressable>
            </View>
          </Card>

          <Card>
            <Text variant="body" style={styles.bodyCopy}>{note.body || 'Empty note'}</Text>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  editButton: {
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: `${ACCENT}55`,
    backgroundColor: `${ACCENT}18`,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  bodyCopy: {
    lineHeight: 24,
  },
});
