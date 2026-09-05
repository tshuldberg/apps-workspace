'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  AssignmentInputSchema,
  AssignmentUpdateSchema,
  CertificationInputSchema,
  CertificationUpdateSchema,
  IllegalAssignmentTransitionError,
  LearningGoalInputSchema,
  LearningGoalUpdateSchema,
  OnlineCourseInputSchema,
  OnlineCourseUpdateSchema,
  SemesterInputSchema,
  classesToICS,
  classToICS,
  createAssignment as dbCreateAssignment,
  createCertification,
  createClass as dbCreateClass,
  createLearningGoal,
  createOnlineCourse,
  createSemester as dbCreateSemester,
  createTeacher,
  deleteAssignment as dbDeleteAssignment,
  deleteCertification,
  deleteClass as dbDeleteClass,
  deleteLearningGoal,
  deleteOnlineCourse,
  deleteTeacher as dbDeleteTeacher,
  getAssignment,
  getClass,
  getSemester,
  listClassesBySemester,
  markAssignmentSubmitted,
  saveClassesSettings,
  setAssignmentGrade,
  setCurrentSemester,
  updateAssignment as dbUpdateAssignment,
  updateCertification,
  updateClass as dbUpdateClass,
  updateLearningGoal,
  updateOnlineCourse,
  updateTeacher as dbUpdateTeacher,
  type AssignmentInput,
  type AssignmentRow,
  type AssignmentStatus,
  type AssignmentUpdate,
  type CategoryWeights,
  type CertificationInput,
  type CertificationUpdate,
  type ClassInput,
  type Day,
  type DayTime,
  type LearningGoalInput,
  type LearningGoalUpdate,
  type OfficeHours,
  type OnlineCourseInput,
  type OnlineCourseStatus,
  type OnlineCourseUpdate,
  type SemesterInput,
} from '@mylife/classes';
import { getClassesDb } from './data';

const VALID_DAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function readReminderOffsets(formData: FormData): number[] {
  return formData
    .getAll('assignmentReminderOffsets')
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
}

function readDayTimeBlocks(formData: FormData): DayTime[] {
  const days = formData.getAll('block_day').map((v) => String(v));
  const starts = formData.getAll('block_start').map((v) => String(v));
  const ends = formData.getAll('block_end').map((v) => String(v));
  const out: DayTime[] = [];
  const len = Math.min(days.length, starts.length, ends.length);
  for (let i = 0; i < len; i += 1) {
    const day = days[i] as Day;
    if (!VALID_DAYS.includes(day)) continue;
    if (!TIME_RE.test(starts[i]) || !TIME_RE.test(ends[i])) continue;
    if (starts[i] >= ends[i]) continue;
    out.push({ day, start_time: starts[i], end_time: ends[i] });
  }
  return out;
}

function readWeights(formData: FormData): CategoryWeights | null {
  const cats = formData.getAll('weight_category').map((v) => String(v).trim());
  const vals = formData.getAll('weight_value').map((v) => Number(v));
  const out: CategoryWeights = {};
  const len = Math.min(cats.length, vals.length);
  for (let i = 0; i < len; i += 1) {
    if (!cats[i]) continue;
    if (!Number.isFinite(vals[i]) || vals[i] < 0 || vals[i] > 100) continue;
    out[cats[i]] = vals[i];
  }
  return Object.keys(out).length > 0 ? out : null;
}

function readOfficeHours(formData: FormData): OfficeHours | null {
  const days = formData.getAll('oh_day').map((v) => String(v));
  const starts = formData.getAll('oh_start').map((v) => String(v));
  const ends = formData.getAll('oh_end').map((v) => String(v));
  const out: OfficeHours = [];
  const len = Math.min(days.length, starts.length, ends.length);
  for (let i = 0; i < len; i += 1) {
    const day = days[i] as Day;
    if (!VALID_DAYS.includes(day)) continue;
    if (!TIME_RE.test(starts[i]) || !TIME_RE.test(ends[i])) continue;
    if (starts[i] >= ends[i]) continue;
    out.push({ day, start_time: starts[i], end_time: ends[i] });
  }
  return out.length > 0 ? out : null;
}

export async function saveClassesSettingsAction(formData: FormData) {
  saveClassesSettings(getClassesDb(), {
    activeTermLabel: String(formData.get('activeTermLabel') ?? ''),
    campusLabel: String(formData.get('campusLabel') ?? ''),
    weekStartsOn: String(formData.get('weekStartsOn') ?? 'monday') as
      | 'monday'
      | 'sunday',
    scheduleDensity: String(formData.get('scheduleDensity') ?? 'comfortable') as
      | 'compact'
      | 'comfortable',
    gradeScale: String(formData.get('gradeScale') ?? 'percent') as
      | 'percent'
      | 'letter'
      | 'gpa_4',
    defaultStudyMinutes: Number(formData.get('defaultStudyMinutes') ?? 45),
    focusBreakMinutes: Number(formData.get('focusBreakMinutes') ?? 10),
    assignmentView: String(formData.get('assignmentView') ?? 'upcoming') as
      | 'upcoming'
      | 'today'
      | 'class',
    assignmentReminderOffsets: readReminderOffsets(formData),
    showWeekends: formData.get('showWeekends') === 'on',
  });

  revalidatePath('/classes');
  revalidatePath('/classes/assignments');
  revalidatePath('/classes/grades');
  revalidatePath('/classes/study');
  revalidatePath('/classes/settings');
}

export async function updateClassAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('Missing class id');
  const teacherIdRaw = formData.get('teacher_id');
  const teacherId =
    teacherIdRaw === null || teacherIdRaw === ''
      ? null
      : String(teacherIdRaw);

  dbUpdateClass(getClassesDb(), id, {
    name: String(formData.get('name') ?? '').trim(),
    code: String(formData.get('code') ?? '').trim() || null,
    section: String(formData.get('section') ?? '').trim() || null,
    credits: Number(formData.get('credits') ?? 0),
    room: String(formData.get('room') ?? '').trim() || null,
    building: String(formData.get('building') ?? '').trim() || null,
    teacher_id: teacherId,
    color: String(formData.get('color') ?? '#3B82F6'),
    notes_md: String(formData.get('notes_md') ?? '').trim() || null,
    day_times: readDayTimeBlocks(formData),
    category_weights: readWeights(formData),
  });

  revalidatePath('/classes');
  revalidatePath(`/classes/class/${id}`);
  redirect(`/classes/class/${id}`);
}

export async function deleteClassAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('Missing class id');
  dbDeleteClass(getClassesDb(), id);
  revalidatePath('/classes');
  redirect('/classes');
}

export async function createTeacherAction(formData: FormData) {
  const id = `tch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const recPotentialRaw = formData.get('rec_potential');
  const ratingRaw = formData.get('rating');
  const recPotential =
    recPotentialRaw === null || recPotentialRaw === ''
      ? null
      : Math.max(0, Math.min(5, Number(recPotentialRaw)));
  const rating =
    ratingRaw === null || ratingRaw === ''
      ? null
      : Math.max(1, Math.min(5, Number(ratingRaw)));

  createTeacher(getClassesDb(), id, {
    name: String(formData.get('name') ?? '').trim(),
    title: String(formData.get('title') ?? '').trim() || null,
    department: String(formData.get('department') ?? '').trim() || null,
    email: String(formData.get('email') ?? '').trim() || null,
    office_location:
      String(formData.get('office_location') ?? '').trim() || null,
    office_hours: readOfficeHours(formData),
    teaching_style_notes:
      String(formData.get('teaching_style_notes') ?? '').trim() || null,
    grading_notes:
      String(formData.get('grading_notes') ?? '').trim() || null,
    rec_potential: recPotential && recPotential > 0 ? recPotential : null,
    rating: rating && rating > 0 ? rating : null,
    notes_md: String(formData.get('notes_md') ?? '').trim() || null,
  });

  revalidatePath('/classes');
  redirect(`/classes/teacher/${id}`);
}

export async function updateTeacherAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('Missing teacher id');
  const recPotentialRaw = formData.get('rec_potential');
  const ratingRaw = formData.get('rating');
  const recPotential =
    recPotentialRaw === null || recPotentialRaw === ''
      ? null
      : Math.max(0, Math.min(5, Number(recPotentialRaw)));
  const rating =
    ratingRaw === null || ratingRaw === ''
      ? null
      : Math.max(1, Math.min(5, Number(ratingRaw)));

  dbUpdateTeacher(getClassesDb(), id, {
    name: String(formData.get('name') ?? '').trim(),
    title: String(formData.get('title') ?? '').trim() || null,
    department: String(formData.get('department') ?? '').trim() || null,
    email: String(formData.get('email') ?? '').trim() || null,
    office_location:
      String(formData.get('office_location') ?? '').trim() || null,
    office_hours: readOfficeHours(formData),
    teaching_style_notes:
      String(formData.get('teaching_style_notes') ?? '').trim() || null,
    grading_notes:
      String(formData.get('grading_notes') ?? '').trim() || null,
    rec_potential: recPotential && recPotential > 0 ? recPotential : null,
    rating: rating && rating > 0 ? rating : null,
    notes_md: String(formData.get('notes_md') ?? '').trim() || null,
  });
  revalidatePath('/classes');
  revalidatePath(`/classes/teacher/${id}`);
  redirect(`/classes/teacher/${id}`);
}

export async function deleteTeacherAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('Missing teacher id');
  dbDeleteTeacher(getClassesDb(), id);
  revalidatePath('/classes');
  redirect('/classes');
}

export async function exportClassICSAction(
  classId: string,
): Promise<{ filename: string; ics: string } | null> {
  const db = getClassesDb();
  const cls = getClass(db, classId);
  if (!cls) return null;
  const semester = getSemester(db, cls.semester_id);
  if (!semester) return null;
  return {
    filename: `${cls.name.replace(/\s+/g, '-').toLowerCase()}.ics`,
    ics: classToICS(cls, semester),
  };
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseCategoryWeights(raw: string): CategoryWeights | null {
  const result: CategoryWeights = {};
  for (const segment of raw.split(',')) {
    const [keyRaw, weightRaw] = segment.split(':');
    const key = (keyRaw ?? '').trim();
    const weight = Number((weightRaw ?? '').trim());
    if (!key || !Number.isFinite(weight)) continue;
    result[key] = weight;
  }
  return Object.keys(result).length > 0 ? result : null;
}

export async function selectSemesterAction(formData: FormData) {
  const id = String(formData.get('semesterId') ?? '');
  if (!id) return;
  setCurrentSemester(getClassesDb(), id);
  revalidatePath('/classes');
  revalidatePath('/classes/assignments');
  revalidatePath('/classes/grades');
}

export async function selectSemesterByIdAction(id: string): Promise<void> {
  if (!id) return;
  setCurrentSemester(getClassesDb(), id);
  revalidatePath('/classes');
  revalidatePath('/classes/assignments');
  revalidatePath('/classes/grades');
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function readSemesterDate(formData: FormData, key: string): string | null {
  const raw = String(formData.get(key) ?? '').trim();
  return DATE_RE.test(raw) ? raw : null;
}

/**
 * createTermAction: Creates a term (semester) so a class can be added.
 *
 * Two modes:
 *  - Default evergreen term: when `evergreen` is set we create a long-running
 *    "Ongoing lessons" term anchored to today with a far-future end date. This
 *    keeps hobby and adult lessons from being blocked by academic semester
 *    scaffolding, and still carries the start/end dates that ICS export needs
 *    for recurring weekly events.
 *  - Custom term: name plus optional start and end dates.
 *
 * Always marks the new term current so the schedule and Add Class flow target
 * it immediately.
 */
export async function createTermAction(formData: FormData) {
  const evergreen = String(formData.get('evergreen') ?? '') === 'true';

  let input: SemesterInput;
  if (evergreen) {
    const start = new Date();
    const startDate = start.toISOString().slice(0, 10);
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 10);
    const endDate = end.toISOString().slice(0, 10);
    input = SemesterInputSchema.parse({
      name: 'Ongoing lessons',
      start_date: startDate,
      end_date: endDate,
      is_current: true,
    });
  } else {
    const name = String(formData.get('name') ?? '').trim();
    if (!name) throw new Error('Term name required');
    const startDate = readSemesterDate(formData, 'start_date');
    const endDate = readSemesterDate(formData, 'end_date');
    if (startDate && endDate && startDate > endDate) {
      throw new Error('End date must be on or after the start date');
    }
    input = SemesterInputSchema.parse({
      name,
      start_date: startDate,
      end_date: endDate,
      institution: String(formData.get('institution') ?? '').trim() || null,
      is_current: true,
    });
  }

  dbCreateSemester(getClassesDb(), genId('sem'), input);
  revalidatePath('/classes');
  revalidatePath('/classes/assignments');
  revalidatePath('/classes/grades');
  revalidatePath('/classes/study');
  revalidatePath('/classes/settings');
}

export async function createClassFromScheduleAction(formData: FormData) {
  const db = getClassesDb();
  const semesterId = String(formData.get('semesterId') ?? '');
  if (!semesterId) throw new Error('Missing semesterId');

  const name = String(formData.get('name') ?? '').trim();
  if (!name) throw new Error('Class name required');

  const startTime = String(formData.get('startTime') ?? '09:00');
  const endTime = String(formData.get('endTime') ?? '10:15');
  if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime) || startTime >= endTime) {
    throw new Error('Invalid time block');
  }

  const daysRaw = String(formData.get('days') ?? '');
  const days = daysRaw
    .split(',')
    .map((d) => d.trim())
    .filter((d): d is Day => VALID_DAYS.includes(d as Day));

  const day_times: DayTime[] = days.map((day) => ({
    day,
    start_time: startTime,
    end_time: endTime,
  }));

  // Resolve teacher: existing id OR quick-create from search text
  let teacherId = String(formData.get('teacherId') ?? '').trim() || null;
  const teacherSearch = String(formData.get('teacherSearch') ?? '').trim();
  if (!teacherId && teacherSearch) {
    const created = createTeacher(db, genId('tch'), { name: teacherSearch });
    teacherId = created.id;
  }

  const credits = Number(formData.get('credits') ?? 3);
  const targetGradeRaw = String(formData.get('targetGrade') ?? '').trim();
  const targetGrade = targetGradeRaw ? Number(targetGradeRaw) : null;
  const latePolicy = String(formData.get('latePolicy') ?? '').trim();

  const input: ClassInput = {
    semester_id: semesterId,
    name,
    code: String(formData.get('code') ?? '').trim() || null,
    section: String(formData.get('section') ?? '').trim() || null,
    credits: Number.isFinite(credits) ? credits : 3,
    day_times,
    room: String(formData.get('room') ?? '').trim() || null,
    building: String(formData.get('building') ?? '').trim() || null,
    teacher_id: teacherId,
    category_weights: parseCategoryWeights(
      String(formData.get('categoryWeights') ?? ''),
    ),
    target_grade: targetGrade,
    color: String(formData.get('color') ?? '#3B82F6'),
    notes_md: latePolicy ? `Late policy: ${latePolicy}` : null,
  };

  dbCreateClass(db, genId('cls'), input);
  revalidatePath('/classes');
  revalidatePath('/classes/assignments');
}

export async function exportSemesterICSAction(
  semesterId: string,
): Promise<{ filename: string; ics: string } | null> {
  const db = getClassesDb();
  const semester = getSemester(db, semesterId);
  if (!semester) return null;
  const classes = listClassesBySemester(db, semesterId);
  return {
    filename: `${semester.name.replace(/\s+/g, '-').toLowerCase()}.ics`,
    ics: classesToICS(classes, semester),
  };
}

// --- Lifelong learning (P8-B) ---

function emptyToNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function readNullableNumber(v: FormDataEntryValue | null): number | null {
  if (v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function readTags(formData: FormData): string[] | null {
  const raw = String(formData.get('tags') ?? '').trim();
  if (!raw) return null;
  const tags = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return tags.length > 0 ? tags : null;
}

function readIdList(formData: FormData, name: string): string[] | null {
  const all = formData.getAll(name).map((v) => String(v).trim()).filter(Boolean);
  return all.length > 0 ? all : null;
}

const VALID_COURSE_STATUS: OnlineCourseStatus[] = [
  'not_started',
  'in_progress',
  'completed',
  'abandoned',
];

function readCourseStatus(
  v: FormDataEntryValue | null,
): OnlineCourseStatus | undefined {
  if (v === null) return undefined;
  const s = String(v);
  return VALID_COURSE_STATUS.includes(s as OnlineCourseStatus)
    ? (s as OnlineCourseStatus)
    : undefined;
}

export async function createOnlineCourseAction(formData: FormData) {
  const id = genId('crs');
  const input: OnlineCourseInput = OnlineCourseInputSchema.parse({
    title: String(formData.get('title') ?? '').trim(),
    provider: emptyToNull(formData.get('provider')),
    url: emptyToNull(formData.get('url')),
    instructor: emptyToNull(formData.get('instructor')),
    category: emptyToNull(formData.get('category')),
    status: readCourseStatus(formData.get('status')) ?? 'not_started',
    progress_percent: Number(formData.get('progress_percent') ?? 0),
    started_at: emptyToNull(formData.get('started_at')),
    completed_at: emptyToNull(formData.get('completed_at')),
    estimated_hours: readNullableNumber(formData.get('estimated_hours')),
    actual_hours: readNullableNumber(formData.get('actual_hours')),
    notes_md: emptyToNull(formData.get('notes_md')),
    certificate_url: emptyToNull(formData.get('certificate_url')),
    rating: readNullableNumber(formData.get('rating')),
    tags: readTags(formData),
  });
  createOnlineCourse(getClassesDb(), id, input);
  revalidatePath('/classes/lifelong');
  revalidatePath('/classes/lifelong/courses');
  redirect(`/classes/lifelong/courses/${id}`);
}

export async function updateOnlineCourseAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('Missing course id');
  const updates: OnlineCourseUpdate = OnlineCourseUpdateSchema.parse({
    title: String(formData.get('title') ?? '').trim(),
    provider: emptyToNull(formData.get('provider')),
    url: emptyToNull(formData.get('url')),
    instructor: emptyToNull(formData.get('instructor')),
    category: emptyToNull(formData.get('category')),
    status: readCourseStatus(formData.get('status')),
    progress_percent: Number(formData.get('progress_percent') ?? 0),
    started_at: emptyToNull(formData.get('started_at')),
    completed_at: emptyToNull(formData.get('completed_at')),
    estimated_hours: readNullableNumber(formData.get('estimated_hours')),
    actual_hours: readNullableNumber(formData.get('actual_hours')),
    notes_md: emptyToNull(formData.get('notes_md')),
    certificate_url: emptyToNull(formData.get('certificate_url')),
    rating: readNullableNumber(formData.get('rating')),
    tags: readTags(formData),
  });
  updateOnlineCourse(getClassesDb(), id, updates);
  revalidatePath('/classes/lifelong');
  revalidatePath('/classes/lifelong/courses');
  revalidatePath(`/classes/lifelong/courses/${id}`);
  redirect(`/classes/lifelong/courses/${id}`);
}

export async function deleteOnlineCourseAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('Missing course id');
  deleteOnlineCourse(getClassesDb(), id);
  revalidatePath('/classes/lifelong');
  revalidatePath('/classes/lifelong/courses');
  redirect('/classes/lifelong/courses');
}

export async function createCertificationAction(formData: FormData) {
  const id = genId('cert');
  const input: CertificationInput = CertificationInputSchema.parse({
    name: String(formData.get('name') ?? '').trim(),
    issuer: emptyToNull(formData.get('issuer')),
    issued_at: emptyToNull(formData.get('issued_at')),
    expires_at: emptyToNull(formData.get('expires_at')),
    credential_id: emptyToNull(formData.get('credential_id')),
    credential_url: emptyToNull(formData.get('credential_url')),
    category: emptyToNull(formData.get('category')),
    notes_md: emptyToNull(formData.get('notes_md')),
    renewal_reminder_days: readNullableNumber(
      formData.get('renewal_reminder_days'),
    ),
  });
  createCertification(getClassesDb(), id, input);
  revalidatePath('/classes/lifelong');
  revalidatePath('/classes/lifelong/certifications');
  redirect(`/classes/lifelong/certifications/${id}`);
}

export async function updateCertificationAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('Missing certification id');
  const updates: CertificationUpdate = CertificationUpdateSchema.parse({
    name: String(formData.get('name') ?? '').trim(),
    issuer: emptyToNull(formData.get('issuer')),
    issued_at: emptyToNull(formData.get('issued_at')),
    expires_at: emptyToNull(formData.get('expires_at')),
    credential_id: emptyToNull(formData.get('credential_id')),
    credential_url: emptyToNull(formData.get('credential_url')),
    category: emptyToNull(formData.get('category')),
    notes_md: emptyToNull(formData.get('notes_md')),
    renewal_reminder_days: readNullableNumber(
      formData.get('renewal_reminder_days'),
    ),
  });
  updateCertification(getClassesDb(), id, updates);
  revalidatePath('/classes/lifelong');
  revalidatePath('/classes/lifelong/certifications');
  revalidatePath(`/classes/lifelong/certifications/${id}`);
  redirect(`/classes/lifelong/certifications/${id}`);
}

export async function deleteCertificationAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('Missing certification id');
  deleteCertification(getClassesDb(), id);
  revalidatePath('/classes/lifelong');
  revalidatePath('/classes/lifelong/certifications');
  redirect('/classes/lifelong/certifications');
}

const VALID_GOAL_STATUS = ['active', 'completed', 'paused', 'abandoned'];

export async function createLearningGoalAction(formData: FormData) {
  const id = genId('goal');
  const statusRaw = String(formData.get('status') ?? 'active');
  const input: LearningGoalInput = LearningGoalInputSchema.parse({
    title: String(formData.get('title') ?? '').trim(),
    description_md: emptyToNull(formData.get('description_md')),
    target_date: emptyToNull(formData.get('target_date')),
    status: VALID_GOAL_STATUS.includes(statusRaw)
      ? (statusRaw as LearningGoalInput['status'])
      : 'active',
    course_ids: readIdList(formData, 'course_ids'),
    certification_ids: readIdList(formData, 'certification_ids'),
    completed_at: emptyToNull(formData.get('completed_at')),
  });
  createLearningGoal(getClassesDb(), id, input);
  revalidatePath('/classes/lifelong');
  revalidatePath('/classes/lifelong/goals');
  redirect(`/classes/lifelong/goals/${id}`);
}

export async function updateLearningGoalAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('Missing goal id');
  const statusRaw = String(formData.get('status') ?? '');
  const updates: LearningGoalUpdate = LearningGoalUpdateSchema.parse({
    title: String(formData.get('title') ?? '').trim(),
    description_md: emptyToNull(formData.get('description_md')),
    target_date: emptyToNull(formData.get('target_date')),
    status: VALID_GOAL_STATUS.includes(statusRaw)
      ? (statusRaw as LearningGoalUpdate['status'])
      : undefined,
    course_ids: readIdList(formData, 'course_ids'),
    certification_ids: readIdList(formData, 'certification_ids'),
    completed_at: emptyToNull(formData.get('completed_at')),
  });
  updateLearningGoal(getClassesDb(), id, updates);
  revalidatePath('/classes/lifelong');
  revalidatePath('/classes/lifelong/goals');
  revalidatePath(`/classes/lifelong/goals/${id}`);
  redirect(`/classes/lifelong/goals/${id}`);
}

export async function deleteLearningGoalAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('Missing goal id');
  deleteLearningGoal(getClassesDb(), id);
  revalidatePath('/classes/lifelong');
  revalidatePath('/classes/lifelong/goals');
  redirect('/classes/lifelong/goals');
}

// --- Assignments (P2-B) ---

export type AssignmentActionResult =
  | { ok: true; assignment?: AssignmentRow }
  | { ok: false; error: string; code?: 'illegal_transition' | 'validation' | 'not_found' };

export async function createAssignmentAction(
  input: AssignmentInput,
): Promise<AssignmentActionResult> {
  const parsed = AssignmentInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: 'validation',
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }
  const id = `asn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    const row = dbCreateAssignment(getClassesDb(), id, parsed.data);
    revalidatePath('/classes/assignments');
    revalidatePath('/classes/grades');
    return { ok: true, assignment: row };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function markAssignmentSubmittedAction(
  id: string,
  submittedAt?: string,
): Promise<AssignmentActionResult> {
  if (!id) return { ok: false, error: 'Missing assignment id', code: 'not_found' };
  try {
    markAssignmentSubmitted(getClassesDb(), id, submittedAt);
    revalidatePath('/classes/assignments');
    revalidatePath('/classes/grades');
    return { ok: true };
  } catch (err) {
    if (err instanceof IllegalAssignmentTransitionError) {
      return { ok: false, code: 'illegal_transition', error: err.message };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function setAssignmentGradeAction(
  id: string,
  grade: number,
  maxGrade?: number,
): Promise<AssignmentActionResult> {
  if (!id) return { ok: false, error: 'Missing assignment id', code: 'not_found' };
  if (!Number.isFinite(grade)) {
    return { ok: false, error: 'Grade must be numeric', code: 'validation' };
  }
  try {
    setAssignmentGrade(getClassesDb(), id, grade, maxGrade);
    revalidatePath('/classes/assignments');
    revalidatePath('/classes/grades');
    return { ok: true };
  } catch (err) {
    if (err instanceof IllegalAssignmentTransitionError) {
      return { ok: false, code: 'illegal_transition', error: err.message };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function updateAssignmentStatusAction(
  id: string,
  status: AssignmentStatus,
): Promise<AssignmentActionResult> {
  if (!id) return { ok: false, error: 'Missing assignment id', code: 'not_found' };
  const updates: AssignmentUpdate = { status };
  const parsed = AssignmentUpdateSchema.safeParse(updates);
  if (!parsed.success) {
    return {
      ok: false,
      code: 'validation',
      error: parsed.error.issues[0]?.message ?? 'Invalid status',
    };
  }
  try {
    dbUpdateAssignment(getClassesDb(), id, parsed.data);
    revalidatePath('/classes/assignments');
    revalidatePath('/classes/grades');
    return { ok: true };
  } catch (err) {
    if (err instanceof IllegalAssignmentTransitionError) {
      return { ok: false, code: 'illegal_transition', error: err.message };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// --- Assignment detail (P2-C) ---

export async function updateAssignmentAction(
  id: string,
  partial: AssignmentUpdate,
): Promise<AssignmentActionResult> {
  if (!id) return { ok: false, error: 'Missing assignment id', code: 'not_found' };
  const parsed = AssignmentUpdateSchema.safeParse(partial);
  if (!parsed.success) {
    return {
      ok: false,
      code: 'validation',
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }
  try {
    dbUpdateAssignment(getClassesDb(), id, parsed.data);
    const row = getAssignment(getClassesDb(), id);
    revalidatePath('/classes/assignments');
    revalidatePath(`/classes/assignments/${id}`);
    revalidatePath('/classes/grades');
    return { ok: true, assignment: row ?? undefined };
  } catch (err) {
    if (err instanceof IllegalAssignmentTransitionError) {
      return { ok: false, code: 'illegal_transition', error: err.message };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteAssignmentAction(
  id: string,
): Promise<AssignmentActionResult> {
  if (!id) return { ok: false, error: 'Missing assignment id', code: 'not_found' };
  try {
    dbDeleteAssignment(getClassesDb(), id);
    revalidatePath('/classes/assignments');
    revalidatePath('/classes/grades');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// --- Study sessions (P4-B) ---

import {
  StudySessionInputSchema,
  createStudySession as _createStudySession,
  type StudySessionInput,
} from '@mylife/classes';

export type StudySessionActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function logStudySessionAction(
  input: StudySessionInput,
): Promise<StudySessionActionResult> {
  const parsed = StudySessionInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid study session input',
    };
  }
  try {
    const id = `ses-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    _createStudySession(getClassesDb(), id, parsed.data);
    revalidatePath('/classes/study');
    return { ok: true, id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// -- Degree planning (P6-B) --
import {
  DegreeProgramInputSchema,
  DegreeProgramUpdateSchema,
  RequirementInputSchema,
  RequirementSatisfactionInputSchema,
  RequirementSatisfactionUpdateSchema,
  RequirementUpdateSchema,
  createDegreeProgram as _createDegreeProgram,
  createRequirement as _createRequirement,
  createRequirementSatisfaction as _createRequirementSatisfaction,
  deleteDegreeProgram as _deleteDegreeProgram,
  deleteRequirement as _deleteRequirement,
  deleteRequirementSatisfaction as _deleteRequirementSatisfaction,
  getRequirement as _getRequirementForAction,
  listRequirementsByProgram as _listRequirementsByProgramForAction,
  setPrimaryProgram as _setPrimaryProgram,
  updateDegreeProgram as _updateDegreeProgram,
  updateRequirement as _updateRequirement,
  updateRequirementSatisfaction as _updateRequirementSatisfaction,
} from '@mylife/classes';

function _readBoolean(v: FormDataEntryValue | null): boolean {
  return v === 'true' || v === '1' || v === 'on';
}

function _readCsvCodes(v: FormDataEntryValue | null): string[] | null {
  const raw = String(v ?? '').trim();
  if (!raw) return null;
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : null;
}

export async function createDegreeProgramAction(formData: FormData) {
  const id = genId('deg');
  const input = DegreeProgramInputSchema.parse({
    name: String(formData.get('name') ?? '').trim(),
    institution: emptyToNull(formData.get('institution')),
    degree_type: emptyToNull(formData.get('degree_type')),
    total_credits_required: Number(formData.get('total_credits_required') ?? 0),
    gpa_required: readNullableNumber(formData.get('gpa_required')),
    catalog_year: emptyToNull(formData.get('catalog_year')),
    start_date: emptyToNull(formData.get('start_date')),
    expected_completion: emptyToNull(formData.get('expected_completion')),
    is_primary: _readBoolean(formData.get('is_primary')),
    notes_md: emptyToNull(formData.get('notes_md')),
  });
  _createDegreeProgram(getClassesDb(), id, input);
  revalidatePath('/classes/degree');
  redirect(`/classes/degree/program/${id}`);
}

export async function updateDegreeProgramAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('Missing program id');
  const updates = DegreeProgramUpdateSchema.parse({
    name: String(formData.get('name') ?? '').trim(),
    institution: emptyToNull(formData.get('institution')),
    degree_type: emptyToNull(formData.get('degree_type')),
    total_credits_required: Number(formData.get('total_credits_required') ?? 0),
    gpa_required: readNullableNumber(formData.get('gpa_required')),
    catalog_year: emptyToNull(formData.get('catalog_year')),
    start_date: emptyToNull(formData.get('start_date')),
    expected_completion: emptyToNull(formData.get('expected_completion')),
    is_primary: _readBoolean(formData.get('is_primary')),
    notes_md: emptyToNull(formData.get('notes_md')),
  });
  _updateDegreeProgram(getClassesDb(), id, updates);
  revalidatePath('/classes/degree');
  revalidatePath(`/classes/degree/program/${id}`);
  redirect(`/classes/degree/program/${id}`);
}

export async function deleteDegreeProgramAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('Missing program id');
  _deleteDegreeProgram(getClassesDb(), id);
  revalidatePath('/classes/degree');
  redirect('/classes/degree');
}

export async function setPrimaryProgramAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('Missing program id');
  _setPrimaryProgram(getClassesDb(), id);
  revalidatePath('/classes/degree');
  revalidatePath(`/classes/degree/program/${id}`);
  redirect(`/classes/degree/program/${id}`);
}

export async function createRequirementAction(formData: FormData) {
  const id = genId('req');
  const programId = String(formData.get('program_id') ?? '');
  if (!programId) throw new Error('Missing program_id');
  const existing = _listRequirementsByProgramForAction(
    getClassesDb(),
    programId,
  );
  const input = RequirementInputSchema.parse({
    program_id: programId,
    name: String(formData.get('name') ?? '').trim(),
    category: emptyToNull(formData.get('category')),
    credits_required: Number(formData.get('credits_required') ?? 0),
    course_count_required: Number(formData.get('course_count_required') ?? 0),
    min_grade: emptyToNull(formData.get('min_grade')),
    allowed_course_codes: _readCsvCodes(formData.get('allowed_course_codes')),
    notes_md: emptyToNull(formData.get('notes_md')),
    sort_order: existing.length,
  });
  _createRequirement(getClassesDb(), id, input);
  revalidatePath(`/classes/degree/program/${programId}`);
  redirect(`/classes/degree/requirement/${id}`);
}

export async function updateRequirementAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('Missing requirement id');
  const updates = RequirementUpdateSchema.parse({
    name: String(formData.get('name') ?? '').trim(),
    category: emptyToNull(formData.get('category')),
    credits_required: Number(formData.get('credits_required') ?? 0),
    course_count_required: Number(formData.get('course_count_required') ?? 0),
    min_grade: emptyToNull(formData.get('min_grade')),
    allowed_course_codes: _readCsvCodes(formData.get('allowed_course_codes')),
    notes_md: emptyToNull(formData.get('notes_md')),
  });
  const req = _getRequirementForAction(getClassesDb(), id);
  _updateRequirement(getClassesDb(), id, updates);
  revalidatePath(`/classes/degree/requirement/${id}`);
  if (req) revalidatePath(`/classes/degree/program/${req.program_id}`);
  redirect(`/classes/degree/requirement/${id}`);
}

export async function deleteRequirementAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('Missing requirement id');
  const req = _getRequirementForAction(getClassesDb(), id);
  const programId = req?.program_id ?? null;
  _deleteRequirement(getClassesDb(), id);
  if (programId) {
    revalidatePath(`/classes/degree/program/${programId}`);
    redirect(`/classes/degree/program/${programId}`);
  } else {
    revalidatePath('/classes/degree');
    redirect('/classes/degree');
  }
}

export async function createSatisfactionAction(formData: FormData) {
  const id = genId('sat');
  const input = RequirementSatisfactionInputSchema.parse({
    requirement_id: String(formData.get('requirement_id') ?? ''),
    class_id: String(formData.get('class_id') ?? ''),
    credits_applied: Number(formData.get('credits_applied') ?? 0),
    status: String(formData.get('status') ?? 'planned'),
    approved_by: emptyToNull(formData.get('approved_by')),
  });
  _createRequirementSatisfaction(getClassesDb(), id, input);
  revalidatePath(`/classes/degree/requirement/${input.requirement_id}`);
  redirect(`/classes/degree/requirement/${input.requirement_id}`);
}

export async function updateSatisfactionAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('Missing satisfaction id');
  const reqId = String(formData.get('requirement_id') ?? '');
  const updates = RequirementSatisfactionUpdateSchema.parse({
    credits_applied: Number(formData.get('credits_applied') ?? 0),
    status: String(formData.get('status') ?? 'planned'),
    approved_by: emptyToNull(formData.get('approved_by')),
  });
  _updateRequirementSatisfaction(getClassesDb(), id, updates);
  if (reqId) revalidatePath(`/classes/degree/requirement/${reqId}`);
  redirect(reqId ? `/classes/degree/requirement/${reqId}` : '/classes/degree');
}

export async function deleteSatisfactionAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('Missing satisfaction id');
  const reqId = String(formData.get('requirement_id') ?? '');
  _deleteRequirementSatisfaction(getClassesDb(), id);
  if (reqId) revalidatePath(`/classes/degree/requirement/${reqId}`);
  redirect(reqId ? `/classes/degree/requirement/${reqId}` : '/classes/degree');
}

// --- Applications + Tests (P7-B) ---
import {
  createApplication as _createApplication,
  createApplicationTask as _createApplicationTask,
  createStandardizedTest as _createStandardizedTest,
  deleteApplication as _deleteApplication,
  deleteApplicationTask as _deleteApplicationTask,
  deleteStandardizedTest as _deleteStandardizedTest,
  markTaskComplete as _markTaskComplete,
  updateApplication as _updateApplication,
  updateApplicationTask as _updateApplicationTask,
  updateStandardizedTest as _updateStandardizedTest,
  type ApplicationStatus as _ApplicationStatus,
  type ApplicationTaskKind as _ApplicationTaskKind,
  type ApplicationTaskStatus as _ApplicationTaskStatus,
  type ApplicationType as _ApplicationType,
  type StandardizedTestCategory as _StdTestCategory,
  type StandardizedTestStatus as _StdTestStatus,
} from '@mylife/classes';

const _APP_TYPES: _ApplicationType[] = [
  'undergrad',
  'grad',
  'scholarship',
  'fellowship',
  'internship',
  'job',
  'other',
];
const _APP_STATUSES: _ApplicationStatus[] = [
  'considering',
  'in_progress',
  'submitted',
  'accepted',
  'rejected',
  'waitlisted',
  'deferred',
  'withdrawn',
];
const _APP_TASK_KINDS: _ApplicationTaskKind[] = [
  'essay',
  'recommendation',
  'transcript',
  'portal_step',
  'fee',
  'supplemental',
  'other',
];
const _APP_TASK_STATUSES: _ApplicationTaskStatus[] = [
  'not_started',
  'in_progress',
  'done',
  'skipped',
];
const _TEST_CATEGORIES: _StdTestCategory[] = [
  'undergrad',
  'grad',
  'ap_ib',
  'language',
  'professional',
  'other',
];
const _TEST_STATUSES: _StdTestStatus[] = [
  'planned',
  'registered',
  'completed',
  'cancelled',
];

function _readEnum<T extends string>(
  raw: FormDataEntryValue | null,
  allowed: readonly T[],
  fallback: T,
): T {
  if (raw === null) return fallback;
  const s = String(raw);
  return (allowed as readonly string[]).includes(s) ? (s as T) : fallback;
}

function _readNonNegInt(raw: FormDataEntryValue | null, fallback = 0): number {
  if (raw === null) return fallback;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function _readBool(formData: FormData, key: string): boolean {
  const v = formData.get(key);
  if (v === null) return false;
  const s = String(v).toLowerCase();
  return s === 'on' || s === 'true' || s === '1' || s === 'yes';
}

function _readTestScoreIds(formData: FormData): string[] | null {
  const ids = formData.getAll('required_test_score_ids').map((v) => String(v).trim()).filter(Boolean);
  return ids.length > 0 ? ids : null;
}

export async function createApplicationAction(formData: FormData) {
  const id = genId('app');
  _createApplication(getClassesDb(), id, {
    name: String(formData.get('name') ?? '').trim(),
    institution: emptyToNull(formData.get('institution')),
    program: emptyToNull(formData.get('program')),
    type: _readEnum(formData.get('type'), _APP_TYPES, 'undergrad'),
    status: _readEnum(formData.get('status'), _APP_STATUSES, 'considering'),
    deadline: emptyToNull(formData.get('deadline')),
    early_deadline: emptyToNull(formData.get('early_deadline')),
    decision_date: emptyToNull(formData.get('decision_date')),
    application_url: emptyToNull(formData.get('application_url')),
    portal_url: emptyToNull(formData.get('portal_url')),
    application_fee: readNullableNumber(formData.get('application_fee')),
    fee_waiver_status: emptyToNull(formData.get('fee_waiver_status')),
    required_test_score_ids: _readTestScoreIds(formData),
    required_essays_count: _readNonNegInt(formData.get('required_essays_count')),
    essays_drafted: _readNonNegInt(formData.get('essays_drafted')),
    essays_finalized: _readNonNegInt(formData.get('essays_finalized')),
    recommenders_required: _readNonNegInt(formData.get('recommenders_required')),
    recommenders_confirmed: _readNonNegInt(formData.get('recommenders_confirmed')),
    transcripts_requested: _readBool(formData, 'transcripts_requested'),
    transcripts_sent: _readBool(formData, 'transcripts_sent'),
    notes_md: emptyToNull(formData.get('notes_md')),
  });
  revalidatePath('/classes/applications');
  redirect(`/classes/applications/${id}`);
}

export async function updateApplicationAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('Missing application id');
  _updateApplication(getClassesDb(), id, {
    name: String(formData.get('name') ?? '').trim(),
    institution: emptyToNull(formData.get('institution')),
    program: emptyToNull(formData.get('program')),
    type: _readEnum(formData.get('type'), _APP_TYPES, 'undergrad'),
    status: _readEnum(formData.get('status'), _APP_STATUSES, 'considering'),
    deadline: emptyToNull(formData.get('deadline')),
    early_deadline: emptyToNull(formData.get('early_deadline')),
    decision_date: emptyToNull(formData.get('decision_date')),
    application_url: emptyToNull(formData.get('application_url')),
    portal_url: emptyToNull(formData.get('portal_url')),
    application_fee: readNullableNumber(formData.get('application_fee')),
    fee_waiver_status: emptyToNull(formData.get('fee_waiver_status')),
    required_test_score_ids: _readTestScoreIds(formData),
    required_essays_count: _readNonNegInt(formData.get('required_essays_count')),
    essays_drafted: _readNonNegInt(formData.get('essays_drafted')),
    essays_finalized: _readNonNegInt(formData.get('essays_finalized')),
    recommenders_required: _readNonNegInt(formData.get('recommenders_required')),
    recommenders_confirmed: _readNonNegInt(formData.get('recommenders_confirmed')),
    transcripts_requested: _readBool(formData, 'transcripts_requested'),
    transcripts_sent: _readBool(formData, 'transcripts_sent'),
    notes_md: emptyToNull(formData.get('notes_md')),
  });
  revalidatePath('/classes/applications');
  revalidatePath(`/classes/applications/${id}`);
  redirect(`/classes/applications/${id}`);
}

export async function deleteApplicationAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('Missing application id');
  _deleteApplication(getClassesDb(), id);
  revalidatePath('/classes/applications');
  redirect('/classes/applications');
}

export async function createApplicationTaskAction(formData: FormData) {
  const applicationId = String(formData.get('application_id') ?? '');
  if (!applicationId) throw new Error('Missing application id');
  _createApplicationTask(getClassesDb(), genId('apt'), {
    application_id: applicationId,
    title: String(formData.get('title') ?? '').trim(),
    kind: _readEnum(formData.get('kind'), _APP_TASK_KINDS, 'other'),
    due_at: emptyToNull(formData.get('due_at')),
    word_target: readNullableNumber(formData.get('word_target')),
    word_count: readNullableNumber(formData.get('word_count')),
    status: _readEnum(formData.get('status'), _APP_TASK_STATUSES, 'not_started'),
    notes_md: emptyToNull(formData.get('notes_md')),
    sort_order: _readNonNegInt(formData.get('sort_order')),
  });
  revalidatePath(`/classes/applications/${applicationId}`);
  redirect(`/classes/applications/${applicationId}`);
}

export async function updateApplicationTaskAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const applicationId = String(formData.get('application_id') ?? '');
  if (!id) throw new Error('Missing task id');
  _updateApplicationTask(getClassesDb(), id, {
    title: String(formData.get('title') ?? '').trim(),
    kind: _readEnum(formData.get('kind'), _APP_TASK_KINDS, 'other'),
    due_at: emptyToNull(formData.get('due_at')),
    word_target: readNullableNumber(formData.get('word_target')),
    word_count: readNullableNumber(formData.get('word_count')),
    status: _readEnum(formData.get('status'), _APP_TASK_STATUSES, 'not_started'),
    notes_md: emptyToNull(formData.get('notes_md')),
  });
  if (applicationId) revalidatePath(`/classes/applications/${applicationId}`);
  if (applicationId) redirect(`/classes/applications/${applicationId}`);
}

export async function deleteApplicationTaskAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const applicationId = String(formData.get('application_id') ?? '');
  if (!id) throw new Error('Missing task id');
  _deleteApplicationTask(getClassesDb(), id);
  if (applicationId) revalidatePath(`/classes/applications/${applicationId}`);
  if (applicationId) redirect(`/classes/applications/${applicationId}`);
}

export async function markTaskCompleteAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const applicationId = String(formData.get('application_id') ?? '');
  if (!id) throw new Error('Missing task id');
  _markTaskComplete(getClassesDb(), id);
  if (applicationId) revalidatePath(`/classes/applications/${applicationId}`);
  if (applicationId) redirect(`/classes/applications/${applicationId}`);
}

export async function createStandardizedTestAction(formData: FormData) {
  const id = genId('tst');
  _createStandardizedTest(getClassesDb(), id, {
    name: String(formData.get('name') ?? '').trim(),
    category: _readEnum(formData.get('category'), _TEST_CATEGORIES, 'undergrad'),
    status: _readEnum(formData.get('status'), _TEST_STATUSES, 'planned'),
    test_date: emptyToNull(formData.get('test_date')),
    registration_deadline: emptyToNull(formData.get('registration_deadline')),
    location: emptyToNull(formData.get('location')),
    score: readNullableNumber(formData.get('score')),
    max_score: readNullableNumber(formData.get('max_score')),
    percentile: readNullableNumber(formData.get('percentile')),
    superscore_eligible: _readBool(formData, 'superscore_eligible'),
    notes_md: emptyToNull(formData.get('notes_md')),
  });
  revalidatePath('/classes/tests');
  redirect(`/classes/tests/${id}`);
}

export async function updateStandardizedTestAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('Missing test id');
  _updateStandardizedTest(getClassesDb(), id, {
    name: String(formData.get('name') ?? '').trim(),
    category: _readEnum(formData.get('category'), _TEST_CATEGORIES, 'undergrad'),
    status: _readEnum(formData.get('status'), _TEST_STATUSES, 'planned'),
    test_date: emptyToNull(formData.get('test_date')),
    registration_deadline: emptyToNull(formData.get('registration_deadline')),
    location: emptyToNull(formData.get('location')),
    score: readNullableNumber(formData.get('score')),
    max_score: readNullableNumber(formData.get('max_score')),
    percentile: readNullableNumber(formData.get('percentile')),
    superscore_eligible: _readBool(formData, 'superscore_eligible'),
    notes_md: emptyToNull(formData.get('notes_md')),
  });
  revalidatePath('/classes/tests');
  revalidatePath(`/classes/tests/${id}`);
  redirect(`/classes/tests/${id}`);
}

export async function deleteStandardizedTestAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('Missing test id');
  _deleteStandardizedTest(getClassesDb(), id);
  revalidatePath('/classes/tests');
  redirect('/classes/tests');
}
