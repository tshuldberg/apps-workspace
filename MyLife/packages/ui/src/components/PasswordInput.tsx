'use client';

import React, { useState, useCallback } from 'react';
import { StyleSheet, View, TextInput, Pressable } from 'react-native';
import { validatePassword } from '@mylife/auth/password-validation';
import { Text } from './Text';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { colors } from '../tokens/colors';
import { spacing, borderRadius } from '../tokens/spacing';

interface PasswordInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  label?: string;
}

export function PasswordInput({
  value,
  onChangeText,
  placeholder = 'Password',
  label,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const toggleVisible = useCallback(() => setVisible((v) => !v), []);

  const validation = value.length > 0 ? validatePassword(value) : null;

  return (
    <View style={styles.container}>
      {label ? (
        <Text variant="label" color={colors.textSecondary} style={styles.label}>
          {label}
        </Text>
      ) : null}
      <View style={styles.inputRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        <Pressable onPress={toggleVisible} hitSlop={8} style={styles.toggle}>
          <Text variant="caption" color={colors.textTertiary}>
            {visible ? 'Hide' : 'Show'}
          </Text>
        </Pressable>
      </View>
      {validation ? (
        <View style={styles.feedback}>
          <PasswordStrengthMeter strength={validation.strength} />
          {validation.errors.length > 0 ? (
            <View style={styles.errors}>
              {validation.errors.map((err) => (
                <Text key={err} variant="caption" color={colors.danger}>
                  {err}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    marginBottom: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    height: 48,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontFamily: 'Inter',
    fontSize: 16,
    paddingVertical: 0,
  },
  toggle: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
  feedback: {
    gap: spacing.sm,
  },
  errors: {
    gap: spacing.xs,
  },
});