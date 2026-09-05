export { CLASSES_MODULE } from './definition';

export {
  formatClassesReminderSummary,
  getClassesFoundationChecklist,
  getClassesSetting,
  getClassesSettings,
  getClassesStarterStats,
  listClassesSettings,
  saveClassesSettings,
  setClassesSetting,
  ALL_TABLES,
  CLASSES_MIGRATIONS,
  CREATE_CLASSES,
  CREATE_CLASSES_SETTINGS,
  CREATE_SEMESTERS,
  CREATE_TEACHERS,
  CREATE_V2_INDEXES,
  archiveSemester,
  createSemester,
  deleteSemester,
  getSemester,
  getSemesterStats,
  listSemesters,
  setCurrentSemester,
  updateSemester,
  createTeacher,
  deleteTeacher,
  getTeacher,
  getTeacherByClass,
  listTeachers,
  updateTeacher,
  createClass,
  deleteClass,
  detectClassConflicts,
  getClass,
  getScheduleForWeek,
  listClassesBySemester,
  listClassesByTeacher,
  updateClass,
  type ScheduledBlock,
  createStudySession,
  deleteStudySession,
  getLocationStats,
  getStreakInfo,
  getStudySession,
  getSubjectTimeAllocation,
  getWeeklySummary,
  listStudySessionsByClass,
  listStudySessionsByDateRange,
  updateStudySession,
  type LocationStat,
  type PerClassHours,
  type StreakInfo,
  type SubjectAllocation,
  type WeeklySummary,
  CREATE_STUDY_SESSIONS,
  CREATE_V3_INDEXES,
  CREATE_ASSIGNMENTS,
  CREATE_V4_INDEXES,
  IllegalAssignmentTransitionError,
  createAssignment,
  deleteAssignment,
  getAssignment,
  getTimeEstimateAccuracy,
  listAssignmentsByClass,
  listAssignmentsByStatus,
  listOverdueAssignments,
  listUpcomingAssignments,
  markAssignmentSubmitted,
  setAssignmentGrade,
  updateAssignment,
  type TimeEstimateAccuracy,
  CREATE_ONLINE_COURSES,
  CREATE_CERTIFICATIONS,
  CREATE_LEARNING_GOALS,
  CREATE_V5_INDEXES,
  createOnlineCourse,
  deleteOnlineCourse,
  getCourseStats,
  getOnlineCourse,
  listOnlineCourses,
  updateOnlineCourse,
  type OnlineCourseFilter,
  createCertification,
  deleteCertification,
  getCertification,
  listCertifications,
  listExpiring,
  updateCertification,
  createLearningGoal,
  deleteLearningGoal,
  getGoalProgress,
  getLearningGoal,
  listLearningGoals,
  updateLearningGoal,
  CREATE_DEGREE_PROGRAMS,
  CREATE_REQUIREMENTS,
  CREATE_REQUIREMENT_SATISFACTIONS,
  CREATE_V6_INDEXES,
  createDegreeProgram,
  deleteDegreeProgram,
  getProgram,
  listPrograms,
  setPrimaryProgram,
  updateDegreeProgram,
  createRequirement,
  deleteRequirement,
  getRequirement,
  listRequirementsByProgram,
  updateRequirement,
  createRequirementSatisfaction,
  deleteRequirementSatisfaction,
  getRequirementSatisfaction,
  listSatisfactionsByClass,
  listSatisfactionsByRequirement,
  updateRequirementSatisfaction,
  CREATE_STANDARDIZED_TESTS,
  CREATE_APPLICATIONS,
  CREATE_APPLICATION_TASKS,
  CREATE_V7_INDEXES,
  createStandardizedTest,
  deleteStandardizedTest,
  getBestScoreByName,
  getStandardizedTest,
  getUpcomingTests,
  listStandardizedTests,
  updateStandardizedTest,
  type StandardizedTestFilter,
  createApplication,
  deleteApplication,
  getApplication,
  getApplicationCompletionPercent,
  listApplications,
  listUpcomingDeadlines,
  updateApplication,
  type ApplicationFilter,
  createApplicationTask,
  deleteApplicationTask,
  getApplicationTask,
  listTasksByApplication,
  markTaskComplete,
  updateApplicationTask,
} from './db';

export { detectConflicts } from './engine/schedule-conflict';

// Office hours widget engine (P5-B)
export {
  formatRelativeDayLabel,
  getUpcomingOfficeHours,
  OFFICE_HOURS_DAY_KEYS,
  OFFICE_HOURS_DAY_LABELS,
  OFFICE_HOURS_DAY_LABELS_SHORT,
  type UpcomingOfficeHour,
} from './engine/office-hours';

export {
  classToICS,
  classesToICS,
  commuteBuffer,
  eventKitPayload,
  type CommuteBufferOptions,
  type CommuteGap,
  type EventKitEventPayload,
  type EventKitRecurrenceRule,
} from './engine/calendar-sync';

// Commute / travel-buffer engine (P1-D)
export {
  computeCommutes,
  summarizeCommutes,
  worstCommuteOfWeek,
  type ClassLite,
  type CommuteHop,
  type CommuteHopEndpoint,
  type CommuteOptions,
  type CommuteSummary,
} from './engine/commute';

// UI helpers (pure: no React imports). Safe for both mobile and web.
export {
  ALL_DAYS,
  CLASSES_PALETTE,
  DAY_LABELS,
  DEFAULT_HOUR_WINDOW,
  WEEKDAYS,
  buildConflictIndex,
  computeHourWindow,
  getActiveDays,
  getBlockPosition,
  getDayKey,
  getHourRows,
  getNowLinePosition,
  groupBlocksByDay,
  minutesToTime,
  pickClassColor,
  timeToMinutes,
  withAlpha,
  type BlockPosition,
  type ClassesPaletteColor,
  type ConflictIndexEntry,
  type HourWindow,
} from './ui';

export type {
  AssignmentView,
  ClassesFoundationChecklistItem,
  ClassesSetting,
  ClassesSettingKey,
  ClassesSettings,
  ClassesStarterStats,
  GradeScale,
  ScheduleDensity,
  UpdateClassesSettingsInput,
  WeekStartsOn,
} from './types';

export {
  AssignmentViewSchema,
  ClassesFoundationChecklistItemSchema,
  ClassesSettingKeySchema,
  ClassesSettingSchema,
  ClassesSettingsSchema,
  ClassesStarterStatsSchema,
  DEFAULT_CLASSES_SETTINGS,
  GradeScaleSchema,
  ScheduleDensitySchema,
  UpdateClassesSettingsInputSchema,
  WeekStartsOnSchema,
} from './types';

// v2 entity types and schemas (P1-A)
export type {
  CategoryWeights,
  ClassInput,
  ClassRow,
  ClassUpdate,
  Day,
  DayTime,
  HydratedClass,
  OfficeHours,
  ScheduleConflict,
  SemesterInput,
  SemesterRow,
  SemesterStats,
  SemesterUpdate,
  TeacherInput,
  TeacherRow,
  TeacherUpdate,
  TimeOfDay,
} from './models/schemas';

// v3 entity types and schemas (P4-A)
export type {
  PomodoroSettings,
  StudySessionInput,
  StudySessionRow,
  StudySessionUpdate,
  TimerType,
} from './models/schemas';

export {
  PomodoroSettingsSchema,
  StudySessionInputSchema,
  StudySessionRowSchema,
  StudySessionUpdateSchema,
  TimerTypeSchema,
} from './models/schemas';

// Pomodoro engine (P4-A)
export {
  DEFAULT_POMODORO_SETTINGS,
  createInitialState as createPomodoroInitialState,
  getProgress as getPomodoroProgress,
  pause as pausePomodoro,
  pomodoroSettingsFromUserSettings,
  reset as resetPomodoro,
  skip as skipPomodoro,
  start as startPomodoro,
  tick as tickPomodoro,
  type PomodoroPhase,
  type PomodoroProgress,
  type PomodoroState,
} from './engine/pomodoro-engine';

// v4 entity types and schemas (P2-A)
export type {
  AssignmentInput,
  AssignmentPriority,
  AssignmentRow,
  AssignmentStatus,
  AssignmentType,
  AssignmentUpdate,
  GroupMember,
  LatePolicy,
  RecurrenceFrequency,
  RecurrenceRule,
} from './models/schemas';

export {
  AssignmentInputSchema,
  AssignmentPrioritySchema,
  AssignmentRowSchema,
  AssignmentStatusSchema,
  AssignmentTypeSchema,
  AssignmentUpdateSchema,
  GroupMemberSchema,
  LatePolicySchema,
  RecurrenceFrequencySchema,
  RecurrenceRuleSchema,
} from './models/schemas';

// Assignment engine (P2-A)
export {
  calculateLatePenalty,
  generateRecurringInstances,
  getDependencyChain,
  getOverdueAssignments,
  isBlocked,
  type LatePenalty,
  type OverdueAssignment,
  type RecurringTemplate,
  type SemesterWindow,
} from './engine/assignment-engine';

export type {
  AssignmentTimerSnapshot,
  AssignmentTimerState,
  StartTimerResult,
  StopTimerResult,
  TimeTrackerStorage,
} from './engine/time-tracker';

export {
  CLASSES_TIME_TRACKER_KEY,
  createMemoryTimeTrackerStorage,
  getActiveTimer,
  getTimerElapsedMs,
  pauseTimer as pauseAssignmentTimer,
  startTimer as startAssignmentTimer,
  stopTimer as stopAssignmentTimer,
  toTimerSnapshot,
} from './engine/time-tracker';

// Grade engine (P3-A): pure GPA, weighted grades, prediction, trend.
// Note: the engine defines its own `GradeScale` distinct from the settings
// `GradeScale` exported from ./types. We re-export under `LetterGradeScale`
// to avoid collision.
export {
  calculateClassGrade,
  calculateSemesterGPA,
  calculateTrend,
  gpaFromLetter,
  letterFromPercent,
  predictFinalGrade,
  type CategoryRollup,
  type ClassGradeResult,
  type FinalPrediction,
  type GradeScale as LetterGradeScale,
  type SemesterGPAClass,
  type SemesterGPAResult,
  type TrendConfidence,
  type TrendDirection,
  type TrendResult,
} from './engine/grade-engine';

export {
  CategoryWeightsSchema,
  ClassInputSchema,
  ClassRowSchema,
  ClassUpdateSchema,
  DAY_ORDER,
  DaySchema,
  DayTimeListSchema,
  DayTimeSchema,
  OfficeHoursSchema,
  SemesterInputSchema,
  SemesterRowSchema,
  SemesterStatsSchema,
  SemesterUpdateSchema,
  TeacherInputSchema,
  TeacherRowSchema,
  TeacherUpdateSchema,
  TimeOfDaySchema,
} from './models/schemas';

// v5 entity types and schemas (P8-A)
export type {
  CertificationInput,
  CertificationRow,
  CertificationUpdate,
  LearningGoalInput,
  LearningGoalProgress,
  LearningGoalRow,
  LearningGoalStatus,
  LearningGoalUpdate,
  OnlineCourseInput,
  OnlineCourseRow,
  OnlineCourseStats,
  OnlineCourseStatus,
  OnlineCourseUpdate,
} from './models/schemas';

export {
  CertificationInputSchema,
  CertificationRowSchema,
  CertificationUpdateSchema,
  LearningGoalInputSchema,
  LearningGoalProgressSchema,
  LearningGoalRowSchema,
  LearningGoalStatusSchema,
  LearningGoalUpdateSchema,
  OnlineCourseInputSchema,
  OnlineCourseRowSchema,
  OnlineCourseStatsSchema,
  OnlineCourseStatusSchema,
  OnlineCourseUpdateSchema,
} from './models/schemas';

// v6 entity types and schemas (P6-A)
export type {
  DegreeProgramInput,
  DegreeProgramRow,
  DegreeProgramUpdate,
  DegreeType,
  RequirementCategory,
  RequirementInput,
  RequirementRow,
  RequirementSatisfactionInput,
  RequirementSatisfactionRow,
  RequirementSatisfactionUpdate,
  RequirementUpdate,
  SatisfactionStatus,
} from './models/schemas';

export {
  DegreeProgramInputSchema,
  DegreeProgramRowSchema,
  DegreeProgramUpdateSchema,
  DegreeTypeSchema,
  RequirementCategorySchema,
  RequirementInputSchema,
  RequirementRowSchema,
  RequirementSatisfactionInputSchema,
  RequirementSatisfactionRowSchema,
  RequirementSatisfactionUpdateSchema,
  RequirementUpdateSchema,
  SatisfactionStatusSchema,
} from './models/schemas';

// Degree-progress engine (P6-A)
export {
  computeProgramProgress,
  computeRequirementProgress,
  detectDoubleCount,
  suggestClassesForRequirement,
  type DoubleCountEntry,
  type GpaStatus,
  type ProgramProgress,
  type RequirementProgress,
} from './engine/degree-engine';

// v7 entity types and schemas (P7-A)
export type {
  ApplicationInput,
  ApplicationRow,
  ApplicationStatus,
  ApplicationTaskInput,
  ApplicationTaskKind,
  ApplicationTaskRow,
  ApplicationTaskStatus,
  ApplicationTaskUpdate,
  ApplicationType,
  ApplicationUpdate,
  SectionScores,
  StandardizedTestCategory,
  StandardizedTestInput,
  StandardizedTestRow,
  StandardizedTestStatus,
  StandardizedTestUpdate,
} from './models/schemas';

export {
  ApplicationInputSchema,
  ApplicationRowSchema,
  ApplicationStatusSchema,
  ApplicationTaskInputSchema,
  ApplicationTaskKindSchema,
  ApplicationTaskRowSchema,
  ApplicationTaskStatusSchema,
  ApplicationTaskUpdateSchema,
  ApplicationTypeSchema,
  ApplicationUpdateSchema,
  SectionScoresSchema,
  StandardizedTestCategorySchema,
  StandardizedTestInputSchema,
  StandardizedTestRowSchema,
  StandardizedTestStatusSchema,
  StandardizedTestUpdateSchema,
} from './models/schemas';

// Applications engine (P7-A)
export {
  computeApplicationProgress,
  computeApplicationsTimeline,
  getDeadlineUrgency,
  groupApplicationsByStatus,
  superscoreFromTests,
  type ApplicationProgress,
  type ApplicationTimelineEntry,
  type DeadlineUrgency,
  type SectionBest,
} from './engine/applications-engine';

// Export/import (P5_5-C)
export {
  CLASSES_CURRENT_SCHEMA_VERSION,
  applyImport,
  loadFullExport,
  type ApplyImportOptions,
  type ApplyImportResult,
  type ImportMode,
} from './db/crud/export-import';

// P9 cross-module integration bridges
export * from './integrations';

export {
  assignmentsToCSV,
  bundleToJSON,
  buildExportBundle,
  classesToCSV,
  gradesCSV,
  parseImportJSON,
  planImport,
  semestersToCSV,
  studySessionsToCSV,
  teachersToCSV,
  type ClassesExportBundle,
  type ImportPlan,
} from './engine/export-import';
