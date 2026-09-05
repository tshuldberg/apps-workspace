import React, { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { OnboardingFlow } from '@mylife/ui';

export default function OnboardingPrivacyScreen() {
  const router = useRouter();

  const handleComplete = useCallback(
    (_password: string) => {
      // Password will be consumed by the auth registration flow
      // wired in Task #4. For now, proceed to the mode selection screen.
      router.replace('/(hub)/onboarding-mode');
    },
    [router],
  );

  const handleSkip = useCallback(() => {
    // Skip just advances to the password page inside the flow,
    // no external navigation needed.
  }, []);

  return <OnboardingFlow onComplete={handleComplete} onSkip={handleSkip} />;
}
