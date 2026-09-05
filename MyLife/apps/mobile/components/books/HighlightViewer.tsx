import React from 'react';
import { View, StyleSheet, Alert, Pressable } from 'react-native';
import { Text, Button, colors, spacing } from '@mylife/ui';
import { useReaderNotes } from '../../hooks/books/use-reader-notes';

const BOOKS_ACCENT = colors.modules.books;

interface HighlightViewerProps {
  documentId: string;
}

export function HighlightViewer({ documentId }: HighlightViewerProps) {
  const { notes, remove, loading } = useReaderNotes(documentId);

  if (loading || notes.length === 0) {
    if (notes.length === 0 && !loading) {
      return (
        <View style={styles.emptyContainer}>
          <Text variant="body" color={colors.textTertiary}>
            No highlights yet. Highlight text while reading to save passages.
          </Text>
        </View>
      );
    }
    return null;
  }

  const handleDelete = (id: string) => {
    Alert.alert('Delete', 'Remove this highlight?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove(id) },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="subheading">Highlights & Notes</Text>
        <View style={styles.countBadge}>
          <Text variant="caption" color={colors.text}>{notes.length}</Text>
        </View>
      </View>

      {notes.map((note) => {
        const isHighlight = note.note_type === 'highlight';
        return (
          <View key={note.id} style={styles.noteRow}>
            <View style={[styles.leftBorder, { backgroundColor: isHighlight ? '#FFD700' : BOOKS_ACCENT }]} />
            <View style={styles.noteContent}>
              {note.selected_text && (
                <Text variant="body" style={styles.excerptText}>{note.selected_text}</Text>
              )}
              {note.note_text && (
                <Text variant="body" color={colors.textSecondary}>{note.note_text}</Text>
              )}
              <Pressable onPress={() => handleDelete(note.id)} hitSlop={8}>
                <Text variant="caption" color={colors.danger}>Delete</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  emptyContainer: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  countBadge: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 999,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  noteRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  leftBorder: {
    width: 4,
    borderRadius: 2,
  },
  noteContent: {
    flex: 1,
    gap: spacing.xs,
  },
  excerptText: {
    fontStyle: 'italic',
  },
});
