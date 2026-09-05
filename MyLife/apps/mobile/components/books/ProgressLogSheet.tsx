import React, { useState } from 'react';
import { View, Modal, StyleSheet, TextInput, Pressable } from 'react-native';
import { Text, Button, colors, spacing } from '@mylife/ui';
import { useProgress } from '../../hooks/books/use-progress';

const BOOKS_ACCENT = colors.modules.books;

interface ProgressLogSheetProps {
  bookId: string;
  sessionId: string;
  pageCount: number | null;
  visible: boolean;
  onClose: () => void;
}

export function ProgressLogSheet({ bookId, sessionId, pageCount, visible, onClose }: ProgressLogSheetProps) {
  const { speed, logProgress, loading } = useProgress(bookId);
  const [page, setPage] = useState('');

  const currentPage = parseInt(page, 10);
  const isValid = !isNaN(currentPage) && currentPage > 0;

  const hoursRemaining =
    speed && pageCount && isValid
      ? Math.max(0, (pageCount - currentPage) / speed.averagePagesPerHour)
      : null;

  const handleLog = () => {
    if (!isValid) return;
    logProgress(currentPage, pageCount);
    setPage('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text variant="subheading" style={styles.title}>Log Reading Progress</Text>

          <View style={styles.field}>
            <Text variant="label" color={colors.textSecondary}>Current page</Text>
            <TextInput
              style={styles.input}
              value={page}
              onChangeText={setPage}
              keyboardType="number-pad"
              placeholder={pageCount ? `of ${pageCount}` : 'Page number'}
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          {speed && (
            <View style={styles.speedRow}>
              <Text variant="caption" color={colors.textSecondary}>
                {Math.round(speed.averagePagesPerHour)} pages/hour
              </Text>
              {hoursRemaining !== null && (
                <Text variant="caption" color={colors.textSecondary}>
                  ~{hoursRemaining < 1 ? `${Math.round(hoursRemaining * 60)}m` : `${hoursRemaining.toFixed(1)}h`} remaining
                </Text>
              )}
            </View>
          )}

          <Button
            variant="primary"
            label={loading ? 'Saving...' : 'Log Progress'}
            onPress={handleLog}
            disabled={!isValid || loading}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    gap: spacing.md,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    textAlign: 'center',
  },
  field: {
    gap: spacing.xs,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: spacing.sm,
    color: colors.text,
    fontFamily: 'Inter',
    fontSize: 16,
  },
  speedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
