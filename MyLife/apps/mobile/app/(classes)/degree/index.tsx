import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, borderRadius, colors, spacing } from '@mylife/ui';
import {
  computeProgramProgress,
  listClassesBySemester,
  listPrograms,
  listRequirementsByProgram,
  listSatisfactionsByRequirement,
  listSemesters,
  type ClassRow,
  type DegreeProgramRow,
  type ProgramProgress,
  type RequirementRow,
} from '@mylife/classes';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  CLASSES_ACCENT,
  CLASSES_ACCENT_BORDER,
  ClassesEmptyCard,
  ClassesHero,
  ClassesScreen,
  ClassesSection,
  useClassesFocusedSnapshot,
} from '../_ui';
import {
  PercentRing,
  Pill,
  ProgressBar,
  REQUIREMENT_CATEGORY_LABEL,
  gpaStatusColor,
  gpaStatusLabel,
} from './_ui';

interface DegreeHubSnapshot {
  primary: DegreeProgramRow | null;
  programs: DegreeProgramRow[];
  requirements: RequirementRow[];
  progress: ProgramProgress | null;
}

export default function DegreeHubScreen() {
  const db = useDatabase();
  const router = useRouter();

  const load = useCallback((): DegreeHubSnapshot => {
    const programs = listPrograms(db);
    const primary = programs.find((p) => p.is_primary === 1) ?? null;
    if (!primary) {
      return { primary: null, programs, requirements: [], progress: null };
    }
    const requirements = listRequirementsByProgram(db, primary.id);
    const allSats = requirements.flatMap((r) =>
      listSatisfactionsByRequirement(db, r.id),
    );
    const semesters = listSemesters(db);
    const allClasses: ClassRow[] = semesters.flatMap((s) =>
      listClassesBySemester(db, s.id),
    );
    const progress = computeProgramProgress(
      primary,
      requirements,
      allSats,
      allClasses,
    );
    return { primary, programs, requirements, progress };
  }, [db]);

  const snap = useClassesFocusedSnapshot(load);

  if (!snap.primary || !snap.progress) {
    return (
      <ClassesScreen
        title="Degree"
        subtitle="Track requirements, credits, and graduation progress for your degree programs."
      >
        <ClassesHero
          badge="Degree"
          title="Plan your path to graduation"
          body="Add a degree program to map requirements, see what's done, and forecast time-to-degree."
          actionLabel={snap.programs.length > 0 ? 'Add another' : 'Add program'}
          onAction={() => router.push('/(classes)/degree/program/add')}
        />
        {snap.programs.length === 0 ? (
          <ClassesSection title="Get started">
            <ClassesEmptyCard
              title="No degree program yet"
              body="Add one to start tracking requirements."
              actionLabel="Add a program"
              onAction={() => router.push('/(classes)/degree/program/add')}
            />
          </ClassesSection>
        ) : (
          <ClassesSection title="All programs">
            <View style={{ gap: spacing.sm }}>
              {snap.programs.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => router.push(`/(classes)/degree/program/${p.id}`)}
                  style={styles.programRow}
                >
                  <View style={styles.programRowTop}>
                    <Text style={styles.programTitle}>{p.name}</Text>
                    {p.degree_type ? <Pill label={p.degree_type} /> : null}
                  </View>
                  {p.institution ? (
                    <Text variant="caption" color={colors.textSecondary}>
                      {p.institution}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          </ClassesSection>
        )}
      </ClassesScreen>
    );
  }

  const progress = snap.progress;
  const program = snap.primary;
  const gpaColor = gpaStatusColor(progress.gpa_status);

  return (
    <ClassesScreen
      title={program.name}
      subtitle={
        program.institution
          ? `${program.institution}${program.degree_type ? ` · ${program.degree_type}` : ''}`
          : program.degree_type ?? 'Degree program'
      }
    >
      <View style={styles.heroRow}>
        <PercentRing percent={progress.percent_complete} />
        <View style={{ flex: 1, gap: spacing.sm }}>
          <View style={styles.statRow}>
            <Text variant="caption" color={colors.textSecondary}>
              Credits completed
            </Text>
            <Text style={styles.statValue}>
              {progress.total_credits_completed} /{' '}
              {progress.total_credits_required}
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text variant="caption" color={colors.textSecondary}>
              In progress
            </Text>
            <Text style={styles.statValue}>
              {progress.total_credits_in_progress}
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text variant="caption" color={colors.textSecondary}>
              Planned
            </Text>
            <Text style={styles.statValue}>
              {progress.total_credits_planned}
            </Text>
          </View>
          <Pill
            label={gpaStatusLabel(progress.gpa_status)}
            color={gpaColor}
            borderColor={gpaColor}
          />
        </View>
      </View>

      <ClassesSection title="Requirements">
        {progress.requirements.length === 0 ? (
          <ClassesEmptyCard
            title="No requirements yet"
            body="Add requirements to start tracking which classes count toward what."
            actionLabel="Add requirement"
            onAction={() =>
              router.push(
                `/(classes)/degree/requirement/add?program_id=${program.id}`,
              )
            }
          />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {progress.requirements.map((rp) => {
              const req = snap.requirements.find(
                (r) => r.id === rp.requirement_id,
              );
              return (
                <Pressable
                  key={rp.requirement_id}
                  onPress={() =>
                    router.push(`/(classes)/degree/requirement/${rp.requirement_id}`)
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
                    <Pill
                      label={REQUIREMENT_CATEGORY_LABEL[req.category]}
                    />
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
                        {rp.credits_in_progress > 0
                          ? ` · ${rp.credits_in_progress} in progress`
                          : ''}
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

        <Pressable
          style={styles.addReqBtn}
          onPress={() =>
            router.push(
              `/(classes)/degree/requirement/add?program_id=${program.id}`,
            )
          }
        >
          <Text style={[styles.addReqBtnLabel, { color: CLASSES_ACCENT }]}>
            + Add requirement
          </Text>
        </Pressable>
      </ClassesSection>

      {snap.programs.length > 1 ? (
        <ClassesSection title="All programs">
          <View style={{ gap: spacing.sm }}>
            {snap.programs.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => router.push(`/(classes)/degree/program/${p.id}`)}
                style={styles.programRow}
              >
                <View style={styles.programRowTop}>
                  <Text style={styles.programTitle}>{p.name}</Text>
                  {p.is_primary === 1 ? (
                    <Pill label="Primary" />
                  ) : p.degree_type ? (
                    <Pill label={p.degree_type} />
                  ) : null}
                </View>
                {p.institution ? (
                  <Text variant="caption" color={colors.textSecondary}>
                    {p.institution}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        </ClassesSection>
      ) : null}
    </ClassesScreen>
  );
}

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
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
  addReqBtn: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: CLASSES_ACCENT_BORDER,
  },
  addReqBtnLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  programRow: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: 4,
  },
  programRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  programTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
});
