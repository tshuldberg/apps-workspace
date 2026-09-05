import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { PasswordStrength } from '@mylife/auth/types';
import { Text } from './Text';
import { colors } from '../tokens/colors';
import { spacing, borderRadius } from '../tokens/spacing';

const STRENGTH_CONFIG: Record<
  PasswordStrength,
  { segments: number; color: string; label: string }
> = {
  weak: { segments: 1, color: '#CC5555', label: 'Weak' },
  fair: { segments: 2, color: '#D97706', label: 'Fair' },
  strong: { segments: 3, color: '#5BA55B', label: 'Strong' },
  very_strong: { segments: 4, color: '#22C55E', label: 'Very Strong' },
};

interface PasswordStrengthMeterProps {
  strength: PasswordStrength;
}

export function PasswordStrengthMeter({ strength }: PasswordStrengthMeterProps) {
  const config = STRENGTH_CONFIG[strength];

  return (
    <View style={styles.container}>
      <View style={styles.barRow}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.segment,
              {
                backgroundColor:
                  i < config.segments ? config.color : colors.border,
              },
              i < 3 && styles.segmentGap,
            ]}
          />
        ))}
      </View>
      <Text variant="caption" color={config.color}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  barRow: {
    flexDirection: 'row',
    height: 4,
  },
  segment: {
    flex: 1,
    borderRadius: borderRadius.sm,
  },
  segmentGap: {
    marginRight: spacing.xs,
  },
});
