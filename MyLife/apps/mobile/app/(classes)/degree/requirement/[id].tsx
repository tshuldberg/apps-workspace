import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Card, Text, borderRadius, colors, spacing } from '@mylife/ui';
import {
  computeRequirementProgress,
  createRequirementSatisfaction,
  deleteRequirement,
  deleteRequirementSatisfaction,
  getProgram,
  getRequirement,
  listClassesBySemester,
  listSatisfactionsByRequirement,
  listSemesters,
  suggestClassesForRequirement,
  type ClassRow,
  type DegreeProgramRow,
  type RequirementRow,
  type RequirementSatisfactionRow,
} from '@mylife/classes';
import { useDatabase } from '../../../../components/DatabaseProvider';
import { uuid } from '../../../../lib/uuid';
import {
  CLASSES_ACCENT,
  CLASSES_ACCENT_BORDER,
  useClassesFocusedSnapshot,
} from '../../_ui';
import {
  Pill,
  ProgressBar,
  REQUIREMENT_CATEGORY_LABEL,
  SATISFACTION_STATUS_LABEL,
} from '../_ui';

interface RequirementDetailSnapshot {
  requirement: RequirementRow | null;
  program: DegreeProgramRow | null;
  satisfactions: RequirementSatisfactionRow[];
  classes: ClassRow[];
  suggested: ClassRow[];
}

export default function RequirementDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();
  const router = useRouter();
  const [showAllClasses, setShowAllClasses] = useState(false);

  const load = useCallback((): RequirementDetailSnapshot => {
    if (!id) {
      return {
        requirement: null,
        program: null,
        satisfactions: [],
        classes: [],
        suggested: [],
      };
    }
    const requirement = getRequirement(db, id);
    if (!requirement) {
      return {
        requirement: null,
        program: null,
        satisfactions: [],
        classes: [],
        suggested: [],
      };
    }
    const program = getProgram(db, requirement.program_id);
    const satisfactions = listSatisfactionsByRequirement(db, requirement.id);
    const semesters = listSemesters(db);
    const classes = semesters.flatMap((s) => listClassesBySemester(db, s.id));
    const suggested = suggestClassesForRequirement(requirement, classes);
    return { requirement, program, satisfactions, classes, suggested };
  }, [db, id]);

  const snap = useClassesFocusedSnapshot(load);

  const handleAttach = useCallback(
    (cls: ClassRow) => {
      if (!snap.requirement) return;
      try {
        createRequirementSatisfaction(db, uuid(), {
          requirement_id: snap.requirement.id,
          class_id: cls.id,
          credits_applied: cls.credits ?? 0,
          status: 'planned',
        });
      } catch (err) {
        Alert.alert('Attach failed', String(err));
      }
    },
    [db, snap.requirement],
  );

  const handleRemoveSatisfaction = useCallback(
    (satId: string) => {
      Alert.alert('Remove class?', 'It will no longer count toward this requirement.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            try {
              deleteRequirementSatisfaction(db, satId);
            } catch (err) {
              Alert.alert('Remove failed', String(err));
            }
          },
        },
      ]);
    },
    [db],
  );

  const handleDelete = useCallback(() => {
    if (!snap.requirement) return;
    const requirement = snap.requirement;
    Alert.alert(
      'Delete requirement?',
      'This removes all attached class satisfactions.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              deleteRequirement(db, requirement.id);
              router.back();
            } catch (err) {
              Alert.alert('Delete failed', String(err));
            }
          },
        },
      ],
    );
  }, [db, snap.requirement, router]);

  if (!snap.requirement) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Stack.Screen options={{ title: 'Requirement' }} />
        <Text variant="body" color={colors.textSecondary}>
          Requirement not found.
        </Text>
      </View>
    );
  }

  const requirement = snap.requirement;
  const progress = computeRequirementProgress(
    requirement,
    snap.satisfactions,
    snap.classes,
  );
  const classById = new Map<string, ClassRow>();
  for (const c of snap.classes) classById.set(c.id, c);
  const blockingClassIds = new Set(progress.blocking_classes.map((c) => c.id));

  const attachedClassIds = new Set(snap.satisfactions.map((s) => s.class_id));
  const unattachedClasses = snap.classes.filter(
    (c) => !attachedClassIds.has(c.id),
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: requirement.name }} />

      <Card style={styles.heroCard}>
        <View style={styles.heroTop}>
          <Text style={styles.heroTitle}>{requirement.name}</Text>
          {progress.is_satisfied ? (
            <Text style={styles.checkmark}>✓</Text>
          ) : null}
        </View>
        {requirement.category ? (
          <Pill label={REQUIREMENT_CATEGORY_LABEL[requirement.category]} />
        ) : null}
        {requirement.credits_required > 0 ? (
          <>
            <ProgressBar
              percent={
                requirement.credits_required > 0
                  ? (progress.credits_completed /
                      requirement.credits_required) *
                    100
                  : 0
              }
            />
            <Text variant="caption" color={colors.textSecondary}>
              {progress.credits_completed} / {requirement.credits_required}{' '}
              credits
              {progress.credits_in_progress > 0
                ? ` · ${progress.credits_in_progress} in progress`
                : ''}
              {progress.credits_planned > 0
                ? ` · ${progress.credits_planned} planned`
                : ''}
            </Text>
          </>
        ) : null}
        {requirement.course_count_required > 0 ? (
          <Text variant="caption" color={colors.textSecondary}>
            {progress.courses_completed} / {requirement.course_count_required}{' '}
            courses
          </Text>
        ) : null}
        {requirement.min_grade ? (
          <Text variant="caption" color={colors.textSecondary}>
            Minimum grade: {requirement.min_grade}
          </Text>
        ) : null}
      </Card>

      <Section title="Attached classes">
        {snap.satisfactions.length === 0 ? (
          <Card style={styles.card}>
            <Text variant="body" color={colors.textSecondary}>
              No classes attached yet. Use a suggestion below or add manually.
            </Text>
          </Card>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {snap.satisfactions.map((sat) => {
              const cls = classById.get(sat.class_id);
              const blocking = cls ? blockingClassIds.has(cls.id) : false;
              return (
                <View key={sat.id} style={styles.satCard}>
                  <View style={styles.satTop}>
                    <Text style={styles.satTitle}>
                      {cls ? cls.name : '(Class deleted)'}
                    </Text>
                    <Pill label={SATISFACTION_STATUS_LABEL[sat.status]} />
                  </View>
                  <Text variant="caption" color={colors.textSecondary}>
                    {cls?.code ?? '—'} · {sat.credits_applied} credits applied
                  </Text>
                  {blocking ? (
                    <Text variant="caption" color="#FFB4AB">
                      Grade below required minimum
                    </Text>
                  ) : null}
                  <Pressable
                    style={styles.removeBtn}
                    onPress={() => handleRemoveSatisfaction(sat.id)}
                  >
                    <Text style={styles.removeBtnLabel}>Remove</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </Section>

      {snap.suggested.length > 0 ? (
        <Section title="Suggested classes">
          <View style={{ gap: spacing.sm }}>
            {snap.suggested
              .filter((c) => !attachedClassIds.has(c.id))
              .map((cls) => (
                <View key={cls.id} style={styles.suggestCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.satTitle}>{cls.name}</Text>
                    <Text variant="caption" color={colors.textSecondary}>
                      {cls.code ?? '—'} · {cls.credits} credits
                    </Text>
                  </View>
                  <Pressable
                    style={[styles.attachBtn, { backgroundColor: CLASSES_ACCENT }]}
                    onPress={() => handleAttach(cls)}
                  >
                    <Text style={[styles.attachBtnLabel, { color: colors.background }]}>
                      Attach
                    </Text>
                  </Pressable>
                </View>
              ))}
          </View>
        </Section>
      ) : null}

      <Section title="Add manually">
        <Pressable
          style={styles.toggleBtn}
          onPress={() => setShowAllClasses((v) => !v)}
        >
          <Text style={[styles.toggleBtnLabel, { color: CLASSES_ACCENT }]}>
            {showAllClasses ? 'Hide all classes' : 'Pick from any class'}
          </Text>
        </Pressable>
        {showAllClasses ? (
          <View style={{ gap: spacing.sm }}>
            {unattachedClasses.length === 0 ? (
              <Card style={styles.card}>
                <Text variant="body" color={colors.textSecondary}>
                  No more classes to attach.
                </Text>
              </Card>
            ) : (
              unattachedClasses.map((cls) => (
                <View key={cls.id} style={styles.suggestCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.satTitle}>{cls.name}</Text>
                    <Text variant="caption" color={colors.textSecondary}>
                      {cls.code ?? '—'} · {cls.credits} credits
                    </Text>
                  </View>
                  <Pressable
                    style={[styles.attachBtn, { backgroundColor: CLASSES_ACCENT }]}
                    onPress={() => handleAttach(cls)}
                  >
                    <Text style={[styles.attachBtnLabel, { color: colors.background }]}>
                      Attach
                    </Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        ) : null}
      </Section>

      {requirement.notes_md ? (
        <Section title="Notes">
          <Card style={styles.card}>
            <Text variant="body" color={colors.text}>
              {requirement.notes_md}
            </Text>
          </Card>
        </Section>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          style={styles.secondaryBtn}
          onPress={() =>
            router.push(`/(classes)/degree/requirement/edit/${requirement.id}`)
          }
        >
          <Text style={styles.secondaryBtnLabel}>Edit requirement</Text>
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
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    flex: 1,
  },
  checkmark: { color: '#30D158', fontSize: 22, fontWeight: '800' },
  satCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: CLASSES_ACCENT_BORDER,
    backgroundColor: 'rgba(59,130,246,0.08)',
    padding: spacing.md,
    gap: spacing.xs,
  },
  satTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  satTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  removeBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: '#FFB4AB',
  },
  removeBtnLabel: { color: '#FFB4AB', fontSize: 12, fontWeight: '700' },
  suggestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  attachBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
  },
  attachBtnLabel: { fontSize: 12, fontWeight: '700' },
  toggleBtn: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: CLASSES_ACCENT_BORDER,
  },
  toggleBtnLabel: { fontSize: 13, fontWeight: '700' },
  actions: { gap: spacing.sm, marginTop: spacing.md },
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
