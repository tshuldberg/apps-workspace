import React from 'react';
import { View, StyleSheet, type ViewStyle, type ViewProps } from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../tokens';

interface Props extends ViewProps {
  elevated?: boolean;
  style?: ViewStyle;
  children: React.ReactNode;
}

export function Card({ elevated = false, style, children, ...rest }: Props) {
  return (
    <View
      style={[
        styles.base,
        elevated && styles.elevated,
        elevated ? shadows.elevated : shadows.card,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  elevated: {
    backgroundColor: colors.surfaceElevated,
  },
});
