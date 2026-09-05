import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Text, Card, colors, spacing } from '@mylife/ui';
import {
  getMedicationExtended,
  getDoseLogsForMedication,
  getRefillHistory,
  getInteractionsForMedication,
  getDaysRemaining,
} from '@mylife/health';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.health;

export default function MedDetailScreen() {
  const db = useDatabase();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tick] = useState(0);

  const med = useMemo(() => {
    if (!id) return null;
    try { return getMedicationExtended(db, id); } catch { return null; }
  }, [db, id, tick]);

  const doseLogs = useMemo(() => {
    if (!id) return [];
    try { return getDoseLogsForMedication(db, id); } catch { return []; }
  }, [db, id, tick]);

  const refills = useMemo(() => {
    if (!id) return [];
    try { return getRefillHistory(db, id); } catch { return []; }
  }, [db, id, tick]);

  const interactions = useMemo(() => {
    if (!id) return [];
    try { return getInteractionsForMedication(db, id); } catch { return []; }
  }, [db, id, tick]);

  const daysLeft = useMemo(() => {
    if (!id) return null;
    try { return getDaysRemaining(db, id); } catch { return null; }
  }, [db, id, tick]);

  if (!med) {
    return (
      <View style={styles.emptyContainer}>
        <Text variant="heading">Medication not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="heading" style={styles.title}>{med.name}</Text>
      <Text variant="caption" color={colors.textSecondary}>
        {med.dosage} {med.unit ?? ''} {med.frequency ? `- ${med.frequency}` : ''}
      </Text>

      {/* Supply */}
      {daysLeft != null && (
        <Card style={styles.card}>
          <Text variant="subheading">Supply</Text>
          <View style={styles.row}>
            <Text style={[styles.metricValue, { color: daysLeft <= 7 ? colors.danger : ACCENT }]}>
              {daysLeft}
            </Text>
            <Text variant="caption" color={colors.textSecondary}>days remaining</Text>
          </View>
          {med.pillCount != null && (
            <Text variant="caption" color={colors.textSecondary}>
              {med.pillCount} pills in stock
            </Text>
          )}
        </Card>
      )}

      {/* Recent Doses */}
      <Card style={styles.card}>
        <Text variant="subheading">Recent Doses</Text>
        {doseLogs.length > 0 ? (
          doseLogs.slice(0, 10).map((log) => (
            <View key={log.id} style={styles.logRow}>
              <Text variant="body">{log.status}</Text>
              <Text variant="caption" color={colors.textSecondary}>
                {log.scheduledTime?.slice(0, 16) ?? log.createdAt?.slice(0, 16) ?? ''}
              </Text>
            </View>
          ))
        ) : (
          <Text variant="caption" color={colors.textSecondary}>
            No dose logs yet
          </Text>
        )}
      </Card>

      {/* Interactions */}
      {interactions.length > 0 && (
        <Card style={styles.card}>
          <Text variant="subheading">Interactions</Text>
          {interactions.map((interaction, i) => (
            <View key={i} style={styles.interactionRow}>
              <Text variant="body" color={colors.danger}>
                {String((interaction as Record<string, unknown>).drug1 ?? '')} + {String((interaction as Record<string, unknown>).drug2 ?? '')}
              </Text>
              <Text variant="caption" color={colors.textSecondary}>
                {String((interaction as Record<string, unknown>).severity ?? '')} - {String((interaction as Record<string, unknown>).description ?? '')}
              </Text>
            </View>
          ))}
        </Card>
      )}

      {/* Refill History */}
      {refills.length > 0 && (
        <Card style={styles.card}>
          <Text variant="subheading">Refill History</Text>
          {refills.slice(0, 5).map((refill) => (
            <View key={refill.id} style={styles.logRow}>
              <Text variant="body">+{refill.quantity}</Text>
              <Text variant="caption" color={colors.textSecondary}>
                {refill.refillDate?.slice(0, 10) ?? ''}
              </Text>
            </View>
          ))}
        </Card>
      )}

      {/* Notes */}
      {med.notes && (
        <Card style={styles.card}>
          <Text variant="subheading">Notes</Text>
          <Text variant="caption" color={colors.textSecondary}>{med.notes}</Text>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  title: {
    marginBottom: spacing.xs,
  },
  card: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  interactionRow: {
    paddingVertical: spacing.xs,
    gap: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
