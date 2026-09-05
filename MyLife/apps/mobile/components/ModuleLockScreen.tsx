import { useEffect, useState, useRef, useCallback } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  getModuleLock,
  verifyPin,
  incrementLockFailedAttempts,
  resetLockFailedAttempts,
  setLockLockedUntil,
  checkLockout,
  computeLockedUntil,
  LOCKOUT_MAX_ATTEMPTS,
} from '@mylife/auth';
import type { DatabaseAdapter } from '@mylife/db';
import { Text, colors, spacing } from '@mylife/ui';

const PIN_LENGTH = 4;
const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

interface ModuleLockScreenProps {
  moduleId: string;
  moduleName: string;
  moduleIcon: string;
  accentColor: string;
  db: DatabaseAdapter;
  onUnlock: () => void;
}

export function ModuleLockScreen({
  moduleId,
  moduleName,
  moduleIcon,
  accentColor,
  db,
  onUnlock,
}: ModuleLockScreenProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometric');
  const [lockMethod, setLockMethod] = useState<'pin' | 'biometric' | 'biometricWithPin'>('pin');
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const autoBiometricAttempted = useRef(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const lock = getModuleLock(db, moduleId);
      if (!lock) {
        onUnlock();
        return;
      }

      if (!mounted) {
        return;
      }

      setLockMethod(lock.method);
      const lockout = checkLockout(lock.failedAttempts, lock.lockedUntil);
      if (lockout.isLocked) {
        setLocked(true);
        setRemainingSeconds(Math.ceil(lockout.remainingMs / 1000));
      }

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

      if (!mounted) {
        return;
      }

      setBiometricAvailable(hasHardware && enrolled);

      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricLabel('Face ID');
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricLabel('Touch ID');
      } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        setBiometricLabel('Iris');
      }
    })();

    return () => {
      mounted = false;
    };
  }, [db, moduleId, onUnlock]);

  // Countdown timer
  useEffect(() => {
    if (!locked || remainingSeconds <= 0) return;
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setLocked(false);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [locked, remainingSeconds]);

  const handleBiometricUnlock = useCallback(async () => {
    if (!biometricAvailable || locked || verifying) {
      return;
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Unlock ${moduleName}`,
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use passcode',
      });

      if (result.success) {
        resetLockFailedAttempts(db, moduleId);
        onUnlock();
      }
    } catch {
      setError('Biometric authentication failed.');
    }
  }, [biometricAvailable, db, locked, moduleId, moduleName, onUnlock, verifying]);

  useEffect(() => {
    if (autoBiometricAttempted.current) return;
    if (lockMethod === 'pin' || !biometricAvailable || locked) return;

    autoBiometricAttempted.current = true;
    void handleBiometricUnlock();
  }, [biometricAvailable, handleBiometricUnlock, lockMethod, locked]);

  const shake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleDigit = useCallback(
    async (digit: string) => {
      if (locked || verifying) return;
      const newPin = pin + digit;
      setPin(newPin);
      setError(null);

      if (newPin.length >= PIN_LENGTH) {
        setVerifying(true);
        try {
          const lock = getModuleLock(db, moduleId);
          if (!lock) {
            onUnlock();
            return;
          }

          const valid = await verifyPin(newPin, lock.salt, lock.pinHash);
          if (valid) {
            resetLockFailedAttempts(db, moduleId);
            onUnlock();
            return;
          }

          const failCount = incrementLockFailedAttempts(db, moduleId);
          if (failCount >= LOCKOUT_MAX_ATTEMPTS) {
            const lockUntil = computeLockedUntil();
            setLockLockedUntil(db, moduleId, lockUntil);
            setLocked(true);
            setRemainingSeconds(60);
            setPin('');
            setError('Too many attempts.');
            shake();
          } else {
            setError(`Incorrect PIN (${failCount} of ${LOCKOUT_MAX_ATTEMPTS})`);
            setPin('');
            shake();
          }
        } catch {
          setError('Verification failed.');
          setPin('');
        } finally {
          setVerifying(false);
        }
      }
    },
    [locked, verifying, pin, db, moduleId, onUnlock, shake],
  );

  const handleDelete = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  }, []);

  const handleKeyPress = useCallback(
    (key: string) => {
      if (key === 'del') handleDelete();
      else if (key !== '') handleDigit(key);
    },
    [handleDelete, handleDigit],
  );

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.emoji}>{moduleIcon}</Text>
        <Text variant="body" color={colors.text}>
          {moduleName} is Locked
        </Text>
      </View>

      {locked ? (
        <View style={styles.lockoutBox}>
          <Text variant="body" color={colors.danger}>
            Too many attempts
          </Text>
          <Text style={styles.countdown}>{formatTime(remainingSeconds)}</Text>
          <Text variant="caption" color={colors.textSecondary}>
            Try again later
          </Text>
        </View>
      ) : (
        <>
          <Animated.View
            style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}
          >
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  pin.length > i
                    ? [styles.dotFilled, { backgroundColor: accentColor, borderColor: accentColor }]
                    : null,
                ]}
              />
            ))}
          </Animated.View>

          {error && (
            <Text variant="caption" color={colors.danger} style={styles.errorText}>
              {error}
            </Text>
          )}

          {lockMethod !== 'pin' && biometricAvailable && (
            <Pressable style={styles.biometricButton} onPress={() => void handleBiometricUnlock()}>
              <Text variant="label" color={accentColor}>
                Use {biometricLabel}
              </Text>
            </Pressable>
          )}

          <View style={styles.keypad}>
            {KEYPAD.map((key, i) => (
              <Pressable
                key={i}
                style={[styles.key, key === '' ? styles.keyEmpty : null]}
                onPress={() => handleKeyPress(key)}
                disabled={key === '' || verifying}
              >
                <Text
                  variant="body"
                  color={key === 'del' ? colors.textSecondary : colors.text}
                >
                  {key === 'del' ? '\u{232B}' : key}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  header: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl },
  emoji: { fontSize: 64 },
  dotsRow: { flexDirection: 'row', gap: 16, marginBottom: spacing.md },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.glassBorder,
    backgroundColor: 'transparent',
  },
  dotFilled: {},
  errorText: { marginBottom: spacing.sm, textAlign: 'center' },
  lockoutBox: { alignItems: 'center', gap: spacing.sm },
  countdown: { fontSize: 48, fontWeight: '700', color: colors.danger },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 240,
    marginTop: spacing.md,
  },
  biometricButton: {
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  key: {
    width: 80,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyEmpty: { opacity: 0 },
});
