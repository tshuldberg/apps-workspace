/**
 * Settings > Transport Preferences.
 *
 * Lets the user reorder and toggle transport layers for mesh sync.
 * The ranked list determines which transport is attempted first when
 * two peers negotiate a connection. Persisted via setTransportPreferences().
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Text, colors, spacing, surfaceTiers } from '@mylife/ui';
import {
  getTransportPreferences,
  setTransportPreferences,
  getDeviceIdentity,
} from '@mylife/sync';
import type { SyncTransportPreference } from '@mylife/sync';
import { useDatabase } from '../../../components/DatabaseProvider';

interface LayerRow {
  layerId: number;
  name: string;
  description: string;
  rank: number;
  enabled: boolean;
}

const DEFAULT_LAYERS: Omit<LayerRow, 'rank' | 'enabled'>[] = [
  { layerId: 1, name: 'LAN (Wi-Fi)', description: 'Local network via Bonjour/mDNS' },
  { layerId: 2, name: 'Nearby', description: 'Apple Multipeer / Android Wi-Fi Direct' },
  { layerId: 3, name: 'BLE', description: 'Bluetooth Low Energy (wake-up pings)' },
  { layerId: 4, name: 'WebRTC', description: 'Peer-to-peer over the internet' },
  { layerId: 5, name: 'Relay', description: 'Encrypted relay (ciphertext only)' },
];

export default function TransportPreferencesScreen() {
  const db = useDatabase();
  const [layers, setLayers] = useState<LayerRow[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  const loadPreferences = useCallback(() => {
    const identity = getDeviceIdentity(db);
    if (!identity) return;
    setDeviceId(identity.publicKey);

    const saved = getTransportPreferences(db, identity.publicKey);
    if (saved.length > 0) {
      // Merge saved preferences with default layer metadata
      const mapped: LayerRow[] = saved
        .sort((a, b) => a.rank - b.rank)
        .map((pref) => {
          const meta = DEFAULT_LAYERS.find((l) => l.layerId === pref.layerId);
          return {
            layerId: pref.layerId,
            name: meta?.name ?? `Layer ${pref.layerId}`,
            description: meta?.description ?? '',
            rank: pref.rank,
            enabled: pref.enabled,
          };
        });
      setLayers(mapped);
    } else {
      // Initialize with defaults
      setLayers(
        DEFAULT_LAYERS.map((l, i) => ({
          ...l,
          rank: i + 1,
          enabled: true,
        })),
      );
    }
  }, [db]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const handleToggle = useCallback(
    (layerId: number, value: boolean) => {
      setLayers((prev) =>
        prev.map((l) => (l.layerId === layerId ? { ...l, enabled: value } : l)),
      );
    },
    [],
  );

  const handleMoveUp = useCallback((index: number) => {
    if (index <= 0) return;
    setLayers((prev) => {
      const next = [...prev];
      const temp = next[index - 1]!;
      next[index - 1] = { ...next[index]!, rank: temp.rank };
      next[index] = { ...temp, rank: next[index]!.rank };
      // Re-sort by rank
      return next
        .sort((a, b) => a.rank - b.rank)
        .map((l, i) => ({ ...l, rank: i + 1 }));
    });
  }, []);

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= layers.length - 1) return;
      setLayers((prev) => {
        const next = [...prev];
        const temp = next[index + 1]!;
        next[index + 1] = { ...next[index]!, rank: temp.rank };
        next[index] = { ...temp, rank: next[index]!.rank };
        return next
          .sort((a, b) => a.rank - b.rank)
          .map((l, i) => ({ ...l, rank: i + 1 }));
      });
    },
    [layers.length],
  );

  const handleSave = useCallback(() => {
    if (!deviceId) return;
    const now = new Date().toISOString();
    const prefs: SyncTransportPreference[] = layers.map((l) => ({
      deviceId,
      layerId: l.layerId,
      rank: l.rank,
      enabled: l.enabled,
      updatedAt: now,
    }));
    setTransportPreferences(db, deviceId, prefs);
    Alert.alert('Saved', 'Transport preferences updated.');
  }, [db, deviceId, layers]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Transport Preferences</Text>
        <Text style={styles.subtitle}>
          Drag to reorder. Higher layers are tried first when connecting to
          peers. Toggle to enable or disable a transport.
        </Text>
      </View>

      {layers.map((layer, index) => (
        <View key={layer.layerId} style={styles.card}>
          <View style={styles.row}>
            {/* Reorder buttons */}
            <View style={styles.reorderCol}>
              <Pressable
                onPress={() => handleMoveUp(index)}
                disabled={index === 0}
                accessibilityLabel={`move-up-${layer.layerId}`}
              >
                <Text
                  style={[
                    styles.reorderButton,
                    index === 0 && styles.reorderDisabled,
                  ]}
                >
                  ▲
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleMoveDown(index)}
                disabled={index === layers.length - 1}
                accessibilityLabel={`move-down-${layer.layerId}`}
              >
                <Text
                  style={[
                    styles.reorderButton,
                    index === layers.length - 1 && styles.reorderDisabled,
                  ]}
                >
                  ▼
                </Text>
              </Pressable>
            </View>

            {/* Layer info */}
            <View style={styles.copy}>
              <View style={styles.nameRow}>
                <Text style={styles.rank}>{layer.rank}</Text>
                <Text style={styles.layerName}>{layer.name}</Text>
              </View>
              <Text style={styles.layerDesc}>{layer.description}</Text>
            </View>

            {/* Toggle */}
            <Switch
              value={layer.enabled}
              onValueChange={(value) => handleToggle(layer.layerId, value)}
              trackColor={{ false: surfaceTiers.highest, true: colors.hubAccent }}
              thumbColor={colors.text}
              accessibilityLabel={`toggle-${layer.layerId}`}
            />
          </View>
        </View>
      ))}

      <Pressable
        style={styles.saveButton}
        onPress={handleSave}
        accessibilityLabel="save-preferences"
      >
        <Text style={styles.saveButtonText}>Save Preferences</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.md },
  header: { gap: spacing.xs, marginBottom: spacing.sm },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  card: {
    backgroundColor: surfaceTiers.high,
    borderRadius: 16,
    padding: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reorderCol: { alignItems: 'center', gap: 2 },
  reorderButton: { color: colors.primary, fontSize: 14 },
  reorderDisabled: { color: surfaceTiers.highest },
  copy: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rank: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
    width: 20,
    textAlign: 'center',
  },
  layerName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  layerDesc: {
    color: colors.textSecondary,
    fontSize: 12,
    marginLeft: 28,
  },
  saveButton: {
    backgroundColor: colors.primaryContainer,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveButtonText: { color: colors.text, fontSize: 15, fontWeight: '600' },
});
