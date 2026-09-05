import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { countWords, createNote, getFolders, getNoteById, updateNote } from '@mylife/notes';
import { Card, Text, borderRadius, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const ACCENT = colors.modules.notes;

export default function NoteEditorScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const noteId = typeof params.id === 'string' ? params.id : '';
  const note = useMemo(() => (noteId ? getNoteById(db, noteId) : null), [db, noteId]);
  const folders = useMemo(() => getFolders(db), [db]);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    if (!note) {
      return;
    }
    setTitle(note.title);
    setBody(note.body);
    setFolderId(note.folderId);
    setIsPinned(note.isPinned);
  }, [note]);

  const wordCount = countWords(body);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text variant="subheading">{note ? 'Edit Note' : 'New Note'}</Text>
        <TextInput
          style={[styles.input, styles.titleInput]}
          value={title}
          onChangeText={setTitle}
          placeholder="Note title"
          placeholderTextColor={colors.textTertiary}
        />
        <View style={styles.chipRow}>
          <Pressable
            style={[styles.chip, folderId === null ? styles.chipActive : null]}
            onPress={() => setFolderId(null)}
          >
            <Text variant="caption" color={folderId === null ? colors.background : colors.textSecondary}>
              No folder
            </Text>
          </Pressable>
          {folders.map((folder) => {
            const selected = folder.id === folderId;
            return (
              <Pressable
                key={folder.id}
                style={[styles.chip, selected ? styles.chipActive : null]}
                onPress={() => setFolderId(folder.id)}
              >
                <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                  {folder.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          style={[styles.input, styles.bodyInput]}
          value={body}
          onChangeText={setBody}
          placeholder="Write in markdown..."
          placeholderTextColor={colors.textTertiary}
          multiline
          textAlignVertical="top"
        />

        <View style={styles.footerRow}>
          <Pressable
            style={[styles.chip, isPinned ? styles.chipActive : null]}
            onPress={() => setIsPinned((value) => !value)}
          >
            <Text variant="caption" color={isPinned ? colors.background : colors.textSecondary}>
              {isPinned ? 'Pinned' : 'Pin note'}
            </Text>
          </Pressable>
          <Text variant="caption" color={colors.textSecondary}>{wordCount} words</Text>
        </View>

        <View style={styles.actions}>
          {note ? (
            <Pressable
              style={styles.secondaryButton}
              onPress={() => router.push({ pathname: '/(notes)/note-preview', params: { id: note.id } })}
            >
              <Text variant="label" color={colors.text}>Preview</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              if (note) {
                updateNote(db, note.id, { title, body, folderId, isPinned });
                router.replace({ pathname: '/(notes)/note-preview', params: { id: note.id } });
                return;
              }
              const id = uuid();
              createNote(db, id, { title, body, folderId, isPinned });
              router.replace({ pathname: '/(notes)/note-preview', params: { id } });
            }}
          >
            <Text variant="label" color={colors.background}>{note ? 'Save' : 'Create'}</Text>
          </Pressable>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  input: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
  },
  titleInput: { fontSize: 18, fontWeight: '600' },
  bodyInput: { minHeight: 260 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceElevated,
  },
  chipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  primaryButton: {
    borderRadius: borderRadius.lg,
    backgroundColor: ACCENT,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
