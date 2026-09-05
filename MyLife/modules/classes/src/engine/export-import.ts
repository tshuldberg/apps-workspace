/**
 * MyClasses export/import engine (P5_5-C).
 *
 * Pure functions: no DB calls inside. Callers pass already-loaded rows in
 * and read the produced bundle / plan out. The DB-side dispatcher lives in
 * `db/crud/export-import.ts`.
 *
 * Bundle shape is forward-compatible: optional v7 tables are only present
 * when the caller passes them (or current schema is >= 7).
 *
 * CSV escaping: RFC 4180-style. Fields with comma, quote, or newline are
 * wrapped in double quotes with embedded quotes doubled. Line terminator
 * is CRLF. UTF-8 throughout.
 */

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
} from '../models/schemas';
import type { ClassesSettings } from '../types';

export interface ClassesExportBundleData {
  settings: Record<string, unknown>;
  semesters: SemesterRow[];
  teachers: TeacherRow[];
  classes: ClassRow[];
  assignments: AssignmentRow[];
  studySessions: StudySessionRow[];
  onlineCourses: OnlineCourseRow[];
  certifications: CertificationRow[];
  learningGoals: LearningGoalRow[];
  degreePrograms: DegreeProgramRow[];
  requirements: RequirementRow[];
  requirementSatisfactions: RequirementSatisfactionRow[];
  standardizedTests?: StandardizedTestRow[];
  applications?: ApplicationRow[];
  applicationTasks?: ApplicationTaskRow[];
}

export interface ClassesExportBundle {
  schema_version: number;
  exported_at: string;
  app: 'MyClasses';
  data: ClassesExportBundleData;
}

export const CLASSES_BUNDLE_APP_TAG = 'MyClasses' as const;

export interface BuildExportBundleInput {
  schemaVersion: number;
  // Accept either the typed settings object or a raw key/value snapshot
  // (from readSettings on the dispatcher). The bundle stores the raw form.
  settings: ClassesSettings | Record<string, unknown>;
  semesters: SemesterRow[];
  teachers: TeacherRow[];
  classes: ClassRow[];
  assignments: AssignmentRow[];
  studySessions: StudySessionRow[];
  onlineCourses: OnlineCourseRow[];
  certifications: CertificationRow[];
  learningGoals: LearningGoalRow[];
  degreePrograms: DegreeProgramRow[];
  requirements: RequirementRow[];
  requirementSatisfactions: RequirementSatisfactionRow[];
  standardizedTests?: StandardizedTestRow[];
  applications?: ApplicationRow[];
  applicationTasks?: ApplicationTaskRow[];
  now?: Date;
}

export function buildExportBundle(input: BuildExportBundleInput): ClassesExportBundle {
  const now = input.now ?? new Date();
  const data: ClassesExportBundleData = {
    settings: { ...input.settings },
    semesters: input.semesters,
    teachers: input.teachers,
    classes: input.classes,
    assignments: input.assignments,
    studySessions: input.studySessions,
    onlineCourses: input.onlineCourses,
    certifications: input.certifications,
    learningGoals: input.learningGoals,
    degreePrograms: input.degreePrograms,
    requirements: input.requirements,
    requirementSatisfactions: input.requirementSatisfactions,
  };
  if (input.standardizedTests !== undefined) data.standardizedTests = input.standardizedTests;
  if (input.applications !== undefined) data.applications = input.applications;
  if (input.applicationTasks !== undefined) data.applicationTasks = input.applicationTasks;

  return {
    schema_version: input.schemaVersion,
    exported_at: now.toISOString(),
    app: CLASSES_BUNDLE_APP_TAG,
    data,
  };
}

export function bundleToJSON(
  bundle: ClassesExportBundle,
  opts?: { pretty?: boolean },
): string {
  return opts?.pretty ? JSON.stringify(bundle, null, 2) : JSON.stringify(bundle);
}

export type ParseImportResult =
  | { ok: true; bundle: ClassesExportBundle }
  | { ok: false; error: string };

export function parseImportJSON(json: string): ParseImportResult {
  if (typeof json !== 'string' || json.length === 0) {
    return { ok: false, error: 'Empty import payload' };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (error) {
    return {
      ok: false,
      error: `Invalid JSON: ${error instanceof Error ? error.message : 'parse failed'}`,
    };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Bundle root must be an object' };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.app !== CLASSES_BUNDLE_APP_TAG) {
    return { ok: false, error: `Bundle app tag must be "${CLASSES_BUNDLE_APP_TAG}"` };
  }
  if (typeof obj.schema_version !== 'number' || !Number.isFinite(obj.schema_version)) {
    return { ok: false, error: 'schema_version must be a finite number' };
  }
  if (!obj.data || typeof obj.data !== 'object' || Array.isArray(obj.data)) {
    return { ok: false, error: 'data must be an object' };
  }
  if (typeof obj.exported_at !== 'string') {
    return { ok: false, error: 'exported_at must be a string' };
  }
  return { ok: true, bundle: obj as unknown as ClassesExportBundle };
}

// -- Plan -----------------------------------------------------------------

export interface ImportPlanCount {
  table: string;
  count: number;
}

export interface ImportPlanSkip extends ImportPlanCount {
  reason: string;
}

export interface ImportPlan {
  to_create: ImportPlanCount[];
  to_update: ImportPlanCount[];
  to_skip: ImportPlanSkip[];
  warnings: string[];
}

export interface PlanImportCurrent {
  schemaVersion: number;
  semesters: SemesterRow[];
  teachers: TeacherRow[];
  classes: ClassRow[];
  assignments: AssignmentRow[];
  studySessions: StudySessionRow[];
  onlineCourses: OnlineCourseRow[];
  certifications: CertificationRow[];
  learningGoals: LearningGoalRow[];
  degreePrograms: DegreeProgramRow[];
  requirements: RequirementRow[];
  requirementSatisfactions: RequirementSatisfactionRow[];
  standardizedTests?: StandardizedTestRow[];
  applications?: ApplicationRow[];
  applicationTasks?: ApplicationTaskRow[];
}

interface TableSpec<T extends { id: string }> {
  table: string;
  imported: T[] | undefined;
  current: T[] | undefined;
  futureOnly?: boolean; // table only exists at schema >= 7
}

function bucketCreatesUpdates<T extends { id: string }>(
  imported: T[] | undefined,
  current: T[] | undefined,
): { creates: number; updates: number } {
  if (!imported || imported.length === 0) return { creates: 0, updates: 0 };
  const currentIds = new Set((current ?? []).map((row) => row.id));
  let creates = 0;
  let updates = 0;
  for (const row of imported) {
    if (currentIds.has(row.id)) updates += 1;
    else creates += 1;
  }
  return { creates, updates };
}

export function planImport(
  bundle: ClassesExportBundle,
  current: PlanImportCurrent,
): ImportPlan {
  const to_create: ImportPlanCount[] = [];
  const to_update: ImportPlanCount[] = [];
  const to_skip: ImportPlanSkip[] = [];
  const warnings: string[] = [];

  const futureSchema = bundle.schema_version > current.schemaVersion;

  const specs: TableSpec<{ id: string }>[] = [
    { table: 'cs_semesters', imported: bundle.data.semesters, current: current.semesters },
    { table: 'cs_teachers', imported: bundle.data.teachers, current: current.teachers },
    { table: 'cs_classes', imported: bundle.data.classes, current: current.classes },
    { table: 'cs_assignments', imported: bundle.data.assignments, current: current.assignments },
    { table: 'cs_study_sessions', imported: bundle.data.studySessions, current: current.studySessions },
    { table: 'cs_online_courses', imported: bundle.data.onlineCourses, current: current.onlineCourses },
    { table: 'cs_certifications', imported: bundle.data.certifications, current: current.certifications },
    { table: 'cs_learning_goals', imported: bundle.data.learningGoals, current: current.learningGoals },
    { table: 'cs_degree_programs', imported: bundle.data.degreePrograms, current: current.degreePrograms },
    { table: 'cs_requirements', imported: bundle.data.requirements, current: current.requirements },
    { table: 'cs_requirement_satisfactions', imported: bundle.data.requirementSatisfactions, current: current.requirementSatisfactions },
    { table: 'cs_standardized_tests', imported: bundle.data.standardizedTests, current: current.standardizedTests, futureOnly: true },
    { table: 'cs_applications', imported: bundle.data.applications, current: current.applications, futureOnly: true },
    { table: 'cs_application_tasks', imported: bundle.data.applicationTasks, current: current.applicationTasks, futureOnly: true },
  ];

  for (const spec of specs) {
    const importedCount = spec.imported?.length ?? 0;
    if (importedCount === 0) continue;

    if (spec.futureOnly && futureSchema && current.schemaVersion < 7) {
      to_skip.push({
        table: spec.table,
        count: importedCount,
        reason: 'future schema',
      });
      continue;
    }

    const { creates, updates } = bucketCreatesUpdates(spec.imported, spec.current);
    if (creates > 0) to_create.push({ table: spec.table, count: creates });
    if (updates > 0) to_update.push({ table: spec.table, count: updates });
  }

  // Orphan / FK skip detection.
  const importedClassIds = new Set((bundle.data.classes ?? []).map((c) => c.id));
  const currentClassIds = new Set(current.classes.map((c) => c.id));
  const knownClassIds = new Set([...importedClassIds, ...currentClassIds]);

  const orphanAssignments = (bundle.data.assignments ?? []).filter(
    (a) => !knownClassIds.has(a.class_id),
  ).length;
  if (orphanAssignments > 0) {
    to_skip.push({
      table: 'cs_assignments',
      count: orphanAssignments,
      reason: 'class_id missing',
    });
    warnings.push(
      `${orphanAssignments} assignment(s) reference unknown class_id; will be skipped.`,
    );
  }

  const orphanStudySessions = (bundle.data.studySessions ?? []).filter(
    (s) => s.class_id !== null && !knownClassIds.has(s.class_id),
  ).length;
  if (orphanStudySessions > 0) {
    to_skip.push({
      table: 'cs_study_sessions',
      count: orphanStudySessions,
      reason: 'class_id missing',
    });
    warnings.push(
      `${orphanStudySessions} study session(s) reference unknown class_id; will be skipped.`,
    );
  }

  const importedProgramIds = new Set(
    (bundle.data.degreePrograms ?? []).map((p) => p.id),
  );
  const currentProgramIds = new Set(current.degreePrograms.map((p) => p.id));
  const knownProgramIds = new Set([...importedProgramIds, ...currentProgramIds]);
  const orphanRequirements = (bundle.data.requirements ?? []).filter(
    (r) => !knownProgramIds.has(r.program_id),
  ).length;
  if (orphanRequirements > 0) {
    to_skip.push({
      table: 'cs_requirements',
      count: orphanRequirements,
      reason: 'program_id missing',
    });
    warnings.push(
      `${orphanRequirements} requirement(s) reference unknown program_id; will be skipped.`,
    );
  }

  const importedReqIds = new Set((bundle.data.requirements ?? []).map((r) => r.id));
  const currentReqIds = new Set(current.requirements.map((r) => r.id));
  const knownReqIds = new Set([...importedReqIds, ...currentReqIds]);
  const orphanSatisfactions = (bundle.data.requirementSatisfactions ?? []).filter(
    (s) => !knownReqIds.has(s.requirement_id) || !knownClassIds.has(s.class_id),
  ).length;
  if (orphanSatisfactions > 0) {
    to_skip.push({
      table: 'cs_requirement_satisfactions',
      count: orphanSatisfactions,
      reason: 'requirement_id or class_id missing',
    });
    warnings.push(
      `${orphanSatisfactions} satisfaction(s) reference unknown requirement_id or class_id; will be skipped.`,
    );
  }

  if (futureSchema) {
    warnings.push(
      `Bundle schema_version ${bundle.schema_version} is newer than current ${current.schemaVersion}; future-only tables will be skipped.`,
    );
  }

  return { to_create, to_update, to_skip, warnings };
}

// -- CSV ------------------------------------------------------------------

const CRLF = '\r\n';

export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'string' ? value : String(value);
  const needsQuoting = /[",\r\n]/.test(str);
  if (!needsQuoting) return str;
  return `"${str.replace(/"/g, '""')}"`;
}

function joinRow(cells: unknown[]): string {
  return cells.map(csvEscape).join(',');
}

function rowsToCsv(header: string[], body: string[]): string {
  const headerLine = header.map(csvEscape).join(',');
  return [headerLine, ...body].join(CRLF) + CRLF;
}

function parseJsonField<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
}

function formatOfficeHours(raw: string | null): string {
  const blocks = parseJsonField<Array<{ day: string; start_time: string; end_time: string }>>(
    raw,
    [],
  );
  if (!Array.isArray(blocks) || blocks.length === 0) return '';
  return blocks
    .map((b) => `${b.day} ${b.start_time}-${b.end_time}`)
    .join('; ');
}

function formatCategoryWeights(raw: string | null): string {
  const obj = parseJsonField<Record<string, number>>(raw, {});
  if (!obj || typeof obj !== 'object' || Object.keys(obj).length === 0) return '';
  return Object.entries(obj)
    .map(([k, v]) => `${k}=${v}`)
    .join(';');
}

function formatStringArray(raw: string | null): string {
  const arr = parseJsonField<string[]>(raw, []);
  if (!Array.isArray(arr) || arr.length === 0) return '';
  return arr.join(';');
}

export function semestersToCSV(rows: SemesterRow[]): string {
  const header = [
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
  const body = rows.map((r) =>
    joinRow([
      r.id,
      r.name,
      r.start_date ?? '',
      r.end_date ?? '',
      r.institution ?? '',
      r.credit_hours,
      r.gpa ?? '',
      r.is_current === 1 ? 'true' : 'false',
      r.created_at,
    ]),
  );
  return rowsToCsv(header, body);
}

export function classesToCSV(rows: ClassRow[]): string {
  const header = [
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
  const body = rows.map((r) => {
    const dayTimes = parseJsonField<Array<{ day: string; start_time: string; end_time: string }>>(
      r.day_times,
      [],
    );
    const dayTimesStr = Array.isArray(dayTimes)
      ? dayTimes.map((d) => `${d.day} ${d.start_time}-${d.end_time}`).join('; ')
      : '';
    return joinRow([
      r.id,
      r.semester_id,
      r.name,
      r.code ?? '',
      r.section ?? '',
      r.credits,
      dayTimesStr,
      r.room ?? '',
      r.building ?? '',
      r.teacher_id ?? '',
      formatCategoryWeights(r.category_weights),
      r.current_grade ?? '',
      r.target_grade ?? '',
      r.color,
      r.notes_md ?? '',
      r.created_at,
      r.updated_at,
    ]);
  });
  return rowsToCsv(header, body);
}

export function assignmentsToCSV(rows: AssignmentRow[]): string {
  const header = [
    'id',
    'class_id',
    'title',
    'type',
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
    'description_md',
    'submission_notes',
    'depends_on',
    'created_at',
    'updated_at',
  ];
  const body = rows.map((r) =>
    joinRow([
      r.id,
      r.class_id,
      r.title,
      r.type,
      r.due_at ?? '',
      r.submitted_at ?? '',
      r.graded_at ?? '',
      r.status,
      r.priority,
      r.estimated_minutes ?? '',
      r.actual_minutes ?? '',
      r.grade ?? '',
      r.max_grade ?? '',
      r.weight ?? '',
      r.is_recurring === 1 ? 'true' : 'false',
      r.description_md ?? '',
      r.submission_notes ?? '',
      formatStringArray(r.depends_on),
      r.created_at,
      r.updated_at,
    ]),
  );
  return rowsToCsv(header, body);
}

export function studySessionsToCSV(rows: StudySessionRow[]): string {
  const header = [
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
  const body = rows.map((r) =>
    joinRow([
      r.id,
      r.class_id ?? '',
      r.started_at,
      r.duration_minutes,
      r.location ?? '',
      r.productivity_rating ?? '',
      r.focus_notes ?? '',
      formatStringArray(r.companion_ids),
      formatStringArray(r.topics_covered),
      r.timer_type,
      r.pomodoro_count,
      r.created_at,
    ]),
  );
  return rowsToCsv(header, body);
}

export function teachersToCSV(rows: TeacherRow[]): string {
  const header = [
    'id',
    'name',
    'title',
    'department',
    'email',
    'office_location',
    'office_hours',
    'rating',
    'rec_potential',
    'notes_md',
    'created_at',
  ];
  const body = rows.map((r) =>
    joinRow([
      r.id,
      r.name,
      r.title ?? '',
      r.department ?? '',
      r.email ?? '',
      r.office_location ?? '',
      formatOfficeHours(r.office_hours),
      r.rating ?? '',
      r.rec_potential ?? '',
      r.notes_md ?? '',
      r.created_at,
    ]),
  );
  return rowsToCsv(header, body);
}

/**
 * gradesCSV: wide-format ledger. One row per class, one column per assignment
 * title (within that class). Cell value = "grade/max_grade" or empty.
 *
 * Because each class has its own assignment set, columns vary per class. We
 * union all assignment titles across classes and emit empty cells where the
 * class doesn't own that title.
 */
export function gradesCSV(
  classes: ClassRow[],
  assignments: AssignmentRow[],
): string {
  const titlesInOrder: string[] = [];
  const seen = new Set<string>();
  for (const a of assignments) {
    if (!seen.has(a.title)) {
      seen.add(a.title);
      titlesInOrder.push(a.title);
    }
  }
  const header = [
    'class_id',
    'class_name',
    'class_code',
    'credits',
    'current_grade',
    'target_grade',
    ...titlesInOrder,
  ];
  const body = classes.map((cls) => {
    const own = assignments.filter((a) => a.class_id === cls.id);
    const byTitle = new Map<string, AssignmentRow>();
    for (const a of own) byTitle.set(a.title, a);
    const cells: unknown[] = [
      cls.id,
      cls.name,
      cls.code ?? '',
      cls.credits,
      cls.current_grade ?? '',
      cls.target_grade ?? '',
    ];
    for (const title of titlesInOrder) {
      const a = byTitle.get(title);
      if (!a || a.grade === null || a.max_grade === null) {
        cells.push('');
      } else {
        cells.push(`${a.grade}/${a.max_grade}`);
      }
    }
    return joinRow(cells);
  });
  return rowsToCsv(header, body);
}
