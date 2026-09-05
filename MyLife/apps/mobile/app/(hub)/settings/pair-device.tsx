/**
 * Settings > Pair Device.
 *
 * Two-mode pairing screen: "Generate" shows a QR code payload for the
 * remote device to scan, "Scan" provides a manual-entry fallback (actual
 * camera QR scanning requires a native module wired in a later phase).
 *
 * The QR payload includes workspace context so the joining device knows
 * which workspace key to request.
 */
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, colors, spacing, surfaceTiers } from '@mylife/ui';
import {
  createWorkspacePairing,
  getDeviceIdentity,
  addWorkspaceMember,
} from '@mylife/sync';
import type { WorkspacePairingPayload, WorkspaceMemberRole } from '@mylife/sync';
import { useDatabase } from '../../../components/DatabaseProvider';

type Mode = 'generate' | 'scan';

export default function PairDeviceScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { workspaceId } = useLocalSearchParams<{ workspaceId: string }>();
  const [mode, setMode] = useState<Mode>('generate');
  const [manualCode, setManualCode] = useState('');

  const identity = useMemo(() => getDeviceIdentity(db), [db]);

  const payload: WorkspacePairingPayload | null = useMemo(() => {
    if (!workspaceId || !identity) return null;
    return createWorkspacePairing(workspaceId, identity.publicKey);
  }, [workspaceId, identity]);

  const qrJson = useMemo(() => {
    if (!payload) return '';
    return JSON.stringify(payload, null, 2);
  }, [payload]);

  const handleManualPair = useCallback(() => {
    if (!workspaceId || !identity) return;
    const trimmed = manualCode.trim();
    if (trimmed.length === 0) {
      Alert.alert('Invalid', 'Please enter the pairing code from the other device.');
      return;
    }

    // Parse the code as a JSON payload (manual entry fallback)
    let parsed: { inviterDeviceId?: string } | undefined;
    try {
      parsed = JSON.parse(trimmed) as { inviterDeviceId?: string };
    } catch {
      Alert.alert('Invalid', 'Could not parse pairing code. Check the format.');
      return;
    }

    const deviceId = parsed.inviterDeviceId;
    if (!deviceId) {
      Alert.alert('Invalid', 'Pairing code is missing the device identifier.');
      return;
    }

    const now = new Date().toISOString();
    addWorkspaceMember(db, {
      workspaceId,
      deviceId,
      role: 'member' as WorkspaceMemberRole,
      invitedByDeviceId: identity.publicKey,
      invitedAt: now,
      removedAt: null,
    });

    Alert.alert('Paired', 'Device added to workspace successfully.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }, [db, workspaceId, identity, manualCode, router]);

  if (!workspaceId) {
    return (
      <View style={styles.screen}>
        <View style={styles.container}>
          <Text style={styles.emptyBody}>No workspace selected.</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pair Device</Text>
        <Text style={styles.subtitle}>
          Add a device to this workspace via QR code or manual entry.
        </Text>
      </View>

      {/* Mode tabs */}
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, mode === 'generate' && styles.tabActive]}
          onPress={() => setMode('generate')}
        >
          <Text style={[styles.tabText, mode === 'generate' && styles.tabTextActive]}>
            Generate
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, mode === 'scan' && styles.tabActive]}
          onPress={() => setMode('scan')}
        >
          <Text style={[styles.tabText, mode === 'scan' && styles.tabTextActive]}>
            Scan / Enter
          </Text>
        </Pressable>
      </View>

      {mode === 'generate' ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Show this to the joining device</Text>
          <Text style={styles.subtitle}>
            The other device scans this QR code or enters the payload manually.
          </Text>
          {/* QR placeholder: actual QR rendering requires a library like react-native-qrcode-svg */}
          <View style={styles.qrPlaceholder}>
            <Text style={styles.qrPlaceholderText}>QR Code</Text>
          </View>
          <View style={styles.codeBox}>
            <Text style={styles.codeText} selectable>
              {qrJson}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Enter code manually</Text>
          <Text style={styles.subtitle}>
            Paste the pairing payload from the inviting device.
          </Text>
          <TextInput
            style={styles.input}
            value={manualCode}
            onChangeText={setManualCode}
            placeholder='Paste pairing payload JSON...'
            placeholderTextColor={colors.outline}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            style={styles.pairButton}
            onPress={handleManualPair}
            accessibilityLabel="confirm-pair"
          >
            <Text style={styles.pairButtonText}>Pair Device</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.md },
  header: { gap: spacing.xs, marginBottom: spacing.sm },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: surfaceTiers.low,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: surfaceTiers.high },
  tabText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: colors.text },
  card: {
    backgroundColor: surfaceTiers.high,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  qrPlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: colors.glass,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrPlaceholderText: { color: colors.textSecondary, fontSize: 14 },
  codeBox: {
    backgroundColor: surfaceTiers.lowest,
    borderRadius: 8,
    padding: spacing.sm,
  },
  codeText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  input: {
    backgroundColor: surfaceTiers.lowest,
    borderRadius: 8,
    padding: spacing.sm,
    color: colors.text,
    fontSize: 13,
    fontFamily: 'monospace',
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pairButton: {
    backgroundColor: colors.primaryContainer,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  pairButtonText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  emptyBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
});
