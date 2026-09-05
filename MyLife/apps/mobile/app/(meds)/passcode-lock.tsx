import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import {
  LOCKOUT_MAX_ATTEMPTS,
  checkLockout,
  computeLockedUntil,
  disableModuleLock,
  enableModuleLock,
  getModuleLock,
  incrementLockFailedAttempts,
  resetLockFailedAttempts,
  setLockLockedUntil,
  updateModuleLockMethod,
  verifyPin,
} from '@mylife/auth';
import type { ModuleLockMethod } from '@mylife/auth';
import {
  GlassCard,
  MaterialSymbol,
  MD_ACCENT,
  MD_ACCENT_LIGHT,
  MD_CHROME_GOLD,
  MD_CYAN_GLOW_STYLE,
  MD_FONTS,
  MD_SURFACES,
  withAlpha,
} from '@mylife/meds/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const PIN_LENGTH = 4;
const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'] as const;
const TIMEOUT_OPTIONS = [
  { label: 'Always', value: 0 },
  { label: '1 min', value: 60 },
  { label: '5 min', value: 300 },
  { label: '15 min', value: 900 },
] as const;

type Flow =
  | 'create'
  | 'confirm-create'
  | 'unlock'
  | 'manage'
  | 'change-current'
  | 'change-new'
  | 'change-confirm';

function titleForFlow(flow: Flow) {
  switch (flow) {
    case 'create':
      return {
        title: 'Create Passcode',
        body: 'Protect MyMeds with a shared module lock that also supports biometric unlock.',
      };
    case 'confirm-create':
      return {
        title: 'Confirm Passcode',
        body: 'Enter the same passcode again so MyMeds can lock the module safely.',
      };
    case 'change-current':
      return {
        title: 'Verify Current Passcode',
        body: 'Confirm the current code before MyMeds lets you replace it.',
      };
    case 'change-new':
      return {
        title: 'New Passcode',
        body: 'Enter the new code you want to use for the MyMeds module lock.',
      };
    case 'change-confirm':
      return {
        title: 'Confirm New Passcode',
        body: 'Repeat the new passcode to finish the change.',
      };
    default:
      return {
        title: 'Enter Passcode',
        body: 'Unlock your MyMeds security settings or use biometrics when available.',
      };
  }
}

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

export default function PasscodeLockScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [flow, setFlow] = useState<Flow>('create');
  const [pin, setPin] = useState('');
  const [stagedPin, setStagedPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometric');
  const autoBiometricAttempted = useRef(false);

  const lock = useMemo(() => getModuleLock(db, 'meds'), [db, tick]);

  const refreshLock = useCallback(() => {
    setTick((value) => value + 1);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
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
      } else {
        setBiometricLabel('Biometric');
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!lock) {
      setFlow('create');
      setPin('');
      setError(null);
      setRemainingSeconds(0);
      return;
    }

    if (flow === 'create' || flow === 'confirm-create') {
      setFlow('unlock');
      setPin('');
      setError(null);
    }

    const lockout = checkLockout(lock.failedAttempts, lock.lockedUntil);
    if (lockout.isLocked) {
      setRemainingSeconds(Math.ceil(lockout.remainingMs / 1000));
    } else {
      setRemainingSeconds(0);
    }
  }, [flow, lock]);

  useEffect(() => {
    if (remainingSeconds <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setRemainingSeconds((value) => Math.max(0, value - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [remainingSeconds]);

  const attemptBiometricUnlock = useCallback(async () => {
    if (!biometricAvailable) {
      Alert.alert('Biometric unavailable', 'Set up Face ID, Touch ID, or another biometric profile on this device first.');
      return false;
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock MyMeds',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Passcode',
      });

      if (result.success) {
        resetLockFailedAttempts(db, 'meds');
        setError(null);
        setPin('');
        if (flow === 'change-current') {
          setFlow('change-new');
        } else {
          setFlow('manage');
        }
        return true;
      }
      return false;
    } catch {
      Alert.alert('Authentication failed', 'MyMeds could not complete biometric authentication.');
      return false;
    }
  }, [biometricAvailable, db, flow]);

  useEffect(() => {
    if (!lock || !biometricAvailable || flow !== 'unlock') {
      return;
    }

    if (lock.method === 'pin' || autoBiometricAttempted.current) {
      return;
    }

    autoBiometricAttempted.current = true;
    void attemptBiometricUnlock();
  }, [attemptBiometricUnlock, biometricAvailable, flow, lock]);

  const handleFailedAttempt = useCallback(() => {
    const failCount = incrementLockFailedAttempts(db, 'meds');
    if (failCount >= LOCKOUT_MAX_ATTEMPTS) {
      const lockedUntil = computeLockedUntil();
      setLockLockedUntil(db, 'meds', lockedUntil);
      setRemainingSeconds(60);
      setError('Too many failed attempts. MyMeds is temporarily locked.');
      setPin('');
      return;
    }

    setError(`Incorrect passcode (${failCount} of ${LOCKOUT_MAX_ATTEMPTS})`);
    setPin('');
  }, [db]);

  const verifyExistingPin = useCallback(
    async (candidate: string) => {
      if (!lock) {
        return false;
      }

      const valid = await verifyPin(candidate, lock.salt, lock.pinHash);
      if (valid) {
        resetLockFailedAttempts(db, 'meds');
        setError(null);
        setPin('');
        return true;
      }

      handleFailedAttempt();
      return false;
    },
    [db, handleFailedAttempt, lock],
  );

  const handleResolvedPin = useCallback(
    async (resolvedPin: string) => {
      if (remainingSeconds > 0 || verifying) {
        return;
      }

      setVerifying(true);
      try {
        if (flow === 'create') {
          setStagedPin(resolvedPin);
          setPin('');
          setFlow('confirm-create');
          return;
        }

        if (flow === 'confirm-create') {
          if (resolvedPin !== stagedPin) {
            setError('Passcodes did not match. Try again.');
            setPin('');
            setFlow('create');
            setStagedPin('');
            return;
          }

          await enableModuleLock(db, 'meds', resolvedPin, 'pin', 0);
          setStagedPin('');
          setPin('');
          refreshLock();
          setFlow('manage');
          return;
        }

        if (flow === 'unlock') {
          const valid = await verifyExistingPin(resolvedPin);
          if (valid) {
            setFlow('manage');
          }
          return;
        }

        if (flow === 'change-current') {
          const valid = await verifyExistingPin(resolvedPin);
          if (valid) {
            setFlow('change-new');
          }
          return;
        }

        if (flow === 'change-new') {
          setStagedPin(resolvedPin);
          setPin('');
          setFlow('change-confirm');
          return;
        }

        if (flow === 'change-confirm') {
          if (resolvedPin !== stagedPin) {
            setError('New passcodes did not match. Try again.');
            setPin('');
            setFlow('change-new');
            setStagedPin('');
            return;
          }

          await enableModuleLock(
            db,
            'meds',
            resolvedPin,
            lock?.method ?? 'pin',
            lock?.lockTimeoutSeconds ?? 0,
          );
          setStagedPin('');
          setPin('');
          refreshLock();
          setFlow('manage');
          return;
        }
      } catch {
        setError('MyMeds could not complete that security step.');
        setPin('');
      } finally {
        setVerifying(false);
      }
    },
    [db, flow, lock?.lockTimeoutSeconds, lock?.method, refreshLock, remainingSeconds, stagedPin, verifying, verifyExistingPin],
  );

  const handleKeypadPress = async (value: (typeof KEYPAD)[number]) => {
    if (value === 'del') {
      setPin((current) => current.slice(0, -1));
      setError(null);
      return;
    }

    if (value === 'bio') {
      if (lock && biometricAvailable) {
        await attemptBiometricUnlock();
      }
      return;
    }

    const nextPin = `${pin}${value}`;
    setPin(nextPin);
    setError(null);

    if (nextPin.length === PIN_LENGTH) {
      await handleResolvedPin(nextPin);
    }
  };

  const handleDisableLock = async () => {
    Alert.alert('Turn off lock', 'Remove the MyMeds module lock and biometric requirement?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Turn Off',
        style: 'destructive',
        onPress: () => {
          disableModuleLock(db, 'meds');
          refreshLock();
          setFlow('create');
          setPin('');
        },
      },
    ]);
  };

  const handleMethodChange = (method: ModuleLockMethod) => {
    if (!lock) {
      return;
    }

    updateModuleLockMethod(db, 'meds', method, lock.lockTimeoutSeconds);
    refreshLock();
  };

  const handleTimeoutChange = (timeoutSeconds: number) => {
    if (!lock) {
      return;
    }

    updateModuleLockMethod(db, 'meds', lock.method, timeoutSeconds);
    refreshLock();
  };

  const configCopy = titleForFlow(flow);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topGlow} />
      <View style={styles.bottomGlow} />

      <View style={styles.logoBlock}>
        <View style={styles.logoBadge}>
          <MaterialSymbol color="#003345" name="medication" size={34} />
        </View>
        <Text style={styles.logoTitle}>MyMeds</Text>
        <Text style={styles.logoSubtitle}>Vault Protected</Text>
      </View>

      {flow === 'manage' && lock ? (
        <View style={styles.manageStack}>
          <GlassCard style={styles.manageCard}>
            <Text style={styles.sectionEyebrow}>Security Active</Text>
            <Text style={styles.sectionTitle}>Module lock enabled</Text>
            <Text style={styles.sectionBody}>
              MyMeds will require authentication when the lock timeout expires.
            </Text>
            <View style={styles.inlineStatusRow}>
              <StatusPill label={lock.method === 'biometricWithPin' ? `${biometricLabel} + Passcode` : 'Passcode Only'} />
              <StatusPill label={lock.lockTimeoutSeconds === 0 ? 'Always ask' : `${Math.round(lock.lockTimeoutSeconds / 60)} min timeout`} />
            </View>
          </GlassCard>

          <GlassCard style={styles.manageCard}>
            <Text style={styles.sectionTitle}>Unlock method</Text>
            <Text style={styles.sectionBody}>Keep passcode only, or add biometrics when this device supports it.</Text>
            <View style={styles.optionRow}>
              <OptionPill
                active={lock.method === 'pin'}
                label="Passcode"
                onPress={() => handleMethodChange('pin')}
              />
              <OptionPill
                active={lock.method === 'biometricWithPin'}
                disabled={!biometricAvailable}
                label={biometricAvailable ? biometricLabel : 'Biometric Unavailable'}
                onPress={() => handleMethodChange('biometricWithPin')}
              />
            </View>
            <Pressable onPress={() => void attemptBiometricUnlock()} style={[styles.secondaryButton, !biometricAvailable ? styles.disabled : null]} disabled={!biometricAvailable}>
              <MaterialSymbol color="#D6C3B5" name="fingerprint" size={16} />
              <Text style={styles.secondaryButtonText}>Test {biometricLabel}</Text>
            </Pressable>
          </GlassCard>

          <GlassCard style={styles.manageCard}>
            <Text style={styles.sectionTitle}>Lock timeout</Text>
            <Text style={styles.sectionBody}>Choose how long MyMeds stays unlocked after a successful authentication.</Text>
            <View style={styles.optionRow}>
              {TIMEOUT_OPTIONS.map((option) => (
                <OptionPill
                  key={option.value}
                  active={lock.lockTimeoutSeconds === option.value}
                  label={option.label}
                  onPress={() => handleTimeoutChange(option.value)}
                />
              ))}
            </View>
          </GlassCard>

          <GlassCard style={styles.manageCard}>
            <Text style={styles.sectionTitle}>Passcode actions</Text>
            <Text style={styles.sectionBody}>Change the current passcode or disable security if you no longer need it.</Text>
            <View style={styles.manageActions}>
              <Pressable onPress={() => setFlow('change-current')} style={styles.secondaryButton}>
                <MaterialSymbol color="#D6C3B5" name="pin" size={16} />
                <Text style={styles.secondaryButtonText}>Change Passcode</Text>
              </Pressable>
              <Pressable onPress={() => void handleDisableLock()} style={styles.secondaryButton}>
                <MaterialSymbol color="#FFB4AB" name="lock_reset" size={16} />
                <Text style={[styles.secondaryButtonText, styles.dangerText]}>Turn Off Lock</Text>
              </Pressable>
            </View>
          </GlassCard>

          <Pressable onPress={() => router.push('/(hub)/module-locks')} style={styles.recoveryLink}>
            <Text style={styles.recoveryLinkText}>Forgot passcode? Reset from Hub Lock Settings</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.keypadStack}>
          <Text style={styles.title}>{configCopy.title}</Text>
          <Text style={styles.body}>{configCopy.body}</Text>

          {remainingSeconds > 0 ? (
            <GlassCard style={styles.lockoutCard}>
              <Text style={styles.lockoutTitle}>Too many attempts</Text>
              <Text style={styles.lockoutCountdown}>{formatCountdown(remainingSeconds)}</Text>
              <Text style={styles.lockoutBody}>Try again when the countdown finishes.</Text>
            </GlassCard>
          ) : (
            <>
              <View style={styles.pinDots}>
                {Array.from({ length: PIN_LENGTH }).map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.pinDot,
                      pin.length > index ? styles.pinDotFilled : null,
                    ]}
                  />
                ))}
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <View style={styles.keypadGrid}>
                {KEYPAD.map((key) => {
                  if (key === 'bio') {
                    const biometricEnabled = !!lock && biometricAvailable && lock.method !== 'pin';
                    return (
                      <Pressable
                        key={key}
                        disabled={!biometricEnabled}
                        onPress={() => void handleKeypadPress(key)}
                        style={[styles.keypadKey, !biometricEnabled ? styles.keypadKeyDisabled : null]}
                      >
                        <MaterialSymbol color={biometricEnabled ? MD_ACCENT_LIGHT : '#52443A'} name="fingerprint" size={22} />
                      </Pressable>
                    );
                  }

                  if (key === 'del') {
                    return (
                      <Pressable key={key} onPress={() => void handleKeypadPress(key)} style={styles.keypadKey}>
                        <MaterialSymbol color="#D6C3B5" name="backspace" size={22} />
                      </Pressable>
                    );
                  }

                  return (
                    <Pressable key={key} onPress={() => void handleKeypadPress(key)} style={styles.keypadKey}>
                      <Text style={styles.keyLabel}>{key}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          <View style={styles.footerLinks}>
            {lock && biometricAvailable ? (
              <Pressable onPress={() => void attemptBiometricUnlock()}>
                <Text style={styles.footerLinkText}>Use {biometricLabel}</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => router.push('/(hub)/module-locks')}>
              <Text style={styles.footerLinkText}>Forgot Passcode</Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function OptionPill({
  label,
  active,
  onPress,
  disabled = false,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.optionPill,
        active ? styles.optionPillActive : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <Text style={[styles.optionPillText, active ? styles.optionPillTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <View style={styles.statusPill}>
      <Text style={styles.statusPillText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MD_SURFACES.base,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: '100%',
    paddingBottom: 56,
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  topGlow: {
    ...MD_CYAN_GLOW_STYLE,
    backgroundColor: withAlpha(MD_ACCENT, 0.08),
    borderRadius: 240,
    height: 240,
    position: 'absolute',
    right: -90,
    top: -40,
    width: 240,
  },
  bottomGlow: {
    backgroundColor: withAlpha(MD_CHROME_GOLD, 0.08),
    borderRadius: 240,
    bottom: -80,
    height: 240,
    left: -90,
    position: 'absolute',
    width: 240,
  },
  logoBlock: {
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  logoBadge: {
    ...MD_CYAN_GLOW_STYLE,
    alignItems: 'center',
    backgroundColor: MD_ACCENT_LIGHT,
    borderRadius: 24,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  logoTitle: {
    color: '#E4E1E9',
    fontFamily: MD_FONTS.extraBold,
    fontSize: 30,
    letterSpacing: -0.8,
    lineHeight: 34,
    textTransform: 'uppercase',
  },
  logoSubtitle: {
    color: '#9F8E81',
    fontFamily: MD_FONTS.bold,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  keypadStack: {
    alignItems: 'center',
    gap: 18,
    marginTop: 48,
    width: '100%',
  },
  title: {
    color: '#E4E1E9',
    fontFamily: MD_FONTS.extraBold,
    fontSize: 30,
    letterSpacing: -0.8,
    lineHeight: 34,
    textAlign: 'center',
  },
  body: {
    color: '#D6C3B5',
    fontFamily: MD_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    maxWidth: 320,
    textAlign: 'center',
  },
  pinDots: {
    flexDirection: 'row',
    gap: 14,
    marginVertical: 12,
  },
  pinDot: {
    backgroundColor: withAlpha('#FFFFFF', 0.05),
    borderRadius: 8,
    height: 16,
    width: 16,
  },
  pinDotFilled: {
    backgroundColor: MD_ACCENT_LIGHT,
    ...MD_CYAN_GLOW_STYLE,
  },
  errorText: {
    color: '#FFB4AB',
    fontFamily: MD_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  lockoutCard: {
    alignItems: 'center',
    gap: 8,
    padding: 20,
    width: '100%',
  },
  lockoutTitle: {
    color: '#FFB4AB',
    fontFamily: MD_FONTS.bold,
    fontSize: 16,
  },
  lockoutCountdown: {
    color: '#E4E1E9',
    fontFamily: MD_FONTS.extraBold,
    fontSize: 36,
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  lockoutBody: {
    color: '#D6C3B5',
    fontFamily: MD_FONTS.regular,
    fontSize: 13,
  },
  keypadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
    width: 304,
  },
  keypadKey: {
    alignItems: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.05),
    borderRadius: 40,
    height: 80,
    justifyContent: 'center',
    width: 80,
  },
  keypadKeyDisabled: {
    backgroundColor: withAlpha('#FFFFFF', 0.03),
  },
  keyLabel: {
    color: '#E4E1E9',
    fontFamily: MD_FONTS.semiBold,
    fontSize: 28,
  },
  footerLinks: {
    alignItems: 'center',
    gap: 14,
    marginTop: 8,
  },
  footerLinkText: {
    color: MD_CHROME_GOLD,
    fontFamily: MD_FONTS.bold,
    fontSize: 11,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  manageStack: {
    gap: 14,
    marginTop: 40,
    width: '100%',
  },
  manageCard: {
    gap: 14,
    padding: 18,
  },
  sectionEyebrow: {
    color: MD_ACCENT_LIGHT,
    fontFamily: MD_FONTS.bold,
    fontSize: 10,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: '#E4E1E9',
    fontFamily: MD_FONTS.bold,
    fontSize: 18,
    lineHeight: 24,
  },
  sectionBody: {
    color: '#D6C3B5',
    fontFamily: MD_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
  },
  inlineStatusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusPill: {
    backgroundColor: withAlpha(MD_ACCENT, 0.16),
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusPillText: {
    color: '#E4E1E9',
    fontFamily: MD_FONTS.semiBold,
    fontSize: 12,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionPill: {
    backgroundColor: withAlpha('#FFFFFF', 0.05),
    borderRadius: 999,
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  optionPillActive: {
    backgroundColor: withAlpha(MD_ACCENT, 0.2),
  },
  optionPillText: {
    color: '#D6C3B5',
    fontFamily: MD_FONTS.semiBold,
    fontSize: 12,
  },
  optionPillTextActive: {
    color: '#E4E1E9',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.05),
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    color: '#D6C3B5',
    fontFamily: MD_FONTS.semiBold,
    fontSize: 13,
  },
  manageActions: {
    gap: 10,
  },
  dangerText: {
    color: '#FFB4AB',
  },
  recoveryLink: {
    alignSelf: 'center',
  },
  recoveryLinkText: {
    color: '#9F8E81',
    fontFamily: MD_FONTS.semiBold,
    fontSize: 12,
  },
  disabled: {
    opacity: 0.45,
  },
});
