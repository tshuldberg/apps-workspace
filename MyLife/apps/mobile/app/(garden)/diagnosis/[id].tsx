import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  getActiveDiagnoses,
  updateDiagnosisStatus,
  type Diagnosis,
} from '@mylife/garden';
import { Text, colors, spacing, borderRadius } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';

const SEVERITY_COLORS: Record<string, string> = {
  mild: colors.success,
  moderate: colors.warning,
  severe: colors.danger,
  critical: colors.danger,
};

export default function DiagnosisDetailScreen() {
  const db = useDatabase();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tick, setTick] = useState(0);

  const diagnosis: Diagnosis | null = useMemo(() => {
    if (!id) return null;
    try {
      const all = getActiveDiagnoses(db);
      return all.find((d: Diagnosis) => d.id === id) ?? null;
    } catch { return null; }
  }, [db, id, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  if (!diagnosis) {
    return (
      <View style={styles.emptyContainer}>
        <Text variant="subheading">Diagnosis not found</Text>
      </View>
    );
  }

  const handleStatus = (status: 'resolved' | 'unresolvable') => {
    try {
      updateDiagnosisStatus(db, diagnosis.id, status);
      refresh();
    } catch {
      Alert.alert('Error', "Couldn't update status.");
    }
  };

  const symptoms = (() => {
    try { return JSON.parse(diagnosis.symptomsJson) as string[]; } catch { return []; }
  })();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading">{diagnosis.diagnosisName ?? 'Unknown'}</Text>
      <Text variant="caption" color={colors.textSecondary}>
        Diagnosed: {diagnosis.diagnosedDate}
      </Text>

      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: SEVERITY_COLORS[diagnosis.severity] ?? colors.textTertiary }]}>
          <Text variant="iconCaption" color={colors.background}>
            {diagnosis.severity}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: colors.surface }]}>
          <Text variant="iconCaption" color={colors.textSecondary}>
            {diagnosis.treatmentStatus.replace(/_/g, ' ')}
          </Text>
        </View>
      </View>

      <Text variant="label" color={colors.textTertiary} style={styles.sectionHeader}>
        SYMPTOMS
      </Text>
      <Text variant="body" color={colors.textSecondary}>
        {symptoms.length > 0 ? symptoms.map((s) => s.replace(/_/g, ' ')).join(', ') : 'None recorded'}
      </Text>

      {diagnosis.treatmentNotes && (
        <>
          <Text variant="label" color={colors.textTertiary} style={styles.sectionHeader}>
            TREATMENT NOTES
          </Text>
          <Text variant="body" color={colors.textSecondary}>
            {diagnosis.treatmentNotes}
          </Text>
        </>
      )}

      {(diagnosis.treatmentStatus === 'pending' || diagnosis.treatmentStatus === 'in_treatment') && (
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.success }]}
            onPress={() => handleStatus('resolved')}
          >
            <Text variant="body" color={colors.background} style={{ fontWeight: '600' }}>
              Mark Resolved
            </Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
            onPress={() => handleStatus('unresolvable')}
          >
            <Text variant="body" color={colors.textSecondary}>
              Mark Unresolvable
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  emptyContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.background,
  },
  badgeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  badge: {
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  sectionHeader: { marginTop: spacing.lg, marginBottom: spacing.xs },
  actionRow: { gap: spacing.sm, marginTop: spacing.lg },
  actionBtn: {
    paddingVertical: spacing.sm + 4, borderRadius: borderRadius.md,
    alignItems: 'center', minHeight: 44, justifyContent: 'center',
  },
});
