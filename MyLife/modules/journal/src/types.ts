import { z } from 'zod';

export const JournalMoodSchema = z.enum(['low', 'okay', 'good', 'great', 'grateful']);
export type JournalMood = z.infer<typeof JournalMoodSchema>;

export const JournalPromptCategorySchema = z.enum([
  'reflection',
  'gratitude',
  'therapy',
  'stoic',
]);
export type JournalPromptCategory = z.infer<typeof JournalPromptCategorySchema>;

export const JournalNotebookSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  color: z.string().nullable(),
  isDefault: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type JournalNotebook = z.infer<typeof JournalNotebookSchema>;

export const EntryTypeSchema = z.enum(['standard', 'therapy_prep']);
export type EntryType = z.infer<typeof EntryTypeSchema>;

export const TranscriptionSourceSchema = z.enum(['voice', 'manual']);

export const TherapyTemplateTypeSchema = z.enum([
  'pre_session', 'post_session', 'crisis_plan', 'progress_checkin',
]);

export const JournalEntrySchema = z.object({
  id: z.string(),
  journalId: z.string(),
  entryDate: z.string(),
  title: z.string().nullable(),
  body: z.string(),
  tags: z.array(z.string()),
  mood: JournalMoodSchema.nullable(),
  imageUris: z.array(z.string()),
  wordCount: z.number().int(),
  // Voice-to-text
  audioPath: z.string().nullable(),
  audioDurationMs: z.number().int().nullable(),
  transcriptionSource: TranscriptionSourceSchema.nullable(),
  // Metadata
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  placeName: z.string().nullable(),
  timezone: z.string().nullable(),
  weatherTempC: z.number().nullable(),
  weatherDescription: z.string().nullable(),
  weatherIcon: z.string().nullable(),
  // Therapy
  entryType: EntryTypeSchema,
  therapySessionNumber: z.number().int().nullable(),
  therapyTemplateType: TherapyTemplateTypeSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type JournalEntry = z.infer<typeof JournalEntrySchema>;

export const JournalTagSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  createdAt: z.string(),
});
export type JournalTag = z.infer<typeof JournalTagSchema>;

export const JournalSettingSchema = z.object({
  key: z.string(),
  value: z.string(),
});
export type JournalSetting = z.infer<typeof JournalSettingSchema>;

export const JournalPromptSchema = z.object({
  id: z.string(),
  category: JournalPromptCategorySchema,
  prompt: z.string(),
});
export type JournalPrompt = z.infer<typeof JournalPromptSchema>;

export const JournalSearchResultSchema = JournalEntrySchema.extend({
  matchedTagNames: z.array(z.string()),
});
export type JournalSearchResult = z.infer<typeof JournalSearchResultSchema>;

export const JournalOnThisDayItemSchema = JournalEntrySchema.extend({
  yearsAgo: z.number().int(),
});
export type JournalOnThisDayItem = z.infer<typeof JournalOnThisDayItemSchema>;

export const JournalDashboardSchema = z.object({
  entryCount: z.number().int(),
  currentStreak: z.number().int(),
  longestStreak: z.number().int(),
  totalWords: z.number().int(),
  monthlyWords: z.number().int(),
  latestMood: JournalMoodSchema.nullable(),
  journalCount: z.number().int(),
});
export type JournalDashboard = z.infer<typeof JournalDashboardSchema>;

export const CreateJournalNotebookInputSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().nullable().default(null),
  color: z.string().nullable().default(null),
  isDefault: z.boolean().default(false),
});
export type CreateJournalNotebookInput = z.input<typeof CreateJournalNotebookInputSchema>;

export const CreateJournalEntryInputSchema = z.object({
  journalId: z.string().optional(),
  entryDate: z.string().optional(),
  title: z.string().nullable().default(null),
  body: z.string().min(1),
  tags: z.array(z.string()).default([]),
  mood: JournalMoodSchema.nullable().default(null),
  imageUris: z.array(z.string()).default([]),
});
export type CreateJournalEntryInput = z.input<typeof CreateJournalEntryInputSchema>;

export const UpdateJournalEntryInputSchema = z.object({
  journalId: z.string().optional(),
  entryDate: z.string().optional(),
  title: z.string().nullable().optional(),
  body: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  mood: JournalMoodSchema.nullable().optional(),
  imageUris: z.array(z.string()).optional(),
});
export type UpdateJournalEntryInput = z.input<typeof UpdateJournalEntryInputSchema>;

export const JournalEntryFilterSchema = z.object({
  journalId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  tag: z.string().optional(),
  mood: JournalMoodSchema.optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});
export type JournalEntryFilter = z.input<typeof JournalEntryFilterSchema>;

export interface JournalExportBundle {
  journals: JournalNotebook[];
  entries: JournalEntry[];
  tags: JournalTag[];
  settings: JournalSetting[];
  onThisDay: JournalOnThisDayItem[];
}
