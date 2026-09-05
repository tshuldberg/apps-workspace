'use client';

import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { generatePassphraseSuggestion, getPasswordStrength } from '@mylife/auth/password-validation';
import { Text } from './Text';
import { Card } from './Card';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { colors } from '../tokens/colors';
import { spacing, borderRadius } from '../tokens/spacing';

interface PassphraseRecommendationProps {
  /** Called when the user taps "Use this" to adopt the generated passphrase. */
  onUsePassphrase?: (passphrase: string) => void;
}

export function PassphraseRecommendation({
  onUsePassphrase,
}: PassphraseRecommendationProps) {
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const handleGenerate = useCallback(() => {
    setSuggestion(generatePassphraseSuggestion());
  }, []);

  const handleUse = useCallback(() => {
    if (suggestion && onUsePassphrase) {
      onUsePassphrase(suggestion);
    }
  }, [suggestion, onUsePassphrase]);

  return (
    <Card style={styles.card}>
      <Text variant="subheading" style={styles.heading}>
        Try a passphrase instead
      </Text>
      <Text variant="body" color={colors.textSecondary} style={styles.body}>
        Pick 4 random words. Longer passwords don't need special characters.
      </Text>

      <Pressable
        onPress={handleGenerate}
        style={({ pressed }) => [
          styles.generateButton,
          pressed && styles.generateButtonPressed,
        ]}
      >
        <Text variant="caption" color={colors.success}>
          Generate suggestion
        </Text>
      </Pressable>

      {suggestion ? (
        <View style={styles.suggestionArea}>
          <View style={styles.suggestionBox}>
            <Text variant="body" style={styles.suggestionText}>
              {suggestion}
            </Text>
          </View>
          <PasswordStrengthMeter strength={getPasswordStrength(suggestion)} />
          {onUsePassphrase ? (
            <Pressable
              onPress={handleUse}
              style={({ pressed }) => [
                styles.useButton,
                pressed && styles.useButtonPressed,
              ]}
            >
              <Text variant="caption" color={colors.text}>
                Use this
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  heading: {
    marginBottom: spacing.xs,
  },
  body: {
    marginBottom: spacing.xs,
  },
  generateButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
  },
  generateButtonPressed: {
    opacity: 0.7,
  },
  suggestionArea: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  suggestionBox: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  suggestionText: {
    fontFamily: 'Inter',
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  useButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.success,
    borderRadius: borderRadius.md,
  },
  useButtonPressed: {
    opacity: 0.7,
  },
});