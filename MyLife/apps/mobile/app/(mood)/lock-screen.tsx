import { useEffect, useState, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text as RNText } from 'react-native';
import {
  getLockConfig,
  incrementFailedAttempts,
  setLockedUntil,
  checkLockout,
  computeLockedUntil,
  LOCKOUT_MAX_ATTEMPTS,
  MOOD_SURFACES,
  MOOD_ACCENT,
  MOOD_TYPOGRAPHY,
} from '@mylife/mood';
import { colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const PIN_LENGTH = 4;

const KEYPAD_KEYS: { digit: string; letters: string }[] = [
  { digit: '1', letters: '' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: 'face', letters: '' },
  { digit: '0', letters: '' },
  { digit: 'del', letters: '' },
];

export default function LockScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const config = getLockConfig(db);
    if (!config || !config.isEnabled) {
      router.back();
      return;
    }
    const lockout = checkLockout(config.failedAttempts, config.lockedUntil);
    if (lockout.isLocked) {
      setLocked(true);
      setRemainingSeconds(Math.ceil(lockout.remainingMs / 1000));
    }
  }, [db, router]);

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

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleDigit = async (digit: string) => {
    if (locked) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError(null);

    if (newPin.length >= PIN_LENGTH) {
      try {
        const config = getLockConfig(db);
        if (!config) return;

        const failCount = incrementFailedAttempts(db);

        if (failCount >= LOCKOUT_MAX_ATTEMPTS) {
          const lockUntil = computeLockedUntil();
          setLockedUntil(db, lockUntil);
          setLocked(true);
          setRemainingSeconds(300);
          setPin('');
          setError('Too many attempts.');
          shake();
          return;
        }

        setError(`Incorrect PIN (${failCount} of ${LOCKOUT_MAX_ATTEMPTS})`);
        setPin('');
        shake();
      } catch {
        setError('Verification failed.');
        setPin('');
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleKeyPress = (key: string) => {
    if (key === 'del') handleDelete();
    else if (key === 'face') {
      // Biometric auth -- placeholder for expo-local-authentication
    } else handleDigit(key);
  };

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <RNText style={styles.lockIcon}>{'\uD83D\uDD12'}</RNText>
          <RNText style={styles.headerTitle}>MyMood</RNText>
        </View>
      </View>

      {/* Avatar + Welcome */}
      <View style={styles.welcomeSection}>
        <View style={styles.avatarCircle}>
          <RNText style={styles.avatarEmoji}>{'\uD83D\uDE0A'}</RNText>
        </View>
        <RNText style={styles.welcomeTitle}>Welcome back</RNText>
        <RNText style={styles.welcomeSubtitle}>
          Please enter your security PIN
        </RNText>
      </View>

      {locked ? (
        <View style={styles.lockoutBox}>
          <RNText style={styles.lockoutEmoji}>{'\u26A0\uFE0F'}</RNText>
          <RNText style={styles.lockoutTitle}>Too many attempts</RNText>
          <RNText style={styles.countdown}>{formatTime(remainingSeconds)}</RNText>
          <RNText style={styles.lockoutSubtitle}>Try again later</RNText>
        </View>
      ) : (
        <>
          {/* PIN Dots */}
          <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  pin.length > i ? styles.dotFilled : null,
                  error && pin.length === 0 ? styles.dotError : null,
                ]}
              />
            ))}
          </Animated.View>

          {error && (
            <RNText style={styles.errorText}>{error}</RNText>
          )}

          {/* Numeric Keypad */}
          <View style={styles.keypad}>
            {KEYPAD_KEYS.map((key, i) => {
              const isFace = key.digit === 'face';
              const isDel = key.digit === 'del';

              return (
                <View key={i} style={styles.keyWrapper}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.key,
                      (isFace || isDel) && styles.keySpecial,
                      pressed && styles.keyPressed,
                    ]}
                    onPress={() => handleKeyPress(key.digit)}
                  >
                    {isFace ? (
                      <RNText style={styles.faceIdIcon}>{'\uD83D\uDE00'}</RNText>
                    ) : isDel ? (
                      <RNText style={styles.deleteIcon}>{'\u232B'}</RNText>
                    ) : (
                      <>
                        <RNText style={styles.keyDigit}>{key.digit}</RNText>
                        {key.letters !== '' && (
                          <RNText style={styles.keyLetters}>{key.letters}</RNText>
                        )}
                      </>
                    )}
                  </Pressable>
                </View>
              );
            })}
          </View>

          {/* Forgot PIN */}
          <Pressable style={styles.forgotButton}>
            <RNText style={styles.forgotText}>FORGOT PIN?</RNText>
          </Pressable>
        </>
      )}
    </View>
  );
}

const KEY_SIZE = 76;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MOOD_SURFACES.depth,
    paddingTop: 60,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lockIcon: {
    fontSize: 20,
  },
  headerTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },

  // Welcome section
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: MOOD_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarEmoji: {
    fontSize: 32,
  },
  welcomeTitle: {
    ...MOOD_TYPOGRAPHY.displayLg,
    fontSize: 26,
    letterSpacing: -0.02 * 26,
    color: colors.text,
    marginBottom: 8,
  },
  welcomeSubtitle: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 15,
    color: colors.textSecondary,
  },

  // PIN dots
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 16,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: MOOD_SURFACES.focus,
  },
  dotFilled: {
    backgroundColor: MOOD_ACCENT,
  },
  dotError: {
    backgroundColor: '#EF4444',
  },

  // Error
  errorText: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 8,
  },

  // Lockout
  lockoutBox: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 40,
    marginTop: 24,
  },
  lockoutEmoji: {
    fontSize: 40,
  },
  lockoutTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    color: '#EF4444',
  },
  countdown: {
    fontSize: 56,
    fontWeight: '700',
    color: '#EF4444',
    fontVariant: ['tabular-nums'],
  },
  lockoutSubtitle: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
  },

  // Keypad
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 32,
    marginTop: 8,
  },
  keyWrapper: {
    width: '33.33%',
    alignItems: 'center',
    marginBottom: 12,
  },
  key: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    borderRadius: KEY_SIZE / 2,
    backgroundColor: MOOD_SURFACES.lift,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keySpecial: {
    backgroundColor: 'transparent',
  },
  keyPressed: {
    backgroundColor: MOOD_SURFACES.focus,
  },
  keyDigit: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 28,
    color: colors.text,
  },
  keyLetters: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  faceIdIcon: {
    fontSize: 28,
  },
  deleteIcon: {
    fontSize: 28,
    color: colors.textSecondary,
  },

  // Forgot PIN
  forgotButton: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 12,
  },
  forgotText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 13,
    letterSpacing: 0.05 * 13,
    color: colors.textSecondary,
  },
});
