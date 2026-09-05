'use client';

import { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { validatePassword } from '@mylife/auth/password-validation';
import { Text } from './Text';
import { Button } from './Button';
import { PasswordInput } from './PasswordInput';
import { PassphraseRecommendation } from './PassphraseRecommendation';
import { colors } from '../tokens/colors';
import { spacing, borderRadius } from '../tokens/spacing';

interface AuthFormProps {
  mode: 'sign-up' | 'sign-in';
  onSubmit: (email: string, password: string, displayName?: string) => Promise<void>;
  /** Backend error to display (e.g. "Email already taken") */
  error?: string;
}

export function AuthForm({ mode, onSubmit, error }: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isSignUp = mode === 'sign-up';
  const validation = password.length > 0 ? validatePassword(password) : null;
  const canSubmit =
    email.trim().length > 0 &&
    password.length > 0 &&
    (validation?.valid ?? false) &&
    (!isSignUp || displayName.trim().length > 0) &&
    !loading;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await onSubmit(
        email.trim(),
        password,
        isSignUp ? displayName.trim() : undefined,
      );
    } finally {
      setLoading(false);
    }
  }, [canSubmit, email, password, displayName, isSignUp, onSubmit]);

  const handleUsePassphrase = useCallback((passphrase: string) => {
    setPassword(passphrase);
  }, []);

  return (
    <View style={styles.container}>
      <Text variant="heading" style={styles.title}>
        {isSignUp ? 'Create account' : 'Welcome back'}
      </Text>
      <Text variant="body" color={colors.textSecondary} style={styles.subtitle}>
        {isSignUp
          ? 'Your data stays on your device. This password protects it.'
          : 'Enter your credentials to unlock your data.'}
      </Text>

      {/* Email field */}
      <View style={styles.fieldGroup}>
        <Text variant="label" color={colors.textSecondary}>
          EMAIL
        </Text>
        <View style={styles.inputRow}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            style={styles.input}
          />
        </View>
      </View>

      {/* Display name (sign-up only) */}
      {isSignUp ? (
        <View style={styles.fieldGroup}>
          <Text variant="label" color={colors.textSecondary}>
            DISPLAY NAME
          </Text>
          <View style={styles.inputRow}>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="words"
              autoComplete="name"
              style={styles.input}
            />
          </View>
        </View>
      ) : null}

      {/* Password field */}
      <PasswordInput
        value={password}
        onChangeText={setPassword}
        label={isSignUp ? 'PASSWORD' : 'PASSWORD'}
        placeholder={isSignUp ? 'Create a password' : 'Enter your password'}
      />

      {/* Passphrase recommendation (sign-up only) */}
      {isSignUp ? (
        <PassphraseRecommendation onUsePassphrase={handleUsePassphrase} />
      ) : null}

      {/* Backend error */}
      {error ? (
        <Text variant="caption" color={colors.danger} style={styles.error}>
          {error}
        </Text>
      ) : null}

      {/* Submit button */}
      <Button
        title={loading ? '' : isSignUp ? 'Create Account' : 'Sign In'}
        onPress={handleSubmit}
        disabled={!canSubmit}
        style={[styles.submitButton, !canSubmit && styles.submitDisabled]}
      >
        {loading ? (
          <ActivityIndicator color={colors.background} size="small" />
        ) : undefined}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  title: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    marginBottom: spacing.sm,
  },
  fieldGroup: {
    gap: spacing.sm,
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
  error: {
    marginTop: spacing.xs,
  },
  submitButton: {
    marginTop: spacing.sm,
  },
  submitDisabled: {
    opacity: 0.4,
  },
});