import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Button, Card, Text, LoadingState, ErrorState, colors, spacing } from '@mylife/ui';
import { BOOKS_SURFACES } from '@mylife/books/ui';
import { icons } from 'lucide-react-native';
import { useReaderDocument, useReaderDocuments } from '../../../hooks/books/use-reader-documents';
import { useReaderNotes } from '../../../hooks/books/use-reader-notes';
import { useReaderPreferences } from '../../../hooks/books/use-reader-preferences';
import { ReaderSettingsSheet } from '../../../components/books/ReaderSettingsSheet';

const SettingsIcon = icons.Settings;

interface ReaderSegment {
  key: string;
  start: number;
  end: number;
  text: string;
}

function splitIntoSegments(content: string): ReaderSegment[] {
  const chunks = content.split(/\n{2,}/);
  const segments: ReaderSegment[] = [];
  let cursor = 0;

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    const start = content.indexOf(chunk, cursor);
    const safeStart = start >= 0 ? start : cursor;
    const end = safeStart + chunk.length;
    cursor = end;
    segments.push({
      key: `${safeStart}-${index}`,
      start: safeStart,
      end,
      text: trimmed,
    });
  }

  return segments;
}

const READER_THEMES = {
  dark: { background: '#121212', text: '#F5F2ED' },
  sepia: { background: '#F3E8D4', text: '#3B2C1C' },
  light: { background: '#FFFFFF', text: '#1D1D1D' },
} as const;

export default function ReaderDocumentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { document, loading } = useReaderDocument(id);
  const { updateProgress } = useReaderDocuments();
  const { notes, create, remove } = useReaderNotes(id);
  const { preferences } = useReaderPreferences(id);

  const [selected, setSelected] = useState<ReaderSegment | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const lastProgressUpdate = useRef(0);

  const segments = useMemo(
    () => splitIntoSegments(document?.text_content ?? ''),
    [document?.text_content],
  );

  const fontSize = preferences?.font_size ?? 20;
  const lineHeight = preferences?.line_height ?? 1.6;
  const marginSize = preferences?.margin_size ?? 20;
  const theme = preferences?.theme ?? 'sepia';
  const readerTheme = READER_THEMES[theme];

  const hasHighlight = useCallback((segment: ReaderSegment): boolean => (
    notes.some((note) =>
      note.note_type === 'highlight'
      && note.selection_start < segment.end
      && note.selection_end > segment.start)
  ), [notes]);

  const hasBookmark = useCallback((segment: ReaderSegment): boolean => (
    notes.some((note) =>
      note.note_type === 'bookmark'
      && note.selection_start >= segment.start
      && note.selection_start <= segment.end)
  ), [notes]);

  const handleScroll = useCallback((event: {
    nativeEvent: {
      contentOffset: { y: number };
      contentSize: { height: number };
      layoutMeasurement: { height: number };
    };
  }) => {
    if (!document) return;

    const now = Date.now();
    if (now - lastProgressUpdate.current < 1200) return;
    lastProgressUpdate.current = now;

    const y = Math.max(0, event.nativeEvent.contentOffset.y);
    const maxScroll = Math.max(
      event.nativeEvent.contentSize.height - event.nativeEvent.layoutMeasurement.height,
      1,
    );
    const ratio = Math.max(0, Math.min(1, y / maxScroll));
    const currentPosition = Math.round(ratio * document.total_chars);

    updateProgress(document.id, {
      current_position: currentPosition,
      progress_percent: ratio * 100,
    });
  }, [document, updateProgress]);

  const createContextNote = useCallback((type: 'highlight' | 'bookmark' | 'note') => {
    if (!selected) return;
    create({
      note_type: type,
      selection_start: selected.start,
      selection_end: selected.end,
      selected_text: selected.text.slice(0, 800),
      note_text: type === 'note' ? noteDraft.trim() || null : null,
      color: type === 'highlight' ? '#F9D976' : null,
    });
    setNoteDraft('');
    setShowComposer(false);
  }, [create, noteDraft, selected]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingState rows={3} />
      </View>
    );
  }

  if (!document) {
    return (
      <View style={styles.loadingContainer}>
        <ErrorState message="Document not found." />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: document.title }} />
      <View style={styles.container}>
        <View style={styles.toolbar}>
          <Pressable
            onPress={() => setShowSettings(true)}
            style={styles.toolButton}
            hitSlop={8}
          >
            <SettingsIcon size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
        <ReaderSettingsSheet documentId={id!} visible={showSettings} onClose={() => setShowSettings(false)} />

        <ScrollView
          style={[styles.reader, { backgroundColor: readerTheme.background }]}
          contentContainerStyle={{ paddingHorizontal: marginSize, paddingVertical: spacing.lg }}
          onScroll={handleScroll}
          scrollEventThrottle={200}
        >
          {segments.map((segment) => {
            const selectedSegment = selected?.key === segment.key;
            const highlighted = hasHighlight(segment);
            const bookmarked = hasBookmark(segment);
            return (
              <Pressable
                key={segment.key}
                onPress={() => setSelected(segment)}
                style={[
                  styles.segment,
                  highlighted && styles.segmentHighlight,
                  selectedSegment && styles.segmentSelected,
                ]}
              >
                <Text
                  variant="body"
                  style={{
                    color: readerTheme.text,
                    fontSize,
                    lineHeight: fontSize * lineHeight,
                    fontFamily: preferences?.font_family ?? 'serif',
                  }}
                >
                  {bookmarked ? '🔖 ' : ''}{segment.text}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {selected && (
          <Card style={styles.selectionCard}>
            <Text variant="caption" color={colors.textSecondary} numberOfLines={2}>
              {selected.text}
            </Text>
            <View style={styles.selectionActions}>
              <Button
                variant="secondary"
                label="Highlight"
                onPress={() => createContextNote('highlight')}
              />
              <Button
                variant="secondary"
                label="Bookmark"
                onPress={() => createContextNote('bookmark')}
              />
              <Button
                variant="ghost"
                label={showComposer ? 'Hide Note' : 'Add Note'}
                onPress={() => setShowComposer((value) => !value)}
              />
            </View>
            {showComposer && (
              <View style={styles.composer}>
                <TextInput
                  value={noteDraft}
                  onChangeText={setNoteDraft}
                  placeholder="Write your note..."
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  style={styles.composerInput}
                />
                <Button
                  variant="primary"
                  label="Save Note"
                  onPress={() => createContextNote('note')}
                />
              </View>
            )}
          </Card>
        )}

        <ScrollView style={styles.notesPane} contentContainerStyle={styles.notesContent}>
          <Text variant="label" color={colors.textTertiary}>Highlights & Notes</Text>
          {notes.length === 0 ? (
            <Text variant="caption" color={colors.textTertiary}>
              Tap a paragraph to highlight, bookmark, or write a note.
            </Text>
          ) : (
            notes.map((note) => (
              <View key={note.id} style={styles.noteRow}>
                <View style={styles.noteMeta}>
                  <Text variant="caption" color={colors.textSecondary}>
                    {note.note_type.toUpperCase()}
                  </Text>
                  {note.note_text ? (
                    <Text variant="body" color={colors.text}>
                      {note.note_text}
                    </Text>
                  ) : null}
                  {note.selected_text ? (
                    <Text variant="caption" color={colors.textTertiary} numberOfLines={2}>
                      {note.selected_text}
                    </Text>
                  ) : null}
                </View>
                <Pressable onPress={() => remove(note.id)}>
                  <Text variant="caption" color={colors.danger}>Delete</Text>
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.base,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.base,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  toolButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BOOKS_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reader: {
    flex: 1,
  },
  segment: {
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 6,
    marginBottom: spacing.xs,
  },
  segmentHighlight: {
    backgroundColor: '#f9d97666',
  },
  segmentSelected: {
    backgroundColor: '#7ab6ff33',
  },
  selectionCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  selectionActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  composer: {
    gap: spacing.xs,
  },
  composerInput: {
    minHeight: 64,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    color: colors.text,
    textAlignVertical: 'top',
  },
  notesPane: {
    maxHeight: 220,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  notesContent: {
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  noteRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  noteMeta: {
    flex: 1,
    gap: 4,
  },
});
