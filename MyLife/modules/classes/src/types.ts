import { z } from 'zod';

export const ClassesSettingKeySchema = z.enum([
  'activeTermLabel',
  'campusLabel',
  'weekStartsOn',
  'scheduleDensity',
  'gradeScale',
  'defaultStudyMinutes',
  'focusBreakMinutes',
  'assignmentView',
  'assignmentReminderOffsets',
  'showWeekends',
  'defaultTravelMinutes',
  'requireBiometricLock',
  'privacyConsentAcknowledgedAt',
]);

export type ClassesSettingKey = z.infer<typeof ClassesSettingKeySchema>;

export const ClassesSettingSchema = z.object({
  key: ClassesSettingKeySchema,
  value: z.string(),
});

export type ClassesSetting = z.infer<typeof ClassesSettingSchema>;

export const WeekStartsOnSchema = z.enum(['monday', 'sunday']);
export type WeekStartsOn = z.infer<typeof WeekStartsOnSchema>;

export const ScheduleDensitySchema = z.enum(['compact', 'comfortable']);
export type ScheduleDensity = z.infer<typeof ScheduleDensitySchema>;

export const GradeScaleSchema = z.enum(['percent', 'letter', 'gpa_4']);
export type GradeScale = z.infer<typeof GradeScaleSchema>;

export const AssignmentViewSchema = z.enum(['upcoming', 'today', 'class']);
export type AssignmentView = z.infer<typeof AssignmentViewSchema>;

export const ClassesSettingsSchema = z.object({
  activeTermLabel: z.string(),
  campusLabel: z.string(),
  weekStartsOn: WeekStartsOnSchema,
  scheduleDensity: ScheduleDensitySchema,
  gradeScale: GradeScaleSchema,
  defaultStudyMinutes: z.number().int().min(15).max(240),
  focusBreakMinutes: z.number().int().min(0).max(60),
  assignmentView: AssignmentViewSchema,
  assignmentReminderOffsets: z.array(z.number().int().min(0).max(10080)).max(4),
  showWeekends: z.boolean(),
  defaultTravelMinutes: z.number().int().min(0).max(120),
  requireBiometricLock: z.boolean(),
  privacyConsentAcknowledgedAt: z.string(),
});

export type ClassesSettings = z.infer<typeof ClassesSettingsSchema>;

export const DEFAULT_CLASSES_SETTINGS: ClassesSettings = {
  activeTermLabel: '',
  campusLabel: '',
  weekStartsOn: 'monday',
  scheduleDensity: 'comfortable',
  gradeScale: 'percent',
  defaultStudyMinutes: 45,
  focusBreakMinutes: 10,
  assignmentView: 'upcoming',
  assignmentReminderOffsets: [],
  showWeekends: false,
  defaultTravelMinutes: 10,
  requireBiometricLock: false,
  privacyConsentAcknowledgedAt: '',
};

export const UpdateClassesSettingsInputSchema = ClassesSettingsSchema.partial();
export type UpdateClassesSettingsInput = z.infer<typeof UpdateClassesSettingsInputSchema>;

export const ClassesFoundationChecklistItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  ready: z.boolean(),
});

export type ClassesFoundationChecklistItem = z.infer<
  typeof ClassesFoundationChecklistItemSchema
>;

export const ClassesStarterStatsSchema = z.object({
  currentTermLabel: z.string(),
  customPreferenceCount: z.number().int().nonnegative(),
  reminderSummary: z.string(),
  dailyFocusLabel: z.string(),
});

export type ClassesStarterStats = z.infer<typeof ClassesStarterStatsSchema>;
