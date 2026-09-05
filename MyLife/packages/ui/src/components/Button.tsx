import React from 'react';
import { StyleSheet, Pressable, Text, type PressableProps } from 'react-native';
import { colors } from '../tokens/colors';
import { borderRadius, spacing } from '../tokens/spacing';
import { typography } from '../tokens/typography';
import { useModuleTheme } from './ModuleThemeProvider';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  /**
   * Preferred button text prop.
   */
  title?: string;
  /**
   * Backward-compatible text prop used by existing app code.
   */
  label?: string;
  /**
   * Optional custom content. If provided, it takes precedence over title/label.
   */
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}

export function Button({
  title,
  label,
  children,
  variant = 'primary',
  style,
  ...props
}: ButtonProps) {
  const theme = useModuleTheme();
  const accent = theme?.accent ?? colors.accent;
  const textContent = title ?? label ?? '';
  const textColor =
    variant === 'primary'
      ? colors.background
      : variant === 'danger'
        ? colors.danger
        : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: props.disabled === true }}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary'
          ? { backgroundColor: pressed ? `${accent}CC` : accent }
          : variant === 'secondary'
            ? styles.secondary
            : variant === 'danger'
              ? styles.danger
              : styles.ghost,
        pressed && variant === 'secondary' && styles.secondaryPressed,
        pressed && variant === 'ghost' && styles.ghostPressed,
        pressed && variant === 'danger' && styles.dangerPressed,
        typeof style === 'function' ? style({ pressed }) : style,
      ]}
      {...props}
    >
      <Text
        style={[
          styles.text,
          { color: textColor },
        ]}
      >
        {children ?? textContent}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryPressed: {
    backgroundColor: colors.surfaceElevated,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  ghostPressed: {
    backgroundColor: colors.surface,
  },
  danger: {
    backgroundColor: 'rgba(255,180,171,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,180,171,0.35)',
  },
  dangerPressed: {
    backgroundColor: 'rgba(255,180,171,0.16)',
  },
  text: {
    fontFamily: typography.body.fontFamily,
    fontSize: 16,
    fontWeight: '600',
  },
});
