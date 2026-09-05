import { z } from 'zod';

export const TranscriptionStatusSchema = z.enum(['pending', 'transcribing', 'complete', 'failed']);
export type TranscriptionStatus = z.infer<typeof TranscriptionStatusSchema>;

export const TranscriptionSourceSchema = z.enum(['voice', 'manual']);
export type TranscriptionSource = z.infer<typeof TranscriptionSourceSchema>;

export const VoiceRecordingSchema = z.object({
  id: z.string(),
  entryId: z.string(),
  filePath: z.string(),
  durationMs: z.number().int().min(0),
  fileSizeBytes: z.number().int().min(0),
  transcription: z.string().nullable(),
  transcriptionStatus: TranscriptionStatusSchema,
  keepAudio: z.boolean(),
  createdAt: z.string(),
});
export type VoiceRecording = z.infer<typeof VoiceRecordingSchema>;

export const CreateVoiceRecordingInputSchema = z.object({
  entryId: z.string(),
  filePath: z.string(),
  durationMs: z.number().int().min(0).default(0),
  fileSizeBytes: z.number().int().min(0).default(0),
  keepAudio: z.boolean().default(true),
});
export type CreateVoiceRecordingInput = z.input<typeof CreateVoiceRecordingInputSchema>;

export interface TranscriptionResult {
  text: string;
  isPartial: boolean;
}

export interface RecordingConfig {
  maxDurationMs: number;
  format: 'aac';
  bitrate: number;
  channels: 1;
  sampleRate: number;
}

export const DEFAULT_RECORDING_CONFIG: RecordingConfig = {
  maxDurationMs: 600_000, // 10 minutes
  format: 'aac',
  bitrate: 64_000,
  channels: 1,
  sampleRate: 44_100,
};

export const MAX_AUDIO_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
