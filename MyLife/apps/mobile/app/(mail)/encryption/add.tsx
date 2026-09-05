import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  getAccounts,
  createEncryptionKey,
  computeFingerprint,
  isPgpPublicKey,
} from '@mylife/mail';
import type { KeyType } from '@mylife/mail';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';

const ACCENT = colors.modules.mail;

export default function AddKeyScreen() {
  const { mode: initialMode } = useLocalSearchParams<{ mode?: string }>();
  const db = useDatabase();
  const router = useRouter();

  const accounts = useMemo(() => getAccounts(db), [db]);
  const [tab, setTab] = useState<'generate' | 'import'>(initialMode === 'import' ? 'import' : 'generate');
  const [selectedAccount, setSelectedAccount] = useState(accounts[0]?.id ?? '');
  const [keyType, setKeyType] = useState<KeyType>('rsa');
  const [passphrase, setPassphrase] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedFingerprint, setGeneratedFingerprint] = useState<string | null>(null);

  // Import state
  const [publicKeyText, setPublicKeyText] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [importValid, setImportValid] = useState<boolean | null>(null);
  const [importFingerprint, setImportFingerprint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const genTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (genTimerRef.current) clearTimeout(genTimerRef.current);
    };
  }, []);

  const handleGenerate = useCallback(() => {
    if (!selectedAccount) return;
    setGenerating(true);
    setError(null);

    // Simulate key generation
    genTimerRef.current = setTimeout(() => {
      try {
        const mockPublicKey = `-----BEGIN PGP PUBLIC KEY BLOCK-----\nGenerated-${keyType}-${Date.now()}\n-----END PGP PUBLIC KEY BLOCK-----`;
        const fingerprint = computeFingerprint(mockPublicKey);
        const id = `key_${uuid()}`;
        createEncryptionKey(db, id, {
          accountId: selectedAccount,
          keyType,
          publicKey: mockPublicKey,
          privateKeyEncrypted: passphrase ? `encrypted:${passphrase}` : undefined,
          fingerprint,
          isOwnKey: true,
        });
        setGeneratedFingerprint(fingerprint);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to generate key');
      } finally {
        setGenerating(false);
      }
    }, 1500);
  }, [db, selectedAccount, keyType, passphrase]);

  const handleValidateImport = useCallback((text: string) => {
    setPublicKeyText(text);
    if (!text.trim()) { setImportValid(null); return; }
    const valid = isPgpPublicKey(text);
    setImportValid(valid);
    if (valid) {
      try {
        setImportFingerprint(computeFingerprint(text));
      } catch { setImportFingerprint(null); }
    }
  }, []);

  const handleImport = useCallback(() => {
    if (!importValid || !contactEmail.includes('@')) {
      setError('Enter a valid key and contact email');
      return;
    }
    setError(null);

    try {
      const fingerprint = computeFingerprint(publicKeyText);
      const id = `key_${uuid()}`;
      createEncryptionKey(db, id, {
        accountId: selectedAccount,
        keyType: 'pgp',
        publicKey: publicKeyText,
        fingerprint,
        contactEmail,
        isOwnKey: false,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to import key');
    }
  }, [db, selectedAccount, publicKeyText, contactEmail, importValid, router]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Tab selector */}
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, tab === 'generate' && styles.tabActive]}
          onPress={() => setTab('generate')}
        >
          <Text variant="subheading" color={tab === 'generate' ? ACCENT : colors.textSecondary}>
            Generate
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'import' && styles.tabActive]}
          onPress={() => setTab('import')}
        >
          <Text variant="subheading" color={tab === 'import' ? ACCENT : colors.textSecondary}>
            Import
          </Text>
        </Pressable>
      </View>

      {/* Account selector */}
      {accounts.length > 1 && (
        <View style={styles.accountRow}>
          <Text variant="caption" color={colors.textSecondary}>Account:</Text>
          {accounts.map((a) => (
            <Pressable
              key={a.id}
              style={[styles.accountChip, selectedAccount === a.id && styles.accountChipActive]}
              onPress={() => setSelectedAccount(a.id)}
            >
              <Text variant="caption" color={selectedAccount === a.id ? ACCENT : colors.textSecondary}>
                {a.email}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Generate tab */}
      {tab === 'generate' && (
        <View style={styles.section}>
          <Text variant="label" color={colors.textTertiary}>Key Type</Text>
          <View style={styles.pickerRow}>
            {([['rsa', 'RSA (most compatible)'], ['x25519', 'x25519 (modern)']] as const).map(([k, label]) => (
              <Pressable
                key={k}
                style={[styles.pickerChip, keyType === k && styles.pickerChipActive]}
                onPress={() => setKeyType(k)}
              >
                <Text variant="caption" color={keyType === k ? ACCENT : colors.textSecondary}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Passphrase (optional, protects private key)"
            placeholderTextColor={colors.textTertiary}
            value={passphrase}
            onChangeText={setPassphrase}
            secureTextEntry
          />

          {error && <Text variant="caption" color={colors.danger}>{error}</Text>}

          {generatedFingerprint ? (
            <View style={styles.successBox}>
              <Text variant="subheading" color={colors.success}>Key generated</Text>
              <Text variant="caption" color={colors.textSecondary} style={styles.mono}>
                {generatedFingerprint}
              </Text>
              <Text variant="caption" color={colors.textSecondary}>
                Your public key can be shared with contacts.
              </Text>
              <Pressable
                style={[styles.primaryBtn, { backgroundColor: ACCENT }]}
                onPress={() => router.back()}
              >
                <Text variant="caption" color={colors.text}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: ACCENT }]}
              onPress={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <ActivityIndicator color={colors.text} size="small" />
              ) : (
                <Text variant="subheading" color={colors.text}>Generate Key Pair</Text>
              )}
            </Pressable>
          )}
        </View>
      )}

      {/* Import tab */}
      {tab === 'import' && (
        <View style={styles.section}>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Paste public key..."
            placeholderTextColor={colors.textTertiary}
            value={publicKeyText}
            onChangeText={handleValidateImport}
            multiline
          />

          {importValid === true && (
            <View style={styles.validRow}>
              <Text variant="caption" color={colors.success}>Valid PGP public key</Text>
              {importFingerprint && (
                <Text variant="caption" color={colors.textSecondary} style={styles.mono}>
                  {importFingerprint}
                </Text>
              )}
            </View>
          )}
          {importValid === false && (
            <Text variant="caption" color={colors.danger}>Not a valid PGP public key</Text>
          )}

          <TextInput
            style={styles.input}
            placeholder="Contact email (who this key belongs to)"
            placeholderTextColor={colors.textTertiary}
            value={contactEmail}
            onChangeText={setContactEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {error && <Text variant="caption" color={colors.danger}>{error}</Text>}

          <Pressable
            style={[styles.primaryBtn, { backgroundColor: importValid ? ACCENT : colors.surface }]}
            onPress={handleImport}
            disabled={!importValid}
          >
            <Text variant="caption" color={importValid ? '#fff' : colors.textTertiary}>Import</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  tabRow: { flexDirection: 'row', gap: spacing.md },
  tab: { paddingBottom: spacing.xs, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: ACCENT },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  accountChip: {
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: 999, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  accountChipActive: { borderColor: ACCENT },
  section: { gap: spacing.md },
  pickerRow: { flexDirection: 'row', gap: spacing.sm },
  pickerChip: {
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pickerChipActive: { borderColor: ACCENT, backgroundColor: `${ACCENT}1A` },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, padding: spacing.sm, color: colors.text,
    fontFamily: 'Inter', fontSize: 16,
  },
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  primaryBtn: {
    paddingVertical: spacing.sm, borderRadius: 8, alignItems: 'center',
  },
  successBox: { gap: spacing.sm, alignItems: 'center', paddingVertical: spacing.md },
  mono: { fontFamily: 'Courier', fontSize: 12 },
  validRow: { gap: spacing.xs },
});
