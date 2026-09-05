import { z } from 'zod';

// ── Transcription ─────────────────────────────────────────────────────

export const TranscriptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  durationSeconds: z.number(),
  language: z.string().nullable(),
  confidence: z.number().nullable(),
  audioUri: z.string().nullable(),
  createdAt: z.string(),
});
export type Transcription = z.infer<typeof TranscriptionSchema>;

// ── Voice Note ────────────────────────────────────────────────────────

export const VoiceNoteSchema = z.object({
  id: z.string(),
  title: z.string(),
  transcriptionId: z.string().nullable(),
  tags: z.string().nullable(),
  isFavorite: z.boolean(),
  createdAt: z.string(),
});
export type VoiceNote = z.infer<typeof VoiceNoteSchema>;

// ── Voice Setting ─────────────────────────────────────────────────────

export const VoiceSettingSchema = z.object({
  key: z.string(),
  value: z.string(),
});
export type VoiceSetting = z.infer<typeof VoiceSettingSchema>;

// ── Transcription Stats ───────────────────────────────────────────────

export const TranscriptionStatsSchema = z.object({
  totalCount: z.number(),
  totalDurationSeconds: z.number(),
  avgDurationSeconds: z.number(),
  byLanguage: z.array(
    z.object({
      language: z.string(),
      count: z.number(),
    }),
  ),
});
export type TranscriptionStats = z.infer<typeof TranscriptionStatsSchema>;

// ── Speaker ──────────────────────────────────────────────────────────

export const SpeakerSchema = z.object({
  id: z.string(),
  name: z.string(),
  voicePrintHash: z.string().nullable(),
  sampleCount: z.number(),
  color: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Speaker = z.infer<typeof SpeakerSchema>;

// ── Speaker Segment ──────────────────────────────────────────────────

export const SpeakerSegmentSchema = z.object({
  id: z.string(),
  transcriptionId: z.string(),
  speakerId: z.string().nullable(),
  speakerLabel: z.string(),
  startSeconds: z.number(),
  endSeconds: z.number(),
  text: z.string(),
  confidence: z.number().nullable(),
  createdAt: z.string(),
});
export type SpeakerSegment = z.infer<typeof SpeakerSegmentSchema>;

// ── Voice Command ─────────────────────────────────────────────────────

export const VoiceCommandSchema = z.object({
  id: z.string(),
  phrase: z.string(),
  action: z.string(),
  moduleTarget: z.string().nullable(),
  params: z.string().nullable(),
  isEnabled: z.boolean(),
  priority: z.number(),
  usageCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type VoiceCommand = z.infer<typeof VoiceCommandSchema>;

// ── Command Log ──────────────────────────────────────────────────────

export const CommandLogSchema = z.object({
  id: z.string(),
  commandId: z.string(),
  matchedPhrase: z.string(),
  matchConfidence: z.number().nullable(),
  executedAt: z.string(),
  success: z.boolean(),
  errorMessage: z.string().nullable(),
});
export type CommandLog = z.infer<typeof CommandLogSchema>;

// ── Language Segment ─────────────────────────────────────────────────

export const LanguageSegmentSchema = z.object({
  id: z.string(),
  transcriptionId: z.string(),
  language: z.string(),
  startSeconds: z.number(),
  endSeconds: z.number(),
  text: z.string(),
  confidence: z.number().nullable(),
  createdAt: z.string(),
});
export type LanguageSegment = z.infer<typeof LanguageSegmentSchema>;

// ── Language Profile ─────────────────────────────────────────────────

export const LanguageProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  languages: z.array(z.string()),
  isDefault: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type LanguageProfile = z.infer<typeof LanguageProfileSchema>;
