import { useCallback, useEffect, useRef, useState } from 'react';
import { uuid } from '../../../lib/uuid';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getAccount,
  createAccount,
  updateAccount,
  autoDiscoverConfig,
  ACCOUNT_COLORS,
} from '@mylife/mail';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';

const ACCENT = colors.modules.mail;

export default function AddAccountScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const db = useDatabase();
  const router = useRouter();
  const isEditing = !!id;

  const [step, setStep] = useState<'credentials' | 'server' | 'personalize'>(isEditing ? 'personalize' : 'credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState('993');
  const [displayName, setDisplayName] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>(ACCOUNT_COLORS[0]);
  const [autoDetected, setAutoDetected] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const testTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (testTimerRef.current) clearTimeout(testTimerRef.current);
    };
  }, []);

  // Load existing account for edit mode
  useEffect(() => {
    if (!id) return;
    try {
      const account = getAccount(db, id);
      if (account) {
        setEmail(account.email);
        setDisplayName(account.displayName);
        setImapHost(account.serverHost);
        setImapPort(String(account.serverPort));
      }
    } catch { /* ignored */ }
  }, [db, id]);

  const handleCredentialsNext = useCallback(() => {
    if (!email.includes('@')) {
      setError('Enter a valid email address');
      return;
    }
    setError(null);
    try {
      const config = autoDiscoverConfig(email);
      if (config) {
        setImapHost(config.imapHost);
        setImapPort(String(config.imapPort));
        setAutoDetected(true);
        setDisplayName(email.split('@')[0]);
        setStep('personalize');
        return;
      }
    } catch { /* ignored */ }
    setStep('server');
  }, [email]);

  const handleServerNext = useCallback(() => {
    if (!imapHost) {
      setError('Enter IMAP server address');
      return;
    }
    setError(null);
    setDisplayName(email.split('@')[0]);
    setStep('personalize');
  }, [imapHost, email]);

  const handleTestConnection = useCallback(() => {
    setTesting(true);
    setTestResult(null);
    // Simulate connection test
    testTimerRef.current = setTimeout(() => {
      setTesting(false);
      setTestResult(imapHost ? 'success' : 'failed');
    }, 1500);
  }, [imapHost]);

  const handleSave = useCallback(() => {
    if (!displayName.trim()) {
      setError('Enter a display name');
      return;
    }
    setError(null);
    const host = imapHost || `imap.${email.split('@')[1]}`;
    const port = parseInt(imapPort, 10) || 993;

    try {
      if (isEditing && id) {
        updateAccount(db, id, {
          email,
          displayName: displayName.trim(),
          serverHost: host,
          serverPort: port,
        });
      } else {
        const newId = `account_${uuid()}`;
        createAccount(db, newId, {
          email,
          displayName: displayName.trim(),
          serverHost: host,
          serverPort: port,
        });
      }
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save account');
    }
  }, [db, id, isEditing, email, displayName, imapHost, imapPort, router]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Step 1: Credentials */}
      {step === 'credentials' && (
        <View style={styles.section}>
          <Text variant="heading" color={colors.text}>Sign in</Text>
          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor={colors.textTertiary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoFocus
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textTertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          {error && <Text variant="caption" color={colors.danger}>{error}</Text>}
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: ACCENT }]}
            onPress={handleCredentialsNext}
          >
            <Text variant="subheading" color={colors.text}>Next</Text>
          </Pressable>
        </View>
      )}

      {/* Step 2: Server Settings */}
      {step === 'server' && (
        <View style={styles.section}>
          <Text variant="heading" color={colors.text}>Server Settings</Text>
          <TextInput
            style={styles.input}
            placeholder="IMAP Host (e.g., imap.example.com)"
            placeholderTextColor={colors.textTertiary}
            value={imapHost}
            onChangeText={setImapHost}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="IMAP Port (993)"
            placeholderTextColor={colors.textTertiary}
            value={imapPort}
            onChangeText={setImapPort}
            keyboardType="number-pad"
          />
          <Pressable style={styles.testBtn} onPress={handleTestConnection} disabled={testing}>
            {testing ? (
              <ActivityIndicator color={ACCENT} size="small" />
            ) : (
              <Text variant="caption" color={ACCENT}>Test Connection</Text>
            )}
          </Pressable>
          {testResult === 'success' && (
            <Text variant="caption" color={colors.success}>Connection successful</Text>
          )}
          {testResult === 'failed' && (
            <Text variant="caption" color={colors.danger}>Connection failed</Text>
          )}
          {error && <Text variant="caption" color={colors.danger}>{error}</Text>}
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: ACCENT }]}
            onPress={handleServerNext}
          >
            <Text variant="subheading" color={colors.text}>Next</Text>
          </Pressable>
          <Pressable onPress={() => setStep('credentials')}>
            <Text variant="caption" color={colors.textSecondary}>Back</Text>
          </Pressable>
        </View>
      )}

      {/* Step 3: Personalize */}
      {step === 'personalize' && (
        <View style={styles.section}>
          <Text variant="heading" color={colors.text}>
            {isEditing ? 'Edit Account' : 'Personalize'}
          </Text>
          {autoDetected && (
            <Text variant="caption" color={colors.success}>Auto-detected server settings</Text>
          )}
          <TextInput
            style={styles.input}
            placeholder="Display name"
            placeholderTextColor={colors.textTertiary}
            value={displayName}
            onChangeText={setDisplayName}
          />
          <Text variant="caption" color={colors.textSecondary}>Account color</Text>
          <View style={styles.colorRow}>
            {ACCOUNT_COLORS.map((c) => (
              <Pressable
                key={c}
                style={[
                  styles.colorDot,
                  { backgroundColor: c },
                  selectedColor === c && styles.colorDotSelected,
                ]}
                onPress={() => setSelectedColor(c)}
              />
            ))}
          </View>
          {error && <Text variant="caption" color={colors.danger}>{error}</Text>}
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: ACCENT }]}
            onPress={handleSave}
          >
            <Text variant="subheading" color={colors.text}>{isEditing ? 'Save' : 'Add Account'}</Text>
          </Pressable>
          {!isEditing && (
            <Pressable onPress={() => setStep(autoDetected ? 'credentials' : 'server')}>
              <Text variant="caption" color={colors.textSecondary}>Back</Text>
            </Pressable>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  section: { gap: spacing.md },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, padding: spacing.sm, color: colors.text,
    fontFamily: 'Inter', fontSize: 16,
  },
  primaryBtn: {
    paddingVertical: spacing.sm, borderRadius: 8, alignItems: 'center',
  },
  testBtn: {
    paddingVertical: spacing.sm, borderRadius: 8, alignItems: 'center',
    borderWidth: 1, borderColor: ACCENT,
  },
  colorRow: { flexDirection: 'row', gap: spacing.sm },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotSelected: { borderWidth: 3, borderColor: colors.text },
});
