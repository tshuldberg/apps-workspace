import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, colors, spacing } from '@mylife/ui';

/**
 * Header-left back button that returns the user to the app selector.
 * Used in per-module stack headers.
 *
 * @deprecated Use {@link ModuleHeader} from './ModuleHeader' instead.
 * ModuleHeader provides a unified header with back button, module name,
 * and hamburger menu. This component is retained only for non-layout
 * screens that still need a standalone back button.
 */
export function BackToHubButton() {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={() => router.replace('/(hub)')}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Text color={colors.textSecondary} style={styles.label}>
        {'< Apps'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingRight: spacing.md,
  },
  label: {
    fontSize: 16,
  },
});
