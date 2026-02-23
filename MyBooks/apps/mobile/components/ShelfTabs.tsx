import React from 'react';
import { ScrollView, Pressable, StyleSheet } from 'react-native';
import type { Shelf } from '@mybooks/shared';
import { Text, colors, spacing, borderRadius } from '@mybooks/ui';

interface Props {
  shelves: Shelf[];
  activeShelfId: string | null;
  onSelect: (id: string | null) => void;
}

export function ShelfTabs({ shelves, activeShelfId, onSelect }: Props) {
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
          color={activeShelfId === null ? colors.accent : colors.textSecondary}
        >
          All
        </Text>
      </Pressable>
      {shelves.map((shelf) => (
        <Pressable
          key={shelf.id}
          style={[styles.tab, activeShelfId === shelf.id && styles.tabActive]}
          onPress={() => onSelect(shelf.id)}
        >
          <Text
            variant="caption"
            color={activeShelfId === shelf.id ? colors.accent : colors.textSecondary}
          >
            {shelf.icon ? `${shelf.icon} ` : ''}{shelf.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

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
    borderColor: colors.accent,
    backgroundColor: colors.accent + '15',
  },
});
