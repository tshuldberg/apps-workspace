'use client';

import { useState, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from './Button';
import { OnboardingPage, OnboardingFeatureRow } from './OnboardingPage';
import { PasswordInput } from './PasswordInput';
import { PassphraseRecommendation } from './PassphraseRecommendation';
import { validatePassword } from '@mylife/auth/password-validation';
import { spacing } from '../tokens/spacing';

interface OnboardingFlowProps {
  /** Called when the user completes the flow with a valid password. */
  onComplete: (password: string) => void;
  /** Called when the user taps "Skip" on skippable pages. */
  onSkip?: () => void;
}

/**
 * Three-page privacy-first onboarding flow.
 *
 * Page 1: "Your data stays yours" (skippable)
 * Page 2: "Some features need the internet" (skippable)
 * Page 3: "Protect your data" (password required, not skippable)
 */
export function OnboardingFlow({ onComplete, onSkip }: OnboardingFlowProps) {
  const [page, setPage] = useState(0);
  const [password, setPassword] = useState('');

  const next = useCallback(() => setPage((p) => p + 1), []);

  const handleSkip = useCallback(() => {
    if (page < 2) {
      setPage(2);
    }
    onSkip?.();
  }, [page, onSkip]);

  const handleComplete = useCallback(() => {
    const result = validatePassword(password);
    if (result.valid) {
      onComplete(password);
    }
  }, [password, onComplete]);

  const handleUsePassphrase = useCallback((passphrase: string) => {
    setPassword(passphrase);
  }, []);

  const isPasswordValid = password.length > 0 && validatePassword(password).valid;

  if (page === 0) {
    return (
      <OnboardingPage
        icon={'\uD83D\uDD12'}
        title="Your data stays yours"
        subtitle="MyLife stores everything on your device. No tracking, no telemetry, no cloud by default. Your personal data never leaves your phone unless you choose otherwise."
        footer={
          <View style={styles.footerButtons}>
            <Button variant="primary" title="Continue" onPress={next} />
            <Button variant="ghost" title="Skip to password" onPress={handleSkip} />
          </View>
        }
      >
        <OnboardingFeatureRow icon={'\uD83D\uDCF1'} text="All data stored locally on your device" />
        <OnboardingFeatureRow icon={'\uD83D\uDEAB'} text="Zero analytics, zero telemetry" />
        <OnboardingFeatureRow icon={'\u2708\uFE0F'} text="Works completely offline" />
        <OnboardingFeatureRow icon={'\uD83D\uDC41\uFE0F'} text="Open source so you can verify" />
      </OnboardingPage>
    );
  }

  if (page === 1) {
    return (
      <OnboardingPage
        icon={'\uD83C\uDF10'}
        title="Some features need the internet"
        subtitle="A few modules connect to the cloud for live data or cross-device sync. This is always your choice and can be changed in Settings."
        footer={
          <View style={styles.footerButtons}>
            <Button variant="primary" title="Continue" onPress={next} />
            <Button variant="ghost" title="Skip to password" onPress={handleSkip} />
          </View>
        }
      >
        <OnboardingFeatureRow icon={'\uD83C\uDFC4'} text="MySurf fetches live wave and tide data" />
        <OnboardingFeatureRow icon={'\uD83C\uDFCB\uFE0F'} text="MyWorkouts syncs across your devices" />
        <OnboardingFeatureRow icon={'\uD83C\uDFE0'} text="MyHomes connects to listing services" />
        <OnboardingFeatureRow icon={'\u2705'} text="Everything else stays fully offline" />
      </OnboardingPage>
    );
  }

  // Page 3: Protect your data (not skippable)
  return (
    <OnboardingPage
      icon={'\uD83D\uDEE1\uFE0F'}
      title="Protect your data"
      subtitle="Create a password to secure your local data. We recommend a passphrase: just pick 4 random words."
      footer={
        <Button
          variant="primary"
          title="Create Account"
          onPress={handleComplete}
          disabled={!isPasswordValid}
          style={!isPasswordValid ? styles.disabledButton : undefined}
        />
      }
    >
      <PasswordInput
        value={password}
        onChangeText={setPassword}
        label="Password"
        placeholder="Enter your password"
      />
      <PassphraseRecommendation onUsePassphrase={handleUsePassphrase} />
    </OnboardingPage>
  );
}

const styles = StyleSheet.create({
  footerButtons: {
    gap: spacing.sm,
  },
  disabledButton: {
    opacity: 0.4,
  },
});