import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, borderRadius, colors, spacing } from '@mylife/ui';
import {
  getBestScoreByName,
  getUpcomingTests,
  listStandardizedTests,
  type StandardizedTestCategory,
  type StandardizedTestRow,
} from '@mylife/classes';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  CLASSES_ACCENT,
  CLASSES_ACCENT_BORDER,
  CLASSES_ACCENT_DIM,
  ClassesEmptyCard,
  ClassesHero,
  ClassesMetricRow,
  ClassesScreen,
  useClassesFocusedSnapshot,
} from '../_ui';
import { Pill, formatDate } from '../applications/_ui';
import { TEST_CATEGORIES, TEST_CATEGORY_LABEL, TEST_STATUS_LABEL, daysUntil } from './_ui';

interface BestEntry {
  name: string;
  score: number;
}

interface Snapshot {
  groups: Record<StandardizedTestCategory, StandardizedTestRow[]>;
  upcoming: StandardizedTestRow[];
  total: number;
  best: BestEntry[];
}

export default function TestsHubScreen() {
  const db = useDatabase();
  const router = useRouter();

  const load = useCallback((): Snapshot => {
    const tests = listStandardizedTests(db);
    const groups = {} as Record<StandardizedTestCategory, StandardizedTestRow[]>;
    for (const cat of TEST_CATEGORIES) groups[cat] = [];
    for (const t of tests) groups[t.category].push(t);
    const upcoming = getUpcomingTests(db, 90);
    // Best score per unique name
    const seen = new Set<string>();
    const best: BestEntry[] = [];
    for (const t of tests) {
      if (seen.has(t.name)) continue;
      seen.add(t.name);
      const b = getBestScoreByName(db, t.name);
      if (b != null) best.push({ name: t.name, score: b });
    }
    return { groups, upcoming, total: tests.length, best };
  }, [db]);

  const snap = useClassesFocusedSnapshot(load);

  if (snap.total === 0) {
    return (
      <ClassesScreen
        title="Tests"
        subtitle="Standardized tests, AP/IB exams, language certs, and pro credentials in one tracker."
      >
        <ClassesHero
          badge="Tests"
          title="Track every score that matters"
          body="Plan upcoming sittings, log scores by section, and superscore across attempts."
          actionLabel="Add test"
          onAction={() => router.push('/(classes)/tests/add')}
        />
        <ClassesEmptyCard
          title="No tests tracked yet"
          body="Log a planned test or a past score to get started."
          actionLabel="Add a test"
          onAction={() => router.push('/(classes)/tests/add')}
        />
      </ClassesScreen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ClassesScreen title="Tests" subtitle="Grouped by category. Tap any test for details.">
        <ClassesMetricRow
          items={[
            { label: 'Total', value: String(snap.total) },
            { label: 'Upcoming', value: String(snap.upcoming.length) },
            { label: 'Best scores', value: String(snap.best.length) },
          ]}
        />

        {snap.upcoming.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.sectionTitle}>Upcoming</Text>
            {snap.upcoming.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => router.push(`/(classes)/tests/${t.id}`)}
                style={styles.card}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle}>{t.name}</Text>
                  <Pill label={TEST_STATUS_LABEL[t.status]} />
                </View>
                <Text variant="caption" color={colors.textSecondary}>
                  {TEST_CATEGORY_LABEL[t.category]}
                  {t.test_date ? ` · ${formatDate(t.test_date)}` : ''}
                  {t.test_date ? ` · ${countdownLabel(t.test_date)}` : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {snap.best.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.sectionTitle}>Best scores</Text>
            <View style={styles.bestRow}>
              {snap.best.map((b) => (
                <View key={b.name} style={styles.bestPill}>
                  <Text style={styles.bestName}>{b.name}</Text>
                  <Text style={styles.bestScore}>{b.score}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {TEST_CATEGORIES.filter((c) => snap.groups[c].length > 0).map((cat) => (
          <View key={cat} style={{ gap: spacing.sm }}>
            <View style={styles.headerRow}>
              <Text style={styles.sectionTitle}>{TEST_CATEGORY_LABEL[cat]}</Text>
              <Text style={styles.sectionCount}>{snap.groups[cat].length}</Text>
            </View>
            {snap.groups[cat].map((t) => (
              <Pressable
                key={t.id}
                onPress={() => router.push(`/(classes)/tests/${t.id}`)}
                style={styles.card}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle}>{t.name}</Text>
                  <Pill label={TEST_STATUS_LABEL[t.status]} />
                </View>
                <Text variant="caption" color={colors.textSecondary}>
                  {t.score != null
                    ? `Score ${t.score}${t.max_score ? ` / ${t.max_score}` : ''}`
                    : 'No score yet'}
                  {t.test_date ? ` · ${formatDate(t.test_date)}` : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        ))}
      </ClassesScreen>

      <Pressable
        style={[styles.fab, { backgroundColor: CLASSES_ACCENT }]}
        onPress={() => router.push('/(classes)/tests/add')}
      >
        <Text style={[styles.fabLabel, { color: colors.background }]}>+ Test</Text>
      </Pressable>
    </View>
  );
}

function countdownLabel(iso: string): string {
  const d = daysUntil(iso);
  if (d == null) return '';
  if (d < 0) return `${Math.abs(d)}d ago`;
  if (d === 0) return 'today';
  if (d <= 60) return `in ${d}d`;
  return `in ${Math.round(d / 30)}mo`;
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '700',
    color: CLASSES_ACCENT,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: CLASSES_ACCENT_BORDER,
    backgroundColor: CLASSES_ACCENT_DIM,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  bestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  bestPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: CLASSES_ACCENT,
    backgroundColor: CLASSES_ACCENT_DIM,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  bestName: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  bestScore: { color: CLASSES_ACCENT, fontSize: 13, fontWeight: '800' },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.pill,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabLabel: { fontSize: 14, fontWeight: '800', letterSpacing: 0.4 },
});
