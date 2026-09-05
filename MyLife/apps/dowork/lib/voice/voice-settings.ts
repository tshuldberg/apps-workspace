// Voice-control settings for the DoWork player, persisted to the shared
// hub_settings KV (same store the workouts settings use). Consumed by the
// player screen (useVoiceCoach + seek buttons) and the Settings tab.

import { z } from 'zod';
import type { DatabaseAdapter } from '@mylife/db';

export const SEEK_SECOND_OPTIONS = [5, 10, 15, 30] as const;
export type SeekSeconds = (typeof SEEK_SECOND_OPTIONS)[number];

export const VoiceSettingsSchema = z.object({
  enabled: z.boolean(),
  seekSeconds: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(30)]),
});

export type VoiceSettings = z.infer<typeof VoiceSettingsSchema>;

// Voice control ships ON: the marquee feature is hands-free playback, and the
// user can opt out from Settings or by denying the OS mic prompt.
export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  enabled: true,
  seekSeconds: 10,
};

const SETTINGS_KEY = 'voice.player.settings';

function readHubSetting(db: DatabaseAdapter, key: string): string | null {
  const rows = db.query<{ value: string }>(
    'SELECT value FROM hub_settings WHERE key = ? LIMIT 1',
    [key],
  );
  return rows[0]?.value ?? null;
}

function writeHubSetting(db: DatabaseAdapter, key: string, value: string): void {
  db.execute(
    `INSERT INTO hub_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

// Any malformed/partial persisted value falls back field-by-field to the
// defaults rather than throwing, so a bad row never bricks the player.
export function normalizeVoiceSettings(raw: unknown): VoiceSettings {
  const parsed = VoiceSettingsSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  const data = (typeof raw === 'object' && raw != null ? raw : {}) as Partial<VoiceSettings>;
  const seek = SEEK_SECOND_OPTIONS.includes(data.seekSeconds as SeekSeconds)
    ? (data.seekSeconds as SeekSeconds)
    : DEFAULT_VOICE_SETTINGS.seekSeconds;
  return {
    enabled: typeof data.enabled === 'boolean' ? data.enabled : DEFAULT_VOICE_SETTINGS.enabled,
    seekSeconds: seek,
  };
}

export function getVoiceSettings(db: DatabaseAdapter): VoiceSettings {
  const raw = readHubSetting(db, SETTINGS_KEY);
  if (!raw) return DEFAULT_VOICE_SETTINGS;
  try {
    return normalizeVoiceSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_VOICE_SETTINGS;
  }
}

export function setVoiceSettings(db: DatabaseAdapter, settings: VoiceSettings): VoiceSettings {
  const normalized = normalizeVoiceSettings(settings);
  writeHubSetting(db, SETTINGS_KEY, JSON.stringify(normalized));
  return normalized;
}
