'use client';

import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from './Text';
import { colors } from '../tokens/colors';
import { borderRadius, spacing } from '../tokens/spacing';

interface BetaDisclaimerProps {
  moduleName?: string;
}

export function BetaDisclaimer({ moduleName }: BetaDisclaimerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const label = moduleName
    ? `${moduleName} is in public beta.`
    : 'This module is in public beta.';

  return (
    <View style={styles.banner}>
      <View style={styles.content}>
        <Text variant="caption" color={colors.textSecondary}>
          {label} Features may change and data formats may evolve between
          updates.
        </Text>
      </View>
      <TouchableOpacity
        style={styles.dismiss}
        onPress={() => setDismissed(true)}
        accessibilityLabel="Dismiss beta disclaimer"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text variant="label" color={colors.textTertiary}>
          ✕
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  content: {
    flex: 1,
  },
  dismiss: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
});