import { z } from 'zod';

const NonEmptyStringSchema = z.string().trim().min(1);
const NullableTextSchema = z.string().nullable();
const StringArraySchema = z.array(z.string());

export const CreateSettingKeySchema = z.enum([
  'defaultLandingTab',
  'defaultSessionMinutes',
  'weeklyPracticeGoalMinutes',
  'portfolioVisibility',
  'captureReflectionPrompts',
]);

export type CreateSettingKey = z.infer<typeof CreateSettingKeySchema>;

export const CreateSettingSchema = z.object({
  key: CreateSettingKeySchema,
  value: z.string(),
});

export type CreateSetting = z.infer<typeof CreateSettingSchema>;

export const CreateLandingTabSchema = z.enum([
  'projects',
  'practice',
  'skills',
  'portfolio',
]);

export type CreateLandingTab = z.infer<typeof CreateLandingTabSchema>;

export const PortfolioVisibilitySchema = z.enum([
  'private',
  'share_link_only',
]);

export type PortfolioVisibility = z.infer<typeof PortfolioVisibilitySchema>;

export const CreateSettingsSchema = z.object({
  defaultLandingTab: CreateLandingTabSchema,
  defaultSessionMinutes: z.number().int().min(15).max(240),
  weeklyPracticeGoalMinutes: z.number().int().min(0).max(5000),
  portfolioVisibility: PortfolioVisibilitySchema,
  captureReflectionPrompts: z.boolean(),
});

export type CreateSettings = z.infer<typeof CreateSettingsSchema>;

export const DEFAULT_CREATE_SETTINGS: CreateSettings = {
  defaultLandingTab: 'projects',
  defaultSessionMinutes: 45,
  weeklyPracticeGoalMinutes: 180,
  portfolioVisibility: 'private',
  captureReflectionPrompts: true,
};

export const UpdateCreateSettingsInputSchema = CreateSettingsSchema.partial();
export type UpdateCreateSettingsInput = z.infer<typeof UpdateCreateSettingsInputSchema>;

export const CreatePhotoKindSchema = z.enum([
  'process',
  'final',
  'detail',
  'reference',
  'setup',
]);

export type CreatePhotoKind = z.infer<typeof CreatePhotoKindSchema>;

export const CreatePhotoInputSchema = z.object({
  project_id: z.string().min(1).optional(),
  portfolio_id: z.string().min(1).optional(),
  equipment_id: z.string().min(1).optional(),
  kind: CreatePhotoKindSchema,
  local_uri: z.string().trim().min(1),
  caption: z.string().optional(),
  taken_at: z.string().optional(),
});

export type CreatePhotoInput = z.infer<typeof CreatePhotoInputSchema>;

export const CreatePhotoRowSchema = z.object({
  id: z.string(),
  project_id: z.string().nullable(),
  portfolio_id: z.string().nullable(),
  equipment_id: z.string().nullable(),
  kind: CreatePhotoKindSchema,
  local_uri: z.string(),
  caption: z.string().nullable(),
  taken_at: z.string().nullable(),
  created_at: z.string(),
});

export type CreatePhotoRow = z.infer<typeof CreatePhotoRowSchema>;

export const CreateProjectTypeSchema = z.enum([
  'art',
  'music',
  'video',
  'writing',
  'code',
  'craft',
  'photo',
  'design',
  'game_dev',
  'other',
]);

export type CreateProjectType = z.infer<typeof CreateProjectTypeSchema>;

export const CreateProjectStatusSchema = z.enum([
  'idea',
  'planning',
  'in_progress',
  'revising',
  'complete',
  'archived',
]);

export type CreateProjectStatus = z.infer<typeof CreateProjectStatusSchema>;

export const CreateProjectSortBySchema = z.enum([
  'created_at',
  'updated_at',
  'deadline',
  'priority',
  'title',
]);

export type CreateProjectSortBy = z.infer<typeof CreateProjectSortBySchema>;

export const CreateSortDirectionSchema = z.enum(['ASC', 'DESC']);

export type CreateSortDirection = z.infer<typeof CreateSortDirectionSchema>;

export const CreateProjectRecordSchema = z.object({
  id: z.string(),
  title: NonEmptyStringSchema,
  type: CreateProjectTypeSchema,
  description_md: NullableTextSchema,
  status: CreateProjectStatusSchema,
  priority: z.number().int().min(0),
  deadline: NullableTextSchema,
  estimated_hours: z.number().nonnegative().nullable(),
  actual_hours: z.number().nonnegative(),
  tools_used: StringArraySchema,
  collaborators: StringArraySchema,
  outcome_notes: NullableTextSchema,
  published_url: NullableTextSchema,
  satisfaction_rating: z.number().int().min(1).max(5).nullable(),
  cover_photo_id: z.string().nullable(),
  inspiration_refs: StringArraySchema,
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type CreateProjectRecord = z.infer<typeof CreateProjectRecordSchema>;

export const CreateProjectInputSchema = z.object({
  title: NonEmptyStringSchema,
  type: CreateProjectTypeSchema,
  description_md: z.string().optional(),
  status: CreateProjectStatusSchema.optional(),
  priority: z.number().int().min(0).optional(),
  deadline: z.string().optional(),
  estimated_hours: z.number().nonnegative().optional(),
  actual_hours: z.number().nonnegative().optional(),
  tools_used: StringArraySchema.optional(),
  collaborators: StringArraySchema.optional(),
  outcome_notes: z.string().optional(),
  published_url: z.string().optional(),
  satisfaction_rating: z.number().int().min(1).max(5).optional(),
  cover_photo_id: z.string().optional(),
  inspiration_refs: StringArraySchema.optional(),
  started_at: z.string().optional(),
  completed_at: z.string().optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;

export const UpdateCreateProjectInputSchema = z.object({
  title: NonEmptyStringSchema.optional(),
  type: CreateProjectTypeSchema.optional(),
  description_md: NullableTextSchema.optional(),
  status: CreateProjectStatusSchema.optional(),
  priority: z.number().int().min(0).optional(),
  deadline: NullableTextSchema.optional(),
  estimated_hours: z.number().nonnegative().nullable().optional(),
  actual_hours: z.number().nonnegative().optional(),
  tools_used: StringArraySchema.optional(),
  collaborators: StringArraySchema.optional(),
  outcome_notes: NullableTextSchema.optional(),
  published_url: NullableTextSchema.optional(),
  satisfaction_rating: z.number().int().min(1).max(5).nullable().optional(),
  cover_photo_id: z.string().nullable().optional(),
  inspiration_refs: StringArraySchema.optional(),
  started_at: NullableTextSchema.optional(),
  completed_at: NullableTextSchema.optional(),
});

export type UpdateCreateProjectInput = z.infer<
  typeof UpdateCreateProjectInputSchema
>;

export const ListCreateProjectsInputSchema = z.object({
  status: CreateProjectStatusSchema.optional(),
  type: CreateProjectTypeSchema.optional(),
  search: z.string().trim().min(1).optional(),
  sort_by: CreateProjectSortBySchema.optional(),
  sort_dir: CreateSortDirectionSchema.optional(),
  limit: z.number().int().positive().max(500).optional(),
  offset: z.number().int().min(0).optional(),
});

export type ListCreateProjectsInput = z.infer<
  typeof ListCreateProjectsInputSchema
>;

export const CreateProgressMoodSchema = z.enum([
  'focused',
  'flowing',
  'struggling',
  'grinding',
  'inspired',
  'frustrated',
]);

export type CreateProgressMood = z.infer<typeof CreateProgressMoodSchema>;

export const CreateProgressEntryRecordSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  date: z.string(),
  notes_md: NullableTextSchema,
  hours_spent: z.number().nonnegative(),
  milestone: z.boolean(),
  milestone_name: NullableTextSchema,
  roadblock: NullableTextSchema,
  breakthrough: NullableTextSchema,
  mood: CreateProgressMoodSchema.nullable(),
  photo_ids: StringArraySchema,
  created_at: z.string(),
});

export type CreateProgressEntryRecord = z.infer<
  typeof CreateProgressEntryRecordSchema
>;

export const CreateProgressEntryInputSchema = z.object({
  project_id: z.string().min(1),
  date: z.string().optional(),
  notes_md: z.string().optional(),
  hours_spent: z.number().nonnegative().optional(),
  milestone: z.boolean().optional(),
  milestone_name: z.string().optional(),
  roadblock: z.string().optional(),
  breakthrough: z.string().optional(),
  mood: CreateProgressMoodSchema.optional(),
  photo_ids: StringArraySchema.optional(),
});

export type CreateProgressEntryInput = z.infer<
  typeof CreateProgressEntryInputSchema
>;

export const UpdateCreateProgressEntryInputSchema = z.object({
  date: z.string().optional(),
  notes_md: NullableTextSchema.optional(),
  hours_spent: z.number().nonnegative().optional(),
  milestone: z.boolean().optional(),
  milestone_name: NullableTextSchema.optional(),
  roadblock: NullableTextSchema.optional(),
  breakthrough: NullableTextSchema.optional(),
  mood: CreateProgressMoodSchema.nullable().optional(),
  photo_ids: StringArraySchema.optional(),
});

export type UpdateCreateProgressEntryInput = z.infer<
  typeof UpdateCreateProgressEntryInputSchema
>;
