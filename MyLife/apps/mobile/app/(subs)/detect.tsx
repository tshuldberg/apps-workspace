import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  listDetectedSubscriptions,
  getPendingDetections,
  acceptDetection,
  dismissDetection,
  listDismissedPayees,
  removeDismissedPayee,
  isPlaidConfigured,
} from '@mylife/subs';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.subs;

export default function DetectScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((v) => v + 1);

  const plaidConfigured = isPlaidConfigured();
  const pending = useMemo(() => getPendingDetections(db), [db, tick]);
  const allDetected = useMemo(() => listDetectedSubscriptions(db), [db, tick]);
  const dismissed = useMemo(() => listDismissedPayees(db), [db, tick]);

  const handleAccept = (id: string) => {
    // Create a subscription from the detection, then accept linking them
    const det = allDetected.find((d) => d.id === id);
    if (!det) return;
    const subId = `sub_det_${Date.now()}`;
    acceptDetection(db, id, subId);
    refresh();
  };

  const handleDismiss = (id: string) => {
    dismissDetection(db, id);
    refresh();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text variant="subheading">Find Subscriptions</Text>
        <Text variant="caption" color={colors.textSecondary}>
          {plaidConfigured
            ? 'Plaid is configured. Scan your bank transactions for recurring charges.'
            : 'Connect your bank via Plaid to automatically detect subscriptions.'}
        </Text>
        {!plaidConfigured && (
          <View style={styles.placeholderBox}>
            <Text variant="body" color={colors.textSecondary}>
              Bank connection setup coming soon. You can manually add subscriptions in the meantime.
            </Text>
          </View>
        )}
      </Card>

      {/* Pending detections */}
      {pending.length > 0 && (
        <Card>
          <Text variant="subheading">New Detections ({pending.length})</Text>
          <View style={styles.list}>
            {pending.map((det) => (
              <View key={det.id} style={styles.detectionRow}>
                <View style={styles.mainCopy}>
                  <Text variant="body">{det.payee}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    ${(det.amountCents / 100).toFixed(2)} -- {det.frequency}
                    {' -- '}Confidence: {(det.confidence * 100).toFixed(0)}%
                  </Text>
                </View>
                <Pressable style={styles.acceptButton} onPress={() => handleAccept(det.id)}>
                  <Text variant="label" color={colors.background}>Add</Text>
                </Pressable>
                <Pressable style={styles.dismissButton} onPress={() => handleDismiss(det.id)}>
                  <Text variant="label" color={colors.textSecondary}>Skip</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* All detected */}
      {allDetected.length > 0 && (
        <Card>
          <Text variant="subheading">All Detected ({allDetected.length})</Text>
          <View style={styles.list}>
            {allDetected.map((det) => (
              <View key={det.id} style={styles.detectionRow}>
                <View style={styles.mainCopy}>
                  <Text variant="body">{det.payee}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    ${(det.amountCents / 100).toFixed(2)} -- {det.status}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Dismissed payees */}
      {dismissed.length > 0 && (
        <Card>
          <Text variant="subheading">Dismissed</Text>
          <View style={styles.list}>
            {dismissed.map((d) => (
              <View key={d.id} style={styles.dismissedRow}>
                <Text variant="body" style={styles.mainLabel}>{d.normalizedPayee}</Text>
                <Pressable
                  onPress={() => { removeDismissedPayee(db, d.id); refresh(); }}
                >
                  <Text variant="caption" color={ACCENT}>Undismiss</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  placeholderBox: {
    marginTop: spacing.sm, padding: spacing.md, borderRadius: 12,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  list: { gap: spacing.sm, marginTop: spacing.sm },
  detectionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.sm, borderRadius: 10,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  mainCopy: { flex: 1, gap: 2 },
  acceptButton: {
    backgroundColor: colors.success, borderRadius: 10,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  dismissButton: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  dismissedRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.sm, borderRadius: 10,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  mainLabel: { flex: 1 },
});
