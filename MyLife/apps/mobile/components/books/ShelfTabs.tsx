import React from 'react';
import { ScrollView, Pressable, StyleSheet } from 'react-native';
import type { Shelf } from '@mylife/books';
import { Text, colors, spacing, borderRadius } from '@mylife/ui';

interface Props {
  shelves: Shelf[];
  activeShelfId: string | null;
  onSelect: (id: string | null) => void;
  bookCounts?: Record<string, number>;
  totalCount?: number;
}

export function ShelfTabs({ shelves, activeShelfId, onSelect, bookCounts, totalCount }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      <Pressable
        style={[styles.tab, activeShelfId === null && styles.tabActive]}
        onPress={() => onSelect(null)}
      >
        <Text
          variant="caption"
          color={activeShelfId === null ? colors.modules.books : colors.textSecondary}
        >
          All{totalCount !== undefined ? ` (${totalCount})` : ''}
        </Text>
      </Pressable>
      {shelves.map((shelf) => {
        const count = bookCounts?.[shelf.id];
        return (
          <Pressable
            key={shelf.id}
            style={[styles.tab, activeShelfId === shelf.id && styles.tabActive]}
            onPress={() => onSelect(shelf.id)}
          >
            <Text
              variant="caption"
              color={activeShelfId === shelf.id ? colors.modules.books : colors.textSecondary}
            >
              {shelf.icon ? `${shelf.icon} ` : ''}{shelf.name}{count !== undefined ? ` (${count})` : ''}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const BOOKS_ACCENT = colors.modules.books;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  tab: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    borderColor: BOOKS_ACCENT,
    backgroundColor: BOOKS_ACCENT + '15',
  },
});
