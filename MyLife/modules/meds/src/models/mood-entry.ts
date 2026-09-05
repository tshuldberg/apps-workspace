import { z } from 'zod';

// -- Energy level enum -------------------------------------------------------
export const EnergyLevelSchema = z.enum(['high', 'low']);
export type EnergyLevel = z.infer<typeof EnergyLevelSchema>;

// -- Pleasantness enum -------------------------------------------------------
export const PleasantnessSchema = z.enum(['pleasant', 'unpleasant', 'neutral']);
export type Pleasantness = z.infer<typeof PleasantnessSchema>;

// -- Full mood entry record --------------------------------------------------
export const MoodEntrySchema = z.object({
  id: z.string(),
  mood: z.string(),
  energyLevel: EnergyLevelSchema,
  pleasantness: PleasantnessSchema,
  intensity: z.number().int().min(1).max(5),
  notes: z.string().nullable(),
  recordedAt: z.string(),
  createdAt: z.string(),
});

// -- Create input ------------------------------------------------------------
export const CreateMoodEntryInputSchema = z.object({
  mood: z.string().min(1),
  energyLevel: EnergyLevelSchema,
  pleasantness: PleasantnessSchema,
  intensity: z.number().int().min(1).max(5).optional(),
  notes: z.string().optional(),
  recordedAt: z.string().optional(),
});

// -- Mood activity (linked to mood entry) ------------------------------------
export const MoodActivitySchema = z.object({
  id: z.string(),
  moodEntryId: z.string(),
  activity: z.string(),
  createdAt: z.string(),
});

// -- Create activity input ---------------------------------------------------
export const CreateMoodActivityInputSchema = z.object({
  moodEntryId: z.string().min(1),
  activity: z.string().min(1),
});

// -- Mood calendar entry (for year-in-pixels) --------------------------------
export const MoodCalendarEntrySchema = z.object({
  date: z.string(),
  dominantMood: z.string().nullable(),
  pleasantness: PleasantnessSchema.nullable(),
  color: z.string(),
  hasData: z.boolean(),
});

// -- Daily mood summary ------------------------------------------------------
export const DailyMoodSummarySchema = z.object({
  date: z.string(),
  entries: z.array(MoodEntrySchema),
  activities: z.array(z.string()),
  dominantMood: z.string().nullable(),
  averageIntensity: z.number().nullable(),
});

// -- Inferred types ----------------------------------------------------------
export type MoodEntry = z.infer<typeof MoodEntrySchema>;
export type CreateMoodEntryInput = z.infer<typeof CreateMoodEntryInputSchema>;
export type MoodActivity = z.infer<typeof MoodActivitySchema>;
export type CreateMoodActivityInput = z.infer<typeof CreateMoodActivityInputSchema>;
export type MoodCalendarEntry = z.infer<typeof MoodCalendarEntrySchema>;
export type DailyMoodSummary = z.infer<typeof DailyMoodSummarySchema>;
