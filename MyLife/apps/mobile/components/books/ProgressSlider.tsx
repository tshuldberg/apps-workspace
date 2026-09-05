import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Pressable } from 'react-native';
import { Text, colors, spacing } from '@mylife/ui';

interface Props {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function ProgressSlider({ currentPage, totalPages, onPageChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(String(currentPage));
  const progress = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;

  const handleSubmit = () => {
    const page = Math.max(0, Math.min(parseInt(inputValue, 10) || 0, totalPages));
    onPageChange(page);
    setEditing(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress}%` }]} />
      </View>

      <View style={styles.pageRow}>
        {editing ? (
          <View style={styles.inputRow}>
            <Text variant="caption" color={colors.textSecondary}>Page</Text>
            <TextInput
              value={inputValue}
              onChangeText={setInputValue}
              onSubmitEditing={handleSubmit}
              onBlur={handleSubmit}
              keyboardType="number-pad"
              autoFocus
              style={styles.pageInput}
              selectTextOnFocus
            />
            <Text variant="caption" color={colors.textSecondary}>of {totalPages}</Text>
          </View>
        ) : (
          <Pressable onPress={() => { setInputValue(String(currentPage)); setEditing(true); }}>
            <Text variant="body" color={colors.text}>
              Page {currentPage} of {totalPages} -- {progress}%
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  track: {
    height: 6,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    backgroundColor: colors.modules.books,
    borderRadius: 3,
  },
  pageRow: {
    alignItems: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pageInput: {
    color: colors.text,
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '600',
    borderBottomWidth: 1,
    borderBottomColor: colors.modules.books,
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
    minWidth: 50,
    textAlign: 'center',
  },
});
