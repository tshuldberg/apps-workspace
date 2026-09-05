import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { Text as RNText } from 'react-native';
import { useRouter } from 'expo-router';
import {
  getLockConfig,
  setLockConfig,
  disableLock,
  GlassCard,
  SectionHeader,
  GradientButton,
  MOOD_SURFACES,
  MOOD_ACCENT,
  MOOD_TYPOGRAPHY,
} from '@mylife/mood';
import { colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const TIMEOUT_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Immediately' },
  { value: 60, label: 'After 1 min' },
  { value: 300, label: 'After 5 min' },
  { value: 900, label: 'After 15 min' },
];

const LOCKOUT_OPTIONS: { attempts: number; duration: string }[] = [
  { attempts: 3, duration: '5 min' },
  { attempts: 5, duration: '15 min' },
  { attempts: 10, duration: '30 min' },
];

type LockMethodOption = 'pin' | 'biometric' | 'biometricWithPin';

export default function LockSettingsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [method, setMethod] = useState<LockMethodOption>('pin');
  const [timeout, setTimeout] = useState(0);
  const [lockoutIndex] = useState(1);
  const [hideInSwitcher, setHideInSwitcher] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const config = getLockConfig(db);
    if (config) {
      setEnabled(config.isEnabled);
      const m = (config.method as LockMethodOption) ?? 'pin';
      setMethod(m);
      setBiometricEnabled(m === 'biometric' || m === 'biometricWithPin');
      setTimeout(config.lockTimeoutSeconds);
    }
    setLoading(false);
  }, [db]);

  const persistConfig = (overrides?: {
    isEnabled?: boolean;
    method?: string | null;
    lockTimeoutSeconds?: number;
  }) => {
    const base = {
      isEnabled: enabled,
      method,
      lockTimeoutSeconds: timeout,
    };
    setLockConfig(db, { ...base, ...overrides });
  };

  const handleBiometricToggle = (value: boolean) => {
    setBiometricEnabled(value);
    const newMethod: LockMethodOption = value ? 'biometricWithPin' : 'pin';
    setMethod(newMethod);
    if (enabled) {
      persistConfig({ method: newMethod });
    }
  };

  const handleTimeoutChange = (t: number) => {
    setTimeout(t);
    if (enabled) {
      persistConfig({ lockTimeoutSeconds: t });
    }
  };

  const handleDisableSecurity = () => {
    Alert.alert(
      'Remove Lock',
      'Disabling the privacy lock will make your journal accessible to anyone with access to this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable Security',
          style: 'destructive',
          onPress: () => {
            disableLock(db);
            setEnabled(false);
            router.back();
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.empty}>
        <RNText style={styles.emptyText}>Loading...</RNText>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Page Title */}
      <RNText style={styles.pageTitle}>Privacy Lock</RNText>
      <RNText style={styles.pageSubtitle}>
        Secure your personal insights and journal with biometric authentication
        and custom security policies.
      </RNText>

      {/* Face ID Card */}
      <GlassCard level={2} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconBadge}>
            <RNText style={styles.iconEmoji}>{'\uD83D\uDE00'}</RNText>
          </View>
          <Switch
            value={biometricEnabled}
            onValueChange={handleBiometricToggle}
            trackColor={{ false: MOOD_SURFACES.focus, true: MOOD_ACCENT }}
            thumbColor={colors.text}
          />
        </View>
        <RNText style={styles.cardTitle}>Use Face ID</RNText>
        <RNText style={styles.cardSubtitle}>
          Unlock MyMood instantly using your biometric profile.
        </RNText>
      </GlassCard>

      {/* Change PIN Card */}
      <GlassCard level={2} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconBadge}>
            <RNText style={styles.iconEmoji}>{'\u2699\uFE0F'}</RNText>
          </View>
        </View>
        <RNText style={styles.cardTitle}>Change PIN</RNText>
        <RNText style={styles.cardSubtitle}>
          Update your 6-digit backup access code.
        </RNText>
        <Pressable
          style={styles.modifyButton}
          onPress={() => {
            Alert.alert(
              'Change PIN',
              'To change your PIN, disable the lock and re-enable it with a new code.',
              [{ text: 'OK' }],
            );
          }}
        >
          <RNText style={styles.modifyButtonText}>Modify Passcode</RNText>
        </Pressable>
      </GlassCard>

      {/* Security Policies */}
      <SectionHeader label="Security Policies" title="" />

      {/* Auto-lock picker */}
      <GlassCard level={1} style={styles.policyCard}>
        <Pressable style={styles.policyRow}>
          <View style={styles.policyIconBadge}>
            <RNText style={styles.policyIcon}>{'\uD83D\uDD12'}</RNText>
          </View>
          <View style={styles.policyContent}>
            <RNText style={styles.policyTitle}>Auto-lock picker</RNText>
            <RNText style={styles.policySubtitle}>Lock when app is closed</RNText>
          </View>
          <RNText style={styles.policyValue}>
            {TIMEOUT_OPTIONS.find((o) => o.value === timeout)?.label ?? 'Immediately'}
          </RNText>
          <RNText style={styles.chevron}>{'\u203A'}</RNText>
        </Pressable>
      </GlassCard>

      {/* Timeout picker - inline */}
      <View style={styles.timeoutOptions}>
        {TIMEOUT_OPTIONS.map((opt) => {
          const selected = timeout === opt.value;
          return (
            <Pressable
              key={opt.value}
              style={[styles.timeoutChip, selected && styles.timeoutChipActive]}
              onPress={() => handleTimeoutChange(opt.value)}
            >
              <RNText
                style={[
                  styles.timeoutChipText,
                  selected && styles.timeoutChipTextActive,
                ]}
              >
                {opt.label}
              </RNText>
            </Pressable>
          );
        })}
      </View>

      {/* Lockout policy */}
      <GlassCard level={1} style={styles.policyCard}>
        <Pressable style={styles.policyRow}>
          <View style={styles.policyIconBadge}>
            <RNText style={styles.policyIcon}>{'\uD83D\uDEE1\uFE0F'}</RNText>
          </View>
          <View style={styles.policyContent}>
            <RNText style={styles.policyTitle}>Lockout policy</RNText>
            <RNText style={styles.policySubtitle}>
              {LOCKOUT_OPTIONS[lockoutIndex].attempts} attempts,{' '}
              {LOCKOUT_OPTIONS[lockoutIndex].duration} duration
            </RNText>
          </View>
          <RNText style={styles.chevron}>{'\u203A'}</RNText>
        </Pressable>
      </GlassCard>

      {/* Hide content in Switcher */}
      <GlassCard level={1} style={styles.policyCard}>
        <View style={styles.policyRow}>
          <View style={styles.policyIconBadge}>
            <RNText style={styles.policyIcon}>{'\uD83D\uDEAB'}</RNText>
          </View>
          <View style={styles.policyContent}>
            <RNText style={styles.policyTitle}>Hide content in Switcher</RNText>
            <RNText style={styles.policySubtitle}>
              Blur app preview in multitasking
            </RNText>
          </View>
          <Switch
            value={hideInSwitcher}
            onValueChange={setHideInSwitcher}
            trackColor={{ false: MOOD_SURFACES.focus, true: MOOD_ACCENT }}
            thumbColor={colors.text}
          />
        </View>
      </GlassCard>

      {/* Remove Lock danger zone */}
      <View style={styles.dangerZone}>
        <View style={styles.dangerWarningBadge}>
          <RNText style={styles.dangerWarningIcon}>{'\u26A0\uFE0F'}</RNText>
        </View>
        <RNText style={styles.dangerTitle}>Remove Lock</RNText>
        <RNText style={styles.dangerSubtitle}>
          Disabling the privacy lock will make your journal accessible to anyone
          with access to this device.
        </RNText>
        <GradientButton
          title="Disable Security"
          variant="danger"
          onPress={handleDisableSecurity}
        />
      </View>

      {/* Footer */}
      <RNText style={styles.footerText}>ENCRYPTION STANDARD: AES-256</RNText>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MOOD_SURFACES.depth,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  empty: {
    flex: 1,
    backgroundColor: MOOD_SURFACES.depth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },

  // Page header
  pageTitle: {
    ...MOOD_TYPOGRAPHY.displayLg,
    color: colors.text,
    marginBottom: 8,
  },
  pageSubtitle: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    marginBottom: 24,
  },

  // Feature cards (Face ID, Change PIN)
  card: {
    marginBottom: 16,
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: MOOD_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 22,
  },
  cardTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    color: colors.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  modifyButton: {
    marginTop: 12,
    backgroundColor: MOOD_SURFACES.focus,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modifyButtonText: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 15,
    color: colors.text,
  },

  // Policy rows
  policyCard: {
    marginBottom: 8,
    padding: 16,
  },
  policyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  policyIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: MOOD_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  policyIcon: {
    fontSize: 16,
  },
  policyContent: {
    flex: 1,
  },
  policyTitle: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 15,
    color: colors.text,
  },
  policySubtitle: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: colors.textSecondary,
  },
  policyValue: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: MOOD_ACCENT,
    marginRight: 4,
  },
  chevron: {
    fontSize: 22,
    color: colors.textSecondary,
  },

  // Timeout picker chips
  timeoutOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  timeoutChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: MOOD_SURFACES.lift,
  },
  timeoutChipActive: {
    backgroundColor: MOOD_ACCENT,
  },
  timeoutChipText: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: colors.textSecondary,
  },
  timeoutChipTextActive: {
    color: '#1a1008',
  },

  // Danger zone
  dangerZone: {
    marginTop: 24,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  dangerWarningBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  dangerWarningIcon: {
    fontSize: 24,
  },
  dangerTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    color: '#F87171',
    marginBottom: 8,
  },
  dangerSubtitle: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },

  // Footer
  footerText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 24,
    opacity: 0.5,
  },

  bottomSpacer: {
    height: 100,
  },
});
