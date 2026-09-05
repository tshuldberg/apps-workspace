import React, { useCallback, useEffect, useState } from 'react';
import { AppState, StyleSheet, TextInput, View } from 'react-native';
import { usePathname } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { attemptUnlock, getModuleLock, resetLockFailedAttempts } from '@mylife/auth';
import { Button, Text } from '@mylife/ui';
import { useManhattanDatabase } from '../providers/DatabaseProvider';

const MODULE_ID = 'manhattan';
const ACCENT = '#E4572E';
const BACKGROUND = '#131318';

// Gates the app behind the optional Manhattan PIN/biometric lock. When no lock
// is configured this renders children immediately. The unlock state is held in
// memory for the session, so children stay visible after a successful unlock.
export function ManhattanLockGuard({ children }: { children: React.ReactNode }) {
  const db = useManhattanDatabase();
  const pathname = usePathname();
  const [hasLock, setHasLock] = useState(() => getModuleLock(db, MODULE_ID) !== null);
  const [unlocked, setUnlocked] = useState(() => getModuleLock(db, MODULE_ID) === null);
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  const refreshLockState = useCallback((forceLock = false) => {
    const configured = getModuleLock(db, MODULE_ID) !== null;
    setHasLock(configured);
    setUnlocked((current) => {
      if (!configured) return true;
      return forceLock ? false : current;
    });
  }, [db]);

  useEffect(() => {
    refreshLockState(false);
  }, [pathname, refreshLockState]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshLockState(true);
        return;
      }
      if (getModuleLock(db, MODULE_ID) !== null) {
        setHasLock(true);
        setUnlocked(false);
      }
    });
    return () => subscription.remove();
  }, [db, refreshLockState]);

  useEffect(() => {
    if (!hasLock || unlocked) return;
    let mounted = true;
    void (async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (mounted) setBiometricAvailable(hasHardware && enrolled);
    })();
    return () => {
      mounted = false;
    };
  }, [hasLock, unlocked]);

  const handleSubmit = useCallback(async () => {
    if (verifying || pin.length < 4) return;
    setVerifying(true);
    try {
      const result = await attemptUnlock(db, MODULE_ID, pin);
      if (result.status === 'unlocked') {
        setUnlocked(true);
        return;
      }
      if (result.status === 'locked_out') {
        const seconds = Math.ceil(result.remainingMs / 1000);
        setMessage(`Too many attempts. Try again in ${seconds}s.`);
      } else if (result.status === 'invalid') {
        const remaining = Math.max(0, 5 - result.failedAttempts);
        setMessage(
          remaining > 0
            ? `Incorrect PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`
            : 'Incorrect PIN. Account locked.',
        );
      } else if (result.status === 'not_configured') {
        // No lock is configured, so there is nothing to enforce.
        setUnlocked(true);
      }
      setPin('');
    } finally {
      setVerifying(false);
    }
  }, [db, pin, verifying]);

  const handleBiometric = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Manhattan',
      cancelLabel: 'Cancel',
      fallbackLabel: 'Use PIN',
    });
    if (result.success) {
      resetLockFailedAttempts(db, MODULE_ID);
      setUnlocked(true);
    }
  }, [db]);

  if (unlocked) {
    return <>{children}</>;
  }

  return (
    <View style={styles.container}>
      <Text variant="heading" color="#E4E1E9" style={styles.title}>
        Manhattan is Locked
      </Text>
      <Text variant="caption" color="#9F8E81" style={styles.subtitle}>
        Enter your PIN to continue.
      </Text>

      <TextInput
        style={styles.input}
        value={pin}
        accessibilityLabel="PIN"
        onChangeText={(value) => {
          setPin(value.replace(/[^0-9]/g, ''));
          setMessage(null);
        }}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={6}
        placeholder="PIN"
        placeholderTextColor="#52443A"
        autoFocus
        onSubmitEditing={() => void handleSubmit()}
      />

      {message && (
        <Text variant="caption" color="#FFB4AB" style={styles.message}>
          {message}
        </Text>
      )}

      <Button
        title={verifying ? 'Checking...' : 'Unlock'}
        onPress={() => void handleSubmit()}
        disabled={verifying || pin.length < 4}
      />

      {biometricAvailable && (
        <Button
          title="Use biometrics"
          variant="ghost"
          onPress={() => void handleBiometric()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: 8 },
  input: {
    backgroundColor: '#1F1F25',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#E4E1E9',
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: ACCENT,
  },
  message: { textAlign: 'center' },
});
