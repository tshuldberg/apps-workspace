import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Pressable, StyleSheet, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { getClassesSettings } from '@mylife/classes';
import { Text, borderRadius, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../DatabaseProvider';

const ACCENT = colors.modules?.classes ?? '#3B82F6';

interface BiometricGateProps {
  children: React.ReactNode;
}

export function BiometricGate({ children }: BiometricGateProps) {
  const db = useDatabase();
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      return getClassesSettings(db).requireBiometricLock;
    } catch {
      return false;
    }
  });
  const [unlocked, setUnlocked] = useState<boolean>(!enabled);
  const [bypassed, setBypassed] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hardwareOk, setHardwareOk] = useState<boolean | null>(null);
  const inFlight = useRef(false);

  const refreshSetting = useCallback(() => {
    try {
      const next = getClassesSettings(db).requireBiometricLock;
      setEnabled(next);
      if (!next) {
        setUnlocked(true);
        setBypassed(false);
        setError(null);
      }
    } catch {
      // ignore; assume disabled
    }
  }, [db]);

  const tryAuth = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    try {
      const hasHw = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHw || !enrolled) {
        setHardwareOk(false);
        setError(
          'No biometrics enrolled on this device. Set up Face ID/Touch ID in system settings.',
        );
        return;
      }
      setHardwareOk(true);
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock MyClasses',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use passcode',
      });
      if (result.success) {
        setUnlocked(true);
        setError(null);
      } else {
        setError('Authentication cancelled or failed.');
      }
    } catch {
      setError('Biometric authentication failed.');
    } finally {
      inFlight.current = false;
    }
  }, []);

  // On mount + when setting flips on, attempt auth.
  useEffect(() => {
    if (enabled && !unlocked && !bypassed) {
      void tryAuth();
    }
  }, [enabled, unlocked, bypassed, tryAuth]);

  // Re-lock on background -> active transitions; refresh setting from DB on each transition.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        setUnlocked(false);
        setBypassed(false);
      }
      if (next === 'active') {
        refreshSetting();
      }
    });
    return () => sub.remove();
  }, [refreshSetting]);

  if (!enabled || unlocked || bypassed) {
    return <>{children}</>;
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.icon}>{'\uD83D\uDD12'}</Text>
        <Text style={styles.title}>MyClasses is locked</Text>
        <Text variant="body" color={colors.textSecondary} style={styles.body}>
          Unlock with Face ID, Touch ID, or your device passcode to continue.
        </Text>
        {error ? (
          <Text variant="caption" color={colors.danger} style={styles.error}>
            {error}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          style={styles.primaryButton}
          onPress={() => void tryAuth()}
        >
          <Text variant="label" color={colors.background}>
            Unlock
          </Text>
        </Pressable>
        {hardwareOk === false ? (
          <Pressable
            accessibilityRole="link"
            style={styles.bypassLink}
            onPress={() => setBypassed(true)}
          >
            <Text variant="caption" color={colors.textSecondary}>
              Disable lock for this session
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: {
    fontSize: 56,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
    lineHeight: 21,
  },
  error: {
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: spacing.md,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.pill,
    backgroundColor: ACCENT,
  },
  bypassLink: {
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
  },
});
