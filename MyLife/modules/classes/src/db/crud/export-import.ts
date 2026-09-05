/**
 * MyClasses export/import dispatcher (P5_5-C).
 *
 * Bridges the pure engine in `engine/export-import.ts` to the SQLite
 * adapter. `loadFullExport` reads every table the current schema exposes
 * and packages it into a `ClassesExportBundle`. `applyImport` accepts a
 * bundle and either replaces or merges rows in a single transaction.
 *
 * v7 tables (standardized tests / applications / application tasks) are
 * loaded behind a try/catch so this works even when the v7 migration has
 * not yet run.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type {
  ApplicationRow,
  ApplicationTaskRow,
  AssignmentRow,
  CertificationRow,
  ClassRow,
  DegreeProgramRow,
  LearningGoalRow,
  OnlineCourseRow,
  RequirementRow,
  RequirementSatisfactionRow,
  SemesterRow,
  StandardizedTestRow,
  StudySessionRow,
  TeacherRow,
} from '../../models/schemas';
import {
  buildExportBundle,
  planImport,
  type ClassesExportBundle,
  type ImportPlan,
  type PlanImportCurrent,
} from '../../engine/export-import';
import { CLASSES_MIGRATIONS } from '../schema';
import { DEFAULT_CLASSES_SETTINGS, type ClassesSettings } from '../../types';

/**
 * Read raw key/value pairs out of cs_settings without going through the
 * typed parser. The export bundle stores settings as a key→value record so
 * importers on other devices can choose how to interpret them; we keep this
 * minimal to avoid a circular import with the sibling `../crud.ts` settings
 * module.
 */
function readSettings(db: DatabaseAdapter): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(DEFAULT_CLASSES_SETTINGS as unknown as Record<string, unknown>) };
  const rows = db.query<{ key: string; value: string }>(
    'SELECT key, value FROM cs_settings',
  );
  for (const r of rows) out[r.key] = r.value;
  return out;
}

const CURRENT_SCHEMA_VERSION = CLASSES_MIGRATIONS.reduce(
  (max, migration) => (migration.version > max ? migration.version : max),
  0,
);

function safeQuery<T>(db: DatabaseAdapter, sql: string): T[] {
  try {
    return db.query<T>(sql);
  } catch {
    return [];
  }
}

function loadAll<T extends Record<string, unknown>>(
  db: DatabaseAdapter,
  table: string,
): T[] {
  return db.query<T>(`SELECT * FROM ${table}`);
}

export interface LoadFullExportOptions {
  now?: Date;
}

export function loadFullExport(
  db: DatabaseAdapter,
  opts?: LoadFullExportOptions,
): ClassesExportBundle {
  const settings = readSettings(db);
  const semesters = loadAll<SemesterRow>(db, 'cs_semesters');
  const teachers = loadAll<TeacherRow>(db, 'cs_teachers');
  const classes = loadAll<ClassRow>(db, 'cs_classes');
  const assignments = loadAll<AssignmentRow>(db, 'cs_assignments');
  const studySessions = loadAll<StudySessionRow>(db, 'cs_study_sessions');
  const onlineCourses = loadAll<OnlineCourseRow>(db, 'cs_online_courses');
  const certifications = loadAll<CertificationRow>(db, 'cs_certifications');
  const learningGoals = loadAll<LearningGoalRow>(db, 'cs_learning_goals');
  const degreePrograms = loadAll<DegreeProgramRow>(db, 'cs_degree_programs');
  const requirements = loadAll<RequirementRow>(db, 'cs_requirements');
  const requirementSatisfactions = loadAll<RequirementSatisfactionRow>(
    db,
    'cs_requirement_satisfactions',
  );

  // v7 tables - guarded so this works even before the v7 migration runs.
  const standardizedTests = safeQuery<StandardizedTestRow>(
    db,
    'SELECT * FROM cs_standardized_tests',
  );
  const applications = safeQuery<ApplicationRow>(
    db,
    'SELECT * FROM cs_applications',
  );
  const applicationTasks = safeQuery<ApplicationTaskRow>(
    db,
    'SELECT * FROM cs_application_tasks',
  );

  return buildExportBundle({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings,
    semesters,
    teachers,
    classes,
    assignments,
    studySessions,
    onlineCourses,
    certifications,
    learningGoals,
    degreePrograms,
    requirements,
    requirementSatisfactions,
    standardizedTests,
    applications,
    applicationTasks,
    now: opts?.now,
  });
}

// -- Apply -----------------------------------------------------------------

export type ImportMode = 'replace' | 'merge';

export interface ApplyImportOptions {
  mode: ImportMode;
  dryRun?: boolean;
}

export interface ApplyImportResult {
  applied: ImportPlan;
  errors: string[];
}

const SEMESTER_COLUMNS = [
  'id',
  'name',
  'start_date',
  'end_date',
  'institution',
  'credit_hours',
  'gpa',
  'is_current',
  'created_at',
];

const TEACHER_COLUMNS = [
  'id',
  'name',
  'title',
  'department',
  'email',
  'office_location',
  'office_hours',
  'teaching_style_notes',
  'grading_notes',
  'rec_potential',
  'rating',
  'notes_md',
  'created_at',
];

const CLASS_COLUMNS = [
  'id',
  'semester_id',
  'name',
  'code',
  'section',
  'credits',
  'day_times',
  'room',
  'building',
  'teacher_id',
  'category_weights',
  'current_grade',
  'target_grade',
  'color',
  'notes_md',
  'created_at',
  'updated_at',
];

const ASSIGNMENT_COLUMNS = [
  'id',
  'class_id',
  'title',
  'type',
  'description_md',
  'due_at',
  'submitted_at',
  'graded_at',
  'status',
  'priority',
  'estimated_minutes',
  'actual_minutes',
  'grade',
  'max_grade',
  'weight',
  'is_recurring',
  'recurrence_rule',
  'group_members',
  'submission_notes',
  'late_policy',
  'depends_on',
  'created_at',
  'updated_at',
];

const STUDY_SESSION_COLUMNS = [
  'id',
  'class_id',
  'started_at',
  'duration_minutes',
  'location',
  'productivity_rating',
  'focus_notes',
  'companion_ids',
  'topics_covered',
  'timer_type',
  'pomodoro_count',
  'created_at',
];

const ONLINE_COURSE_COLUMNS = [
  'id',
  'title',
  'provider',
  'url',
  'instructor',
  'category',
  'status',
  'progress_percent',
  'started_at',
  'completed_at',
  'estimated_hours',
  'actual_hours',
  'notes_md',
  'certificate_url',
  'rating',
  'tags',
  'created_at',
  'updated_at',
];

const CERTIFICATION_COLUMNS = [
  'id',
  'name',
  'issuer',
  'issued_at',
  'expires_at',
  'credential_id',
  'credential_url',
  'category',
  'notes_md',
  'renewal_reminder_days',
  'created_at',
  'updated_at',
];

const LEARNING_GOAL_COLUMNS = [
  'id',
  'title',
  'description_md',
  'target_date',
  'status',
  'course_ids',
  'certification_ids',
  'created_at',
  'completed_at',
];

const DEGREE_PROGRAM_COLUMNS = [
  'id',
  'name',
  'institution',
  'degree_type',
  'total_credits_required',
  'gpa_required',
  'catalog_year',
  'start_date',
  'expected_completion',
  'is_primary',
  'notes_md',
  'created_at',
  'updated_at',
];

const REQUIREMENT_COLUMNS = [
  'id',
  'program_id',
  'name',
  'category',
  'credits_required',
  'course_count_required',
  'min_grade',
  'allowed_course_codes',
  'notes_md',
  'sort_order',
  'created_at',
];

const REQUIREMENT_SATISFACTION_COLUMNS = [
  'id',
  'requirement_id',
  'class_id',
  'credits_applied',
  'status',
  'approved_by',
  'created_at',
];

const STANDARDIZED_TEST_COLUMNS = [
  'id',
  'name',
  'category',
  'test_date',
  'registration_deadline',
  'location',
  'score',
  'max_score',
  'percentile',
  'section_scores',
  'status',
  'superscore_eligible',
  'notes_md',
  'created_at',
  'updated_at',
];

const APPLICATION_COLUMNS = [
  'id',
  'name',
  'institution',
  'type',
  'program',
  'deadline',
  'early_deadline',
  'decision_date',
  'status',
  'application_url',
  'portal_url',
  'application_fee',
  'fee_waiver_status',
  'required_test_score_ids',
  'required_essays_count',
  'essays_drafted',
  'essays_finalized',
  'recommenders_required',
  'recommenders_confirmed',
  'transcripts_requested',
  'transcripts_sent',
  'notes_md',
  'created_at',
  'updated_at',
];

const APPLICATION_TASK_COLUMNS = [
  'id',
  'application_id',
  'title',
  'kind',
  'due_at',
  'completed_at',
  'word_target',
  'word_count',
  'status',
  'notes_md',
  'sort_order',
  'created_at',
];

function rowValuesByColumns<T extends Record<string, unknown>>(
  row: T,
  cols: string[],
): unknown[] {
  return cols.map((c) => {
    const v = row[c];
    return v === undefined ? null : v;
  });
}

function placeholders(count: number): string {
  return new Array(count).fill('?').join(', ');
}

function upsertRows<T extends { id: string }>(
  db: DatabaseAdapter,
  table: string,
  cols: string[],
  rows: T[],
  mode: ImportMode,
  errors: string[],
): void {
  if (rows.length === 0) return;
  const colsList = cols.join(', ');
  const placeholderList = placeholders(cols.length);

  if (mode === 'replace') {
    for (const r of rows) {
      try {
        db.execute(
          `INSERT INTO ${table} (${colsList}) VALUES (${placeholderList})`,
          rowValuesByColumns(r as unknown as Record<string, unknown>, cols),
        );
      } catch (error) {
        errors.push(
          `${table} id=${r.id}: ${error instanceof Error ? error.message : 'insert failed'}`,
        );
      }
    }
    return;
  }

  // merge mode: UPSERT via ON CONFLICT so we update in place rather than
  // DELETE+INSERT (which would cascade and wipe child rows of unrelated
  // siblings -- e.g. INSERT OR REPLACE on a semester would cascade-delete
  // every class pointing at that semester, including ones not in the bundle).
  const updateAssignments = cols
    .filter((c) => c !== 'id')
    .map((c) => `${c} = excluded.${c}`)
    .join(', ');
  for (const r of rows) {
    try {
      db.execute(
        `INSERT INTO ${table} (${colsList}) VALUES (${placeholderList})
         ON CONFLICT(id) DO UPDATE SET ${updateAssignments}`,
        rowValuesByColumns(r as unknown as Record<string, unknown>, cols),
      );
    } catch (error) {
      errors.push(
        `${table} id=${r.id}: ${error instanceof Error ? error.message : 'upsert failed'}`,
      );
    }
  }
}

function clearTable(db: DatabaseAdapter, table: string): void {
  db.execute(`DELETE FROM ${table}`);
}

interface ImportTablePlan<T extends { id: string }> {
  table: string;
  cols: string[];
  rows: T[];
  futureOnly?: boolean;
}

function buildCurrentSnapshot(db: DatabaseAdapter): PlanImportCurrent {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    semesters: loadAll<SemesterRow>(db, 'cs_semesters'),
    teachers: loadAll<TeacherRow>(db, 'cs_teachers'),
    classes: loadAll<ClassRow>(db, 'cs_classes'),
    assignments: loadAll<AssignmentRow>(db, 'cs_assignments'),
    studySessions: loadAll<StudySessionRow>(db, 'cs_study_sessions'),
    onlineCourses: loadAll<OnlineCourseRow>(db, 'cs_online_courses'),
    certifications: loadAll<CertificationRow>(db, 'cs_certifications'),
    learningGoals: loadAll<LearningGoalRow>(db, 'cs_learning_goals'),
    degreePrograms: loadAll<DegreeProgramRow>(db, 'cs_degree_programs'),
    requirements: loadAll<RequirementRow>(db, 'cs_requirements'),
    requirementSatisfactions: loadAll<RequirementSatisfactionRow>(
      db,
      'cs_requirement_satisfactions',
    ),
    standardizedTests: safeQuery<StandardizedTestRow>(
      db,
      'SELECT * FROM cs_standardized_tests',
    ),
    applications: safeQuery<ApplicationRow>(db, 'SELECT * FROM cs_applications'),
    applicationTasks: safeQuery<ApplicationTaskRow>(
      db,
      'SELECT * FROM cs_application_tasks',
    ),
  };
}

export function applyImport(
  db: DatabaseAdapter,
  bundle: ClassesExportBundle,
  opts: ApplyImportOptions,
): ApplyImportResult {
  const errors: string[] = [];
  const current = buildCurrentSnapshot(db);
  const plan = planImport(bundle, current);

  if (opts.dryRun) {
    return { applied: plan, errors };
  }

  const skipFuture =
    bundle.schema_version > current.schemaVersion && current.schemaVersion < 7;

  // Order matters for FKs.
  const tablePlans: ImportTablePlan<{ id: string }>[] = [
    { table: 'cs_semesters', cols: SEMESTER_COLUMNS, rows: bundle.data.semesters ?? [] },
    { table: 'cs_teachers', cols: TEACHER_COLUMNS, rows: bundle.data.teachers ?? [] },
    { table: 'cs_classes', cols: CLASS_COLUMNS, rows: bundle.data.classes ?? [] },
    { table: 'cs_assignments', cols: ASSIGNMENT_COLUMNS, rows: bundle.data.assignments ?? [] },
    { table: 'cs_study_sessions', cols: STUDY_SESSION_COLUMNS, rows: bundle.data.studySessions ?? [] },
    { table: 'cs_online_courses', cols: ONLINE_COURSE_COLUMNS, rows: bundle.data.onlineCourses ?? [] },
    { table: 'cs_certifications', cols: CERTIFICATION_COLUMNS, rows: bundle.data.certifications ?? [] },
    { table: 'cs_learning_goals', cols: LEARNING_GOAL_COLUMNS, rows: bundle.data.learningGoals ?? [] },
    { table: 'cs_degree_programs', cols: DEGREE_PROGRAM_COLUMNS, rows: bundle.data.degreePrograms ?? [] },
    { table: 'cs_requirements', cols: REQUIREMENT_COLUMNS, rows: bundle.data.requirements ?? [] },
    { table: 'cs_requirement_satisfactions', cols: REQUIREMENT_SATISFACTION_COLUMNS, rows: bundle.data.requirementSatisfactions ?? [] },
    { table: 'cs_standardized_tests', cols: STANDARDIZED_TEST_COLUMNS, rows: bundle.data.standardizedTests ?? [], futureOnly: true },
    { table: 'cs_applications', cols: APPLICATION_COLUMNS, rows: bundle.data.applications ?? [], futureOnly: true },
    { table: 'cs_application_tasks', cols: APPLICATION_TASK_COLUMNS, rows: bundle.data.applicationTasks ?? [], futureOnly: true },
  ];

  // Filter orphans (matching planImport logic) so inserts don't blow up FKs.
  const importedClassIds = new Set(
    (bundle.data.classes ?? []).map((c) => c.id),
  );
  const currentClassIds = new Set(current.classes.map((c) => c.id));
  const knownClassIds = new Set([...importedClassIds, ...currentClassIds]);

  const importedProgramIds = new Set(
    (bundle.data.degreePrograms ?? []).map((p) => p.id),
  );
  const currentProgramIds = new Set(current.degreePrograms.map((p) => p.id));
  const knownProgramIds = new Set([...importedProgramIds, ...currentProgramIds]);

  const importedReqIds = new Set(
    (bundle.data.requirements ?? []).map((r) => r.id),
  );
  const currentReqIds = new Set(current.requirements.map((r) => r.id));
  const knownReqIds = new Set([...importedReqIds, ...currentReqIds]);

  function filterRows<T extends { id: string }>(
    plan: ImportTablePlan<T>,
  ): ImportTablePlan<T> {
    if (plan.table === 'cs_assignments') {
      const rows = (plan.rows as unknown as AssignmentRow[]).filter((a) =>
        knownClassIds.has(a.class_id),
      );
      return { ...plan, rows: rows as unknown as T[] };
    }
    if (plan.table === 'cs_study_sessions') {
      const rows = (plan.rows as unknown as StudySessionRow[]).filter(
        (s) => s.class_id === null || knownClassIds.has(s.class_id),
      );
      return { ...plan, rows: rows as unknown as T[] };
    }
    if (plan.table === 'cs_requirements') {
      const rows = (plan.rows as unknown as RequirementRow[]).filter((r) =>
        knownProgramIds.has(r.program_id),
      );
      return { ...plan, rows: rows as unknown as T[] };
    }
    if (plan.table === 'cs_requirement_satisfactions') {
      const rows = (plan.rows as unknown as RequirementSatisfactionRow[]).filter(
        (s) => knownReqIds.has(s.requirement_id) && knownClassIds.has(s.class_id),
      );
      return { ...plan, rows: rows as unknown as T[] };
    }
    return plan;
  }

  const filteredPlans = tablePlans.map((p) => filterRows(p));

  // Settings get applied outside the DELETE/INSERT cycle for tables; settings
  // already use upsert semantics. We piggyback into the same transaction.
  const importedSettings = bundle.data.settings ?? {};

  try {
    db.transaction(() => {
      if (opts.mode === 'replace') {
        // Reverse FK order for clears.
        const reverseClearOrder = [...filteredPlans].reverse();
        for (const tp of reverseClearOrder) {
          if (tp.futureOnly && skipFuture) continue;
          if (tp.futureOnly) {
            // Still try to clear, but tolerate missing tables.
            try {
              clearTable(db, tp.table);
            } catch {
              // table doesn't exist; nothing to clear.
            }
            continue;
          }
          clearTable(db, tp.table);
        }
        // Clear settings to honor "replace".
        db.execute(`DELETE FROM cs_settings`);
      }

      for (const tp of filteredPlans) {
        if (tp.futureOnly && skipFuture) continue;
        if (tp.futureOnly) {
          // Wrap in try/catch so missing v7 table doesn't kill the whole import.
          try {
            upsertRows(db, tp.table, tp.cols, tp.rows, opts.mode, errors);
          } catch (error) {
            errors.push(
              `${tp.table}: ${error instanceof Error ? error.message : 'unavailable'}`,
            );
          }
          continue;
        }
        upsertRows(db, tp.table, tp.cols, tp.rows, opts.mode, errors);
      }

      // Settings: always upsert each key.
      for (const [key, value] of Object.entries(importedSettings)) {
        const serialized =
          typeof value === 'string'
            ? value
            : typeof value === 'number' || typeof value === 'boolean'
              ? value === true
                ? '1'
                : value === false
                  ? '0'
                  : String(value)
              : JSON.stringify(value);
        try {
          db.execute(
            `INSERT INTO cs_settings (key, value) VALUES (?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
            [key, serialized],
          );
        } catch (error) {
          errors.push(
            `cs_settings key=${key}: ${error instanceof Error ? error.message : 'upsert failed'}`,
          );
        }
      }

      if (errors.length > 0) {
        // Force rollback by throwing.
        throw new Error('Import errors; rolling back');
      }
    });
  } catch (error) {
    if (errors.length === 0) {
      errors.push(error instanceof Error ? error.message : 'transaction failed');
    }
    return { applied: plan, errors };
  }

  return { applied: plan, errors };
}

// Re-export commonly used engine pieces so callers only need this one module.
export {
  buildExportBundle,
  bundleToJSON,
  parseImportJSON,
  planImport,
  semestersToCSV,
  classesToCSV,
  assignmentsToCSV,
  studySessionsToCSV,
  teachersToCSV,
  gradesCSV,
  type ClassesExportBundle,
  type ImportPlan,
  type PlanImportCurrent,
} from '../../engine/export-import';

export { CURRENT_SCHEMA_VERSION as CLASSES_CURRENT_SCHEMA_VERSION };
