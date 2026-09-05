import { Pressable, StyleSheet, View, Text } from 'react-native';
import { colors } from '@mylife/ui';
import type { ConflictIndexEntry } from '@mylife/classes';

export interface ConflictBadgeProps {
  conflicts: ConflictIndexEntry[];
  onPress?: () => void;
  size?: 'sm' | 'md';
}

/**
 * Warning pill that surfaces overlapping classes. Tap opens the conflict
 * resolver sheet (managed by the parent screen since it needs router access).
 */
export function ConflictBadge({ conflicts, onPress, size = 'sm' }: ConflictBadgeProps) {
  if (conflicts.length === 0) return null;
  const summary =
    conflicts.length === 1
      ? `Overlaps ${conflicts[0].otherName}`
      : `${conflicts.length} conflicts`;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.badge, size === 'md' ? styles.md : styles.sm]}
      accessibilityRole="button"
      accessibilityLabel={`Schedule conflict: ${summary}`}
    >
      <View style={styles.dot} />
      <Text numberOfLines={1} style={styles.text}>
        {summary}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: colors.errorContainer,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  sm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  md: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.danger,
  },
  text: {
    color: colors.danger,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
});
