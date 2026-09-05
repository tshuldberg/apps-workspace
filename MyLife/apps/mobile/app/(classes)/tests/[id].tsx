import { useCallback } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, borderRadius, colors, spacing } from '@mylife/ui';
import {
  deleteStandardizedTest,
  getStandardizedTest,
  type StandardizedTestRow,
} from '@mylife/classes';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  CLASSES_ACCENT,
  CLASSES_ACCENT_BORDER,
  CLASSES_ACCENT_DIM,
  useClassesFocusedSnapshot,
} from '../_ui';
import { Pill, formatDate } from '../applications/_ui';
import { TEST_CATEGORY_LABEL, TEST_STATUS_LABEL, daysUntil } from './_ui';

export default function TestDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const load = useCallback(
    (): StandardizedTestRow | null => (id ? getStandardizedTest(db, id) : null),
    [db, id],
  );

  const test = useClassesFocusedSnapshot(load);

  const onDelete = useCallback(() => {
    if (!test) return;
    Alert.alert('Delete test?', `Remove "${test.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteStandardizedTest(db, test.id);
          router.replace('/(classes)/tests');
        },
      },
    ]);
  }, [db, test, router]);

  if (!test) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>Test not found.</Text>
      </View>
    );
  }

  const sectionEntries: [string, number][] = (() => {
    if (!test.section_scores) return [];
    try {
      const obj = JSON.parse(test.section_scores) as Record<string, number>;
      return Object.entries(obj);
    } catch {
      return [];
    }
  })();

  const dDays = daysUntil(test.test_date);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <View style={{ gap: 6 }}>
        <Text style={styles.title}>{test.name}</Text>
        <Text variant="caption" color={colors.textSecondary}>
          {TEST_CATEGORY_LABEL[test.category]}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs }}>
          <Pill label={TEST_STATUS_LABEL[test.status]} />
          {test.superscore_eligible ? <Pill label="Superscore eligible" /> : null}
        </View>
      </View>

      <View style={styles.card}>
        <Row label="Score" value={test.score != null ? `${test.score}${test.max_score ? ` / ${test.max_score}` : ''}` : '—'} />
        {test.percentile != null ? <Row label="Percentile" value={`${test.percentile}`} /> : null}
        <Row label="Test date" value={formatDate(test.test_date)} />
        {dDays != null ? (
          <Row
            label="Countdown"
            value={dDays < 0 ? `${Math.abs(dDays)}d ago` : dDays === 0 ? 'today' : `in ${dDays}d`}
          />
        ) : null}
        {test.registration_deadline ? (
          <Row label="Registration deadline" value={formatDate(test.registration_deadline)} />
        ) : null}
        {test.location ? <Row label="Location" value={test.location} /> : null}
      </View>

      {sectionEntries.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Section scores</Text>
          {sectionEntries.map(([k, v]) => (
            <Row key={k} label={k} value={String(v)} />
          ))}
        </View>
      ) : null}

      {test.notes_md ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={{ color: colors.text, fontSize: 14 }}>{test.notes_md}</Text>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
        <Pressable
          style={[styles.action, { borderColor: colors.danger, borderWidth: 1 }]}
          onPress={onDelete}
        >
          <Text style={[styles.actionLabel, { color: colors.danger }]}>Delete</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="caption" color={colors.textSecondary} style={{ flex: 1 }}>
        {label}
      </Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: CLASSES_ACCENT_BORDER,
    backgroundColor: CLASSES_ACCENT_DIM,
    padding: spacing.md,
    gap: spacing.xs,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  action: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.pill,
    alignItems: 'center',
  },
  actionLabel: { fontSize: 14, fontWeight: '800', letterSpacing: 0.4 },
});
