import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { tokens } from '../theme/tokens';

interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function PrimaryButton({ label, onPress, disabled, loading }: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      // The label is set explicitly rather than left to the Text child: while
      // `loading` is true the child is a spinner, and a button whose only name
      // came from that child would announce as unlabelled at exactly the moment
      // the user is waiting to hear what is happening. `busy` says so directly.
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        styles.primary,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tokens.bg} />
      ) : (
        <Text style={[styles.label, styles.primaryLabel, isDisabled && styles.disabledLabel]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, disabled }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.base,
        styles.secondary,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.label, styles.secondaryLabel, disabled && styles.disabledLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primary: {
    backgroundColor: tokens.accent,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: tokens.border,
  },
  disabled: {
    backgroundColor: tokens.elevated,
    borderColor: 'transparent',
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
  },
  primaryLabel: {
    color: tokens.bg,
  },
  secondaryLabel: {
    color: tokens.text,
  },
  disabledLabel: {
    color: tokens.textTertiary,
  },
});
