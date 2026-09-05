import React from 'react';
import { View, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { colors } from '../tokens/colors';
import { spacing, borderRadius } from '../tokens/spacing';

interface Props {
  name: string;
  color?: string;
  onRemove?: () => void;
  style?: ViewStyle;
}

export function TagPill({ name, color, onRemove, style }: Props) {
  return (
    <View style={[styles.container, style]}>
      {color ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      <Text variant="caption" color={colors.textSecondary}>
        {name}
      </Text>
      {onRemove ? (
        <Pressable onPress={onRemove} hitSlop={8} style={styles.removeButton}>
          <Text variant="caption" color={colors.textTertiary}>
            x
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.xl,
    alignSelf: 'flex-start',
    gap: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  removeButton: {
    marginLeft: 2,
  },
});
