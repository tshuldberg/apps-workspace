import { z } from 'zod';

// -- Day-of-week + time blocks --

export const DaySchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
export type Day = z.infer<typeof DaySchema>;

export const DAY_ORDER: Record<Day, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const TimeOfDaySchema = z.string().regex(TIME_RE, 'Time must be HH:MM (24h)');
export type TimeOfDay = z.infer<typeof TimeOfDaySchema>;

export const DayTimeSchema = z
  .object({
    day: DaySchema,
    start_time: TimeOfDaySchema,
    end_time: TimeOfDaySchema,
  })
  .refine((dt) => dt.start_time < dt.end_time, {
    message: 'start_time must be before end_time',
    path: ['end_time'],
  });
export type DayTime = z.infer<typeof DayTimeSchema>;

export const DayTimeListSchema = z.array(DayTimeSchema);

// -- Category weights (e.g. {exams:40, homework:30, participation:20, final:10}) --

export const CategoryWeightsSchema = z.record(z.string(), z.number().min(0).max(100));
export type CategoryWeights = z.infer<typeof CategoryWeightsSchema>;

// -- Office hours (per-day blocks) --

export const OfficeHoursSchema = z.array(DayTimeSchema);
export type OfficeHours = z.infer<typeof OfficeHoursSchema>;

// -- Semester --

export const SemesterRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  institution: z.string().nullable(),
  credit_hours: z.number().int().nonnegative(),
  gpa: z.number().nullable(),
  is_current: z.number().int(),
  created_at: z.string(),
});
export type SemesterRow = z.infer<typeof SemesterRowSchema>;

export const SemesterInputSchema = z.object({
  name: z.string().min(1),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  institution: z.string().nullable().optional(),
  credit_hours: z.number().int().nonnegative().optional(),
  gpa: z.number().nullable().optional(),
  is_current: z.boolean().optional(),
});
export type SemesterInput = z.infer<typeof SemesterInputSchema>;

export const SemesterUpdateSchema = SemesterInputSchema.partial();
export type SemesterUpdate = z.infer<typeof SemesterUpdateSchema>;

export const SemesterStatsSchema = z.object({
  class_count: z.number().int().nonnegative(),
  gpa: z.number().nullable(),
  credit_hours: z.number().int().nonnegative(),
});
export type SemesterStats = z.infer<typeof SemesterStatsSchema>;

// -- Teacher --

export const TeacherRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string().nullable(),
  department: z.string().nullable(),
  email: z.string().nullable(),
  office_location: z.string().nullable(),
  office_hours: z.string().nullable(), // serialized OfficeHours JSON
  teaching_style_notes: z.string().nullable(),
  grading_notes: z.string().nullable(),
  rec_potential: z.number().int().nullable(),
  rating: z.number().int().min(1).max(5).nullable(),
  notes_md: z.string().nullable(),
  created_at: z.string(),
});
export type TeacherRow = z.infer<typeof TeacherRowSchema>;

export const TeacherInputSchema = z.object({
  name: z.string().min(1),
  title: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal('').transform(() => null)),
  office_location: z.string().nullable().optional(),
  office_hours: OfficeHoursSchema.nullable().optional(),
  teaching_style_notes: z.string().nullable().optional(),
  grading_notes: z.string().nullable().optional(),
  rec_potential: z.number().int().nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  notes_md: z.string().nullable().optional(),
});
export type TeacherInput = z.infer<typeof TeacherInputSchema>;

export const TeacherUpdateSchema = TeacherInputSchema.partial();
export type TeacherUpdate = z.infer<typeof TeacherUpdateSchema>;

// -- Class --

export const ClassRowSchema = z.object({
  id: z.string(),
  semester_id: z.string(),
  name: z.string(),
  code: z.string().nullable(),
  section: z.string().nullable(),
  credits: z.number().int().nonnegative(),
  day_times: z.string().nullable(), // serialized DayTime[] JSON
  room: z.string().nullable(),
  building: z.string().nullable(),
  teacher_id: z.string().nullable(),
  category_weights: z.string().nullable(), // serialized CategoryWeights JSON
  current_grade: z.number().nullable(),
  target_grade: z.number().nullable(),
  color: z.string(),
  notes_md: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ClassRow = z.infer<typeof ClassRowSchema>;

export const ClassInputSchema = z.object({
  semester_id: z.string().min(1),
  name: z.string().min(1),
  code: z.string().nullable().optional(),
  section: z.string().nullable().optional(),
  credits: z.number().int().nonnegative().optional(),
  day_times: DayTimeListSchema.optional(),
  room: z.string().nullable().optional(),
  building: z.string().nullable().optional(),
  teacher_id: z.string().nullable().optional(),
  category_weights: CategoryWeightsSchema.nullable().optional(),
  current_grade: z.number().nullable().optional(),
  target_grade: z.number().nullable().optional(),
  color: z.string().optional(),
  notes_md: z.string().nullable().optional(),
});
export type ClassInput = z.infer<typeof ClassInputSchema>;

export const ClassUpdateSchema = ClassInputSchema.partial();
export type ClassUpdate = z.infer<typeof ClassUpdateSchema>;

// -- Hydrated class with parsed JSON --

export interface HydratedClass extends Omit<ClassRow, 'day_times' | 'category_weights'> {
  day_times: DayTime[];
  category_weights: CategoryWeights | null;
}

// -- Schedule conflict --

export interface ScheduleConflict {
  a: ClassRow;
  b: ClassRow;
  day: Day;
  overlap_minutes: number;
}

// -- Study sessions (v3 / P4-A) --

export const TimerTypeSchema = z.enum(['pomodoro', 'custom', 'freeform']);
export type TimerType = z.infer<typeof TimerTypeSchema>;

export const StudySessionRowSchema = z.object({
  id: z.string(),
  class_id: z.string().nullable(),
  started_at: z.string(),
  duration_minutes: z.number().int().nonnegative(),
  location: z.string().nullable(),
  productivity_rating: z.number().int().min(1).max(5).nullable(),
  focus_notes: z.string().nullable(),
  companion_ids: z.string().nullable(), // serialized string[] JSON
  topics_covered: z.string().nullable(), // serialized string[] JSON
  timer_type: TimerTypeSchema,
  pomodoro_count: z.number().int().nonnegative(),
  created_at: z.string(),
});
export type StudySessionRow = z.infer<typeof StudySessionRowSchema>;

export const StudySessionInputSchema = z.object({
  class_id: z.string().nullable().optional(),
  started_at: z.string().min(1),
  duration_minutes: z.number().int().nonnegative(),
  location: z.string().nullable().optional(),
  productivity_rating: z.number().int().min(1).max(5).nullable().optional(),
  focus_notes: z.string().nullable().optional(),
  companion_ids: z.array(z.string()).nullable().optional(),
  topics_covered: z.array(z.string()).nullable().optional(),
  timer_type: TimerTypeSchema.optional(),
  pomodoro_count: z.number().int().nonnegative().optional(),
});
export type StudySessionInput = z.infer<typeof StudySessionInputSchema>;

export const StudySessionUpdateSchema = StudySessionInputSchema.partial();
export type StudySessionUpdate = z.infer<typeof StudySessionUpdateSchema>;

// -- Assignments (v4 / P2-A) --

export const AssignmentTypeSchema = z.enum([
  'homework',
  'essay',
  'project',
  'quiz',
  'exam',
  'lab',
  'presentation',
  'reading',
  'other',
]);
export type AssignmentType = z.infer<typeof AssignmentTypeSchema>;

export const AssignmentStatusSchema = z.enum([
  'not_started',
  'in_progress',
  'submitted',
  'graded',
]);
export type AssignmentStatus = z.infer<typeof AssignmentStatusSchema>;

export const AssignmentPrioritySchema = z.enum([
  'low',
  'medium',
  'high',
  'critical',
]);
export type AssignmentPriority = z.infer<typeof AssignmentPrioritySchema>;

export const RecurrenceFrequencySchema = z.enum([
  'daily',
  'weekly',
  'biweekly',
  'monthly',
]);
export type RecurrenceFrequency = z.infer<typeof RecurrenceFrequencySchema>;

export const RecurrenceRuleSchema = z.object({
  frequency: RecurrenceFrequencySchema,
  interval: z.number().int().positive(),
  until: z.string().optional(),
});
export type RecurrenceRule = z.infer<typeof RecurrenceRuleSchema>;

export const GroupMemberSchema = z.object({
  name: z.string().min(1),
  responsibilities: z.string().optional(),
  complete: z.boolean().optional(),
  is_me: z.boolean().optional(),
});
export type GroupMember = z.infer<typeof GroupMemberSchema>;

export const LatePolicySchema = z.object({
  percent_per_day: z.number().nonnegative(),
  max_days: z.number().int().nonnegative(),
});
export type LatePolicy = z.infer<typeof LatePolicySchema>;

export const AssignmentRowSchema = z.object({
  id: z.string(),
  class_id: z.string(),
  title: z.string(),
  type: AssignmentTypeSchema,
  description_md: z.string().nullable(),
  due_at: z.string().nullable(),
  submitted_at: z.string().nullable(),
  graded_at: z.string().nullable(),
  status: AssignmentStatusSchema,
  priority: AssignmentPrioritySchema,
  estimated_minutes: z.number().int().nonnegative().nullable(),
  actual_minutes: z.number().int().nonnegative().nullable(),
  grade: z.number().nullable(),
  max_grade: z.number().nullable(),
  weight: z.number().nullable(),
  is_recurring: z.number().int(),
  recurrence_rule: z.string().nullable(), // serialized RecurrenceRule JSON
  group_members: z.string().nullable(), // serialized GroupMember[] JSON
  submission_notes: z.string().nullable(),
  late_policy: z.string().nullable(), // serialized LatePolicy JSON
  depends_on: z.string().nullable(), // serialized string[] JSON
  created_at: z.string(),
  updated_at: z.string(),
});
export type AssignmentRow = z.infer<typeof AssignmentRowSchema>;

export const AssignmentInputSchema = z.object({
  class_id: z.string().min(1),
  title: z.string().min(1),
  type: AssignmentTypeSchema,
  description_md: z.string().nullable().optional(),
  due_at: z.string().nullable().optional(),
  submitted_at: z.string().nullable().optional(),
  graded_at: z.string().nullable().optional(),
  status: AssignmentStatusSchema.optional(),
  priority: AssignmentPrioritySchema.optional(),
  estimated_minutes: z.number().int().nonnegative().nullable().optional(),
  actual_minutes: z.number().int().nonnegative().nullable().optional(),
  grade: z.number().nullable().optional(),
  max_grade: z.number().nullable().optional(),
  weight: z.number().nullable().optional(),
  is_recurring: z.boolean().optional(),
  recurrence_rule: RecurrenceRuleSchema.nullable().optional(),
  group_members: z.array(GroupMemberSchema).nullable().optional(),
  submission_notes: z.string().nullable().optional(),
  late_policy: LatePolicySchema.nullable().optional(),
  depends_on: z.array(z.string()).nullable().optional(),
});
export type AssignmentInput = z.infer<typeof AssignmentInputSchema>;

export const AssignmentUpdateSchema = AssignmentInputSchema.partial();
export type AssignmentUpdate = z.infer<typeof AssignmentUpdateSchema>;

// -- Online courses (v5 / P8-A) --

export const OnlineCourseStatusSchema = z.enum([
  'not_started',
  'in_progress',
  'completed',
  'abandoned',
]);
export type OnlineCourseStatus = z.infer<typeof OnlineCourseStatusSchema>;

export const OnlineCourseRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  provider: z.string().nullable(),
  url: z.string().nullable(),
  instructor: z.string().nullable(),
  category: z.string().nullable(),
  status: OnlineCourseStatusSchema,
  progress_percent: z.number(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  estimated_hours: z.number().nullable(),
  actual_hours: z.number().nullable(),
  notes_md: z.string().nullable(),
  certificate_url: z.string().nullable(),
  rating: z.number().int().min(1).max(5).nullable(),
  tags: z.string().nullable(), // serialized string[] JSON
  created_at: z.string(),
  updated_at: z.string(),
});
export type OnlineCourseRow = z.infer<typeof OnlineCourseRowSchema>;

export const OnlineCourseInputSchema = z.object({
  title: z.string().min(1),
  provider: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  instructor: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  status: OnlineCourseStatusSchema.optional(),
  progress_percent: z.number().min(0).max(100).optional(),
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  estimated_hours: z.number().nonnegative().nullable().optional(),
  actual_hours: z.number().nonnegative().nullable().optional(),
  notes_md: z.string().nullable().optional(),
  certificate_url: z.string().nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
});
export type OnlineCourseInput = z.infer<typeof OnlineCourseInputSchema>;

export const OnlineCourseUpdateSchema = OnlineCourseInputSchema.partial();
export type OnlineCourseUpdate = z.infer<typeof OnlineCourseUpdateSchema>;

export const OnlineCourseStatsSchema = z.object({
  total: z.number().int().nonnegative(),
  in_progress: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  total_hours_spent: z.number().nonnegative(),
});
export type OnlineCourseStats = z.infer<typeof OnlineCourseStatsSchema>;

// -- Certifications (v5 / P8-A) --

export const CertificationRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  issuer: z.string().nullable(),
  issued_at: z.string().nullable(),
  expires_at: z.string().nullable(),
  credential_id: z.string().nullable(),
  credential_url: z.string().nullable(),
  category: z.string().nullable(),
  notes_md: z.string().nullable(),
  renewal_reminder_days: z.number().int().nonnegative().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type CertificationRow = z.infer<typeof CertificationRowSchema>;

export const CertificationInputSchema = z.object({
  name: z.string().min(1),
  issuer: z.string().nullable().optional(),
  issued_at: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
  credential_id: z.string().nullable().optional(),
  credential_url: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  notes_md: z.string().nullable().optional(),
  renewal_reminder_days: z.number().int().nonnegative().nullable().optional(),
});
export type CertificationInput = z.infer<typeof CertificationInputSchema>;

export const CertificationUpdateSchema = CertificationInputSchema.partial();
export type CertificationUpdate = z.infer<typeof CertificationUpdateSchema>;

// -- Learning goals (v5 / P8-A) --

export const LearningGoalStatusSchema = z.enum([
  'active',
  'completed',
  'paused',
  'abandoned',
]);
export type LearningGoalStatus = z.infer<typeof LearningGoalStatusSchema>;

export const LearningGoalRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  description_md: z.string().nullable(),
  target_date: z.string().nullable(),
  status: LearningGoalStatusSchema,
  course_ids: z.string().nullable(), // serialized string[] JSON
  certification_ids: z.string().nullable(), // serialized string[] JSON
  created_at: z.string(),
  completed_at: z.string().nullable(),
});
export type LearningGoalRow = z.infer<typeof LearningGoalRowSchema>;

export const LearningGoalInputSchema = z.object({
  title: z.string().min(1),
  description_md: z.string().nullable().optional(),
  target_date: z.string().nullable().optional(),
  status: LearningGoalStatusSchema.optional(),
  course_ids: z.array(z.string()).nullable().optional(),
  certification_ids: z.array(z.string()).nullable().optional(),
  completed_at: z.string().nullable().optional(),
});
export type LearningGoalInput = z.infer<typeof LearningGoalInputSchema>;

export const LearningGoalUpdateSchema = LearningGoalInputSchema.partial();
export type LearningGoalUpdate = z.infer<typeof LearningGoalUpdateSchema>;

export const LearningGoalProgressSchema = z.object({
  total_items: z.number().int().nonnegative(),
  completed_items: z.number().int().nonnegative(),
  percent: z.number(),
  goal: LearningGoalRowSchema.nullable(),
});
export type LearningGoalProgress = z.infer<typeof LearningGoalProgressSchema>;

// -- Degree planning (v6 / P6-A) --

export const DegreeTypeSchema = z.enum([
  'BS',
  'BA',
  'MS',
  'MA',
  'PhD',
  'Minor',
  'Certificate',
  'Other',
]);
export type DegreeType = z.infer<typeof DegreeTypeSchema>;

export const RequirementCategorySchema = z.enum([
  'major',
  'minor',
  'general_ed',
  'elective',
  'capstone',
  'other',
]);
export type RequirementCategory = z.infer<typeof RequirementCategorySchema>;

export const SatisfactionStatusSchema = z.enum([
  'planned',
  'in_progress',
  'completed',
]);
export type SatisfactionStatus = z.infer<typeof SatisfactionStatusSchema>;

export const DegreeProgramRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  institution: z.string().nullable(),
  degree_type: DegreeTypeSchema.nullable(),
  total_credits_required: z.number().int().nonnegative(),
  gpa_required: z.number().nullable(),
  catalog_year: z.string().nullable(),
  start_date: z.string().nullable(),
  expected_completion: z.string().nullable(),
  is_primary: z.number().int(),
  notes_md: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type DegreeProgramRow = z.infer<typeof DegreeProgramRowSchema>;

export const DegreeProgramInputSchema = z.object({
  name: z.string().min(1),
  institution: z.string().nullable().optional(),
  degree_type: DegreeTypeSchema.nullable().optional(),
  total_credits_required: z.number().int().nonnegative(),
  gpa_required: z.number().nullable().optional(),
  catalog_year: z.string().nullable().optional(),
  start_date: z.string().nullable().optional(),
  expected_completion: z.string().nullable().optional(),
  is_primary: z.boolean().optional(),
  notes_md: z.string().nullable().optional(),
});
export type DegreeProgramInput = z.infer<typeof DegreeProgramInputSchema>;

export const DegreeProgramUpdateSchema = DegreeProgramInputSchema.partial();
export type DegreeProgramUpdate = z.infer<typeof DegreeProgramUpdateSchema>;

export const RequirementRowSchema = z.object({
  id: z.string(),
  program_id: z.string(),
  name: z.string(),
  category: RequirementCategorySchema.nullable(),
  credits_required: z.number().int().nonnegative(),
  course_count_required: z.number().int().nonnegative(),
  min_grade: z.string().nullable(),
  allowed_course_codes: z.string().nullable(), // serialized string[] JSON
  notes_md: z.string().nullable(),
  sort_order: z.number().int(),
  created_at: z.string(),
});
export type RequirementRow = z.infer<typeof RequirementRowSchema>;

export const RequirementInputSchema = z.object({
  program_id: z.string().min(1),
  name: z.string().min(1),
  category: RequirementCategorySchema.nullable().optional(),
  credits_required: z.number().int().nonnegative().optional(),
  course_count_required: z.number().int().nonnegative().optional(),
  min_grade: z.string().nullable().optional(),
  allowed_course_codes: z.array(z.string()).nullable().optional(),
  notes_md: z.string().nullable().optional(),
  sort_order: z.number().int().optional(),
});
export type RequirementInput = z.infer<typeof RequirementInputSchema>;

export const RequirementUpdateSchema = RequirementInputSchema.partial();
export type RequirementUpdate = z.infer<typeof RequirementUpdateSchema>;

export const RequirementSatisfactionRowSchema = z.object({
  id: z.string(),
  requirement_id: z.string(),
  class_id: z.string(),
  credits_applied: z.number().int().nonnegative(),
  status: SatisfactionStatusSchema,
  approved_by: z.string().nullable(),
  created_at: z.string(),
});
export type RequirementSatisfactionRow = z.infer<
  typeof RequirementSatisfactionRowSchema
>;

export const RequirementSatisfactionInputSchema = z.object({
  requirement_id: z.string().min(1),
  class_id: z.string().min(1),
  credits_applied: z.number().int().nonnegative(),
  status: SatisfactionStatusSchema.optional(),
  approved_by: z.string().nullable().optional(),
});
export type RequirementSatisfactionInput = z.infer<
  typeof RequirementSatisfactionInputSchema
>;

export const RequirementSatisfactionUpdateSchema =
  RequirementSatisfactionInputSchema.partial();
export type RequirementSatisfactionUpdate = z.infer<
  typeof RequirementSatisfactionUpdateSchema
>;

// -- Standardized tests (v7 / P7-A) --

export const StandardizedTestCategorySchema = z.enum([
  'undergrad',
  'grad',
  'ap_ib',
  'language',
  'professional',
  'other',
]);
export type StandardizedTestCategory = z.infer<typeof StandardizedTestCategorySchema>;

export const StandardizedTestStatusSchema = z.enum([
  'planned',
  'registered',
  'completed',
  'cancelled',
]);
export type StandardizedTestStatus = z.infer<typeof StandardizedTestStatusSchema>;

export const SectionScoresSchema = z.record(z.string(), z.number());
export type SectionScores = z.infer<typeof SectionScoresSchema>;

export const StandardizedTestRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: StandardizedTestCategorySchema,
  test_date: z.string().nullable(),
  registration_deadline: z.string().nullable(),
  location: z.string().nullable(),
  score: z.number().nullable(),
  max_score: z.number().nullable(),
  percentile: z.number().nullable(),
  section_scores: z.string().nullable(), // serialized SectionScores JSON
  status: StandardizedTestStatusSchema,
  superscore_eligible: z.number().int(),
  notes_md: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type StandardizedTestRow = z.infer<typeof StandardizedTestRowSchema>;

export const StandardizedTestInputSchema = z.object({
  name: z.string().min(1),
  category: StandardizedTestCategorySchema,
  test_date: z.string().nullable().optional(),
  registration_deadline: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  score: z.number().nullable().optional(),
  max_score: z.number().nullable().optional(),
  percentile: z.number().nullable().optional(),
  section_scores: SectionScoresSchema.nullable().optional(),
  status: StandardizedTestStatusSchema.optional(),
  superscore_eligible: z.boolean().optional(),
  notes_md: z.string().nullable().optional(),
});
export type StandardizedTestInput = z.infer<typeof StandardizedTestInputSchema>;

export const StandardizedTestUpdateSchema = StandardizedTestInputSchema.partial();
export type StandardizedTestUpdate = z.infer<typeof StandardizedTestUpdateSchema>;

// -- Applications (v7 / P7-A) --

export const ApplicationTypeSchema = z.enum([
  'undergrad',
  'grad',
  'scholarship',
  'fellowship',
  'internship',
  'job',
  'other',
]);
export type ApplicationType = z.infer<typeof ApplicationTypeSchema>;

export const ApplicationStatusSchema = z.enum([
  'considering',
  'in_progress',
  'submitted',
  'accepted',
  'rejected',
  'waitlisted',
  'deferred',
  'withdrawn',
]);
export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;

export const ApplicationRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  institution: z.string().nullable(),
  type: ApplicationTypeSchema,
  program: z.string().nullable(),
  deadline: z.string().nullable(),
  early_deadline: z.string().nullable(),
  decision_date: z.string().nullable(),
  status: ApplicationStatusSchema,
  application_url: z.string().nullable(),
  portal_url: z.string().nullable(),
  application_fee: z.number().nullable(),
  fee_waiver_status: z.string().nullable(),
  required_test_score_ids: z.string().nullable(), // serialized string[] JSON
  required_essays_count: z.number().int().nonnegative(),
  essays_drafted: z.number().int().nonnegative(),
  essays_finalized: z.number().int().nonnegative(),
  recommenders_required: z.number().int().nonnegative(),
  recommenders_confirmed: z.number().int().nonnegative(),
  transcripts_requested: z.number().int(),
  transcripts_sent: z.number().int(),
  notes_md: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ApplicationRow = z.infer<typeof ApplicationRowSchema>;

export const ApplicationInputSchema = z.object({
  name: z.string().min(1),
  institution: z.string().nullable().optional(),
  type: ApplicationTypeSchema,
  program: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  early_deadline: z.string().nullable().optional(),
  decision_date: z.string().nullable().optional(),
  status: ApplicationStatusSchema.optional(),
  application_url: z.string().nullable().optional(),
  portal_url: z.string().nullable().optional(),
  application_fee: z.number().nullable().optional(),
  fee_waiver_status: z.string().nullable().optional(),
  required_test_score_ids: z.array(z.string()).nullable().optional(),
  required_essays_count: z.number().int().nonnegative().optional(),
  essays_drafted: z.number().int().nonnegative().optional(),
  essays_finalized: z.number().int().nonnegative().optional(),
  recommenders_required: z.number().int().nonnegative().optional(),
  recommenders_confirmed: z.number().int().nonnegative().optional(),
  transcripts_requested: z.boolean().optional(),
  transcripts_sent: z.boolean().optional(),
  notes_md: z.string().nullable().optional(),
});
export type ApplicationInput = z.infer<typeof ApplicationInputSchema>;

export const ApplicationUpdateSchema = ApplicationInputSchema.partial();
export type ApplicationUpdate = z.infer<typeof ApplicationUpdateSchema>;

// -- Application tasks (v7 / P7-A) --

export const ApplicationTaskKindSchema = z.enum([
  'essay',
  'recommendation',
  'transcript',
  'portal_step',
  'fee',
  'supplemental',
  'other',
]);
export type ApplicationTaskKind = z.infer<typeof ApplicationTaskKindSchema>;

export const ApplicationTaskStatusSchema = z.enum([
  'not_started',
  'in_progress',
  'done',
  'skipped',
]);
export type ApplicationTaskStatus = z.infer<typeof ApplicationTaskStatusSchema>;

export const ApplicationTaskRowSchema = z.object({
  id: z.string(),
  application_id: z.string(),
  title: z.string(),
  kind: ApplicationTaskKindSchema,
  due_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  word_target: z.number().int().nullable(),
  word_count: z.number().int().nullable(),
  status: ApplicationTaskStatusSchema,
  notes_md: z.string().nullable(),
  sort_order: z.number().int(),
  created_at: z.string(),
});
export type ApplicationTaskRow = z.infer<typeof ApplicationTaskRowSchema>;

export const ApplicationTaskInputSchema = z.object({
  application_id: z.string().min(1),
  title: z.string().min(1),
  kind: ApplicationTaskKindSchema,
  due_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  word_target: z.number().int().nonnegative().nullable().optional(),
  word_count: z.number().int().nonnegative().nullable().optional(),
  status: ApplicationTaskStatusSchema.optional(),
  notes_md: z.string().nullable().optional(),
  sort_order: z.number().int().optional(),
});
export type ApplicationTaskInput = z.infer<typeof ApplicationTaskInputSchema>;

export const ApplicationTaskUpdateSchema = ApplicationTaskInputSchema.partial();
export type ApplicationTaskUpdate = z.infer<typeof ApplicationTaskUpdateSchema>;

// -- Pomodoro engine (v3 / P4-A) --

export const PomodoroSettingsSchema = z.object({
  workMinutes: z.number().int().min(1).max(180),
  shortBreakMinutes: z.number().int().min(0).max(60),
  longBreakMinutes: z.number().int().min(0).max(120),
  longBreakInterval: z.number().int().min(1).max(12),
});
export type PomodoroSettings = z.infer<typeof PomodoroSettingsSchema>;
