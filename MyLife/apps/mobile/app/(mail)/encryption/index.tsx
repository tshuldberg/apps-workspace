import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  getAccounts,
  getEncryptionKeys,
  revokeKey,
  deleteEncryptionKey,
} from '@mylife/mail';
import type { EncryptionKey } from '@mylife/mail';
import { Text, colors, spacing, glass } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';

const ACCENT = colors.modules.mail;

export default function EncryptionScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [keys, setKeys] = useState<EncryptionKey[]>([]);

  const accounts = useMemo(() => getAccounts(db), [db]);

  const loadData = useCallback(() => {
    try {
      const all: EncryptionKey[] = [];
      for (const a of accounts) {
        all.push(...getEncryptionKeys(db, a.id));
      }
      setKeys(all);
    } catch { /* ignored */ } finally { setLoading(false); }
  }, [db, accounts]);

  useEffect(() => { loadData(); }, [loadData]);

  const ownKeys = keys.filter((k) => k.isOwnKey);
  const contactKeys = keys.filter((k) => !k.isOwnKey);

  const handleRevoke = useCallback((key: EncryptionKey) => {
    Alert.alert('Revoke Key', 'This key will no longer be used for encryption.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Revoke', style: 'destructive', onPress: () => { revokeKey(db, key.id); loadData(); } },
    ]);
  }, [db, loadData]);

  const handleDeleteKey = useCallback((key: EncryptionKey) => {
    Alert.alert('Delete Key', 'Permanently remove this encryption key?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteEncryptionKey(db, key.id); loadData(); } },
    ]);
  }, [db, loadData]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={ACCENT} size="large" />
      </View>
    );
  }

  if (keys.length === 0) {
    return (
      <View style={styles.centered}>
        <View style={[styles.emptyCard, glass.card]}>
          <Text variant="heading">🔒</Text>
          <Text variant="subheading" color={colors.text}>End-to-end encryption</Text>
          <Text variant="body" color={colors.textSecondary} style={styles.emptyText}>
            Encrypt your messages so only the intended recipient can read them. Generate your key pair to get started.
          </Text>
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: ACCENT }]}
            onPress={() => router.push('/(mail)/encryption/add')}
          >
            <Text variant="caption" color="#fff">Generate Key Pair</Text>
          </Pressable>
          <Pressable onPress={() => router.push({ pathname: '/(mail)/encryption/add', params: { mode: 'import' } })}>
            <Text variant="caption" color={colors.textSecondary}>Import Public Key</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Count keys expiring within 30 days
  const expiringKeys = keys.filter((k) => {
    if (!k.expiresAt || k.isRevoked) return false;
    const expiresDate = new Date(k.expiresAt);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return expiresDate <= thirtyDaysFromNow && expiresDate > new Date();
  });

  const handleVerifyFingerprint = (key: EncryptionKey) => {
    Alert.alert(
      'Verify Fingerprint',
      `Compare this fingerprint with the key owner:\n\n${key.fingerprint}\n\nDoes it match?`,
      [
        { text: 'No Match', style: 'destructive' },
        { text: 'Verified', style: 'default', onPress: () => {
          Alert.alert('Key Verified', 'This key has been verified.');
        }},
      ],
    );
  };

  const handleExportPublicKey = (key: EncryptionKey) => {
    // TODO: Implement actual key export via share sheet
    Alert.alert('Export Public Key', `Fingerprint:\n${key.fingerprint}\n\nExport via share sheet is coming soon.`);
  };

  const renderKeyCard = (key: EncryptionKey) => {
    const isExpired = key.expiresAt && new Date(key.expiresAt) < new Date();
    const isExpiringSoon = !isExpired && key.expiresAt && (() => {
      const exp = new Date(key.expiresAt!);
      const soon = new Date();
      soon.setDate(soon.getDate() + 30);
      return exp <= soon;
    })();
    const statusColor = key.isRevoked ? colors.danger : isExpired ? '#F59E0B' : colors.success;
    const statusLabel = key.isRevoked ? 'Revoked' : isExpired ? 'Expired' : 'Active';

    return (
      <View key={key.id} style={styles.keyCard}>
        <View style={styles.keyHeader}>
          <View style={[styles.typeBadge, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
            <Text variant="caption" color={ACCENT}>{key.keyType.toUpperCase()}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <Text variant="caption" color={statusColor}>{statusLabel}</Text>
          </View>
          <Text variant="caption" color={colors.textTertiary}>{key.keyType}</Text>
        </View>
        {isExpiringSoon && (
          <View style={styles.warningBanner}>
            <Text variant="caption" color="#F59E0B">
              Expires {new Date(key.expiresAt!).toLocaleDateString()}
            </Text>
          </View>
        )}
        <Text variant="caption" color={colors.textSecondary} style={styles.mono}>
          {key.fingerprint.slice(0, 20)}...
        </Text>
        {key.contactEmail && (
          <Text variant="body" color={colors.textSecondary}>{key.contactEmail}</Text>
        )}
        <Text variant="caption" color={colors.textTertiary}>
          Created: {new Date(key.createdAt).toLocaleDateString()}
          {key.expiresAt ? ` | Expires: ${new Date(key.expiresAt).toLocaleDateString()}` : ' | No expiry'}
        </Text>
        <View style={styles.keyActions}>
          {!key.isRevoked && !isExpired && (
            <Pressable onPress={() => handleVerifyFingerprint(key)}>
              <Text variant="caption" color={ACCENT}>Verify</Text>
            </Pressable>
          )}
          {key.isOwnKey && (
            <Pressable onPress={() => handleExportPublicKey(key)}>
              <Text variant="caption" color={ACCENT}>Export</Text>
            </Pressable>
          )}
          {!key.isRevoked && (
            <Pressable onPress={() => handleRevoke(key)}>
              <Text variant="caption" color={colors.danger}>Revoke</Text>
            </Pressable>
          )}
          <Pressable onPress={() => handleDeleteKey(key)}>
            <Text variant="caption" color={colors.danger}>Delete</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {ownKeys.length > 0 && (
          <View style={styles.section}>
            <Text variant="label" color={colors.textTertiary}>Your Keys</Text>
            {ownKeys.map(renderKeyCard)}
          </View>
        )}

        {contactKeys.length > 0 && (
          <View style={styles.section}>
            <Text variant="label" color={colors.textTertiary}>Contact Keys</Text>
            {contactKeys.map(renderKeyCard)}
          </View>
        )}
      </ScrollView>

      <Pressable
        style={[styles.fab, { backgroundColor: ACCENT }]}
        onPress={() => router.push('/(mail)/encryption/add')}
      >
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.lg },
  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.background, padding: spacing.lg,
  },
  emptyCard: { padding: spacing.lg, gap: spacing.md, alignItems: 'center' },
  emptyText: { textAlign: 'center' },
  primaryBtn: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 8,
  },
  warningBanner: {
    backgroundColor: 'rgba(245,158,11,0.1)', paddingHorizontal: spacing.sm,
    paddingVertical: 4, borderRadius: 4,
  },
  section: { gap: spacing.sm },
  keyCard: {
    padding: spacing.md, gap: spacing.xs,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  keyHeader: { flexDirection: 'row', gap: spacing.sm },
  typeBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 4 },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 4 },
  mono: { fontFamily: 'Courier', fontSize: 12 },
  keyActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  fab: {
    position: 'absolute', bottom: spacing.lg, right: spacing.lg,
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  fabIcon: { color: '#fff', fontSize: 28, fontWeight: '300', marginTop: -2 },
});
