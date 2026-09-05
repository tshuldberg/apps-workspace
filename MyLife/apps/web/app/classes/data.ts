import {
  calculateClassGrade,
  calculateLatePenalty,
  calculateSemesterGPA,
  calculateTrend,
  detectClassConflicts,
  formatClassesReminderSummary,
  getAssignment,
  getClass,
  getClassesFoundationChecklist,
  getClassesSettings,
  getClassesStarterStats,
  getCourseStats,
  getDependencyChain,
  getGoalProgress,
  getScheduleForWeek,
  isBlocked,
  letterFromPercent,
  listAssignmentsByClass,
  listCertifications,
  listClassesBySemester,
  listExpiring,
  listLearningGoals,
  listOnlineCourses,
  listSemesters,
  listTeachers,
  predictFinalGrade,
  type AssignmentRow,
  type AssignmentStatus,
  type CategoryWeights,
  type CertificationRow,
  type ClassGradeResult,
  type ClassRow,
  type FinalPrediction,
  type LatePenalty,
  type LearningGoalProgress,
  type LearningGoalRow,
  type OnlineCourseRow,
  type OnlineCourseStats,
  type OnlineCourseStatus,
  type ScheduleConflict,
  type ScheduledBlock,
  type SemesterGPAResult,
  type SemesterRow,
  type TeacherRow,
  type TrendResult,
} from '@mylife/classes';
import { getAdapter, ensureModuleMigrations } from '@/lib/db';

export function getClassesDb() {
  const db = getAdapter();
  ensureModuleMigrations('classes');
  return db;
}

export function loadClassesFoundation() {
  const db = getClassesDb();
  return {
    settings: getClassesSettings(db),
    stats: getClassesStarterStats(db),
    checklist: getClassesFoundationChecklist(db),
  };
}

export interface ScheduleViewModel {
  semesters: SemesterRow[];
  teachers: TeacherRow[];
  activeSemesterId: string | null;
  blocks: ScheduledBlock[];
  conflicts: ScheduleConflict[];
}

export function loadScheduleView(): ScheduleViewModel {
  const db = getClassesDb();
  const semesters = listSemesters(db);
  const teachers = listTeachers(db);
  const current = semesters.find((s) => s.is_current === 1) ?? semesters[0] ?? null;
  const activeSemesterId = current?.id ?? null;
  const blocks = activeSemesterId ? getScheduleForWeek(db, activeSemesterId) : [];
  const conflicts = activeSemesterId ? detectClassConflicts(db, activeSemesterId) : [];
  return { semesters, teachers, activeSemesterId, blocks, conflicts };
}

// Office hours widget loader (P5-B). Returns the next 5 upcoming office-hour
// blocks across all teachers attached to the current semester's classes.
import {
  getUpcomingOfficeHours as _getUpcomingOfficeHours,
  type UpcomingOfficeHour,
} from '@mylife/classes';
export type { UpcomingOfficeHour };
export function loadOfficeHoursWidget(): UpcomingOfficeHour[] {
  const db = getClassesDb();
  const semesters = listSemesters(db);
  const current =
    semesters.find((s) => s.is_current === 1) ?? semesters[0] ?? null;
  if (!current) return [];
  const teachers = listTeachers(db);
  const classes = listClassesBySemester(db, current.id);
  return _getUpcomingOfficeHours(teachers, classes, new Date(), 5);
}

export interface GradeRow {
  cls: ClassRow;
  assignments: AssignmentRow[];
  weights: CategoryWeights | null;
  grade: ClassGradeResult;
  prediction: FinalPrediction | null;
  trend: TrendResult;
}

export interface GradesViewModel {
  semester: SemesterRow | null;
  rows: GradeRow[];
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

function buildTrendHistory(assignments: AssignmentRow[]): Array<{ date: string; percent: number }> {
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

export function loadGradesView(): GradesViewModel {
  const db = getClassesDb();
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
  const rows: GradeRow[] = classes.map((cls) => {
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
    const trend = calculateTrend(buildTrendHistory(assignments));
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
}

// --- Lifelong learning (P8-B) ---

const EXPIRING_WINDOW_DAYS = 90;

export interface LifelongHubView {
  active_courses: OnlineCourseRow[];
  expiring_certs: CertificationRow[];
  active_goals: Array<{ goal: LearningGoalRow; progress: LearningGoalProgress }>;
  course_stats: OnlineCourseStats;
  cert_total: number;
  goal_total: number;
}

export function loadLifelongHubView(): LifelongHubView {
  const db = getClassesDb();

  const inProgress = listOnlineCourses(db, { status: 'in_progress' });
  const expiringCerts = listExpiring(db, EXPIRING_WINDOW_DAYS);
  const allGoals = listLearningGoals(db);
  const activeGoalRows = allGoals.filter((g) => g.status === 'active');
  const activeGoals = activeGoalRows
    .slice(0, 3)
    .map((goal) => ({ goal, progress: getGoalProgress(db, goal.id) }));

  const courseStats = getCourseStats(db);
  const certTotal = listCertifications(db).length;

  return {
    active_courses: inProgress.slice(0, 3),
    expiring_certs: expiringCerts.slice(0, 5),
    active_goals: activeGoals,
    course_stats: courseStats,
    cert_total: certTotal,
    goal_total: allGoals.length,
  };
}

export interface CoursesView {
  status: OnlineCourseStatus | 'all';
  rows: OnlineCourseRow[];
  stats: OnlineCourseStats;
}

export function loadCoursesView(filter?: {
  status?: OnlineCourseStatus | 'all';
}): CoursesView {
  const db = getClassesDb();
  const status = filter?.status ?? 'all';
  const rows =
    status === 'all'
      ? listOnlineCourses(db)
      : listOnlineCourses(db, { status });
  const stats = getCourseStats(db);
  return { status, rows, stats };
}

export interface CertificationsView {
  rows: CertificationRow[];
  expiring_soon: CertificationRow[];
}

export function loadCertificationsView(): CertificationsView {
  const db = getClassesDb();
  const rows = listCertifications(db);
  const expiring_soon = listExpiring(db, EXPIRING_WINDOW_DAYS);
  return { rows, expiring_soon };
}

export interface LearningGoalRowView {
  goal: LearningGoalRow;
  progress: LearningGoalProgress;
}

export interface LearningGoalsView {
  rows: LearningGoalRowView[];
}

export function loadLearningGoalsView(): LearningGoalsView {
  const db = getClassesDb();
  const goals = listLearningGoals(db);
  return {
    rows: goals.map((goal) => ({ goal, progress: getGoalProgress(db, goal.id) })),
  };
}

export interface OnlineCourseDetailView {
  course: OnlineCourseRow;
}

export function loadOnlineCourse(id: string): OnlineCourseRow | null {
  const db = getClassesDb();
  const rows = listOnlineCourses(db);
  return rows.find((c) => c.id === id) ?? null;
}

export function loadCertification(id: string): CertificationRow | null {
  const db = getClassesDb();
  const rows = listCertifications(db);
  return rows.find((c) => c.id === id) ?? null;
}

export interface LearningGoalDetailView {
  goal: LearningGoalRow;
  progress: LearningGoalProgress;
  linked_courses: OnlineCourseRow[];
  linked_certs: CertificationRow[];
}

function parseIdArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : [];
  } catch {
    return [];
  }
}

export function loadLearningGoalDetail(
  id: string,
): LearningGoalDetailView | null {
  const db = getClassesDb();
  const goals = listLearningGoals(db);
  const goal = goals.find((g) => g.id === id);
  if (!goal) return null;
  const progress = getGoalProgress(db, id);
  const courseIds = new Set(parseIdArray(goal.course_ids));
  const certIds = new Set(parseIdArray(goal.certification_ids));
  const linked_courses = listOnlineCourses(db).filter((c) => courseIds.has(c.id));
  const linked_certs = listCertifications(db).filter((c) => certIds.has(c.id));
  return { goal, progress, linked_courses, linked_certs };
}

export function loadGoalLinkOptions(): {
  courses: OnlineCourseRow[];
  certs: CertificationRow[];
} {
  const db = getClassesDb();
  return {
    courses: listOnlineCourses(db),
    certs: listCertifications(db),
  };
}

// --- Assignments view (P2-B) ---

export type AssignmentDueRange = 'all' | 'overdue' | 'week' | '7d';

export interface AssignmentRowVM {
  assignment: AssignmentRow;
  cls: ClassRow | null;
  isOverdue: boolean;
}

export interface AssignmentsView {
  assignments: AssignmentRowVM[];
  classes: ClassRow[];
  currentSemester: SemesterRow | null;
  reminderSummary: string;
  filters: {
    status: AssignmentStatus | 'all';
    classId: string | 'all';
    dueRange: AssignmentDueRange;
  };
}

export function loadAssignmentsView(filter?: {
  status?: AssignmentStatus | 'all';
  classId?: string | 'all';
  dueRange?: AssignmentDueRange;
}): AssignmentsView {
  const db = getClassesDb();
  const status = filter?.status ?? 'all';
  const classId = filter?.classId ?? 'all';
  const dueRange = filter?.dueRange ?? 'all';

  const semesters = listSemesters(db);
  const currentSemester =
    semesters.find((s) => s.is_current === 1) ?? semesters[0] ?? null;
  const settings = getClassesSettings(db);
  const reminderSummary = formatClassesReminderSummary(
    settings.assignmentReminderOffsets,
  );

  if (!currentSemester) {
    return {
      assignments: [],
      classes: [],
      currentSemester: null,
      reminderSummary,
      filters: { status, classId, dueRange },
    };
  }

  const classes = listClassesBySemester(db, currentSemester.id);
  const classMap = new Map(classes.map((c) => [c.id, c]));
  const all: AssignmentRow[] = [];
  for (const c of classes) {
    all.push(...listAssignmentsByClass(db, c.id));
  }
  all.sort((a, b) => {
    if (a.due_at === null && b.due_at === null) return 0;
    if (a.due_at === null) return 1;
    if (b.due_at === null) return -1;
    return a.due_at.localeCompare(b.due_at);
  });

  const now = Date.now();
  const weekEnd = now + 7 * 24 * 60 * 60 * 1000;

  const filtered = all.filter((a) => {
    if (status !== 'all' && a.status !== status) return false;
    if (classId !== 'all' && a.class_id !== classId) return false;
    if (dueRange === 'overdue') {
      if (!a.due_at) return false;
      const t = new Date(a.due_at).getTime();
      if (t >= now) return false;
      if (a.status !== 'not_started' && a.status !== 'in_progress') return false;
    } else if (dueRange === 'week' || dueRange === '7d') {
      if (!a.due_at) return false;
      const t = new Date(a.due_at).getTime();
      if (t < now || t > weekEnd) return false;
    }
    return true;
  });

  const assignments: AssignmentRowVM[] = filtered.map((a) => ({
    assignment: a,
    cls: classMap.get(a.class_id) ?? null,
    isOverdue:
      a.due_at !== null &&
      new Date(a.due_at).getTime() < now &&
      (a.status === 'not_started' || a.status === 'in_progress'),
  }));

  return {
    assignments,
    classes,
    currentSemester,
    reminderSummary,
    filters: { status, classId, dueRange },
  };
}

// --- Assignment detail (P2-C) ---

export interface AssignmentDetailView {
  assignment: AssignmentRow;
  cls: ClassRow | null;
  classes: ClassRow[];
  dependencyChain: AssignmentRow[];
  isBlocked: boolean;
  latePenalty: LatePenalty | null;
  classAssignments: AssignmentRow[];
}

export function loadAssignmentDetail(id: string): AssignmentDetailView | null {
  const db = getClassesDb();
  const assignment = getAssignment(db, id);
  if (!assignment) return null;
  const cls = getClass(db, assignment.class_id);
  const classAssignments = listAssignmentsByClass(db, assignment.class_id);
  const dependencyChain = getDependencyChain(assignment.id, classAssignments);
  const blocked = isBlocked(assignment, classAssignments);
  let latePenalty: LatePenalty | null = null;
  if (assignment.due_at && assignment.late_policy) {
    const submittedOrNow = assignment.submitted_at ?? new Date().toISOString();
    latePenalty = calculateLatePenalty(assignment, submittedOrNow);
  }

  // Also load all classes for the current semester so the edit form can
  // re-render the class chip row.
  const semesters = listSemesters(db);
  const currentSemester =
    semesters.find((s) => s.is_current === 1) ?? semesters[0] ?? null;
  const classes = currentSemester
    ? listClassesBySemester(db, currentSemester.id)
    : cls
      ? [cls]
      : [];

  return {
    assignment,
    cls,
    classes,
    dependencyChain,
    isBlocked: blocked,
    latePenalty,
    classAssignments,
  };
}

// --- Study view (P4-B) ---

import {
  getWeeklySummary as _getWeeklySummary,
  listStudySessionsByDateRange as _listStudySessionsByDateRange,
  type ClassesSettings as _ClassesSettings,
  type StudySessionRow as _StudySessionRow,
  type WeeklySummary as _WeeklySummary,
} from '@mylife/classes';

function _mondayOfWeekISO(now: Date = new Date()): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const dow = d.getUTCDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

export interface StudyView {
  classes: ClassRow[];
  weekStart: string;
  weeklySummary: _WeeklySummary;
  recentSessions: _StudySessionRow[];
  settings: _ClassesSettings;
  currentSemester: SemesterRow | null;
}

export function loadStudyView(): StudyView {
  const db = getClassesDb();
  const settings = getClassesSettings(db);
  const semesters = listSemesters(db);
  const currentSemester =
    semesters.find((s) => s.is_current === 1) ?? semesters[0] ?? null;
  const classes = currentSemester
    ? listClassesBySemester(db, currentSemester.id)
    : [];
  const weekStart = _mondayOfWeekISO(new Date());
  const weeklySummary = _getWeeklySummary(db, weekStart);

  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentSessions = _listStudySessionsByDateRange(
    db,
    start.toISOString(),
    end.toISOString(),
  )
    .slice(-25)
    .reverse();

  return {
    classes,
    weekStart,
    weeklySummary,
    recentSessions,
    settings,
    currentSemester,
  };
}

// -- Degree planning (P6-B) --
import {
  computeProgramProgress as _computeProgramProgress,
  computeRequirementProgress as _computeRequirementProgress,
  detectDoubleCount as _detectDoubleCount,
  getProgram as _getProgram,
  getRequirement as _getRequirement,
  listPrograms as _listPrograms,
  listRequirementsByProgram as _listRequirementsByProgram,
  listSatisfactionsByClass as _listSatisfactionsByClass,
  listSatisfactionsByRequirement as _listSatisfactionsByRequirement,
  suggestClassesForRequirement as _suggestClassesForRequirement,
  type DegreeProgramRow,
  type DoubleCountEntry,
  type ProgramProgress,
  type RequirementProgress,
  type RequirementRow,
  type RequirementSatisfactionRow,
} from '@mylife/classes';

export type {
  DegreeProgramRow,
  DoubleCountEntry,
  ProgramProgress,
  RequirementProgress,
  RequirementRow,
  RequirementSatisfactionRow,
};

function _allClasses(db: ReturnType<typeof getClassesDb>): ClassRow[] {
  const semesters = listSemesters(db);
  const out: ClassRow[] = [];
  for (const s of semesters) {
    out.push(...listClassesBySemester(db, s.id));
  }
  return out;
}

export interface DegreeHubView {
  programs: DegreeProgramRow[];
  primary: {
    program: DegreeProgramRow;
    progress: ProgramProgress;
  } | null;
}

export function loadDegreeHubView(): DegreeHubView {
  const db = getClassesDb();
  const programs = _listPrograms(db);
  const primary =
    programs.find((p) => p.is_primary === 1) ?? programs[0] ?? null;
  if (!primary) return { programs, primary: null };
  const requirements = _listRequirementsByProgram(db, primary.id);
  const satisfactions: RequirementSatisfactionRow[] = [];
  for (const r of requirements) {
    satisfactions.push(..._listSatisfactionsByRequirement(db, r.id));
  }
  const classes = _allClasses(db);
  const progress = _computeProgramProgress(
    primary,
    requirements,
    satisfactions,
    classes,
  );
  return { programs, primary: { program: primary, progress } };
}

export interface ProgramDetailView {
  program: DegreeProgramRow;
  requirements: RequirementRow[];
  satisfactions: RequirementSatisfactionRow[];
  classes: ClassRow[];
  progress: ProgramProgress;
  doubleCounts: DoubleCountEntry[];
}

export function loadProgramDetail(id: string): ProgramDetailView | null {
  const db = getClassesDb();
  const program = _getProgram(db, id);
  if (!program) return null;
  const requirements = _listRequirementsByProgram(db, id);
  const satisfactions: RequirementSatisfactionRow[] = [];
  for (const r of requirements) {
    satisfactions.push(..._listSatisfactionsByRequirement(db, r.id));
  }
  const classes = _allClasses(db);
  const progress = _computeProgramProgress(
    program,
    requirements,
    satisfactions,
    classes,
  );
  const doubleCounts = _detectDoubleCount(satisfactions);
  return { program, requirements, satisfactions, classes, progress, doubleCounts };
}

export interface RequirementDetailView {
  requirement: RequirementRow;
  program: DegreeProgramRow;
  satisfactions: RequirementSatisfactionRow[];
  attachedClasses: ClassRow[];
  allClasses: ClassRow[];
  unattachedClasses: ClassRow[];
  suggestedClasses: ClassRow[];
  progress: RequirementProgress;
}

export function loadRequirementDetail(
  id: string,
): RequirementDetailView | null {
  const db = getClassesDb();
  const requirement = _getRequirement(db, id);
  if (!requirement) return null;
  const program = _getProgram(db, requirement.program_id);
  if (!program) return null;
  const satisfactions = _listSatisfactionsByRequirement(db, id);
  const allClasses = _allClasses(db);
  const attachedIds = new Set(satisfactions.map((s) => s.class_id));
  const attachedClasses = allClasses.filter((c) => attachedIds.has(c.id));
  const unattachedClasses = allClasses.filter((c) => !attachedIds.has(c.id));
  const suggestedClasses = _suggestClassesForRequirement(
    requirement,
    unattachedClasses,
  );
  const progress = _computeRequirementProgress(
    requirement,
    satisfactions,
    allClasses,
  );
  return {
    requirement,
    program,
    satisfactions,
    attachedClasses,
    allClasses,
    unattachedClasses,
    suggestedClasses,
    progress,
  };
}

// -- Applications + Tests (P7-B) --
import {
  computeApplicationProgress as _computeApplicationProgress,
  getApplication as _getApplication,
  getBestScoreByName as _getBestScoreByName,
  getDeadlineUrgency as _getDeadlineUrgency,
  getStandardizedTest as _getStandardizedTest,
  getUpcomingTests as _getUpcomingTests,
  groupApplicationsByStatus as _groupApplicationsByStatus,
  listApplications as _listApplications,
  listStandardizedTests as _listStandardizedTests,
  listTasksByApplication as _listTasksByApplication,
  type ApplicationProgress,
  type ApplicationRow,
  type ApplicationStatus,
  type ApplicationTaskRow,
  type DeadlineUrgency,
  type StandardizedTestCategory,
  type StandardizedTestRow,
} from '@mylife/classes';

export type {
  ApplicationProgress,
  ApplicationRow,
  ApplicationStatus,
  ApplicationTaskRow,
  DeadlineUrgency,
  StandardizedTestCategory,
  StandardizedTestRow,
};

export interface ApplicationCardVM {
  application: ApplicationRow;
  tasks: ApplicationTaskRow[];
  progress: ApplicationProgress;
  urgency: DeadlineUrgency;
}

export interface ApplicationsView {
  total: number;
  upcoming: number;
  groups: Record<ApplicationStatus, ApplicationCardVM[]>;
}

const APPLICATION_STATUS_KEYS: ApplicationStatus[] = [
  'considering',
  'in_progress',
  'submitted',
  'accepted',
  'rejected',
  'waitlisted',
  'deferred',
  'withdrawn',
];

export function loadApplicationsView(): ApplicationsView {
  const db = getClassesDb();
  const apps = _listApplications(db);
  const grouped = _groupApplicationsByStatus(apps);
  const groups = {} as Record<ApplicationStatus, ApplicationCardVM[]>;
  for (const status of APPLICATION_STATUS_KEYS) {
    groups[status] = grouped[status].map((application) => {
      const tasks = _listTasksByApplication(db, application.id);
      return {
        application,
        tasks,
        progress: _computeApplicationProgress(application, tasks),
        urgency: _getDeadlineUrgency(application),
      };
    });
  }
  const now = new Date();
  const upcoming = apps.filter((a) => {
    const u = _getDeadlineUrgency(a, now);
    return u === 'critical' || u === 'soon';
  }).length;
  return { total: apps.length, upcoming, groups };
}

export interface ApplicationDetailView {
  application: ApplicationRow;
  tasks: ApplicationTaskRow[];
  progress: ApplicationProgress;
  urgency: DeadlineUrgency;
  requiredTests: StandardizedTestRow[];
}

export function loadApplicationDetail(id: string): ApplicationDetailView | null {
  const db = getClassesDb();
  const application = _getApplication(db, id);
  if (!application) return null;
  const tasks = _listTasksByApplication(db, application.id);
  const progress = _computeApplicationProgress(application, tasks);
  const urgency = _getDeadlineUrgency(application);
  let requiredTests: StandardizedTestRow[] = [];
  if (application.required_test_score_ids) {
    try {
      const ids = JSON.parse(application.required_test_score_ids) as string[];
      requiredTests = ids
        .map((tid) => _getStandardizedTest(db, tid))
        .filter((t): t is StandardizedTestRow => Boolean(t));
    } catch {
      requiredTests = [];
    }
  }
  return { application, tasks, progress, urgency, requiredTests };
}

export interface ApplicationsAddView {
  tests: StandardizedTestRow[];
}

export function loadApplicationsAddView(): ApplicationsAddView {
  const db = getClassesDb();
  return { tests: _listStandardizedTests(db) };
}

export interface TestBestScore {
  name: string;
  score: number;
}

export interface TestsView {
  total: number;
  groups: Record<StandardizedTestCategory, StandardizedTestRow[]>;
  upcoming: StandardizedTestRow[];
  best: TestBestScore[];
}

const TEST_CATEGORY_KEYS: StandardizedTestCategory[] = [
  'undergrad',
  'grad',
  'ap_ib',
  'language',
  'professional',
  'other',
];

export function loadTestsView(): TestsView {
  const db = getClassesDb();
  const tests = _listStandardizedTests(db);
  const groups = {} as Record<StandardizedTestCategory, StandardizedTestRow[]>;
  for (const c of TEST_CATEGORY_KEYS) groups[c] = [];
  for (const t of tests) groups[t.category].push(t);
  const upcoming = _getUpcomingTests(db, 90);
  const seen = new Set<string>();
  const best: TestBestScore[] = [];
  for (const t of tests) {
    if (seen.has(t.name)) continue;
    seen.add(t.name);
    const b = _getBestScoreByName(db, t.name);
    if (b != null) best.push({ name: t.name, score: b });
  }
  return { total: tests.length, groups, upcoming, best };
}

export interface TestDetailView {
  test: StandardizedTestRow;
}

export function loadTestDetail(id: string): TestDetailView | null {
  const db = getClassesDb();
  const test = _getStandardizedTest(db, id);
  if (!test) return null;
  return { test };
}
