import React, { useState } from 'react';
import { StyleSheet, View, Pressable, ActivityIndicator } from 'react-native';
import { Card, Text, colors, spacing, borderRadius } from '@mylife/ui';
import { useHumanVerification } from '../hooks/use-human-verification';

interface VerificationGateProps {
  /** Content shown when the user is verified. */
  children: React.ReactNode;
  /** Optional user ID (defaults to 'local' for offline mode). */
  userId?: string;
}

/**
 * Gates social write actions (Forums posting, Market listings) behind
 * biometric human verification.
 *
 * Read-only browsing is allowed without verification -- this gate
 * should wrap ONLY the write action UI (post buttons, listing forms),
 * not the entire module screen.
 *
 * The OS Secure Enclave handles all biometric processing.
 * We receive ONLY a boolean. Biometric data never reaches our code.
 */
export function VerificationGate({ children, userId }: VerificationGateProps) {
  const { verified, requestVerification } = useHumanVerification(userId);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (verified) {
    return <>{children}</>;
  }

  const handleVerify = async () => {
    setVerifying(true);
    setError(null);

    const result = await requestVerification();
    if (!result.success) {
      setError(result.error ?? 'Verification failed.');
    }

    setVerifying(false);
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.icon}>🛡️</Text>
          <Text variant="heading" style={styles.title}>
            Human Verification
          </Text>
          <Text variant="body" color={colors.textSecondary} style={styles.subtitle}>
            Verify you are human to post and trade. This keeps our community safe from bots.
          </Text>
        </View>

        <View style={styles.privacyNote}>
          <Text variant="caption" color={colors.textSecondary} style={styles.privacyText}>
            We receive only a yes/no from your device. Your biometric data never leaves the Secure Enclave.
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.verifyButton,
            pressed && styles.verifyButtonPressed,
            verifying && styles.disabled,
          ]}
          onPress={() => void handleVerify()}
          disabled={verifying}
        >
          {verifying ? (
            <ActivityIndicator color={colors.background} size="small" />
          ) : (
            <Text style={styles.verifyButtonText}>
              Verify with Face ID / Touch ID
            </Text>
          )}
        </Pressable>

        {error && (
          <Text variant="caption" color={colors.danger} style={styles.error}>
            {error}
          </Text>
        )}

        <Text variant="caption" color={colors.textSecondary} style={styles.footnote}>
          You can still browse content without verifying.
        </Text>
      </Card>
    </View>
  );
}

/**
 * Inline verification prompt for use inside forms or action sheets.
 * Smaller than the full VerificationGate -- just a button + status.
 */
export function VerificationPrompt({
  userId,
  onVerified,
}: {
  userId?: string;
  onVerified?: () => void;
}) {
  const { verified, requestVerification } = useHumanVerification(userId);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (verified) {
    return null;
  }

  const handleVerify = async () => {
    setVerifying(true);
    setError(null);

    const result = await requestVerification();
    if (result.success) {
      onVerified?.();
    } else {
      setError(result.error ?? 'Verification failed.');
    }

    setVerifying(false);
  };

  return (
    <View style={styles.inlineContainer}>
      <Pressable
        style={({ pressed }) => [
          styles.inlineButton,
          pressed && styles.inlineButtonPressed,
          verifying && styles.disabled,
        ]}
        onPress={() => void handleVerify()}
        disabled={verifying}
      >
        {verifying ? (
          <ActivityIndicator color={colors.accent} size="small" />
        ) : (
          <Text variant="caption" color={colors.accent}>
            🛡️ Verify to continue
          </Text>
        )}
      </Pressable>
      {error && (
        <Text variant="caption" color={colors.danger} style={styles.inlineError}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 22,
  },
  privacyNote: {
    backgroundColor: colors.glass,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
    width: '100%',
  },
  privacyText: {
    textAlign: 'center',
    lineHeight: 18,
  },
  verifyButton: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accent,
    marginBottom: spacing.sm,
  },
  verifyButtonPressed: {
    opacity: 0.85,
  },
  verifyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  disabled: {
    opacity: 0.6,
  },
  error: {
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  footnote: {
    textAlign: 'center',
  },
  inlineContainer: {
    paddingVertical: spacing.xs,
  },
  inlineButton: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  inlineButtonPressed: {
    backgroundColor: `${colors.accent}15`,
  },
  inlineError: {
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
