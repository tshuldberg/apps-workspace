import { useCallback } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Card, Text, borderRadius, colors, spacing } from '@mylife/ui';
import {
  computeProgramProgress,
  deleteDegreeProgram,
  detectDoubleCount,
  getProgram,
  listClassesBySemester,
  listRequirementsByProgram,
  listSatisfactionsByRequirement,
  listSemesters,
  setPrimaryProgram,
  type ClassRow,
  type DegreeProgramRow,
  type ProgramProgress,
  type RequirementRow,
  type RequirementSatisfactionRow,
} from '@mylife/classes';
import { useDatabase } from '../../../../components/DatabaseProvider';
import {
  CLASSES_ACCENT,
  CLASSES_ACCENT_BORDER,
  useClassesFocusedSnapshot,
} from '../../_ui';
import {
  PercentRing,
  Pill,
  ProgressBar,
  REQUIREMENT_CATEGORY_LABEL,
  formatDate,
  gpaStatusColor,
  gpaStatusLabel,
} from '../_ui';

interface ProgramDetailSnapshot {
  program: DegreeProgramRow | null;
  requirements: RequirementRow[];
  classes: ClassRow[];
  satisfactions: RequirementSatisfactionRow[];
  progress: ProgramProgress | null;
}

export default function ProgramDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();
  const router = useRouter();

  const load = useCallback((): ProgramDetailSnapshot => {
    if (!id) {
      return {
        program: null,
        requirements: [],
        classes: [],
        satisfactions: [],
        progress: null,
      };
    }
    const program = getProgram(db, id);
    if (!program) {
      return {
        program: null,
        requirements: [],
        classes: [],
        satisfactions: [],
        progress: null,
      };
    }
    const requirements = listRequirementsByProgram(db, program.id);
    const satisfactions = requirements.flatMap((r) =>
      listSatisfactionsByRequirement(db, r.id),
    );
    const semesters = listSemesters(db);
    const classes = semesters.flatMap((s) => listClassesBySemester(db, s.id));
    const progress = computeProgramProgress(
      program,
      requirements,
      satisfactions,
      classes,
    );
    return { program, requirements, classes, satisfactions, progress };
  }, [db, id]);

  const snap = useClassesFocusedSnapshot(load);

  const handleSetPrimary = useCallback(() => {
    if (!snap.program) return;
    try {
      setPrimaryProgram(db, snap.program.id);
      Alert.alert('Primary set', `${snap.program.name} is now your primary program.`);
    } catch (err) {
      Alert.alert('Failed', String(err));
    }
  }, [db, snap.program]);

  const handleDelete = useCallback(() => {
    if (!snap.program) return;
    const program = snap.program;
    Alert.alert(
      'Delete program?',
      'This will remove all requirements and satisfactions. Class records are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              deleteDegreeProgram(db, program.id);
              router.back();
            } catch (err) {
              Alert.alert('Delete failed', String(err));
            }
          },
        },
      ],
    );
  }, [db, snap.program, router]);

  if (!snap.program || !snap.progress) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Stack.Screen options={{ title: 'Program' }} />
        <Text variant="body" color={colors.textSecondary}>
          Program not found.
        </Text>
      </View>
    );
  }

  const program = snap.program;
  const progress = snap.progress;
  const gpaColor = gpaStatusColor(progress.gpa_status);
  const doubleCount = detectDoubleCount(snap.satisfactions);
  const classById = new Map<string, ClassRow>();
  for (const c of snap.classes) classById.set(c.id, c);
  const reqById = new Map<string, RequirementRow>();
  for (const r of snap.requirements) reqById.set(r.id, r);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: program.name }} />

      <Card style={styles.heroCard}>
        <View style={styles.heroRow}>
          <PercentRing percent={progress.percent_complete} />
          <View style={{ flex: 1, gap: spacing.sm }}>
            <Text style={styles.heroTitle}>{program.name}</Text>
            {program.institution ? (
              <Text variant="caption" color={colors.textSecondary}>
                {program.institution}
                {program.degree_type ? ` · ${program.degree_type}` : ''}
              </Text>
            ) : program.degree_type ? (
              <Text variant="caption" color={colors.textSecondary}>
                {program.degree_type}
              </Text>
            ) : null}
            <Pill
              label={gpaStatusLabel(progress.gpa_status)}
              color={gpaColor}
              borderColor={gpaColor}
            />
          </View>
        </View>
      </Card>

      <Section title="Overview">
        <Card style={styles.card}>
          <Row
            label="Credits"
            value={`${progress.total_credits_completed} / ${progress.total_credits_required}`}
          />
          <Row
            label="In progress"
            value={`${progress.total_credits_in_progress}`}
          />
          <Row label="Planned" value={`${progress.total_credits_planned}`} />
          {program.gpa_required != null ? (
            <Row label="GPA required" value={program.gpa_required.toFixed(2)} />
          ) : null}
          {program.catalog_year ? (
            <Row label="Catalog" value={program.catalog_year} />
          ) : null}
          <Row label="Started" value={formatDate(program.start_date)} />
          <Row
            label="Expected"
            value={formatDate(program.expected_completion)}
          />
        </Card>
      </Section>

      <Section title="Requirements">
        {progress.requirements.length === 0 ? (
          <Card style={styles.card}>
            <Text variant="body" color={colors.textSecondary}>
              No requirements yet. Add one to start tracking progress.
            </Text>
          </Card>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {progress.requirements.map((rp) => {
              const req = reqById.get(rp.requirement_id);
              return (
                <Pressable
                  key={rp.requirement_id}
                  onPress={() =>
                    router.push(
                      `/(classes)/degree/requirement/${rp.requirement_id}`,
                    )
                  }
                  style={styles.reqCard}
                >
                  <View style={styles.reqTop}>
                    <Text style={styles.reqTitle}>{rp.name}</Text>
                    {rp.is_satisfied ? (
                      <Text style={styles.checkmark}>✓</Text>
                    ) : null}
                  </View>
                  {req?.category ? (
                    <Pill label={REQUIREMENT_CATEGORY_LABEL[req.category]} />
                  ) : null}
                  {rp.credits_required > 0 ? (
                    <>
                      <ProgressBar
                        percent={
                          rp.credits_required > 0
                            ? (rp.credits_completed / rp.credits_required) * 100
                            : 0
                        }
                      />
                      <Text variant="caption" color={colors.textSecondary}>
                        {rp.credits_completed} / {rp.credits_required} credits
                      </Text>
                    </>
                  ) : null}
                  {rp.course_count_required > 0 ? (
                    <Text variant="caption" color={colors.textSecondary}>
                      {rp.courses_completed} / {rp.course_count_required}{' '}
                      courses
                    </Text>
                  ) : null}
                  {rp.blocking_classes.length > 0 ? (
                    <Text variant="caption" color="#FFB4AB">
                      {rp.blocking_classes.length} blocking grade
                      {rp.blocking_classes.length === 1 ? '' : 's'}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}
      </Section>

      {doubleCount.length > 0 ? (
        <Section title="Double-counted classes">
          <Card style={styles.card}>
            {doubleCount.map((entry) => {
              const cls = classById.get(entry.class_id);
              return (
                <View key={entry.class_id} style={styles.dcRow}>
                  <Text style={styles.dcTitle}>
                    {cls ? cls.name : entry.class_id}
                  </Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    Counts toward {entry.requirement_ids.length} requirements
                  </Text>
                </View>
              );
            })}
          </Card>
        </Section>
      ) : null}

      {program.notes_md ? (
        <Section title="Notes">
          <Card style={styles.card}>
            <Text variant="body" color={colors.text}>
              {program.notes_md}
            </Text>
          </Card>
        </Section>
      ) : null}

      <View style={styles.actions}>
        {program.is_primary !== 1 ? (
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: CLASSES_ACCENT }]}
            onPress={handleSetPrimary}
          >
            <Text style={[styles.primaryBtnLabel, { color: colors.background }]}>
              Set as primary
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          style={styles.secondaryBtn}
          onPress={() =>
            router.push(`/(classes)/degree/program/edit/${program.id}`)
          }
        >
          <Text style={styles.secondaryBtnLabel}>Edit program</Text>
        </Pressable>
        <Pressable style={styles.dangerBtn} onPress={handleDelete}>
          <Text style={styles.dangerBtnLabel}>Delete</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text variant="caption" color={colors.textSecondary}>
        {label}
      </Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  center: { justifyContent: 'center', alignItems: 'center' },
  section: { gap: spacing.sm },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  card: { gap: spacing.sm },
  heroCard: { gap: spacing.sm },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  reqCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: CLASSES_ACCENT_BORDER,
    backgroundColor: 'rgba(59,130,246,0.08)',
    padding: spacing.md,
    gap: spacing.xs,
  },
  reqTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reqTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  checkmark: {
    color: '#30D158',
    fontSize: 18,
    fontWeight: '800',
  },
  dcRow: { gap: 4 },
  dcTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  primaryBtn: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  primaryBtnLabel: { fontSize: 15, fontWeight: '700' },
  secondaryBtn: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  secondaryBtnLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  dangerBtn: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFB4AB',
    backgroundColor: 'transparent',
  },
  dangerBtnLabel: { fontSize: 14, fontWeight: '700', color: '#FFB4AB' },
});
