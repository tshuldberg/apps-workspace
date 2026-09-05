import { z } from 'zod';

export const SleepWakeFeelingSchema = z.enum([
  'refreshed',
  'groggy',
  'exhausted',
  'energized',
]);

export type SleepWakeFeeling = z.infer<typeof SleepWakeFeelingSchema>;

export const SleepBridgeSettingsSchema = z.object({
  moodEnabled: z.boolean(),
  habitsEnabled: z.boolean(),
  healthEnabled: z.boolean(),
});

export type SleepBridgeSettings = z.infer<typeof SleepBridgeSettingsSchema>;

export const DEFAULT_SLEEP_BRIDGE_SETTINGS: SleepBridgeSettings = {
  moodEnabled: false,
  habitsEnabled: false,
  healthEnabled: false,
};

export const SleepSettingKeySchema = z.enum([
  'sleep.targetHours',
  'dream.dictionaryNotes',
  'bridge.mood.enabled',
  'bridge.habits.enabled',
  'bridge.health.enabled',
]);

export type SleepSettingKey = z.infer<typeof SleepSettingKeySchema>;

export const SleepSettingSchema = z.object({
  key: SleepSettingKeySchema,
  value: z.string(),
});

export type SleepSetting = z.infer<typeof SleepSettingSchema>;

export const SleepModuleStatusSchema = z.object({
  releaseState: z.literal('hidden'),
  schemaVersion: z.literal(1),
  accentColor: z.literal('#A78BFA'),
});

export type SleepModuleStatus = z.infer<typeof SleepModuleStatusSchema>;

export const DEFAULT_SLEEP_MODULE_STATUS: SleepModuleStatus = {
  releaseState: 'hidden',
  schemaVersion: 1,
  accentColor: '#A78BFA',
};
