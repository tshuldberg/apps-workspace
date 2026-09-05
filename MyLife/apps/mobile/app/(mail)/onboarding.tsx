import { useCallback, useState } from 'react';
import { uuid } from '../../lib/uuid';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  createAccount,
  autoDiscoverConfig,
  ACCOUNT_COLORS,
} from '@mylife/mail';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.mail;

type Step = 'welcome' | 'provider' | 'credentials' | 'personalize' | 'syncing';

const PROVIDERS = [
  { name: 'Gmail', domain: 'gmail.com', icon: '📧' },
  { name: 'Outlook', domain: 'outlook.com', icon: '📬' },
  { name: 'Yahoo', domain: 'yahoo.com', icon: '📩' },
  { name: 'iCloud', domain: 'icloud.com', icon: '☁️' },
  { name: 'ProtonMail', domain: 'protonmail.com', icon: '🔒' },
  { name: 'Other', domain: '', icon: '✉️' },
];

export default function OnboardingScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [step, setStep] = useState<Step>('welcome');
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [serverHost, setServerHost] = useState('');
  const [serverPort, setServerPort] = useState('993');
  const [displayName, setDisplayName] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>(ACCOUNT_COLORS[0]);
  const [autoDetected, setAutoDetected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleProviderSelect = useCallback((provider: typeof PROVIDERS[number]) => {
    setSelectedProvider(provider.name);
    if (provider.domain) {
      // Don't pre-fill email -- just remember the provider for auto-discovery
    }
    setStep('credentials');
  }, []);

  const handleCredentialsNext = useCallback(() => {
    if (!email.includes('@') || !email.includes('.')) {
      setError('Enter a valid email address');
      return;
    }
    setError(null);

    // Auto-discover server settings
    try {
      const config = autoDiscoverConfig(email);
      if (config) {
        setServerHost(config.imapHost);
        setServerPort(String(config.imapPort));
        setAutoDetected(true);
      }
    } catch { /* ignored */ }

    setDisplayName(email.split('@')[0]);
    setStep('personalize');
  }, [email]);

  const handleFinish = useCallback(() => {
    if (!displayName.trim()) {
      setError('Enter a display name');
      return;
    }
    setError(null);
    setStep('syncing');

    const host = serverHost || `imap.${email.split('@')[1]}`;
    const port = parseInt(serverPort, 10) || 993;
    const id = `account_${uuid()}`;

    try {
      createAccount(db, id, {
        email,
        displayName: displayName.trim(),
        serverHost: host,
        serverPort: port,
      });
      // Simulate initial sync delay
      setTimeout(() => {
        router.replace('/(mail)/');
      }, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create account');
      setStep('personalize');
    }
  }, [db, email, displayName, serverHost, serverPort, router]);

  return (
    <View style={styles.screen}>
      {/* Step 0: Welcome */}
      {step === 'welcome' && (
        <View style={styles.centered}>
          <Text style={styles.heroIcon}>📬</Text>
          <Text variant="heading" color={colors.text} style={styles.heroTitle}>
            Welcome to MyMail
          </Text>
          <Text variant="body" color={colors.textSecondary} style={styles.heroText}>
            Your email stays on your device.
          </Text>
          <Text variant="body" color={colors.textSecondary} style={styles.heroText}>
            No cloud. No tracking. No analytics.
          </Text>
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: ACCENT }]}
            onPress={() => setStep('provider')}
          >
            <Text variant="subheading" color="#fff">Get Started</Text>
          </Pressable>
        </View>
      )}

      {/* Step 1: Choose Provider */}
      {step === 'provider' && (
        <View style={styles.centered}>
          <Text variant="heading" color={colors.text} style={styles.stepTitle}>
            Choose your provider
          </Text>
          <View style={styles.providerGrid}>
            {PROVIDERS.map((p) => (
              <Pressable
                key={p.name}
                style={styles.providerCard}
                onPress={() => handleProviderSelect(p)}
              >
                <Text style={styles.providerIcon}>{p.icon}</Text>
                <Text variant="body" color={colors.text}>{p.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Step 2: Credentials */}
      {step === 'credentials' && (
        <View style={styles.formContainer}>
          <Text variant="heading" color={colors.text} style={styles.stepTitle}>
            Sign in
          </Text>
          {selectedProvider && selectedProvider !== 'Other' && (
            <Text variant="caption" color={colors.success} style={styles.detectedBanner}>
              Setting up {selectedProvider}
            </Text>
          )}
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

          {selectedProvider === 'Other' && (
            <>
              <TextInput
                style={styles.input}
                placeholder="IMAP Server (e.g., imap.example.com)"
                placeholderTextColor={colors.textTertiary}
                value={serverHost}
                onChangeText={setServerHost}
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder="Port (993)"
                placeholderTextColor={colors.textTertiary}
                value={serverPort}
                onChangeText={setServerPort}
                keyboardType="number-pad"
              />
            </>
          )}

          {error && <Text variant="caption" color={colors.danger}>{error}</Text>}

          <Pressable
            style={[styles.primaryBtn, { backgroundColor: ACCENT }]}
            onPress={handleCredentialsNext}
          >
            <Text variant="subheading" color="#fff">Next</Text>
          </Pressable>
          <Pressable onPress={() => setStep('provider')}>
            <Text variant="caption" color={colors.textSecondary}>Back</Text>
          </Pressable>
        </View>
      )}

      {/* Step 3: Personalize */}
      {step === 'personalize' && (
        <View style={styles.formContainer}>
          <Text variant="heading" color={colors.text} style={styles.stepTitle}>
            Personalize
          </Text>
          {autoDetected && (
            <Text variant="caption" color={colors.success} style={styles.detectedBanner}>
              Detected {selectedProvider ?? 'provider'} settings
            </Text>
          )}
          <TextInput
            style={styles.input}
            placeholder="Display name"
            placeholderTextColor={colors.textTertiary}
            value={displayName}
            onChangeText={setDisplayName}
            autoFocus
          />
          <Text variant="caption" color={colors.textSecondary} style={styles.colorLabel}>
            Account color
          </Text>
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
            onPress={handleFinish}
          >
            <Text variant="subheading" color="#fff">Finish Setup</Text>
          </Pressable>
          <Pressable onPress={() => setStep('credentials')}>
            <Text variant="caption" color={colors.textSecondary}>Back</Text>
          </Pressable>
        </View>
      )}

      {/* Step 4: Syncing */}
      {step === 'syncing' && (
        <View style={styles.centered}>
          <ActivityIndicator color={ACCENT} size="large" />
          <Text variant="subheading" color={colors.text} style={styles.syncTitle}>
            Syncing your inbox...
          </Text>
          <Text variant="body" color={colors.textSecondary}>
            This may take a minute for large mailboxes
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: spacing.lg, gap: spacing.md,
  },
  formContainer: {
    flex: 1, justifyContent: 'center',
    padding: spacing.lg, gap: spacing.md,
  },
  heroIcon: { fontSize: 64 },
  heroTitle: { marginTop: spacing.md },
  heroText: { textAlign: 'center' },
  stepTitle: { marginBottom: spacing.sm },
  detectedBanner: { marginBottom: spacing.xs },
  providerGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center', gap: spacing.md,
    marginTop: spacing.md,
  },
  providerCard: {
    width: 100, height: 100,
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center', gap: spacing.xs,
  },
  providerIcon: { fontSize: 32 },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, padding: spacing.sm, color: colors.text,
    fontFamily: 'Inter', fontSize: 16,
  },
  primaryBtn: {
    paddingVertical: spacing.sm, borderRadius: 8,
    alignItems: 'center', marginTop: spacing.sm,
  },
  colorLabel: { marginTop: spacing.xs },
  colorRow: { flexDirection: 'row', gap: spacing.sm },
  colorDot: {
    width: 32, height: 32, borderRadius: 16,
  },
  colorDotSelected: {
    borderWidth: 3, borderColor: '#fff',
  },
  syncTitle: { marginTop: spacing.md },
});
