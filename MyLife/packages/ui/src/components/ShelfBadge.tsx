import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { spacing, borderRadius } from '../tokens/spacing';

interface Props {
  name: string;
  color?: string;
  icon?: string;
  compact?: boolean;
  style?: ViewStyle;
}

export function ShelfBadge({
  name,
  color = '#2C6B50',
  icon,
  compact = false,
  style,
}: Props) {
  return (
    <View
      style={[
        styles.base,
        compact && styles.compact,
        { backgroundColor: color + '22', borderColor: color + '55' },
        style,
      ]}
    >
      {icon ? (
        <Text variant="caption" style={styles.icon}>
          {icon}
        </Text>
      ) : null}
      <Text
        variant={compact ? 'label' : 'caption'}
        color={color}
        numberOfLines={1}
      >
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  compact: {
    paddingVertical: 2,
    paddingHorizontal: spacing.xs + 2,
  },
  icon: {
    marginRight: spacing.xs,
  },
});
