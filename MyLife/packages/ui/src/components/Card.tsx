import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { colors } from '../tokens/colors';
import { borderRadius, spacing } from '../tokens/spacing';
import { shadows } from '../tokens/shadows';
import { useModuleTheme } from './ModuleThemeProvider';

interface CardProps extends ViewProps {
  elevated?: boolean;
  children: React.ReactNode;
}

export function Card({ elevated = false, style, children, ...props }: CardProps) {
  const theme = useModuleTheme();
  const themedStyle = theme
    ? {
      backgroundColor: elevated ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)',
      borderColor: hexToRgba(theme.accent, elevated ? 0.30 : 0.22),
      shadowColor: theme.accent,
      shadowOpacity: elevated ? 0.22 : 0.14,
      shadowRadius: elevated ? 20 : 14,
    }
    : undefined;

  return (
    <View
      style={[
        styles.card,
        elevated && styles.elevated,
        themedStyle,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  elevated: {
    backgroundColor: colors.surfaceElevated,
    ...shadows.elevated,
  },
});

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized;

  const int = Number.parseInt(full, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;

  return `rgba(${r},${g},${b},${alpha})`;
}
