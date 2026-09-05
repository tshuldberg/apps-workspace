import { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  calculateClassGrade,
  calculateSemesterGPA,
  calculateTrend,
  letterFromPercent,
  listAssignmentsByClass,
  listClassesBySemester,
  listSemesters,
  predictFinalGrade,
  type AssignmentRow,
  type CategoryWeights,
  type ClassGradeResult,
  type ClassRow,
  type FinalPrediction,
  type SemesterGPAResult,
  type SemesterRow,
  type TrendResult,
} from '@mylife/classes';
import { useDatabase } from '../../components/DatabaseProvider';
import { GradeCard } from '../../components/classes/GradeCard';
import {
  ClassesEmptyCard,
  ClassesHero,
  ClassesMetricRow,
  ClassesScreen,
  ClassesSection,
  useClassesFocusedSnapshot,
} from './_ui';

interface GradeRowVM {
  cls: ClassRow;
  assignments: AssignmentRow[];
  weights: CategoryWeights | null;
  grade: ClassGradeResult;
  prediction: FinalPrediction | null;
  trend: TrendResult;
}

interface GradesSnapshot {
  semester: SemesterRow | null;
  rows: GradeRowVM[];
  semesterGPA: SemesterGPAResult;
}

function parseWeights(raw: string | null): CategoryWeights | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') return parsed as CategoryWeights;
    return null;
  } catch {
    return null;
  }
}

function buildHistory(assignments: AssignmentRow[]): Array<{ date: string; percent: number }> {
  return assignments
    .filter(
      (a) =>
        a.graded_at !== null &&
        a.grade !== null &&
        a.max_grade !== null &&
        a.max_grade > 0,
    )
    .map((a) => ({
      date: a.graded_at as string,
      percent: ((a.grade as number) / (a.max_grade as number)) * 100,
    }));
}

export default function ClassesGradesScreen() {
  const db = useDatabase();
  const router = useRouter();

  const load = useCallback((): GradesSnapshot => {
    const semesters = listSemesters(db);
    const semester =
      semesters.find((s) => s.is_current === 1) ?? semesters[0] ?? null;

    if (!semester) {
      return {
        semester: null,
        rows: [],
        semesterGPA: { gpa: null, credit_hours: 0, graded_credits: 0 },
      };
    }

    const classes = listClassesBySemester(db, semester.id);
    const rows: GradeRowVM[] = classes.map((cls) => {
      const assignments = listAssignmentsByClass(db, cls.id);
      const weights = parseWeights(cls.category_weights);
      const grade = calculateClassGrade(assignments, weights);
      const target =
        typeof cls.target_grade === 'number' && Number.isFinite(cls.target_grade)
          ? cls.target_grade
          : 90;
      const prediction =
        grade.graded_count > 0 || assignments.length > 0
          ? predictFinalGrade(assignments, weights, target)
          : null;
      const trend = calculateTrend(buildHistory(assignments));
      return { cls, assignments, weights, grade, prediction, trend };
    });

    const semesterGPA = calculateSemesterGPA(
      rows.map((r) => ({
        credits: r.cls.credits,
        letter:
          r.grade.percent === null ? null : letterFromPercent(r.grade.percent),
      })),
    );

    return { semester, rows, semesterGPA };
  }, [db]);

  const snapshot = useClassesFocusedSnapshot(load);

  const gpaText = useMemo(
    () => (snapshot.semesterGPA.gpa === null ? '—' : snapshot.semesterGPA.gpa.toFixed(2)),
    [snapshot.semesterGPA.gpa],
  );

  if (!snapshot.semester) {
    return (
      <ClassesScreen
        title="Grades"
        subtitle="Set up a semester to start tracking GPA, weighted grades, and what-if predictions."
      >
        <ClassesEmptyCard
          title="No active semester"
          body="Add a semester from settings to unlock the grade dashboard."
          actionLabel="Open Settings"
          onAction={() => router.push('/(classes)/settings')}
        />
      </ClassesScreen>
    );
  }

  if (snapshot.rows.length === 0) {
    return (
      <ClassesScreen
        title={snapshot.semester.name}
        subtitle="No classes in this semester yet. Add one to start tracking grades."
      >
        <ClassesEmptyCard
          title="No classes yet"
          body="Once you add classes and graded assignments, this dashboard fills in automatically."
          actionLabel="Add a class"
          onAction={() => router.push('/(classes)/class/add')}
        />
      </ClassesScreen>
    );
  }

  return (
    <ClassesScreen
      title="Grades"
      subtitle={`Semester GPA, per-class breakdowns, and what-if predictions for ${snapshot.semester.name}.`}
    >
      <ClassesHero
        badge={snapshot.semester.name}
        title={`Semester GPA: ${gpaText}`}
        body={`${snapshot.semesterGPA.graded_credits} of ${snapshot.semesterGPA.credit_hours} credits graded so far. Cards below break down each class.`}
      />

      <ClassesMetricRow
        items={[
          { label: 'GPA', value: gpaText },
          {
            label: 'Credit hours',
            value: String(snapshot.semesterGPA.credit_hours),
          },
          {
            label: 'Graded credits',
            value: String(snapshot.semesterGPA.graded_credits),
          },
        ]}
      />

      <ClassesSection title="Class grades">
        <View style={{ gap: 12 }}>
          {snapshot.rows.map((row) => (
            <GradeCard
              key={row.cls.id}
              cls={row.cls}
              assignments={row.assignments}
              weights={row.weights}
              grade={row.grade}
              trend={row.trend}
              initialPrediction={row.prediction}
            />
          ))}
        </View>
      </ClassesSection>
    </ClassesScreen>
  );
}
